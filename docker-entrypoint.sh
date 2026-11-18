#!/bin/sh
# Platform volumes are mounted root-owned. Give the data directory to the unprivileged "node" user,
# then replace this shell with the server running as that user (so it receives SIGINT/SIGTERM directly).
set -e
if [ "$(id -u)" = "0" ]; then
  mkdir -p "${DATA_DIR:-/data}"
  chown -R node:node "${DATA_DIR:-/data}"
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi
exec "$@"
