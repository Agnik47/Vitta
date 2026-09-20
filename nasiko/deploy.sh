#!/usr/bin/env bash
# The deploy script is Node now, so it runs on macOS, Linux and Windows alike — see nasiko/deploy.js
# for the usage. This wrapper only keeps `bash nasiko/deploy.sh …` working.
exec node "$(cd "$(dirname "$0")" && pwd)/deploy.js" "$@"
