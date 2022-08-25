#!/usr/bin/env bash
set -e
dir=$(cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
cd "${dir}"
cd ..
rm -rf dist lambda.zip
mkdir -p dist
cp -r deploy index.js package.json README.md dist
cd dist
npm i --production
zip -qr ../lambda.zip deploy index.js package.json README.md node_modules
