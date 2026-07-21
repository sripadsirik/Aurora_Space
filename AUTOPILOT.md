# Daily Autopilot — Setup Guide

Runs Claude Code once a day per project, using your Claude Pro subscription
(no per-token billing). It always works via pull request — nothing lands
without your review.

This same workflow file gets copied into every project's repo. Because Claude
Pro's rate limit is per-account (shared across all your repos) and resets on a
rolling ~5 hour window, each project's run is scheduled 5 hours apart so no
two projects are ever competing for the same quota window.

## 1. One-time: Claude Code auth (shared across all projects)

On your own machine, logged into Claude Code with your Pro account:

```
claude setup-token
```

Add the resulting token as a secret in **each** repo you use this in:

`Settings -> Secrets and variables -> Actions -> Secrets -> New repository secret`
- Name: `CLAUDE_CODE_OAUTH_TOKEN`
- Value: (the token)

If it starts failing on auth later, just regenerate with `claude setup-token`
and update the secret in whichever repo is affected.

## 2. Per project: drop in the workflow

Copy `.github/workflows/autopilot.yml` into each project's repo, and set that
project's cron slot (see schedule table below).

## 3. Per project: the on/off switch

`Settings -> Secrets and variables -> Actions -> Variables -> New repository variable`
- Name: `AUTOPILOT_ENABLED`
- Value: `true` or `false`

Flip to `false` on a project any day you want to work on it yourself — that
project's run skips entirely. Everything else stays on schedule. You can also
trigger a run manually any time from the Actions tab regardless of the
schedule.

## 4. Staggered schedule across projects

Pick a starting hour and add 5 hours per project. Times are UTC — convert to
your local time when editing the `cron:` line in each repo's workflow file.
Cron format is `minute hour * * *`.

| Project        | Cron (UTC)     |
|----------------|----------------|
| Aurora_Space   | `0 10 * * *` *(5 AM Central during CDT)* |
| Project 2      | `0 15 * * *`   |
| Project 3      | `0 20 * * *`   |
| Project 4      | `0 1 * * *`    |
| Project 5      | `0 6 * * *` *(wraps back near Aurora_Space — 5 projects is about the practical limit in a day)* |

**Scheduled runs always start late.** GitHub queues scheduled workflows on
shared infrastructure and drops them when it's busy — delays of 10–60+ minutes
are normal, and this repo's very first run landed 67 minutes late. You cannot
configure this away; the cron time is "no earlier than", not "at". Two things
help: avoid the top of the hour (`:00`) and avoid midnight UTC (`0 0 * * *`),
which are by far the most contended slots because everyone schedules there. An
odd minute like `:07` or `:23` is measurably more punctual than `:00`.

Add new projects down this table as you create them; just keep adding 5 hours
and wrapping around midnight.

## 5. Routing work with labels (optional)

Create a label `autopilot:claude` in a repo and tag issues you want it to pick
up. It'll work the oldest open one in that label first. If none exist, it
falls back to: fix failing CI, else pick the day's mode.

## 6. Feature days vs. cleanup days

On days with no failing CI and no labeled issue, the workflow deterministically
picks a mode based on the date: **1 day in 4 is a "feature" day**, the other 3
are "cleanup" days (lint/docs/tests/small refactors). This is calculated from
day-of-year, not random, so it's predictable and repeats the same way every
project runs on its own schedule. On feature days it's told to keep scope to
one small, self-contained feature — not something sprawling, since nobody
reviews it until the PR lands.

To change the ratio, edit the `Decide today's mode` step in the workflow file
(the `% 4` controls it — `% 3` = 1-in-3 feature days, `% 7` = about weekly).

## 7. What you'll see

Every run opens a PR, or does nothing if it found nothing worth doing — it
never pushes to your default branch directly. Review, request changes, or
merge like any other PR.

## Notes

- **The 5-hour rate limit window is shared across ALL your Claude usage** —
  including you coding interactively. If you're mid-session on Project 2 when
  Project 1's autopilot run is scheduled, they'll draw from the same quota.
  The staggering above avoids project-vs-project collisions, but doesn't
  protect against your own concurrent usage — keep that in mind if you code
  heavily right when a run is due.
- `--max-turns` in the workflow's `claude_args` caps how long a single run can
  go. It's set to 250, because the 15-commit-per-run minimum needs a lot of
  turns — the template's original 40 wasn't enough to even reach the first
  push. Lower it if a project's runs are eating too much of the window, but
  lower the commit minimum alongside it.
- `anthropics/claude-code-action` is actively developed and inputs have already
  been renamed once (v1 replaced `direct_prompt` with `prompt`, and folded
  `allowed_tools`/`max_turns` into `claude_args`; `@beta` now points at that v1
  code). If a run errors on inputs, check the current README:
  https://github.com/anthropics/claude-code-action
- The job needs `id-token: write` permission — the action fetches a GitHub OIDC
  token at startup and fails immediately without it.
