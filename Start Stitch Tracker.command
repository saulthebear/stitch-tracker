#!/bin/zsh
cd -- "${0:A:h}" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v npm >/dev/null 2>&1; then
  echo "Install Node.js 22.12 or newer, then open this launcher again."
  read -k 1 "?Press any key to close."
  exit 1
fi
if [[ ! -d node_modules ]]; then
  npm ci || exit 1
fi
npm start
if [[ $? -ne 0 ]]; then
  read -k 1 "?The app could not start. Press any key to close."
fi
