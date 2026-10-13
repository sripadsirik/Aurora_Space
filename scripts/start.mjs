#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { parseEnv } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stateDir = join(root, '.aurora');
const lockDir = join(stateDir, 'launcher');
const stateFile = join(lockDir, 'state.json');
const backend = join(root, 'backend');
const frontend = join(root, 'frontend');
const compose = ['compose', '-f', join(root, 'infra/docker-compose.yml')];
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const say = (message) => console.log(`\n  AURORA  ${message}`);

export function optionsFrom(args) {
  const unknown = args.filter((arg) => !['--demo', '--engine=go', '--engine=rust', '--help', 'start', 'stop', 'status'].includes(arg));
  if (unknown.length) throw new Error(`Unknown option: ${unknown.join(', ')}. Use npm start -- --help.`);
  return { demo: args.includes('--demo'), engine: args.includes('--engine=rust') ? 'rust' : 'go', command: args.find((arg) => ['stop', 'status'].includes(arg)) ?? 'start' };
}

export async function waitUntil(check, { timeout = 60_000, interval = 500, signal, label = 'service' } = {}) {
  const deadline = Date.now() + timeout;
  while (!signal?.aborted) {
    if (await check()) return;
    if (Date.now() >= deadline) throw new Error(`${label} did not become ready within ${Math.round(timeout / 1000)} seconds.`);
    await wait(interval);
  }
  throw new Error('Startup cancelled.');
}

