/**
 * Ce que les vidéos du tutoriel montrent.
 * =======================================
 *
 * Une scène = une fonctionnalité, filmée en train de servir. Pas de texte
 * incrusté : la bulle ou l'étape du tutoriel porte les mots, la vidéo porte le
 * geste. Chaque scène dure une dizaine de secondes, en boucle.
 */

const { recette, semaine, panier, jour } = require('./recettes');

/**
 * Poser un décor dans le navigateur neuf de la caméra : une semaine remplie,
 * une liste de courses commencée. Sans ça, les écrans réservés aux membres se
 * filment vides — et une vidéo d'écran vide n'apprend rien.
 */
const decor = (cles) => 'try {'
    + Object.entries(cles)
        .map(([cle, valeur]) => `localStorage.setItem(${JSON.stringify(cle)}, ${JSON.stringify(JSON.stringify(valeur))});`)
        .join('\n')
    + '} catch (e) {}';

/** Trois bouteilles en cave, une déjà bue : de quoi montrer le rangement. */
const VINS = [
    { id: 'v1', name: 'Chorey-lès-Beaune', grape: 'Pinot noir', year: '2019', color: 'rouge', region: 'Bourgogne', qty: 3, shelf: 'cave', addedAt: 3 },
    { id: 'v2', name: 'Sancerre Les Monts Damnés', grape: 'Sauvignon blanc', year: '2021', color: 'blanc', region: 'Loire', qty: 1, shelf: 'cave', addedAt: 2 },
    { id: 'v3', name: 'Château Margaux', grape: 'Cabernet Sauvignon', year: '2018', color: 'rouge', region: 'Bordeaux', qty: 2, shelf: 'cave', addedAt: 1 },
    { id: 'v4', name: 'Bandol rosé', grape: 'Mourvèdre', year: '2022', color: 'rose', region: 'Provence', qty: 1, shelf: 'tasted', myRating: 4, addedAt: 0 },
];

