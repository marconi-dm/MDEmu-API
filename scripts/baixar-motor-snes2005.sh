#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/lab-snes2005
curl -fL 'https://raw.githubusercontent.com/HenryLF/snes9x2005-wasm/main/dist/index.js' -o public/lab-snes2005/snes2005.js
curl -fL 'https://raw.githubusercontent.com/HenryLF/snes9x2005-wasm/main/snes9x2005/snes9x_2005.wasm' -o public/lab-snes2005/snes9x_2005.wasm
node -e "const fs=require('fs');const b=fs.readFileSync('public/lab-snes2005/snes9x_2005.wasm');if(b.subarray(0,4).toString('hex')!=='0061736d')throw Error('WASM inválido')"
echo 'Motor baixado e verificado. Publique public/ na Vercel.'
