#!/bin/bash
# ./dev.sh          desktop shell reading web/ live (Cmd+R reloads the page after an edit)
# ./dev.sh browser  serve web/ for Chrome or Edge at http://localhost:8765
cd "$(dirname "$0")"
if [ "$1" = browser ]; then
  exec python3 -m http.server 8765 --bind 127.0.0.1 -d web
fi
export PATH="$HOME/.cargo/bin:$PATH"
cd app && MM_WEB="$PWD/../web" cargo run
