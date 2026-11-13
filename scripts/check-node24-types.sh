#!/usr/bin/env bash
set -euo pipefail
temp_root="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
probe="$temp_root/tandem-node26-only.ts"
printf 'import { create } from "node:vfs"; create();\n' > "$probe"
args=(--ignoreConfig --noEmit --skipLibCheck --module NodeNext --moduleResolution NodeNext --target ES2023 --types node --typeRoots "$PWD/node_modules/@types" "$probe")
pnpm exec tsc "${args[@]}"
pnpm add --save-dev --save-exact --ignore-scripts @types/node@24.13.3
node -e 'if (require("./node_modules/@types/node/package.json").version !== "24.13.3") process.exit(1)'
if pnpm exec tsc "${args[@]}" > "$temp_root/tandem-node24-probe.log" 2>&1; then
  echo 'Node 24 declarations unexpectedly accepted node:vfs'
  exit 1
fi
grep -F 'TS2307' "$temp_root/tandem-node24-probe.log"
grep -F 'node:vfs' "$temp_root/tandem-node24-probe.log"
pnpm typecheck
