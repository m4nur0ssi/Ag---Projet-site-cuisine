@echo off
setlocal EnableDelayedExpansion
title Chef Magicien - Deployeur Professionnel

:: --- CONFIGURATION ---
:: On utilise le nom du NAS qui fonctionne dans ton explorateur
set "NAS_NAME=DS211"
set "NAS_PATH=\\%NAS_NAME%\web\recettes"
:: ---------------------

:menu
cls
echo ======================================================
echo          COUTEAU SUISSE DE CUISINE MAGIQUE
echo ======================================================
echo.
echo 1. TOUT FAIRE (Sync WordPress + Build + Deploy)
echo 2. BUILD + DEPLOY UNIQUEMENT (Garder recettes actuelles)
echo 3. TESTER LA CONNEXION AU NAS
echo 4. QUITTER
echo.

set /p Choice="Votre choix (1-4) : "

if "%Choice%"=="4" goto :eof
if "%Choice%"=="3" goto test_nas
if "%Choice%"=="2" goto build
if "%Choice%"=="1" goto sync
goto menu

:test_nas
echo.
echo 📡 Test d'acces a %NAS_PATH%...
if exist "%NAS_PATH%\" (
    echo ✅ Dossier "recettes" accessible !
    dir "%NAS_PATH%" /W
) else (
    echo ❌ Dossier INACCESSIBLE.
    echo Tentative de réveiller le NAS...
    explorer "\\%NAS_NAME%\web"
    echo.
    echo Si une fenetre s'est ouverte sur le NAS, le dossier devrait etre pret.
)
pause
goto menu

:sync
echo.
echo [1/3] 📥 Synchronisation des recettes avec WordPress...
node sync-recipes.js
if %errorlevel% neq 0 (
    echo ❌ ERREUR Sync.
    pause
    goto menu
)

:build
echo.
echo [2/3] 🏗️ Preparation du "Grimoire" (Build)...
call npm run clean-build
if %errorlevel% neq 0 (
    echo ❌ ERREUR Build.
    pause
    goto menu
)

:deploy
echo.
echo [3/3] 🚀 Transfert vers le NAS (%NAS_PATH%)...
if not exist "%NAS_PATH%\" (
    echo ❌ NAS fch : Le dossier recettes est introuvable sur %NAS_PATH%
    pause
    goto menu
)

if exist "%NAS_PATH%\_next" (
    echo 🧹 Nettoyage cache technique...
    rd /s /q "%NAS_PATH%\_next"
)

:: Copie MIROIR (Ecrasement propre)
robocopy out "%NAS_PATH%" /MIR /FFT /Z /W:5 /R:5 /MT:8

echo.
echo ======================================================
echo ✅ MAGIE OPEREE ! Tout est a jour.
echo Verifiez sur : http://192.168.1.200/recettes/
echo ======================================================
pause
goto menu
