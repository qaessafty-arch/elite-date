#!/bin/sh
# usage: fetch.sh <name e.g. products/foo> <url>
set -e
cd "$(dirname "$0")"
mkdir -p "$(dirname "$1")"
curl -sS -f -o "$1.png" "$2"
file "$1.png" | cut -c1-80
