#!/bin/bash

# Git Bundle Packer (ESM 版) - 修复 Buffer polyfill
set -e

EXTENSION_PATH="${1:-$(pwd)}"
BUNDLER_DIR="git-bundler-temp-esm"

echo "🚀 打包 ESM isomorphic-git (修复 Buffer) 到 $EXTENSION_PATH/lib/bundle.js"

rm -rf "$BUNDLER_DIR"
mkdir -p "$BUNDLER_DIR"
cd "$BUNDLER_DIR"

npm init -y
npm install isomorphic-git @isomorphic-git/lightning-fs buffer
npm install --save-dev esbuild

# 生成 src/index.js (加 Buffer 全局 + named exports)
mkdir -p src
cat > src/index.js << 'EOF'
// src/index.js - 暴露 named exports + Buffer polyfill
import * as isomorphicGit from 'isomorphic-git';
import lightningFS from '@isomorphic-git/lightning-fs';
import * as gitHttpWeb from 'isomorphic-git/http/web';
import { Buffer } from 'buffer';

// Buffer polyfill：注入全局 (浏览器/Service Worker 兼容)
if (typeof globalThis !== 'undefined') {
  globalThis.Buffer = Buffer;
}
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
}

// Named exports：直接暴露模块
export { isomorphicGit as git };
export { default as LightningFS } from '@isomorphic-git/lightning-fs';
export { gitHttpWeb as http };
export { Buffer };
EOF

# package.json scripts (ESM)
node -e "
const pkg = require('./package.json');
pkg.scripts = { build: 'esbuild src/index.js --bundle --format=esm --outfile=dist/bundle.js --platform=browser --target=es2020 --minify' };
require('fs').writeFileSync('./package.json', JSON.stringify(pkg, null, 2));
"

# 打包
npm run build

# 检查 & 复制
if [ ! -f "dist/bundle.js" ]; then
  echo "❌ 打包失败！"
  exit 1
fi

LIB_PATH="$EXTENSION_PATH"
mkdir -p "$LIB_PATH"
cp dist/bundle.js "$LIB_PATH/bundle.js"

cd ..
rm -rf "$BUNDLER_DIR"

BUNDLE_SIZE=$(du -h "$LIB_PATH/bundle.js" | cut -f1)
echo "✅ ESM bundle.js (大小: $BUNDLE_SIZE) 已复制！(Buffer 全局化)"
echo "💡 用法: import { git, LightningFS, http as GitHttp, Buffer } from '../lib/bundle.js';"