const SCENES = {
    recherche: {
        titre: 'Chercher une recette',
        page: '/',
        async jouer(p) {
            await p.attendre(1200);
            const loupe = await p.centre('[class*=isolatedSearchBtn]');
            await p.tap(loupe.x, loupe.y, { apres: 1400 });
            await p.taper('input[class*=spInput]', 'poulet', { cadence: 170 });
            await p.attendre(1400);
            // Et on ouvre le premier résultat : une recherche ne s'arrête pas
            // à la liste.
            const premier = await p.centreParTexte('poulet', '[class*=spItem]');
            await p.tap(premier.x, premier.y, { apres: 3000 });
            await p.attendre(1400);
        },
    },

    filtres: {
        titre: 'Filtrer le menu',
        page: '/',
        async jouer(p) {
            await p.attendre(1200);
            const menu = await p.centre('[class*=heroMenuBtn]');
            await p.tap(menu.x, menu.y, { apres: 1500 });
            // Les filtres sont au bas du volet, sous les raccourcis : on descend.
            await p.evaluer("document.querySelector('[class*=navScroll]').scrollTo({ top: 9999, behavior: 'smooth' })");
            await p.attendre(1300);
            const categories = await p.amener('^\\s*Catégories');
            await p.tap(categories.x, categories.y, { apres: 1000 });
            const desserts = await p.amener('^\\s*Desserts\\s*$');
            await p.tap(desserts.x, desserts.y, { apres: 1300 });
            // On referme les catégories : sans ça, « Pays » finit sous la barre
            // d'action qui vient d'apparaître, et le doigt toucherait celle-ci.
            const replier = await p.amener('^\\s*Catégories');
            await p.tap(replier.x, replier.y, { apres: 1000 });
            const pays = await p.amener('^\\s*Pays');
            await p.tap(pays.x, pays.y, { apres: 1000 });
            const espagne = await p.amener('^\\s*Espagne\\s*$');
            await p.tap(espagne.x, espagne.y, { apres: 1500 });
            // Le compte du bouton dit tout de suite ce que les deux coches donnent.
            const voir = await p.amener('Voir \\d+ recette');
            await p.tap(voir.x, voir.y, { apres: 3000 });
            await p.attendre(1600);
        },
    },

    courses: {
        titre: 'La liste de courses',
        page: '/tv-courses',
        avant: () => decor({
            // Aujourd'hui et demain : « Jour par jour » s'ouvre sur la date du
            // tournage, un décor posé sur un lundi en dur s'y afficherait vide.
            'meal-planner-week': semaine({
                [jour(0)]: { Midi: '6337', Soir: '7455' },
                [jour(1)]: { Soir: '5496' },
            }),
            'magic-shopping-list': panier(['5941']),
        }) + `
            // Partager et le drive du magasin sortent de l'application : le film
            // s'arrêterait sur un onglet vide. La caméra reste dedans — ce que
            // l'application affiche, lui, ne change pas d'un pouce.
            window.open = () => null;`,
        async jouer(p) {
            await p.attendre(2000);
            // Barrer ce qu'on a déjà au placard : le compte de l'en-tête baisse,
            // et l'article sort de ce qui partira au magasin.
            const ligne = await p.centreParTexte('Ail|Concombre|Courgette', '[class*=courseText]');
            await p.tap(ligne.x, ligne.y, { apres: 1800 });
            const jour = await p.amener('^\\s*Par jour');
            await p.tap(jour.x, jour.y, { apres: 2400 });
            const plus = await p.amener('^\\s*En \\+');
            await p.tap(plus.x, plus.y, { apres: 2400 });
            const toute = await p.amener('Tout acheter');
            await p.tap(toute.x, toute.y, { apres: 1800 });
            // La barre du bas : partager la liste, ou la faire dérouler au magasin.
            const magasin = await p.amener('Carrefour|Faire mes courses|Lancer');
            await p.tap(magasin.x, magasin.y, { apres: 2600 });
            await p.attendre(1600);
        },
    },

    'jour-j': {
        titre: 'Le menu du Jour J',
        page: '/tv-planner?mode=jourj',
        // Deux plats déjà là : on filme la fin d'un menu, pas son début, sinon
        // la scène passe son temps à remplir des cases vides.
        avant: () => decor({ 'meal-planner-week': { JourJ: { 'Entrée': recette('6337'), Plat: recette('7455') } } }),
        async jouer(p) {
            await p.attendre(2000);
            // « Surprends-moi » comble un creux du menu sans quitter l'écran :
            // c'est le geste qui montre le mieux à quoi sert cette page.
            const apero = await p.centreParTexte('Surprends-moi');
            await p.tap(apero.x, apero.y, { apres: 2400 });
            const suivant = await p.amener('Surprends-moi');
            await p.tap(suivant.x, suivant.y, { apres: 2400 });
            // Le déroulé range les plats à l'envers du service : on part de
            // l'heure à laquelle on passe à table.
            const deroule = await p.amener('Déroulé de la soirée');
            await p.tap(deroule.x, deroule.y, { apres: 3000 });
            await p.glisser(200, 640, 200, 320, { pas: 22, pause: 26 });
            await p.attendre(2000);
        },
    },

    'mode-cuisine': {
        titre: 'Cuisiner pas à pas',
        page: '/',
        async jouer(p) {
            await p.attendre(1200);
            const loupe = await p.centre('[class*=isolatedSearchBtn]');
            await p.tap(loupe.x, loupe.y, { apres: 1400 });
            await p.taper('input[class*=spInput]', 'Gnocchis Croustillants');
            const resultat = await p.centreParTexte('^Gnocchis Croustillants');
            await p.tap(resultat.x, resultat.y, { avant: 400, apres: 3200 });
            // Le mode cuisine met une étape par écran, en grand : les mains sont
            // dans la farine, on ne cherche pas sa ligne dans un paragraphe.
            const lancer = await p.amener('Lancer la préparation');
            await p.tap(lancer.x, lancer.y, { apres: 2800 });
            const suivant = await p.centreParTexte('Suivant');
            // L'étape suivante porte une durée : le minuteur part de lui-même.
            await p.tap(suivant.x, suivant.y, { apres: 3200 });
            await p.tap(suivant.x, suivant.y, { apres: 3000 });
            await p.attendre(1600);
        },
    },

    assistant: {
        titre: 'Demander à l’assistant',
        page: '/',
        async jouer(p) {
            await p.attendre(1200);
            const loupe = await p.centre('[class*=isolatedSearchBtn]');
            await p.tap(loupe.x, loupe.y, { apres: 1400 });
            // Le troisième onglet ne cherche pas des mots : il lit une envie.
            const onglet = await p.centreParTexte('^Assistant$');
            await p.tap(onglet.x, onglet.y, { apres: 1400 });
            await p.taper('input[class*=spInput], textarea[class*=spInput]',
                'un dîner rapide avec du poulet et du citron', { cadence: 60 });
            // Pas de bouton « envoyer » : la question part avec la touche Entrée.
            await p.touche('Enter', 'input[class*=spInput]');
            await p.attendre(9000);
        },
    },

    'ma-cave': {
        titre: 'Ranger une bouteille',
        page: '/ma-cave',
        avant: () => decor({ 'ma-cave-v1': VINS }),
        async jouer(p) {
            await p.attendre(1800);
            // L'étagère d'arrivée doit être à l'écran en même temps que la
            // bouteille : le geste ne se raconte pas en deux morceaux.
            await p.evaluer("window.scrollTo({ top: 640, behavior: 'smooth' })");
            await p.attendre(1500);
            const geste = await p.evaluer(`(() => {
                const carte = [...document.querySelectorAll('[data-wine]')].find((e) => {
                    const b = e.getBoundingClientRect();
                    return b.top > 40 && b.bottom < window.innerHeight - 60;
                });
                const etagere = document.querySelector('[data-shelf="tasted"]');
                if (!carte || !etagere) return null;
                const c = carte.getBoundingClientRect();
                const t = etagere.getBoundingClientRect();
                return {
                    x: Math.round(c.left + c.width / 2), y: Math.round(c.top + 70),
                    cx: Math.round(window.innerWidth / 2),
                    cy: Math.round(Math.min(t.top + 90, window.innerHeight - 60)),
                };
            })()`);
            if (!geste) throw new Error('cave : bouteille ou étagère hors écran');
            // De côté d'abord : la cave ne décolle la bouteille qu'au mouvement
            // latéral — vers le bas, elle croirait qu'on fait défiler la page.
            await p.glisserPar([
                { x: geste.x, y: geste.y },
                { x: geste.x + 120, y: geste.y + 10 },
                { x: geste.cx, y: geste.cy },
            // Doucement : trop vite, le navigateur regroupe les positions et
            // l'application ne voit qu'un saut, pas un trajet.
            ], { pas: 12, pause: 60 });
            await p.attendre(2600);
            // Une prise ratée produit une vidéo valide et vide de sens : on
            // demande à l'application si la bouteille a vraiment changé d'étagère.
            const range = await p.evaluer(
                "JSON.parse(localStorage.getItem('ma-cave-v1') || '[]').filter((v) => v.shelf === 'tasted').length");
            if (range < 2) throw new Error('la bouteille n’a pas été rangée : prise à refaire');
        },
    },

    'mes-videos': {
        titre: 'Une vidéo devient une recette',
        page: '/',
        /*
         * Cette scène-là exige une VRAIE session : la route d'import refuse
         * tout le reste, et c'est bien ainsi. On lui passe donc une session
         * par l'environnement (TUTO_SESSION, le JSON rendu par Supabase à la
         * connexion) — le compte de façade `NEXT_PUBLIC_FAUX_COMPTE` ne
         * conviendrait pas : son jeton n'est pas signé.
         */
        avant: () => {
            const session = process.env.TUTO_SESSION;
            if (!session) throw new Error('mes-videos : passe TUTO_SESSION=<json de session Supabase> pour tourner cette scène');
            /*
             * Sous quel nom ranger la session ? Supabase la lit dans
             * `sb-<projet>-auth-token`. Le script de tournage, lui, ne charge
             * pas `.env.local` — on prend donc le nom du projet DANS le jeton :
             * sa charge utile porte l'adresse du serveur qui l'a signé.
             */
            const charge = JSON.parse(Buffer.from(JSON.parse(session).access_token.split('.')[1], 'base64url').toString());
            const ref = new URL(charge.iss).hostname.split('.')[0];
            return `try { localStorage.setItem('sb-${ref}-auth-token', ${JSON.stringify(session)}); } catch (e) {}`;
        },
        async jouer(p) {
            await p.attendre(1600);
            const menu = await p.centre('[class*=heroMenuBtn]');
            await p.tap(menu.x, menu.y, { apres: 1500 });
            const entree = await p.amener('vu une vidéo');
            await p.tap(entree.x, entree.y, { apres: 1800 });
            // Le lien d'une vidéo, tapé lettre à lettre : on voit d'où il vient.
            await p.taper('input[type=url]', 'tiktok.com/@aissa_kitchen/video/7653779236460743968', { cadence: 45 });
            const ajouter = await p.centreParTexte('Ajouter');
            // Le serveur écoute la vidéo puis écrit la recette : quelques
            // secondes pendant lesquelles l'écran dit ce qu'il fait.
            await p.tap(ajouter.x, ajouter.y, { apres: 9000 });
            await p.attendre(2500);
            // Une prise ratée donne une vidéo qui ne montre rien : on vérifie
            // que la fiche s'est bien ouverte.
            const ouverte = await p.evaluer("!!document.querySelector('[class*=sheet], [class*=RecipeSheet]')");
            if (!ouverte) throw new Error('la fiche ne s’est pas ouverte : prise à refaire');
            await p.glisser(200, 640, 200, 320, { pas: 20, pause: 26 });
            await p.attendre(1800);
        },
    },

    'appui-long': {
        titre: 'Le menu de la carte',
        page: '/',
        async jouer(p) {
            await p.attendre(1600);
            await p.evaluer("window.scrollTo({ top: 900, behavior: 'smooth' })");
            await p.attendre(1400);
            const carte = await p.evaluer(`(() => {
                const e = [...document.querySelectorAll('[class*=tv_thumb__]')].find(x => {
                    const b = x.getBoundingClientRect();
                    const img = x.querySelector('img');
                    // Une carte sans photo (« Photo à venir ») fait pauvre à l'écran.
                    const photo = img && img.complete && img.naturalWidth > 40 && !/placeholder/i.test(img.src);
                    return photo && b.width > 90 && b.top > 120 && b.bottom < window.innerHeight - 140;
                });
                if (!e) return null;
                const b = e.getBoundingClientRect();
                return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) };
            })()`);
            if (!carte) throw new Error('aucune vignette à portée');
            await p.appuiLong(carte.x, carte.y, 1000);
            await p.attendre(2400);
        },
    },

    'deplacer-repas': {
        titre: 'Déplacer un repas',
        page: '/tv-planner',
        // Le repas est posé AUJOURD'HUI : le carrousel s'ouvre sur le jour
        // courant, la scène doit trouver sa carte du premier coup.
        avant: () => decor({
            'meal-planner-week': semaine({ [jour(0)]: { Midi: '6337', Soir: '7455' } }),
        }),
        async jouer(p) {
            await p.attendre(2400);
            // La semaine est un carrousel d'un jour par écran : viser la
            // première carte du document attrape souvent un jour hors champ.
            const carte = await p.evaluer(`(() => {
                const e = [...document.querySelectorAll('[data-creneau] button[class*=planCard]')].find((x) => {
                    const b = x.getBoundingClientRect();
                    return b.width > 80 && b.left >= 0 && b.right <= window.innerWidth
                        && b.top > 120 && b.bottom < window.innerHeight - 120;
                });
                if (!e) return null;
                const b = e.getBoundingClientRect();
                return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + 50) };
            })()`);
            if (!carte) throw new Error('aucun repas visible : remplis un créneau avant de filmer');
            // Appui tenu : la recette passe « en main ». On peut alors lâcher,
            // prendre son temps pour changer de jour, et poser.
            await p.appuiLong(carte.x, carte.y, 1200);
            await p.attendre(1200);
            // Balayage : la semaine tourne d'un jour.
            await p.glisser(320, 520, 60, 520, { pas: 14, pause: 30 });
            await p.attendre(1400);
            const creneau = await p.evaluer(`(() => {
                const e = [...document.querySelectorAll('[class*=planEmpty]')].find((x) => {
                    const b = x.getBoundingClientRect();
                    return b.width > 60 && b.left >= 0 && b.right <= window.innerWidth
                        && b.top > 120 && b.bottom < window.innerHeight - 100;
                });
                if (!e) return null;
                const b = e.getBoundingClientRect();
                return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) };
            })()`);
            if (!creneau) throw new Error('aucun créneau libre en vue le jour suivant');
            await p.tap(creneau.x, creneau.y, { avant: 600, apres: 2600 });
            await p.attendre(1400);
            // Une prise ratée donne une vidéo valide et muette : on demande à
            // l'application si le repas a vraiment changé de jour.
            const jours = await p.evaluer(
                "Object.values(JSON.parse(localStorage.getItem('meal-planner-week') || '{}')).filter((j) => Object.keys(j || {}).length).length");
            if (jours < 2) throw new Error('le repas n’a pas changé de jour : prise à refaire');
        },
    },

    /* ── « 100 % légumes de saison » : l'accompagnement d'un plat servi nu ── */
    'accompagnement-saison': {
        titre: 'Un accompagnement de saison',
        page: '/tv-planner',
        // Une bavette seule, aujourd'hui à midi : elle appelle un accompagnement.
        avant: () => decor({
            'meal-planner-week': semaine({ [jour(0)]: { Midi: '8113' } }),
        }),
        async jouer(p) {
            await p.attendre(2400);
            const saison = await p.amener('100 % légumes de saison', 'button', { attente: 900 });
            await p.tap(saison.x, saison.y, { avant: 500, apres: 2200 });
            // La loupe s'ouvre déjà réduite aux légumes de saison : on en choisit un.
            const premier = await p.evaluer(`(() => {
                const e = [...document.querySelectorAll('[class*=spItem]')].find((x) => {
                    const b = x.getBoundingClientRect();
                    return b.width > 80 && b.top > 120 && b.bottom < window.innerHeight - 60;
                });
                if (!e) return null;
                const b = e.getBoundingClientRect();
                return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) };
            })()`);
            if (!premier) throw new Error('aucun accompagnement de saison à choisir');
            await p.tap(premier.x, premier.y, { avant: 500, apres: 2000 });
            const ajouter = await p.centreParTexte('Ajouter au planificateur');
            await p.tap(ajouter.x, ajouter.y, { avant: 500, apres: 2600 });
            const pose = await p.evaluer(
                "Object.values(JSON.parse(localStorage.getItem('meal-planner-week') || '{}')).some((j) => Object.values(j || {}).some((c) => c && c.side))");
            if (!pose) throw new Error('l’accompagnement n’a pas été posé : prise à refaire');
        },
    },

    /* ── Le filtre « 100 % de saison » de la recherche ── */
    'filtres-saison': {
        titre: 'Le filtre « 100 % de saison »',
        page: '/',
        async jouer(p) {
            await p.attendre(1200);
            const loupe = await p.centre('[class*=isolatedSearchBtn]');
            await p.tap(loupe.x, loupe.y, { apres: 1400 });
            const tendances = await p.centreParTexte('Tendances', '[class*=spGroup]');
            await p.tap(tendances.x, tendances.y, { apres: 1200 });
            const saison = await p.amener('100 % de saison', 'button', { attente: 700 });
            await p.tap(saison.x, saison.y, { avant: 400, apres: 2600 });
            // Un second filtre, pour montrer qu'ils se combinent.
            const categorie = await p.centreParTexte('Catégorie', '[class*=spGroup]');
            await p.tap(categorie.x, categorie.y, { apres: 1200 });
            const plats = await p.amener('^Plats', 'button', { attente: 700 });
            await p.tap(plats.x, plats.y, { avant: 400, apres: 2800 });
        },
    },

    /* ── Les #hashtags d'une fiche ── */
    hashtags: {
        titre: 'Les hashtags d’une fiche',
        page: '/',
        async jouer(p) {
            await p.attendre(3000);
            // La puce visible sous la photo du héros (la première est parfois hors champ).
            const tag = await p.evaluer(`(() => {
                const e = [...document.querySelectorAll('[class*=heroTagChip]')].find((x) => {
                    const b = x.getBoundingClientRect();
                    return b.width > 0 && b.top > 60 && b.bottom < window.innerHeight - 60 && /^#/.test(x.textContent.trim());
                });
                if (!e) return null;
                const b = e.getBoundingClientRect();
                return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) };
            })()`);
            if (!tag) throw new Error('aucun hashtag visible sous la photo');
            await p.tap(tag.x, tag.y, { avant: 600, apres: 3400 });
            await p.attendre(1200);
        },
    },

    /* ── BUREAU (fenêtre de Mac, souris) : le menu de gauche et les filtres ── */
    'bureau-menu': {
        titre: 'Le menu de gauche et les filtres',
        page: '/',
        bureau: true,
        async jouer(p) {
            await p.attendre(2600);
            // Les catégories se déplient dans la barre latérale.
            const cat = await p.amener('^Catégories$', 'button', { attente: 600 });
            await p.tap(cat.x, cat.y, { apres: 1200 });
            const desserts = await p.amener('^\\s*Desserts\\s*$', 'button', { attente: 500 });
            await p.tap(desserts.x, desserts.y, { apres: 1600 });
            // Les tendances se cumulent avec la catégorie : ET entre groupes.
            const tend = await p.amener('^Tendances$', 'button', { attente: 600 });
            await p.tap(tend.x, tend.y, { apres: 1200 });
            const express = await p.amener('Express', 'button', { attente: 500 });
            await p.tap(express.x, express.y, { apres: 2600 });
            await p.attendre(1400);
        },
    },

    fiche: {
        titre: 'La fiche recette',
        page: '/',
        async jouer(p) {
            // Vite : le grand visuel tourne tout seul, et on veut la recette
            // que le spectateur a sous les yeux, pas la suivante.
            await p.attendre(500);
            // Toucher la photo du héros ouvre la fiche (le bouton « Voir la recette » n'existe pas sur mobile).
            const photo = await p.centre('[class*=heroPosterOn]');
            await p.tap(photo.x, photo.y, { avant: 200, apres: 3200 });
            // Les ingrédients, puis les étapes : c'est l'ordre où on les lit.
            await p.glisser(200, 660, 200, 300, { pas: 22, pause: 26 });
            await p.attendre(1500);
            await p.glisser(200, 660, 200, 280, { pas: 22, pause: 26 });
            await p.attendre(1500);
            await p.glisser(200, 660, 200, 300, { pas: 22, pause: 26 });
            await p.attendre(1800);
        },
    },

    'bureau-accompagnement-saison': {
        titre: 'Un accompagnement de saison',
        bureau: true,
        page: '/tv-planner',
        // Une bavette seule, aujourd'hui à midi : elle appelle un accompagnement.
        avant: () => decor({
            'meal-planner-week': semaine({ [jour(0)]: { Midi: '8113' } }),
        }),
        async jouer(p) {
            await p.attendre(2400);
            const saison = await p.amener('100 % légumes de saison', 'button', { attente: 900 });
            await p.tap(saison.x, saison.y, { avant: 500, apres: 2200 });
            // La loupe s'ouvre déjà réduite aux légumes de saison : on en choisit un.
            const premier = await p.evaluer(`(() => {
                const e = [...document.querySelectorAll('[class*=spItem]')].find((x) => {
                    const b = x.getBoundingClientRect();
                    return b.width > 80 && b.top > 120 && b.bottom < window.innerHeight - 60;
                });
                if (!e) return null;
                const b = e.getBoundingClientRect();
                return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) };
            })()`);
            if (!premier) throw new Error('aucun accompagnement de saison à choisir');
            await p.tap(premier.x, premier.y, { avant: 500, apres: 2000 });
            const ajouter = await p.centreParTexte('Ajouter au planificateur');
            await p.tap(ajouter.x, ajouter.y, { avant: 500, apres: 2600 });
            const pose = await p.evaluer(
                "Object.values(JSON.parse(localStorage.getItem('meal-planner-week') || '{}')).some((j) => Object.values(j || {}).some((c) => c && c.side))");
            if (!pose) throw new Error('l’accompagnement n’a pas été posé : prise à refaire');
        },
    },

    'bureau-deplacer-repas': {
        titre: 'Déplacer un repas',
        page: '/tv-planner',
        bureau: true,
        // Midi et Soir d'aujourd'hui : on glisse un repas sur l'autre, ils échangent leur place.
        avant: () => decor({
            'meal-planner-week': semaine({ [jour(0)]: { Midi: '6337', Soir: '7455' } }),
        }),
        async jouer(p) {
            await p.attendre(2400);
            // Les deux repas du jour : le premier (Midi) et le suivant (Soir).
            const cartes = await p.evaluer(`(() => {
                const vus = [...document.querySelectorAll('[data-creneau] button[class*=planCard]')].filter((x) => {
                    const b = x.getBoundingClientRect();
                    return b.width > 80 && b.left >= 0 && b.right <= window.innerWidth && b.top >= 0 && b.bottom <= window.innerHeight;
                });
                if (vus.length < 2) return null;
                const c = (e) => { const b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + 50) }; };
                return [c(vus[0]), c(vus[1])];
            })()`);
            if (!cartes) throw new Error('deux repas à voir côte à côte : remplis Midi et Soir avant de filmer');
            // Le doigt prend le repas de midi, le traîne jusqu'au soir, et lâche.
            await p.glisserPar(cartes, { pas: 26, pause: 28 });
            await p.attendre(1600);
            const echange = await p.evaluer(
                "(() => { const j = JSON.parse(localStorage.getItem('meal-planner-week') || '{}').Lun || {}; return j.Midi && j.Midi.id === '7455' && j.Soir && j.Soir.id === '6337'; })()");
            if (!echange) throw new Error('les repas ne se sont pas échangés : prise à refaire');
            await p.attendre(1200);
        },
    },

    'bureau-courses': {
        titre: 'La liste de courses',
        bureau: true,
        page: '/tv-courses',
        avant: () => decor({
            // Aujourd'hui et demain : « Jour par jour » s'ouvre sur la date du
            // tournage, un décor posé sur un lundi en dur s'y afficherait vide.
            'meal-planner-week': semaine({
                [jour(0)]: { Midi: '6337', Soir: '7455' },
                [jour(1)]: { Soir: '5496' },
            }),
            'magic-shopping-list': panier(['5941']),
        }) + `
            // Partager et le drive du magasin sortent de l'application : le film
            // s'arrêterait sur un onglet vide. La caméra reste dedans — ce que
            // l'application affiche, lui, ne change pas d'un pouce.
            window.open = () => null;`,
        async jouer(p) {
            await p.attendre(2000);
            // Barrer ce qu'on a déjà au placard : le compte de l'en-tête baisse,
            // et l'article sort de ce qui partira au magasin.
            const ligne = await p.centreParTexte('Ail|Concombre|Courgette', '[class*=courseText]');
            await p.tap(ligne.x, ligne.y, { apres: 1800 });
            const jour = await p.amener('^\\s*Par jour');
            await p.tap(jour.x, jour.y, { apres: 2400 });
            const plus = await p.amener('^\\s*En \\+');
            await p.tap(plus.x, plus.y, { apres: 2400 });
            const toute = await p.amener('Tout acheter');
            await p.tap(toute.x, toute.y, { apres: 1800 });
            // La barre du bas : partager la liste, ou la faire dérouler au magasin.
            const magasin = await p.amener('Carrefour|Faire mes courses|Lancer');
            await p.tap(magasin.x, magasin.y, { apres: 2600 });
            await p.attendre(1600);
        },
    },

    'bureau-filtres-saison': {
        titre: 'Le filtre « 100 % de saison »',
        bureau: true,
        page: '/',
        async jouer(p) {
            await p.attendre(1200);
            const loupe = await p.centre('[class*=searchBtn]');
            await p.tap(loupe.x, loupe.y, { apres: 1400 });
            const tendances = await p.centreParTexte('Tendances', '[class*=spGroup]');
            await p.tap(tendances.x, tendances.y, { apres: 1200 });
            const saison = await p.amener('100 % de saison', 'button', { attente: 700 });
            await p.tap(saison.x, saison.y, { avant: 400, apres: 2600 });
            // Un second filtre, pour montrer qu'ils se combinent.
            const categorie = await p.centreParTexte('Catégorie', '[class*=spGroup]');
            await p.tap(categorie.x, categorie.y, { apres: 1200 });
            const plats = await p.amener('^Plats', 'button', { attente: 700 });
            await p.tap(plats.x, plats.y, { avant: 400, apres: 2800 });
        },
    },

    'bureau-fiche': {
        titre: 'La fiche recette',
        bureau: true,
        page: '/',
        async jouer(p) {
            // Vite : le grand visuel tourne tout seul, et on veut la recette
            // que le spectateur a sous les yeux, pas la suivante.
            await p.attendre(500);
            // Toucher la photo du héros ouvre la fiche (le bouton « Voir la recette » n'existe pas sur mobile).
            const photo = await p.centre('[class*=heroPosterImg]');
            await p.tap(photo.x, photo.y, { avant: 200, apres: 3200 });
            // Les ingrédients, puis les étapes : c'est l'ordre où on les lit.
            await p.glisser(200, 660, 200, 300, { pas: 22, pause: 26 });
            await p.attendre(1500);
            await p.glisser(200, 660, 200, 280, { pas: 22, pause: 26 });
            await p.attendre(1500);
            await p.glisser(200, 660, 200, 300, { pas: 22, pause: 26 });
            await p.attendre(1800);
        },
    },

        'bureau-clic-droit': {
        titre: 'Le clic droit sur une carte',
        page: '/',
        bureau: true,
        async jouer(p) {
            await p.attendre(3500);
            // On descend jusqu'aux rangées, puis on vise une carte bien dans le cadre.
            await p.evaluer("(() => { const e = [...document.querySelectorAll('[class*=cardLabel]:not([class*=cardLabelRow])')].find((x) => x.textContent.startsWith('Ragoût')); if (e) e.scrollIntoView({ block: 'center', behavior: 'instant' }); })()");
            await p.attendre(1800);
            const carte = await p.evaluer(`(() => {
                const e = [...document.querySelectorAll('[class*=cardLabel]:not([class*=cardLabelRow])')].find((x) => {
                    const b = x.getBoundingClientRect();
                    return b.width > 60 && b.top > 120 && b.bottom < window.innerHeight - 40 && b.left >= 0 && b.right <= window.innerWidth;
                });
                if (!e) return null;
                const b = e.getBoundingClientRect();
                return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) };
            })()`);
            if (!carte) throw new Error('aucune carte visible pour le clic droit ' + JSON.stringify(await p.evaluer("[...document.querySelectorAll('[class*=cardLabel]:not([class*=cardLabelRow])')].slice(0,6).map((x) => { const b = x.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.left), innerHeight, innerWidth, document.querySelector('main') ? document.querySelector('main').scrollTop : -1]; })")));
            await p.clicDroitSur(carte.x, carte.y, { avant: 500, apres: 2800 });
            await p.attendre(1200);
        },
    },

    'bureau-bibliotheque': {
        titre: 'La bibliothèque',
        page: '/',
        bureau: true,
        async jouer(p) {
            await p.attendre(1800);
            const cat = await p.amener('^Catégories$', 'button', { attente: 600 });
            // Le groupe peut déjà être ouvert : un clic le refermerait, et Desserts disparaîtrait.
            const ouvert = await p.evaluer("[...document.querySelectorAll('button[class*=navGroupHead]')].find((b) => /Catégories/.test(b.textContent)).getAttribute('aria-expanded') === 'true'");
            if (!ouvert) await p.tap(cat.x, cat.y, { apres: 1100 });
            await p.amener('^\\s*Desserts\\s*$', '[class*=navRowSmall]', { attente: 700 });
            await p.evaluer("document.querySelector('[class*=libraryDrop]').scrollIntoView({ block: 'center', behavior: 'smooth' })");
            await p.attendre(1000);
            const depart = await p.centreParTexte('^\\s*Desserts\\s*$', '[class*=navRowSmall]');
            const cible = await p.centre('[class*=libraryDrop]');
            // Le doigt suit le trajet jusqu'à la bibliothèque, puis lâche.
            await p.glisserPar([{ x: depart.x, y: depart.y }, { x: cible.x, y: cible.y }], { pas: 30, pause: 26 });
            // Le glisser-déposer natif du navigateur ne se pilote pas par la souris
            // en mode headless : on le rejoue par ses événements, sur les mêmes éléments.
            const depose = await p.evaluer(`(() => {
                const src = [...document.querySelectorAll('[class*=navGroup] button')].find((b) => /^\\s*Desserts\\s*$/.test(b.textContent));
                const zone = document.querySelector('[class*=libraryDrop]');
                if (!src || !zone) return false;
                const dt = new DataTransfer();
                const fire = (el, type) => el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
                fire(src.closest('[draggable=true]') || src, 'dragstart');
                fire(zone, 'dragenter'); fire(zone, 'dragover'); fire(zone, 'drop');
                fire(src.closest('[draggable=true]') || src, 'dragend');
                return true;
            })()`);
            if (!depose) throw new Error('élément introuvable pour le dépôt');
            await p.attendre(600);
            const pris = await p.evaluer("document.querySelector('[class*=libraryDrop]').textContent.includes('Desserts')");
            if (!pris) throw new Error('le dépôt dans la bibliothèque n’a pas pris : prise à refaire');
            await p.attendre(1800);
        },
    },

};

module.exports = { SCENES };
