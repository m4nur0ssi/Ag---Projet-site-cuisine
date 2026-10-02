#!/bin/bash
# Relance proprement le site local : arrête l'ancien serveur, repart à neuf.
cd "$(dirname "$0")"
echo "→ Arrêt de l'ancien serveur…"
lsof -ti tcp:3000 | xargs -r kill -9 2>/dev/null
pkill -f "next dev" 2>/dev/null
sleep 2
rm -rf .next
echo "→ Redémarrage… (garde cette fenêtre ouverte)"
( sleep 35; open "http://localhost:3000" ) &
npm run dev
