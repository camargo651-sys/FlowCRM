#!/bin/bash
# Quick dev commands for Tracktio
case "$1" in
  restart)
    lsof -ti :3000 -ti :3001 2>/dev/null | xargs kill -9 2>/dev/null
    sleep 1; nohup ./start.sh > /dev/null 2>&1 & disown
    sleep 3; echo "✅ Server running on http://localhost:3000"
    ;;
  check)
    echo "🔍 TypeScript..." && npx tsc --noEmit && echo "✅ Types OK"
    echo "🧪 Tests..." && npx vitest run && echo "✅ Tests OK"
    ;;
  build)
    npx next build && echo "✅ Build OK"
    ;;
  deploy)
    npx tsc --noEmit && npx next build && npx vercel@latest --prod && echo "✅ Deployed"
    ;;
  ship)
    # check + commit + push + deploy
    npx tsc --noEmit && npx vitest run && \
    git add -A && git commit -m "$2" && git push && \
    npx vercel@latest --prod && echo "🚀 Shipped!"
    ;;
  *)
    echo "Usage: ./dev.sh [restart|check|build|deploy|ship \"commit msg\"]"
    ;;
esac
