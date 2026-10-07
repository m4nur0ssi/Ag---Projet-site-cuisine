'use client';

/**
 * Recherche « façon Apple TV+ » — route /tv, TEST DE DESIGN (local uniquement).
 * Reprend À L'IDENTIQUE les fonctionnalités de SpotlightSearch (prod) :
 *   • Par recette   : texte + groupes Catégorie / Pays / Tendances (chips).
 *   • Par ingrédients : on ajoute des ingrédients, tri par nombre de correspondances.
 *   • Assistant IA  : demande en langage naturel (texte ou voix) → recettes du site.
 * Seul le HABILLAGE change : verre profond, chips pilules, typo — langage iOS 26/27.
 * Aucune modification de la prod (SpotlightSearch reste tel quel).
 */

import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { suggerer } from '@/lib/suggestionsCourses';

const RecipeSheet = dynamic(() => import('@/mobile/components/RecipeSheet/RecipeSheet'), { ssr: false });
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Recipe } from '@/mobile/types';
/*
 * La recherche part des mêmes données que l'accueil, complétées par les étapes
 * et les ingrédients : ces deux modules sont déjà chargés quand l'utilisateur
 * ouvre la recherche. Importer le catalogue complet ferait télécharger une
 * deuxième copie de tout, juste pour lire des noms d'ingrédients.
 */
import { homeRecipes } from '@/mobile/data/home-recipes';
import { detailById } from '@/mobile/data/home-details';

const mockRecipes = homeRecipes.map((r) => {
    const d = detailById[String(r.id)];
    return d ? { ...r, steps: d.steps, ingredients: d.ingredients } : r;
});
import { decodeHtml } from '@/mobile/lib/utils';
import { smartLocalSearch } from '@/lib/recipeSmartSearch';
import { buildFinderCatalog } from '@/lib/recipe-search-payload';
import { lireContrainteNote, appliquerContrainteNote } from '@/lib/contrainte-note';
import { loadAllRatingStats } from '@/mobile/lib/ratings';
import { FILTER_GROUPS, type FilterGroup } from '@/lib/searchFilters';
import { timingOf, totalMinutes, formatMinutes } from './timing';
import { matchesTag } from './themes';
import { estRecettePates } from '@/lib/pates';
import styles from './tv.module.css';
import Tip from '@/components/Tip/Tip';
import { ecrireStock } from '@/lib/stockage';
import { readCave, drinkWindow, type CaveWine } from '@/lib/cave';
import { intentionVin, compacterCave, accordLocal } from '@/lib/accordCave';
import { clavierRepris } from '@/lib/clavier';
import { useBackToClose } from './retour';

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Le mot qu'on lit sur une étiquette, plutôt que la clé technique. */
const COULEUR_MOT: Record<string, string> = {
    rouge: 'Rouge', blanc: 'Blanc', rose: 'Rosé', liqueur: 'Liquoreux',
};

/** Retire emojis/drapeaux/symboles décoratifs des libellés (langage sobre TV). */
/** Retour haptique (ignoré si non supporté). */
const haptic = (ms = 8) => { try { navigator.vibrate?.(ms); } catch { /* noop */ } };

const stripEmoji = (s: string) =>
    s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}️‍]/gu, '').trim();

type Mode = 'recipe' | 'ingredients' | 'assistant';

interface TVSpotlightProps {
    open: boolean;
    onClose: () => void;
    onRecipeSelect: (recipe: Recipe) => void;
    /**
     * Restreint le vivier de recettes proposées. Le planificateur s'en sert pour
     * n'offrir que des PLATS dans un créneau, ou que des ACCOMPAGNEMENTS quand on
     * complète une viande servie nue.
     */
    filter?: (recipe: Recipe) => boolean;
    /** Intitulé affiché à la place de « Terminé » (ex. « Choisir un plat »). */
    hint?: string;
    /** Mode d'ouverture (défaut « recipe »). « assistant » = recherche IA. */
    initialMode?: Mode;
    /** Démarre la dictée vocale automatiquement à l'ouverture (raccourci loupe). */
    autoVoice?: boolean;
    /**
     * Recherche pré-remplie par un lien externe (« /?q=parmesan ») : on arrive
     * avec le champ déjà rempli et les résultats affichés, pas sur une page
     * vide. Lien partagé, newsletter, ou site partenaire qui envoie l'ingrédient
     * de sa fiche produit.
     */
    initialQuery?: string;
    /**
     * Ingrédients pré-cochés (« /?ingredients=parmesan,jambon cru »), séparés par
     * des virgules. Ouvre directement le mode « avec mes ingrédients », une puce
     * par ingrédient — un panier de courses devient une recherche.
     */
    initialIngredients?: string;
    /**
     * `embedded` : rendu DANS le shell desktop TV+ (panneau, menu à gauche) au
     * lieu du calque plein écran. Plus de bouton « Terminé », plus de fond
     * verre, un en-tête titre + sous-titre — le moule des autres panneaux.
     */
    embedded?: boolean;
    /**
     * `panneau` : calque plein écran, mais habillé comme la PAGE Recherche du
     * bureau — sur-titre, grand titre doré, résultats en colonnes. C'est ce que
     * le planificateur ouvre quand on ajoute une recette : on retrouve l'écran
     * de recherche habituel plutôt qu'une liste qui déroule en bas.
     */
    panneau?: boolean;
    /** Consulter la fiche avant de confirmer le créneau du planificateur. */
    previewBeforeSelect?: boolean;
}

/**
 * Ce qu'il faut vraiment chercher quand on écarte un aliment.
 *
 * Les recettes ne nomment pas leurs ingrédients comme on les demande : le
 * poulet s'y appelle « volaille entière », le gluten n'apparaît jamais sous ce
 * mot — c'est de la farine, du blé, des pâtes. Une exclusion qui ne lit que le
 * mot tapé laisse passer la moitié des plats, et sur une allergie, laisser
 * passer est pire que refuser trop.
 *
 * Cette table couvre les régimes courants ; tout autre mot est cherché tel quel.
 */
