#!/usr/bin/env bash
set -e

# 0) проверим зависимости
command -v node >/dev/null || { echo "node is required"; exit 1; }
command -v npx  >/dev/null || { echo "npx is required"; exit 1; }

# 1) установить зависимости во всех пакетах 
npm i

# 2) запустить весь стек
npm run dev