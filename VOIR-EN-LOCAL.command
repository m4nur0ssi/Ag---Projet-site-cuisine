#!/bin/bash
# Lance le site en local puis l'ouvre dans le navigateur (script créé par Claude).
cd "$(dirname "$0")"
( sleep 25; open "http://localhost:3000" ) &
echo "→ Démarrage du site local… (garde cette fenêtre ouverte)"
npm run dev