async function readEnv(path) {
  try { return parseEnv(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
}

async function portAvailable(port) {
  return new Promise((done) => {
    const server = createTcpServer();
    server.once('error', () => done(false));
    server.listen(port, '127.0.0.1', () => server.close(() => done(true)));
  });
}

async function control(command) {
  let state;
  try { state = JSON.parse(await readFile(stateFile, 'utf8')); }
  catch { say('No Aurora session is running.'); return; }
  try {
    const response = await fetch(`http://127.0.0.1:${state.controlPort}/${command}`, {
      method: command === 'stop' ? 'POST' : 'GET',
      headers: { authorization: `Bearer ${state.token}` }, signal: AbortSignal.timeout(3000)
    });
    if (!response.ok) throw new Error('Control request rejected');
    say(await response.text());
  } catch { say('The previous session is no longer responding. Start again with npm start.'); }
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log('Aurora — one terminal\n\n  npm start                   Live stack (Docker + Go + frontend)\n  npm run demo                3D demo, only Node.js needed\n  npm start -- --engine=rust   Use the Rust orbital engine (requires Cargo + CMake)\n  npm run status              Show current session\n  npm stop                    Stop the current session\n\nCtrl+C stops all services started by this launcher. Logs: .aurora/logs/');
    return;
  }
  const options = optionsFrom(process.argv.slice(2));
  if (options.command !== 'start') return control(options.command);
  await mkdir(stateDir, { recursive: true });
  try { await mkdir(lockDir); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let old;
    try { old = JSON.parse(await readFile(stateFile, 'utf8')); } catch { /* launch may still be acquiring lock */ }
    if (!old) throw new Error('Another launch is starting, or a stale .aurora/launcher directory remains. Check npm run status.');
    let alive = true;
    try { process.kill(old.pid, 0); } catch (e) { if (e.code === 'ESRCH') alive = false; }
    if (alive) throw new Error('Aurora is already running. Use npm run status or npm stop.');
    await rm(lockDir, { recursive: true, force: true });
    await mkdir(lockDir);
  }
  const controller = new AbortController();
  const children = new Set();
  const logs = new Set();
  let infraOwned = [];
  let stopping = false;
  let controlServer;
  let grafanaPort = 3001;
  let prometheusPort = 9090;
  let sessionStatus = 'Starting Aurora…';
  let shutdownPromise;

  function kill(child, signal = 'SIGTERM') {
    if (child.exitCode !== null || child.signalCode !== null) return;
    try {
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      else process.kill(-child.pid, signal);
    } catch { /* already exited */ }
  }

  function launch(name, command, args, { cwd = root, env = process.env, service = false, quiet = false, allowStopping = false } = {}) {
    if (stopping && !allowStopping) throw new Error('Startup cancelled.');
    const child = spawn(command, args, { cwd, env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    children.add(child);
    const log = createWriteStream(join(stateDir, 'logs', `${name}.log`), { flags: 'a' });
    logs.add(log);
    let output = '';
    for (const stream of [child.stdout, child.stderr]) {
      createInterface({ input: stream }).on('line', (line) => {
        output = (output + line + '\n').slice(-32_000);
        log.write(`${line}\n`);
        if (!quiet) console.log(`  [${name}] ${line}`);
      });
    }
    const done = new Promise((resolveDone) => {
      child.once('error', (error) => resolveDone({ code: 1, output: error.message }));
      child.once('close', (code) => resolveDone({ code, output }));
    }).then((result) => {
      children.delete(child); log.end(); logs.delete(log);
      if (service && !stopping) {
        console.error(`\n  ${name} exited unexpectedly (${result.code}). See .aurora/logs/${name}.log`);
        void shutdown(1);
      }
      return result;
    });
    return { child, done };
  }

  async function run(name, command, args, config = {}) {
    const result = await launch(name, command, args, config).done;
    if (result.code !== 0) throw new Error(`${name} failed. ${result.output.slice(-1200)}`);
    return result.output;
  }

  function shutdown(code = 0) {
    if (shutdownPromise) return shutdownPromise;
    stopping = true;
    controller.abort();
    shutdownPromise = (async () => {
      say('Stopping this session…');
      controlServer?.close();
      for (const child of children) kill(child);
      for (let attempt = 0; children.size && attempt < 30; attempt++) await wait(100);
      for (const child of children) kill(child, 'SIGKILL');
      if (infraOwned.length) {
        await run('infra-stop', 'docker', [...compose, 'stop', '-t', '5', ...infraOwned], { quiet: true, allowStopping: true }).catch((error) => console.error(error.message));
      }
      for (const stream of logs) stream.end();
      await rm(lockDir, { recursive: true, force: true });
      say('Stopped. Logs are saved in .aurora/logs/.');
      process.exitCode = code;
    })();
    return shutdownPromise;
  }
  process.once('SIGINT', () => { void shutdown(); });
  process.once('SIGTERM', () => { void shutdown(); });

  try {
    await mkdir(join(stateDir, 'logs'), { recursive: true });
    const token = randomBytes(24).toString('hex');
    controlServer = createServer((request, response) => {
      if (request.headers.authorization !== `Bearer ${token}`) { response.writeHead(403); response.end(); return; }
      if (request.url === '/stop' && request.method === 'POST') {
        response.end('Stopping Aurora…'); void shutdown();
      } else { response.end(sessionStatus); }
    });
    await new Promise((done, reject) => {
      controlServer.once('error', reject);
      controlServer.listen(0, '127.0.0.1', done);
    });
    await writeFile(stateFile, JSON.stringify({ pid: process.pid, controlPort: controlServer.address().port, token }), { mode: 0o600 });
    const backendEnv = { ...await readEnv(join(backend, '.env')), ...process.env };
    backendEnv.SPACETRACK_CACHE_PATH ||= join(stateDir, "cdm-current-v1.json");
    const wsPort = Number(backendEnv.WS_PORT || 8080);
    const frontendPort = Number(process.env.AURORA_PORT || 5173);
    const metrics = [['GATEWAY', 2112], [options.engine === 'rust' ? 'ENGINE_RUST' : 'ENGINE', options.engine === 'rust' ? 2117 : 2114], ['NOAA', 2113], ['CELESTRAK', 2115]];
    if (backendEnv.SPACETRACK_USERNAME && backendEnv.SPACETRACK_PASSWORD) metrics.push(['SPACETRACK', 2116]);
    const ports = options.demo ? [frontendPort] : [frontendPort, wsPort, ...metrics.map(([key, fallback]) => Number(backendEnv[`METRICS_PORT_${key}`] || fallback))];
    for (const port of ports) {
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid port: ${port}`);
      if (!await portAvailable(port)) throw new Error(`Port ${port} is already in use. Stop the existing service before starting Aurora.`);
    }
    const npmCli = process.env.npm_execpath;
    const npmCommand = npmCli ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
    const npmArgs = npmCli ? [npmCli] : [];
    if (!existsSync(join(frontend, 'node_modules', '.bin', 'vite'))) {
      say('Installing frontend dependencies…');
      await run('install', npmCommand, [...npmArgs, 'ci'], { cwd: frontend });
    }

    if (!options.demo) {
      say('Checking the live stack…');
      await run('go', 'go', ['version'], { quiet: true });
      let dockerReady = await launch('docker-check', 'docker', ['info'], { quiet: true }).done;
      if (dockerReady.code !== 0 && process.platform === 'darwin' && existsSync('/Applications/Docker.app')) {
        say('Starting Docker Desktop…');
        await run('docker-open', 'open', ['-a', 'Docker'], { quiet: true });
        await waitUntil(async () => (await launch('docker-check', 'docker', ['info'], { quiet: true }).done).code === 0,
          { timeout: 120_000, interval: 2000, signal: controller.signal, label: 'Docker Desktop' });
      } else if (dockerReady.code !== 0) throw new Error('Start Docker Desktop, then run npm start again. For a frontend-only preview: npm run demo.');
      const existing = (await run('infra-status', 'docker', [...compose, 'ps', '--services', '--status', 'running'], { quiet: true })).trim().split(/\s+/);
      for (const [service, containerPort, variable, preferred] of [['grafana', 3000, 'AURORA_GRAFANA_PORT', 3001], ['prometheus', 9090, 'AURORA_PROMETHEUS_PORT', 9090]]) {
        let port = Number(process.env[variable] || preferred);
        if (existing.includes(service)) {
          const address = await run('infra-port', 'docker', [...compose, 'port', service, String(containerPort)], { quiet: true });
          port = Number(address.trim().split(':').at(-1));
        } else {
          while (!await portAvailable(port) && port < preferred + 100) port++;
          if (!await portAvailable(port)) throw new Error(`No free local port for ${service}.`);
        }
        process.env[variable] = String(port);
        if (service === 'grafana') grafanaPort = port;
        else prometheusPort = port;
      }
      infraOwned = ['zookeeper', 'kafka', 'prometheus', 'grafana'].filter((name) => !existing.includes(name));
      say('Starting Kafka and monitoring…');
      await run('infra', 'docker', [...compose, 'up', '-d', '--wait', '--wait-timeout', '120']);
      await run('kafka-ready', 'docker', [...compose, 'exec', '-T', 'kafka', 'kafka-topics', '--bootstrap-server', 'localhost:29092', '--list'], { quiet: true });
      await mkdir(join(stateDir, 'bin'), { recursive: true });
      const services = [['gateway', './gateway'], ['celestrak', './ingestion/celestrak'], ['noaa', './ingestion/noaa']];
      if (options.engine === 'go') services.push(['engine', './engine']);
      if (backendEnv.SPACETRACK_USERNAME && backendEnv.SPACETRACK_PASSWORD) services.push(['spacetrack', './ingestion/spacetrack']);
      else say('Space-Track credentials are absent; conjunctions stay clearly labeled as sample data.');
      say(`Building backend (${options.engine} orbital engine)…`);
      for (const [name, target] of services) {
        await run(`build-${name}`, 'go', ['build', '-o', join(stateDir, 'bin', name + (process.platform === 'win32' ? '.exe' : '')), target], { cwd: backend });
      }
      if (options.engine === 'rust') {
        await run('build-rust', 'cargo', ['build', '--release', '--locked', '--manifest-path', join(backend, 'engine-rust/Cargo.toml')]);
      }
      launch('gateway', join(stateDir, 'bin', process.platform === 'win32' ? 'gateway.exe' : 'gateway'), [], { cwd: backend, env: backendEnv, service: true });
      await waitUntil(async () => {
        try { return (await fetch(`http://127.0.0.1:${wsPort}/health`, { signal: AbortSignal.timeout(1000) })).ok; } catch { return false; }
      }, { signal: controller.signal, label: 'Gateway' });
      for (const [name] of services.filter(([name]) => name !== 'gateway').sort(([a], [b]) => Number(b === 'engine') - Number(a === 'engine'))) {
        launch(name, join(stateDir, 'bin', name + (process.platform === 'win32' ? '.exe' : '')), [], { cwd: backend, env: backendEnv, service: true });
      }
      if (options.engine === 'rust') {
        launch('engine-rust', join(backend, 'engine-rust/target/release', process.platform === 'win32' ? 'engine-rust.exe' : 'engine-rust'), [], { cwd: backend, env: backendEnv, service: true });
      }
    }
    launch('frontend', process.execPath, [join(frontend, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(frontendPort), '--strictPort'], {
      cwd: frontend, service: true,
      env: { ...process.env, VITE_WS_URL: options.demo ? '' : `ws://127.0.0.1:${wsPort}/ws`, VITE_PUBLIC_BASE: '/' }
    });
    await waitUntil(async () => {
      try { return (await fetch(`http://127.0.0.1:${frontendPort}`, { signal: AbortSignal.timeout(1000) })).ok; } catch { return false; }
    }, { signal: controller.signal, label: 'Frontend' });
    sessionStatus = `${options.demo ? 'Demo' : 'Live stack'} ready\n  Dashboard:  http://localhost:${frontendPort}\n${options.demo ? '' : `  Health:     http://localhost:${wsPort}/health\n  Grafana:    http://localhost:${grafanaPort} (admin / aurora)\n  Prometheus: http://localhost:${prometheusPort}\n`}  Ctrl+C stops this session. Logs: .aurora/logs/`;
    say(sessionStatus);
  } catch (error) {
    if (!stopping) console.error(`\n  ${error.message}`);
    await shutdown(stopping ? (process.exitCode ?? 0) : 1);
  }
}

if (process.argv[1] && await realpath(resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
