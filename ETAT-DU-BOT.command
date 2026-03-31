#!/bin/bash
cd "$(dirname "$0")"
clear
echo "=========================================="
echo "      🔍 ÉTAT DU BOT CUISINE 🪄"
echo "=========================================="
echo ""

# Vérification du processus
PID=$(ps -ef | grep "node server.js" | grep -v grep | awk '{print $2}')

if [ -z "$PID" ]; then
    echo "❌ STATUT : ARRÊTÉ"
    echo "Pour le relancer, utilisez 'LANCER-MAC.command'"
else
    echo "✅ STATUT : EN COURS D'EXÉCUTION"
    echo "PID : $PID"
fi

echo ""
echo "=========================================="
echo "       📜 DERNIÈRES ACTIONS (LOGS) :"
echo "=========================================="
echo ""
# Recherche du fichier de log
LOG_FILE=""
if [ -f "tiktok-bot/bot_server_v3.log" ]; then
    LOG_FILE="tiktok-bot/bot_server_v3.log"
elif [ -f "bot_server_v3.log" ]; then
    LOG_FILE="bot_server_v3.log"
fi

if [ -z "$LOG_FILE" ]; then
    echo "⚠️ Aucun fichier de log trouvé."
else
    tail -n 30 "$LOG_FILE"
fi
echo ""
echo "=========================================="
echo "Appuyez sur une touche pour rafraîchir ou fermer..."
read -n 1
