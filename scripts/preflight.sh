#!/usr/bin/env sh
set -eu

command -v node >/dev/null
command -v pnpm >/dev/null
command -v git >/dev/null

node --version
pnpm --version
git --version

pnpm typecheck
pnpm build

echo "Preflight passed. Next: copy .env.example to .env and run pnpm dev."