const FAMILLES_EXCLUSION: Record<string, string[]> = {
    poulet: ['poulet', 'volaille', 'blanc de dinde', 'escalope de dinde'],
    dinde: ['dinde', 'volaille'],
    porc: ['porc', 'lard', 'lardon', 'jambon', 'bacon', 'chorizo', 'saucisson', 'andouille', 'boudin'],
    boeuf: ['boeuf', 'bœuf', 'steak', 'bavette', 'entrecote', 'entrecôte', 'hache', 'haché'],
    viande: ['boeuf', 'bœuf', 'porc', 'agneau', 'veau', 'poulet', 'volaille', 'lard', 'jambon', 'bacon', 'steak', 'saucisse'],
    poisson: ['poisson', 'saumon', 'thon', 'cabillaud', 'colin', 'merlu', 'sardine', 'maquereau', 'anchois', 'truite', 'bar', 'dorade'],
    'fruits de mer': ['crevette', 'moule', 'huitre', 'huître', 'gambas', 'calamar', 'poulpe', 'coquille', 'langoustine', 'crabe'],
    gluten: ['farine', 'ble', 'blé', 'pate', 'pâte', 'pain', 'chapelure', 'semoule', 'boulgour', 'orge', 'seigle', 'biscuit', 'brioche'],
    lactose: ['lait', 'beurre', 'creme', 'crème', 'fromage', 'yaourt', 'mascarpone', 'ricotta', 'mozzarella', 'parmesan', 'gruyere', 'gruyère'],
    'lait': ['lait', 'creme', 'crème', 'beurre', 'fromage', 'yaourt'],
    oeuf: ['oeuf', 'œuf'],
    arachide: ['arachide', 'cacahuete', 'cacahuète', 'peanut'],
    'fruits a coque': ['noix', 'noisette', 'amande', 'pistache', 'cajou', 'pecan', 'pécan'],
    alcool: ['vin', 'biere', 'bière', 'rhum', 'whisky', 'cognac', 'vodka', 'liqueur', 'porto', 'champagne'],
};

/** Les mots à traquer pour une exclusion donnée. */
function motsInterdits(mot: string): string[] {
    const m = normalize(mot);
    for (const [cle, liste] of Object.entries(FAMILLES_EXCLUSION)) {
        if (normalize(cle) === m) return liste.map(normalize);
    }
    return [m];
}

