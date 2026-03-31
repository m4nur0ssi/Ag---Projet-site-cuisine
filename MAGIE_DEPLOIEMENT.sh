#!/bin/bash

# Se déplacer dans le dossier du script
cd "$(dirname "$0")"

# Configuration
NAS_PATH="/Volumes/web/recettes"
SOURCE_DIR="out"

# Couleurs pour le terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

clear
echo "======================================================"
echo "         COUTEAU SUISSE DE CUISINE MAGIQUE (MAC)"
echo "======================================================"
echo ""
echo " 1. MODE TURBO (Sync dernière page + Build + Deploy) - 1 min"
echo " 2. MODE GRIMOIRE (Sync TOTALITÈ + Build + Deploy) - 5 min"
echo " 3. BUILD + DEPLOY UNIQUEMENT (Design seulement)"
echo " 4. TESTER LA CONNEXION AU NAS"
echo " 5. QUITTER"
echo ""
read -p "Votre choix (1-5) : " choice

case $choice in
    1)
        echo -e "\n${BLUE}[1/3] 📥 Synchronisation RAPIDE (Dernières recettes)...${NC}"
        node sync-recipes.js --recent
        if [ $? -ne 0 ]; then echo -e "${RED}❌ Erreur Sync${NC}"; exit 1; fi
        DO_BUILD=true
        ;;
    2)
        echo -e "\n${BLUE}[1/3] 📥 Synchronisation TOTALE...${NC}"
        node sync-recipes.js
        if [ $? -ne 0 ]; then echo -e "${RED}❌ Erreur Sync${NC}"; exit 1; fi
        DO_BUILD=true
        ;;
    3)
        DO_BUILD=true
        ;;
    4)
        if [ -d "$NAS_PATH" ]; then

            echo -e "${GREEN}✅ NAS Accessible sur $NAS_PATH${NC}"
            ls -F "$NAS_PATH"
        else
            echo -e "${RED}❌ NAS Inaccessible.${NC}"
            echo "Assurez-vous de connecter le partage 'web' dans le Finder (Aller > Se connecter au serveur > smb://192.168.1.200)."
        fi
        exit 0
        ;;
    4)
        exit 0
        ;;
    *)
        echo "Choix invalide."
        exit 1
        ;;
esac

if [ "$DO_BUILD" = true ]; then
    echo -e "\n${BLUE}[2/3] 🏗️ Préparation du Grimoire (Build)...${NC}"
    npm run build
    if [ $? -ne 0 ]; then echo -e "${RED}❌ Erreur Build${NC}"; exit 1; fi
    
    echo -e "\n${BLUE}[3/3] 🚀 Transfert vers le NAS...${NC}"
    if [ ! -d "$NAS_PATH" ]; then
        echo -e "${RED}❌ ERREUR : Le NAS n'est pas monté sur $NAS_PATH${NC}"
        echo "Ouvrez le Finder et connectez-vous au serveur smb://192.168.1.200 pour monter le dossier 'web'."
        exit 1
    fi

    if [ -d "$NAS_PATH/_next" ]; then
        echo "🧹 Nettoyage du cache technique..."
        rm -rf "$NAS_PATH/_next"
    fi

    rsync -av --delete "$SOURCE_DIR/" "$NAS_PATH/"
    
    echo -e "\n${GREEN}======================================================"
    echo "✅ MAGIE OPÉRÉE ! Tout est à jour sur ton NAS."
    echo "L'ordre des ingrédients (case à cocher à gauche) est appliqué !"
    echo "Vérifiez sur : http://192.168.1.200/recettes/"
    echo "======================================================"
    echo -e "${NC}"
fi
