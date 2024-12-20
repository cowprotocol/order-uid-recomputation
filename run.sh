#!/bin/bash

set -o errexit -o nounset -o pipefail

base_path="$(dirname "$(realpath -s "$0")")/src"

deno run \
  --deny-read \
  --deny-env \
  --allow-net="api.cow.fi" \
  -- \
  "$base_path/hash-uid.ts" \
  "$@"