export default function TVSpotlight({ open, onClose, onRecipeSelect, filter, hint, initialMode, autoVoice, initialQuery, initialIngredients, embedded = false, panneau = false, previewBeforeSelect = false }: TVSpotlightProps) {
    const [query, setQuery] = useState('');
    const [mode, setMode] = useState<Mode>('recipe');
    const [ingTags, setIngTags] = useState<string[]>([]);
    const [ingInput, setIngInput] = useState('');
    const [preview, setPreview] = useState<Recipe | null>(null);
    useBackToClose(!!preview && (open || embedded), () => setPreview(null));
    const [suggestionIndex, setSuggestionIndex] = useState(-1);
    const [suggestionsOpen, setSuggestionsOpen] = useState(true);
    const suggestions = useMemo(() => mode === 'ingredients' && suggestionsOpen
        ? suggerer(ingInput).filter((name) => !ingTags.some((tag) => normalize(tag) === normalize(name)))
        : [], [mode, ingInput, ingTags, suggestionsOpen]);
    useEffect(() => { setSuggestionIndex(-1); }, [ingInput]);
    // Le fragment en cours participe lui aussi à la recherche, sans attendre Entrée.
    const searchedIngredients = useMemo(() => [...ingTags, ...(ingInput.trim().length >= 2 ? [ingInput.trim()] : [])], [ingTags, ingInput]);
    /**
     * Régime alimentaire : les ingrédients dont on ne VEUT PAS.
     *
     * Une allergie ou un régime ne change pas d'une recherche à l'autre : la
     * liste se retient d'une visite sur l'autre, et s'applique à TOUS les modes
     * — chercher par nom, par ingrédients ou en décrivant son envie. Rien ne
     * sert d'exclure l'arachide d'un côté pour la voir revenir de l'autre.
     */
    const [exclus, setExclus] = useState<string[]>([]);
    const [exclusInput, setExclusInput] = useState('');
    const [exclusOuvert, setExclusOuvert] = useState(false);
    useEffect(() => {
        try {
            const brut = JSON.parse(localStorage.getItem('regime-sans') || '[]');
            if (Array.isArray(brut)) setExclus(brut.filter((x) => typeof x === 'string'));
        } catch { /* mode privé */ }
    }, []);
    const enregistrerExclus = (next: string[]) => {
        setExclus(next);
        try { ecrireStock('regime-sans', JSON.stringify(next)); } catch { /* noop */ }
    };
    const ajouterExclu = () => {
        const val = exclusInput.trim().toLowerCase();
        if (val && !exclus.includes(val)) enregistrerExclus([...exclus, val]);
        setExclusInput('');
    };

    const [activeGroup, setActiveGroup] = useState<FilterGroup | null>(null);
    // Multi-filtres cumulatifs (catégorie + pays + tendance combinés en ET).
    const [activeFilters, setActiveFilters] = useState<string[]>([]);
    const toggleFilter = (tag: string) =>
        setActiveFilters((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const router = useRouter();

    // Assistant IA
    const [aiQuery, setAiQuery] = useState('');
    const [aiResults, setAiResults] = useState<Recipe[]>([]);
    /*
     * L'assistant répond aussi en BOUTEILLES.
     *
     * « Un vin de ma cave pour du poulet » n'est pas une demande de recette :
     * il proposait cinq plats au poulet. Quand la question porte sur le vin, on
     * cherche dans la cave de l'utilisateur — celle de l'appareil — au lieu du
     * catalogue.
     */
    const [aiWines, setAiWines] = useState<CaveWine[]>([]);
    const [aiMessage, setAiMessage] = useState('');
    const [aiBusy, setAiBusy] = useState(false);
    const [aiError, setAiError] = useState('');
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    /**
     * Vivier de base : tout le catalogue, ou le sous-ensemble imposé par
     * l'appelant — moins ce que le régime interdit. En retranchant ICI, aucun
     * mode n'a besoin d'y penser : ni la recherche, ni les filtres, ni
     * l'assistant ne peuvent proposer une recette écartée.
     */
    const pool = useMemo(() => {
        const base = filter ? mockRecipes.filter(filter) : mockRecipes;
        // Choisir une recette POUR le planificateur : on veut voir tout ce qui
        // convient au créneau, le régime « sans… » n'a pas à s'y inviter.
        if (!exclus.length || filter) return base;
        const bannis = exclus.flatMap(motsInterdits);
        return base.filter((r) => {
            // Le titre et les étiquettes comptent autant que la liste des
            // ingrédients : « Ramen de poulet » se trahit par son nom.
            const champs = [
                normalize(r.title || ''),
                ...(r.tags || []).map((t: string) => normalize(t)),
                ...(r.ingredients || []).map((i: any) => normalize(i?.name || '')),
            ];
            return !champs.some((c) => bannis.some((b) => b && c.includes(b)));
        });
    }, [filter, exclus]);
    const localSearch = (q: string) => smartLocalSearch(pool as any, q, 5) as Recipe[];

    const abortRef = useRef<AbortController | null>(null);
    const searchSeqRef = useRef<number>(0);
    const lastExecutedQueryRef = useRef<string>('');
    const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const askAssistant = async (raw?: string) => {
        const q = (raw ?? aiQuery).trim();
        if (!q) return;

        lastExecutedQueryRef.current = q;

        // Si une recherche précédente était en cours, on l'annule pour donner priorité immédiate à la nouvelle
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }
        const ac = new AbortController();
        abortRef.current = ac;
        const seq = ++searchSeqRef.current;

        setAiBusy(true);
        setAiError('');
        setAiResults([]);
        setAiWines([]);
        setAiMessage('');

        // La cave vit sur l'appareil : elle part avec la question, sinon le
        // serveur n'aurait aucun moyen de savoir ce qu'on possède.
        const cave = readCave();
        const surLeVin = intentionVin(q);
        /*
         * « Une recette de gâteau notée au moins 4/5 » : la note ne voyage pas
         * avec le catalogue (elle vit dans Supabase), le modèle ne peut donc pas
         * la vérifier. On retranche ICI ce qui n'atteint pas la note demandée,
         * et il ne reçoit plus que des candidates légitimes.
         */
        const contrainte = lireContrainteNote(q);
        let vivier: Recipe[] = pool as Recipe[];
        if (contrainte && !surLeVin) {
            const notes = await loadAllRatingStats();
            if (seq !== searchSeqRef.current) return;
            // Aucune note lisible (base injoignable, lecture refusée) : on
            // n'écarte RIEN. Répondre « aucune recette notée 4/5 » alors qu'on
            // n'a simplement pas pu regarder serait un mensonge.
            if (notes.size) vivier = appliquerContrainteNote(vivier as any, notes, contrainte) as Recipe[];
            if (!vivier.length) {
                setAiError(contrainte.meilleures
                    ? 'Aucune recette du site n\'a encore été notée.'
                    : `Aucune recette du site n'est notée ${contrainte.min.toString().replace('.', ',')}/5 ou plus pour l'instant.`);
                setAiBusy(false);
                return;
            }
        }
        try {
            const compact = buildFinderCatalog(vivier as any);
            const res = await fetch('/api/recipe-finder', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                // La clause de note est retirée de la demande : elle est déjà
                // appliquée, et elle ne décrirait qu'un plat imaginaire.
                body: JSON.stringify({ query: (contrainte?.reste || q), recipes: compact, cave: compacterCave(cave) }),
                signal: ac.signal,
            });
            if (seq !== searchSeqRef.current) return;
            if (!res.ok) throw new Error('api');
            const data = await res.json();
            if (seq !== searchSeqRef.current) return;

            if (data.kind === 'wines') {
                const parId = new Map(cave.map((w) => [String(w.id), w]));
                const bouteilles = (data.ids || []).map((id: string) => parId.get(String(id))).filter(Boolean) as CaveWine[];
                if (bouteilles.length) { setAiWines(bouteilles); setAiMessage(data.message || ''); }
                // Cave vide : le message du serveur l'explique, inutile de
                // basculer sur des recettes que personne n'a demandées.
                else if (!cave.length) setAiError(data.message || 'Ta cave est vide.');
                else throw new Error('empty');
                return;
            }

            const byId = new Map(vivier.map((r) => [String(r.id), r]));
            let found = (data.ids || []).map((id: string) => byId.get(String(id))).filter(Boolean) as Recipe[];
            if (filter) found = found.filter(filter);
            if (found.length) {
                setAiResults(found);
                // On rappelle la contrainte : sans elle, rien ne dit que la
                // sélection a bien été filtrée sur la note.
                setAiMessage(contrainte ? `Parmi les recettes ${contrainte.libelle}` : (data.message || ''));
            }
            else throw new Error('empty');
        } catch (err: any) {
            if (err?.name === 'AbortError' || seq !== searchSeqRef.current) return;
            // Assistant injoignable : on répond quand même, avec les accords de
            // base pour le vin, et la recherche texte pour le reste.
            if (surLeVin) {
                const bouteilles = accordLocal(q, cave);
                if (bouteilles.length) { setAiWines(bouteilles); setAiMessage('Dans ta cave, ce qui s\'en rapproche le plus'); }
                else setAiError(cave.length
                    ? 'Aucune bouteille de ta cave ne convient vraiment. Reformule ta demande.'
                    : 'Ta cave est vide — ajoute des bouteilles pour que je puisse te conseiller.');
                return;
            }
            // Le repli cherche dans le VIVIER déjà filtré : une recherche de
            // secours ne doit pas rendre ce que la contrainte vient d'écarter.
            const local = smartLocalSearch(vivier as any, contrainte?.reste || q, 5) as Recipe[];
            if (local.length) {
                setAiResults(local);
                setAiMessage(contrainte ? `Parmi les recettes ${contrainte.libelle}` : 'Voici ce que j\'ai trouvé sur le site');
            }
            else setAiError('Aucune recette du site ne correspond. Reformule ta demande.');
        } finally {
            if (seq === searchSeqRef.current) {
                setAiBusy(false);
            }
        }
    };

    // Arrêt propre et complet de l'écoute vocale (sans callbacks résiduels)
    const stopVoice = () => {
        if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
        if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
        if (recognitionRef.current) {
            try {
                const old = recognitionRef.current;
                recognitionRef.current = null;
                old.onstart = null;
                old.onresult = null;
                old.onerror = null;
                old.onend = null;
                old.stop?.();
                old.abort?.();
            } catch {}
        }
        setIsListening(false);
    };

    // Référence toujours à jour vers la dernière version de `toggleVoice` :
    // l'effet d'ouverture peut l'appeler sans avoir à la lister en dépendance,
    // et sans risquer d'appeler la version figée au premier rendu.
    const toggleVoiceRef = useRef<() => void>(() => {});

    const toggleVoice = () => {
        if (typeof window === 'undefined') return;
        haptic(10);
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) {
            setMode('assistant');
            setAiError('La dictée vocale n\'est pas supportée ici (utilise Safari sur iPhone ou Chrome sur Android).');
            return;
        }

        // Si l'écoute est déjà en cours, un tap l'arrête immédiatement
        if (isListening || recognitionRef.current) {
            stopVoice();
            return;
        }

        // Nettoyage complet préalable pour éviter toute collision
        stopVoice();

        // Mode assistant IA + bascule
        setMode('assistant');
        setAiError('');
        if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch {} }

        const rec = new SR();
        rec.lang = 'fr-FR';
        rec.interimResults = true;
        rec.continuous = false;
        rec.maxAlternatives = 1;

        let capturedTranscript = '';
        let searchExecuted = false;

        const executeSearch = (rawText: string) => {
            const clean = rawText.trim();
            if (!clean || searchExecuted) return;
            searchExecuted = true;
            try { rec.stop(); } catch {}
            setAiQuery(clean);
            askAssistant(clean);
        };

        rec.onstart = () => {
            setIsListening(true);
            setAiError('');
            if (watchdogRef.current) clearTimeout(watchdogRef.current);
            // Rien capté après 8,5 s → on coupe et on explique.
            watchdogRef.current = setTimeout(() => {
                if (!capturedTranscript.trim()) {
                    stopVoice();
                    setAiError('Je n\'ai rien entendu. Réappuie sur le micro et parle près du téléphone.');
                }
            }, 8500);
        };

        rec.onresult = (e: any) => {
            let interim = '';
            let final = '';
            for (let i = 0; i < e.results.length; i++) {
                const item = e.results[i];
                if (item.isFinal) {
                    final += item[0].transcript;
                } else {
                    interim += item[0].transcript;
                }
            }
            const current = (final || interim).trim();
            if (current) {
                capturedTranscript = current;
                setAiQuery(current);
                if (final.trim()) {
                    executeSearch(final.trim());
                }
            }
        };

        rec.onerror = (ev: any) => {
            if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
            setIsListening(false);
            recognitionRef.current = null;
            const err = ev?.error;
            if (err === 'not-allowed' || err === 'service-not-allowed') {
                setAiError('Micro refusé. Autorise le micro pour ce site dans les réglages du navigateur, puis réessaie.');
            } else if (err === 'no-speech') {
                if (!capturedTranscript.trim()) {
                    setAiError('Je n\'ai rien entendu. Réappuie sur le micro et parle.');
                }
            } else if (err === 'audio-capture') {
                setAiError('Microphone introuvable ou occupé par une autre application.');
            } else if (err === 'network') {
                if (capturedTranscript.trim()) {
                    executeSearch(capturedTranscript.trim());
                } else {
                    setAiError('Erreur réseau lors de la reconnaissance vocale. Réessaie.');
                }
            }
        };

        rec.onend = () => {
            if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
            setIsListening(false);
            recognitionRef.current = null;
            // Si le navigateur n'a pas émis isFinal mais qu'on a du texte capté :
            if (!searchExecuted && capturedTranscript.trim()) {
                executeSearch(capturedTranscript.trim());
            }
        };

        recognitionRef.current = rec;
        try {
            rec.start();
        } catch (startErr) {
            // Si le moteur WebKit ferme encore l'ancienne session, retenter dans 200ms
            retryTimerRef.current = setTimeout(() => {
                try {
                    if (recognitionRef.current === rec) {
                        rec.start();
                    }
                } catch {
                    setIsListening(false);
                    recognitionRef.current = null;
                }
            }, 200);
        }
    };
    toggleVoiceRef.current = toggleVoice;

    // Lancement auto : 0,7 s d'inactivité après frappe clavier → recherche IA.
    // Ne relance pas si la requête vient déjà d'être exécutée par la voix.
    useEffect(() => {
        if (mode !== 'assistant') return;
        const q = aiQuery.trim();
        if (q.length < 3) return;
        if (q === lastExecutedQueryRef.current) return;
        const t = setTimeout(() => askAssistant(q), 700);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [aiQuery, mode]);

    // Mode recette
    const filteredRecipes = useMemo(() => {
        if (mode !== 'recipe') return [];
        let pool2 = pool.filter((r) => r.category !== 'restaurant');
        // Chaque filtre coché doit matcher (ET) : « un dessert espagnol express ».
        for (const f of activeFilters) {
            const af = normalize(f);
            // Une tendance a ses propres règles (« Pâtes » veut une pâte dans le
            // titre, « Express » un temps réel…) : le tag WordPress seul laissait
            // passer un gratin de pommes de terre. Catégories et pays, eux, se
            // lisent bien sur la catégorie et les tags.
            if (FILTER_GROUPS.tendances.some((t) => t.tag === f)) {
                pool2 = pool2.filter((r) => matchesTag(r, f, { ignoreCategoryGuards: activeFilters.some((x) => FILTER_GROUPS.categorie.some((c) => c.tag === x)) }));
                continue;
            }
            pool2 = pool2.filter((r) =>
                normalize(r.category || '') === af ||
                (r.tags || []).some((t: string) => normalize(t).includes(af)));
        }
        if (query.trim().length > 0) {
            const q = normalize(query.trim());
            // « pâte(s) », « pasta » : on cherche des PÂTES. La sous-chaîne rendait
            // aussi la pâte brisée, la pâte à pizza et tout plat tagué « pates ».
            const veutDesPates = /^(pates?|pasta)s?$/.test(q);
            pool2 = pool2.filter((r) => veutDesPates
                ? estRecettePates(r)
                : normalize(r.title).includes(q) ||
                  (r.tags || []).some((t: string) => normalize(t).includes(q)));
        }
        if (activeFilters.length === 0 && query.trim().length === 0) {
            const sorted = [...pool2].sort((a, b) => parseInt(b.id) - parseInt(a.id));
            // Créneau du planificateur (filter imposé) → on montre TOUT le type
            // demandé (toutes les entrées, tous les plats…), pas seulement 10.
            return sorted;
        }
        return pool2;
    }, [query, mode, activeFilters, pool, filter]);

    // Mode ingrédients
    const ingredientResults = useMemo(() => {
        if (mode !== 'ingredients' || searchedIngredients.length === 0) return [];
        const tags = searchedIngredients.map((t) => t.toLowerCase());
        return pool
            .filter((r) => r.category !== 'restaurant')
            .map((r) => {
                const ingNames = r.ingredients.map((i) => i.name.toLowerCase());
                const has = (tag: string) => ingNames.some((n) => normalize(n).includes(normalize(tag)));
                const matched = tags.filter(has);
                // Ce qui manque, nommément : « il manque le fenouil » vaut mieux
                // qu'un simple 1/2, on sait quoi acheter.
                const missing = tags.filter((t) => !has(t));
                return { recipe: r, matched: matched.length, missing };
            })
            .filter(({ matched }) => matched > 0)
            // Recettes complètes d'abord, puis les plus proches.
            .sort((a, b) => b.matched - a.matched)
            .slice(0, 14);
    }, [searchedIngredients, mode, pool]);

    const addIngTag = (name = ingInput) => {
        const val = name.trim().toLowerCase();
        if (val && !ingTags.includes(val)) setIngTags((prev) => [...prev, val]);
        setIngInput('');
    };

    // Croix « tout effacer » : ce qu'elle vide dépend du mode affiché.
    const hasSomethingToClear =
        mode === 'assistant' ? aiQuery.trim().length > 0
            : mode === 'recipe' ? query.length > 0
                : ingInput.length > 0 || ingTags.length > 0;

    const clearField = () => {
        stopVoice();
        if (abortRef.current) abortRef.current.abort();
        if (mode === 'assistant') { setAiQuery(''); setAiResults([]); setAiMessage(''); setAiError(''); }
        else if (mode === 'recipe') setQuery('');
        else { setIngInput(''); setIngTags([]); }
        inputRef.current?.focus();
    };

    const pick = (recipe: Recipe) => {
        haptic(8);
        if (previewBeforeSelect) {
            inputRef.current?.blur();
            stopVoice();
            setPreview(recipe);
            return;
        }
        onRecipeSelect(recipe);
        if (!embedded) onClose();
    };
    const confirmPreview = (recipe: Recipe) => {
        setPreview(null);
        onRecipeSelect(recipe);
        if (!embedded) onClose();
    };

    /** Le champ prend le focus À SON MONTAGE quand l'écran vient de s'ouvrir. */
    const wantFocusRef = useRef(false);
    /*
     * Curseur dans le champ dès l'ouverture. Le panneau arrive en animation :
     * un seul essai tombe parfois avant que l'input existe, donc on retente
     * quelques fois et on s'arrête dès qu'il a le focus.
     */
    const focusSoon = () => {
        // Le champ n'existe pas encore au premier passage : le panneau arrive en
        // chargement différé (`dynamic`), ce qui prend parfois plus d'une
        // seconde. On arme donc aussi le montage du champ lui-même (`attachInput`),
        // sinon tous les essais tombent dans le vide et le curseur n'y va jamais.
        wantFocusRef.current = true;
        const delays = [0, 60, 160, 320, 500];
        const timers = delays.map((d) => setTimeout(() => {
            const el = inputRef.current;
            if (el && document.activeElement !== el) el.focus({ preventScroll: true });
            if (el) { wantFocusRef.current = false; clavierRepris(); }
        }, d));
        return () => { timers.forEach(clearTimeout); wantFocusRef.current = false; };
    };

    const attachInput = (el: HTMLInputElement | null) => {
        inputRef.current = el;
        if (el && wantFocusRef.current) {
            wantFocusRef.current = false;
            el.focus({ preventScroll: true });
            // Le porte-clavier peut lâcher : le clavier est à nous maintenant.
            clavierRepris();
        }
    };

    /*
     * Le focus, DANS LA MÊME TÂCHE que le clic.
     *
     * Un effet de mise en page s'exécute avant que le navigateur rende la main :
     * pour iOS, le focus fait donc toujours partie du geste du doigt, et le
     * clavier monte pour de bon. Posé dans un `useEffect` ordinaire — ou pire,
     * dans un `setTimeout` — il arrive après, et iOS refuse de lever le clavier.
     */
    useLayoutEffect(() => {
        if (!open && !embedded) return;
        wantFocusRef.current = true;
        const el = inputRef.current;
        if (el) {
            el.focus({ preventScroll: true });
            wantFocusRef.current = false;
            clavierRepris();
        }
    }, [open, embedded]);

    /*
     * Dire au reste de l'application qu'une recherche est ouverte.
     *
     * Depuis qu'elle passe SOUS la barre du bas, la loupe reste sous le doigt
     * pendant qu'on choisit une recette pour le planificateur : sans ce
     * drapeau, elle ouvrirait une seconde recherche par-dessus la première.
     */
    useEffect(() => {
        if (embedded || !open) return;
        document.body.dataset.recherche = 'ouverte';
        return () => { delete document.body.dataset.recherche; };
    }, [open, embedded]);

    // Ouverture : focus + page figée. Fermeture : on réinitialise tout.
    useEffect(() => {
        // En panneau, l'écran est toujours « ouvert » : on focalise le champ une
        // fois et on ne touche NI au scroll de la page NI à l'état saisi.
        if (embedded) {
            const stop = focusSoon();
            return () => stop();
        }
        if (open) {
            // Raccourci loupe : ouvre direct en mode assistant IA et lance la dictée.
            if (initialMode) setMode(initialMode);
            const stop = focusSoon();
            let tv: ReturnType<typeof setTimeout> | undefined;
            if (autoVoice) tv = setTimeout(() => toggleVoiceRef.current(), 420);
            const prev = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = prev; stop(); if (tv) clearTimeout(tv); };
        }
        setPreview(null);
        setQuery(''); setIngTags([]); setIngInput(''); setMode('recipe');
        setActiveGroup(null); setActiveFilters([]);
        setAiQuery(''); setAiResults([]); setAiMessage(''); setAiError('');
        stopVoice();
        if (abortRef.current) abortRef.current.abort();
    }, [open, embedded, initialMode, autoVoice]);

    /*
     * Amorce venue de l'URL (lien externe). Elle s'applique UNE fois par
     * valeur reçue : ensuite l'écran appartient au visiteur, une frappe ne doit
     * jamais être écrasée par un effet qui repasse. Plusieurs ingrédients →
     * mode « ingrédients » (une puce chacun) ; un seul mot → recherche par nom.
     */
    const seedRef = useRef<string | null>(null);
    useEffect(() => {
        if (!open && !embedded) return;
        const ings = (initialIngredients || '')
            .split(/\s*[,;]\s*/)
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean);
        const q = (initialQuery || '').trim();
        if (!q && !ings.length) return;
        const seed = `${q}|${ings.join(',')}`;
        if (seedRef.current === seed) return;
        seedRef.current = seed;
        if (ings.length) {
            setMode('ingredients');
            setIngTags(ings);
            setIngInput('');
        } else {
            setMode('recipe');
            setQuery(q);
        }
    }, [open, embedded, initialQuery, initialIngredients]);

    // Une ligne de résultat (image + drapeau + titre + méta).
    const ResultItem = ({ recipe, meta, note }: { recipe: Recipe; meta: string; note?: string }) => {
        return (
            <button className={styles.spItem} onClick={() => pick(recipe)}>
                <div className={styles.spThumbWrap}>
                    <img src={recipe.image} alt="" className={styles.spThumb} loading="lazy" decoding="async" draggable={false} />
                </div>
                <div className={styles.spInfo}>
                    <div className={styles.spTitle}>{decodeHtml(recipe.title)}</div>
                    <div className={styles.spMeta}>{meta}</div>
                    {note && <div className={styles.spMissing}>{note}</div>}
                </div>
            </button>
        );
    };

    /**
     * Une bouteille de la cave, en résultat d'assistant.
     *
     * Même gabarit qu'une recette — vignette, titre, ligne de contexte — pour
     * qu'on n'ait pas à réapprendre à lire la liste. La photo de la bouteille
     * est celle du marchand quand elle a été retrouvée ; sans photo, la pastille
     * porte la couleur du vin.
     */
    const WineItem = ({ wine }: { wine: CaveWine }) => {
        const fenetre = drinkWindow(wine);
        const meta = [
            COULEUR_MOT[wine.color] || wine.color,
            wine.year,
            wine.region,
        ].filter(Boolean).join(' • ');
        const reste = (wine.qty || 1) > 1 ? `${wine.qty} bouteilles en cave` : null;
        return (
            <button className={styles.spItem} onClick={() => { haptic(8); onClose(); router.push('/ma-cave'); }}>
                <div className={styles.spThumbWrap}>
                    {wine.photo
                        ? <img src={wine.photo} alt="" className={styles.spThumb} loading="lazy" decoding="async" draggable={false} />
                        : <span className={`${styles.spWinePuce} ${styles['spWine_' + wine.color]}`} aria-hidden />}
                </div>
                <div className={styles.spInfo}>
                    <div className={styles.spTitle}>{wine.name}</div>
                    <div className={styles.spMeta}>{meta}</div>
                    {(fenetre || reste) && (
                        <div className={styles.spMissing}>
                            {[fenetre?.label, reste].filter(Boolean).join(' · ')}
                        </div>
                    )}
                </div>
            </button>
        );
    };

    // Durée et difficulté viennent de l'estimateur, comme partout ailleurs : le
    // champ WordPress vaut 15 + 30 min et « moyen » sur les 617 recettes.
    const recipeMeta = (r: Recipe) => {
        if (r.category === 'restaurant') {
            return r.restaurant?.subType ? `restaurant • ${r.restaurant.subType}` : 'restaurant';
        }
        const d = timingOf(r).difficulty;
        const time = formatMinutes(totalMinutes(r));
        return [r.category, time, d].filter(Boolean).join(' • ');
    };

    const body = (
        <>
                    <Tip id="recherche" delay={1400} />
                    {/* En panneau : gros titre + sous-titre, comme Favoris. */}
                    {(embedded || panneau) && (
                        <div className={styles.spPanelHead}>
                            <div className={styles.spPanelKicker}>Trouver une recette</div>
                            <h1 className={styles.spPanelTitle}>Recherche</h1>
                            <p className={styles.spPanelSub}>Par mot, par ingrédients, ou en décrivant ton envie.</p>
                        </div>
                    )}

                    <div className={styles.spModeRow}>
                    {/* Segmented control : mode */}
                    <div className={styles.spSegment}>
                        {([['recipe', 'Recette'], ['ingredients', 'Ingrédients'], ['assistant', 'Assistant']] as [Mode, string][]).map(([m, lbl]) => (
                            <button
                                key={m}
                                className={`${styles.spSeg} ${mode === m ? styles.spSegOn : ''}`}
                                onClick={() => {
                                    haptic(8);
                                    setMode(m); setActiveGroup(null); setActiveFilters([]);
                                    setTimeout(() => inputRef.current?.focus(), 50);
                                }}
                            >{lbl}</button>
                        ))}
                    </div>
                        {!embedded && <button className={styles.spCancel} onClick={onClose}>{hint || 'Terminé'}</button>}
                    </div>

                    {/* Recherche et nombre de résultats */}
                    <div className={styles.spHead}>
                        <div className={styles.spField}>
                            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" className={styles.spFieldIcon} aria-hidden>
                                <path d="M21 21l-4.3-4.3M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            {mode === 'assistant' ? (
                                <input
                                    ref={attachInput} type="text" className={styles.spInput}
                                    placeholder={isListening ? "🎙️ À l'écoute… parle maintenant" : "Dis-moi ton envie… ex : un plat rapide au poulet"}
                                    value={aiQuery} onChange={(e) => setAiQuery(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); askAssistant(); } }}
                                    enterKeyHint="search" autoComplete="off" autoCorrect="off" spellCheck={false}
                                />
                            ) : mode === 'recipe' ? (
                                <input
                                    ref={attachInput} type="text" className={styles.spInput}
                                    placeholder="Rechercher une recette"
                                    value={query} onChange={(e) => setQuery(e.target.value)}
                                    enterKeyHint="search" autoComplete="off" autoCorrect="off" spellCheck={false}
                                />
                            ) : (
                                <input
                                    ref={attachInput} type="text" className={styles.spInput}
                                    placeholder="Riz, fenouil…"
                                    value={ingInput} onChange={(e) => { setIngInput(e.target.value); setSuggestionsOpen(true); }}
                                    onFocus={() => setSuggestionsOpen(true)}
                                    role="combobox" aria-autocomplete="list" aria-expanded={suggestions.length > 0}
                                    aria-controls={suggestions.length ? 'planner-ingredient-suggestions' : undefined}
                                    aria-activedescendant={suggestionIndex >= 0 ? `planner-ingredient-${suggestionIndex}` : undefined}
                                    onKeyDown={(e) => {
                                        if (e.key === 'ArrowDown' && suggestions.length) {
                                            e.preventDefault(); setSuggestionIndex((i) => (i + 1) % suggestions.length);
                                        } else if (e.key === 'ArrowUp' && suggestions.length) {
                                            e.preventDefault(); setSuggestionIndex((i) => i <= 0 ? suggestions.length - 1 : i - 1);
                                        } else if (e.key === 'Escape') {
                                            setSuggestionsOpen(false); setSuggestionIndex(-1);
                                        } else if (e.key === 'Enter' || e.key === ',') {
                                            e.preventDefault(); addIngTag(suggestionIndex >= 0 ? suggestions[suggestionIndex] : ingInput);
                                        }
                                    }}
                                    enterKeyHint="done" autoComplete="off" autoCorrect="off" spellCheck={false}
                                />
                            )}
                            {/* Croix : vide le champ (et les puces) d'un geste, curseur rendu au champ. */}
                            {hasSomethingToClear && (
                                <button
                                    className={styles.spClear}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => { haptic(8); clearField(); }}
                                    aria-label="Effacer la recherche"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                                        <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.35" />
                                        <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                </button>
                            )}
                            {/* Valider sans clavier : les résultats se recalculent aussitôt. */}
                            {mode === 'ingredients' && ingInput.trim() && (
                                <button className={styles.spAdd} onClick={() => { haptic(8); addIngTag(); }} aria-label="Ajouter l'ingrédient">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                </button>
                            )}
                            {(mode === 'assistant' || mode === 'recipe') && (
                                <button
                                    className={`${styles.spMic} ${isListening ? styles.spMicOn : ''}`}
                                    onClick={toggleVoice}
                                    aria-label={isListening ? "Couper le micro" : "Dicter ma recherche"}
                                    title={isListening ? "Couper le micro" : "Dicter ma recherche"}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                        <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M19 11a7 7 0 0 1-14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                            )}
                        </div>
                        <div className={styles.spResultCount} role="status" aria-live="polite">
                            <strong>{mode === 'recipe' ? filteredRecipes.length : mode === 'ingredients' ? ingredientResults.length : aiResults.length}</strong>
                            <span>recette{(mode === 'recipe' ? filteredRecipes.length : mode === 'ingredients' ? ingredientResults.length : aiResults.length) !== 1 ? 's' : ''}</span>
                        </div>
                    </div>

                    {suggestions.length > 0 && (
                        <ul id="planner-ingredient-suggestions" className={styles.spSuggestions} role="listbox" aria-label="Suggestions d’ingrédients">
                            {suggestions.map((name, i) => (
                                <li key={name} id={`planner-ingredient-${i}`} role="option" aria-selected={i === suggestionIndex}>
                                    <button type="button" className={`${styles.courseSuggItem} ${i === suggestionIndex ? styles.courseSuggOn : ''}`}
                                        onMouseDown={(e) => e.preventDefault()} onClick={() => addIngTag(name)}>
                                        <span className={styles.courseSuggNom}>{name}</span><span className={styles.courseSuggPlus}>+</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className={styles.spFilterRow}>
                    {/* Régime : ce qu'on ne veut PAS voir, quel que soit le mode. */}
                    {!filter && (
                        <div className={styles.spSans}>
                            {exclus.map((x) => (
                                <button
                                    key={x}
                                    className={styles.spSansTag}
                                    onClick={() => { haptic(6); enregistrerExclus(exclus.filter((e) => e !== x)); }}
                                    aria-label={`Ne plus exclure ${x}`}
                                >
                                    sans {x}
                                    <span className={styles.spSansX}>✕</span>
                                </button>
                            ))}

                            {exclusOuvert ? (
                                <span className={styles.spSansField}>
                                    <input
                                        className={styles.spSansInput}
                                        placeholder="Arachide, gluten…"
                                        value={exclusInput}
                                        autoFocus
                                        onChange={(e) => setExclusInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); ajouterExclu(); }
                                            if (e.key === 'Escape') { setExclusOuvert(false); setExclusInput(''); }
                                        }}
                                        onBlur={() => { ajouterExclu(); setExclusOuvert(false); }}
                                        enterKeyHint="done" autoComplete="off" autoCorrect="off" spellCheck={false}
                                    />
                                </span>
                            ) : (
                                <button
                                    className={styles.spSansAdd}
                                    onClick={() => { haptic(8); setExclusOuvert(true); }}
                                >
                                    + Sans…
                                </button>
                            )}
                        </div>
                    )}

                    {/* Groupes + chips (mode recette) */}
                    {mode === 'recipe' && (
                        <div className={styles.spGroups}>
                            {(['categorie', 'pays', 'tendances'] as FilterGroup[]).map((g) => (
                                <button
                                    key={g}
                                    className={`${styles.spGroup} ${activeGroup === g ? styles.spGroupOn : ''}`}
                                    onClick={() => {
                                        haptic(8);
                                        // On ne vide PAS les filtres : ils sont cumulatifs entre groupes.
                                        if (activeGroup === g) setActiveGroup(null);
                                        else { setActiveGroup(g); setQuery(''); }
                                    }}
                                >{g === 'categorie' ? 'Catégorie' : g === 'pays' ? 'Pays' : 'Tendances'}
                                    {(() => {
                                        const n = FILTER_GROUPS[g].filter((f: any) => activeFilters.includes(f.tag)).length;
                                        return n > 0 ? <span className={styles.spGroupBadge}>{n}</span> : null;
                                    })()}
                                </button>
                            ))}
                        </div>
                    )}

                    </div>

                    {mode === 'recipe' && activeGroup && (
                        <div className={styles.spChips}>
                            {(activeGroup === 'tendances'
                                ? [...FILTER_GROUPS[activeGroup]].sort((a, b) =>
                                    a.label.replace(/^[^\p{L}]+/u, '').localeCompare(b.label.replace(/^[^\p{L}]+/u, ''), 'fr'))
                                : FILTER_GROUPS[activeGroup]
                            ).map((f) => (
                                <button
                                    key={f.tag}
                                    className={`${styles.spChip} ${activeFilters.includes(f.tag) ? styles.spChipOn : ''}`}
                                    onClick={() => {
                                        haptic(8);
                                        toggleFilter(f.tag);
                                        // Catégorie et pays se replient une fois le choix fait ;
                                        // les tendances restent ouvertes (on en cumule plusieurs)
                                        // jusqu'à un nouvel appui sur « Tendances ».
                                        if (activeGroup !== 'tendances') setActiveGroup(null);
                                    }}
                                >{stripEmoji(f.label)}</button>
                            ))}
                        </div>
                    )}

                    {mode === 'ingredients' && ingTags.length > 0 && (
                        <div className={styles.spChips}>
                            {ingTags.map((tag) => (
                                <span key={tag} className={`${styles.spChip} ${styles.spChipOn}`}>
                                    {tag}
                                    <button className={styles.spTagX} onClick={() => setIngTags((p) => p.filter((t) => t !== tag))} aria-label="Retirer">✕</button>
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Résultats */}
                    <div className={styles.spResults}>
                        {mode === 'assistant' && (
                            <>
                                {aiBusy && <div className={styles.spHint}>L&apos;assistant cherche…</div>}
                                {!aiBusy && isListening && !aiQuery && (
                                    <div className={styles.spHint}>🎙️ À l&apos;écoute… dis ce que tu aimerais cuisiner</div>
                                )}
                                {!aiBusy && aiMessage && <div className={styles.spAiMsg}>{aiMessage}</div>}
                                {!aiBusy && aiError && <div className={styles.spEmpty}>{aiError}</div>}
                                {!aiBusy && !isListening && !aiResults.length && !aiWines.length && !aiError && (
                                    <div className={styles.spEmpty}>Décris ton envie (ou dicte) : « un dessert au chocolat sans gluten », « plat italien rapide », « un vin de ma cave pour du poulet »…</div>
                                )}
                                {aiWines.map((w) => <WineItem key={w.id} wine={w} />)}
                                {aiResults.map((r) => <ResultItem key={r.id} recipe={r} meta={recipeMeta(r)} />)}
                            </>
                        )}

                        {mode === 'recipe' && (
                            <>
                                {query.trim().length === 0 && activeFilters.length === 0 && (
                                    <div className={styles.spHint}>Dernières recettes publiées</div>
                                )}
                                {filteredRecipes.length > 0
                                    ? (query.trim() || activeFilters.length || filter ? filteredRecipes : filteredRecipes.slice(0, 10)).map((r) => <ResultItem key={r.id} recipe={r} meta={recipeMeta(r)} />)
                                    : <div className={styles.spEmpty}>Aucune recette ne correspond…</div>}
                            </>
                        )}

                        {mode === 'ingredients' && (
                            <>
                                {searchedIngredients.length === 0 ? (
                                    <div className={styles.spEmpty}>Tape un ingrédient pour voir les suggestions et les recettes</div>
                                ) : ingredientResults.length > 0
                                    ? ingredientResults.map(({ recipe, matched, missing }) => (
                                        <ResultItem
                                            key={recipe.id}
                                            recipe={recipe}
                                            meta={`${recipe.category} • ${matched}/${searchedIngredients.length} ingrédient${searchedIngredients.length > 1 ? 's' : ''}`}
                                            note={missing.length ? `Il manque : ${missing.join(', ')}` : undefined}
                                        />
                                    ))
                                    : <div className={styles.spEmpty}>Aucune recette avec ces ingrédients</div>}
                            </>
                        )}
                    </div>
                    {preview && (open || embedded) && (
                        <RecipeSheet recipe={preview} isOpen={true} onClose={() => setPreview(null)} onAddToPlanner={confirmPreview} />
                    )}
        </>
    );

    if (embedded) return <div className={styles.spEmbedded}>{body}</div>;

    /*
     * En mode panneau, le calque part dans <body>. Sans ça il restait DANS le
     * planificateur : un ancêtre y crée un contexte (transformations,
     * verre dépoli), `position: fixed` n'y couvre plus l'écran et la recherche
     * s'empilait tout en bas de la page — le défaut signalé.
     */
    const calque = (
        <AnimatePresence>
            {open && (
                <motion.div
                    className={`${styles.spRoot} ${styles.spEmbedded} ${styles.spEnPanneau}`}
                    style={preview ? { visibility: 'hidden' } : undefined}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
                >
                    {body}
                </motion.div>
            )}
        </AnimatePresence>
    );
    if (panneau) {
        return typeof document === 'undefined' ? calque : createPortal(calque, document.body);
    }

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className={styles.spRoot}
                    style={preview ? { visibility: 'hidden' } : undefined}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
                >
                    {body}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
