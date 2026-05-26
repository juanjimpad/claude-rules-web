#!/bin/sh
set -e
SHA=$(git rev-parse HEAD)
printf '{"sha":"%s"}\n' "$SHA" > web/version.json
wrangler deploy
