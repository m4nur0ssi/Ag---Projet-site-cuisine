@echo off
echo ==============================================
echo 🚀 LANCEMENT DES RECETTES MAGIQUES 
echo ==============================================
echo.
echo Installation des dependances (si besoin)...
call npm install --legacy-peer-deps

echo Lancement du bot TikTok et du site web simultanement...
call npm run dev
pause
