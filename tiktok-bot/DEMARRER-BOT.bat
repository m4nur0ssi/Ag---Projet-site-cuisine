@echo off
title TikTok → WordPress BOT
color 0A
echo.
echo  ==========================================
echo   🍽️  TikTok → Recettes Magiques BOT
echo  ==========================================
echo.
cd /d "%~dp0"

REM Vérification Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo  ERREUR : Node.js n'est pas installé !
    echo  Télécharge-le sur : https://nodejs.org
    pause
    exit
)

REM Installation des dépendances si necessaire
if not exist "node_modules" (
    echo  📦 Installation des dépendances...
    npm install
    echo.
)

echo  🚀 Démarrage du serveur...
echo  (Laisse cette fenêtre ouverte - ferme-la pour arrêter le bot)
echo.
node server.js
pause
