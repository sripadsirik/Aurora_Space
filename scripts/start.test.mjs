import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optionsFrom, waitUntil } from './start.mjs';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';

test('launcher selects live stack by default and rejects mistyped options', () => {
  assert.deepEqual(optionsFrom([]), { demo: false, engine: 'go', command: 'start' });
  assert.equal(optionsFrom(['--engine=rust']).engine, 'rust');
  assert.equal(optionsFrom(['--demo']).demo, true);
  assert.equal(optionsFrom(['stop']).command, 'stop');
  assert.throws(() => optionsFrom(['--demoo']), /Unknown option/);
});

test('readiness retries until the actual service is ready', async () => {
  let calls = 0;
  await waitUntil(() => ++calls === 3, { timeout: 100, interval: 1 });
  assert.equal(calls, 3);
});

test('readiness fails with the service name and respects cancellation', async () => {
  await assert.rejects(waitUntil(() => false, { timeout: 2, interval: 1, label: 'Kafka' }), /Kafka did not become ready/);
  await assert.rejects(waitUntil(() => false, { signal: AbortSignal.abort() }), /Startup cancelled/);
});

test('a supervised session rejects duplicates, reports status, cleans up, and fails if its service crashes', { timeout: 20_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aurora-launcher-'));
  await mkdir(join(directory, 'scripts'));
  await mkdir(join(directory, 'frontend/node_modules/vite/bin'), { recursive: true });
  await mkdir(join(directory, 'frontend/node_modules/.bin'), { recursive: true });
  await copyFile(new URL('./start.mjs', import.meta.url), join(directory, 'scripts/start.mjs'));
  await writeFile(join(directory, 'frontend/node_modules/.bin/vite'), '');
  // A tiny HTTP child replaces Vite so the supervisor can be tested without Docker
  // or a browser. It still runs as a real, independently supervised process.
  await writeFile(join(directory, 'frontend/node_modules/vite/bin/vite.js'), `
    const http = require('node:http');
    const fs = require('node:fs');
    fs.writeFileSync('../.aurora/test-child-pid', String(process.pid));
    const server = http.createServer((request, response) => response.end('preview'));
    server.listen(Number(process.argv[process.argv.indexOf('--port') + 1]), '127.0.0.1');
  `);
  const portServer = createServer();
  await new Promise((done) => portServer.listen(0, '127.0.0.1', done));
  const port = portServer.address().port;
  await new Promise((done) => portServer.close(done));
  const children = [];
  function cli(...args) {
    const child = spawn(process.execPath, [join(directory, 'scripts/start.mjs'), ...args], {
      env: { ...process.env, AURORA_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe']
    });
    children.push(child);
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    return { child, done: new Promise((done) => child.on('close', (code) => done({ code, output }))) };
  }
  async function reachable() {
    try { return (await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(500) })).ok; } catch { return false; }
  }
  try {
    const session = cli('--demo');
    await waitUntil(reachable, { timeout: 5000, interval: 50 });
    await waitUntil(async () => (await cli('status').done).output.includes('Demo ready'), { timeout: 5000, interval: 50 });
    const duplicate = await cli('--demo').done;
    assert.equal(duplicate.code, 1);
    assert.match(duplicate.output, /already running/);
    await cli('stop').done;
    assert.equal((await session.done).code, 0);
    assert.equal(await reachable(), false);
    await assert.rejects(readFile(join(directory, '.aurora/launcher/state.json')), { code: 'ENOENT' });

    const restarted = cli('--demo');
    await waitUntil(reachable, { timeout: 5000, interval: 50 });
    const servicePid = Number(await readFile(join(directory, '.aurora/test-child-pid'), 'utf8'));
    process.kill(servicePid, 'SIGTERM');
    const result = await restarted.done;
    assert.equal(result.code, 1);
    assert.match(result.output, /frontend exited unexpectedly/);
    await assert.rejects(readFile(join(directory, '.aurora/launcher/state.json')), { code: 'ENOENT' });
  } finally {
    for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
    try { process.kill(Number(await readFile(join(directory, '.aurora/test-child-pid'), 'utf8')), 'SIGTERM'); } catch { /* exited */ }
    await rm(directory, { recursive: true, force: true });
  }
});
