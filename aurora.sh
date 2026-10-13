#!/usr/bin/env bash
# Compatibility wrapper. The cross-platform supervisor lives in scripts/start.mjs.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
exec node scripts/start.mjs "$@"
