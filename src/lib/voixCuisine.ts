'use client';

/**
 * La voix du mode préparation, côté appareil.
 *
 * Pourquoi une balise <audio> et pas la synthèse intégrée : sur iPhone, la
 * synthèse (`speechSynthesis`) reste souvent muette dans une appli installée, et
 * sa voix est celle d'un robot. Une balise <audio> qu'on a « débloquée » par un
 * geste de l'utilisateur peut, elle, jouer n'importe quand ensuite — c'est la
 * méthode de Pilvoice.
 *
 *   1. `debloquerVoix()` DANS le geste (clic sur « Lancer la préparation ») ;
 *   2. `direNaturel(texte)` demande l'audio à `/api/tts`, le garde (mémoire +
 *      cache du navigateur, un an) et le joue ;
 *   3. si le service ne répond pas (pas de clé, pas de compte, hors ligne),
 *      `direNaturel` renvoie `false` et l'appelant prend la voix de l'appareil.
 */
import { supabase } from '@/mobile/lib/supabase';

let lecteur: HTMLAudioElement | null = null;
let debloque = false;
const enMemoire = new Map<string, string>();      // texte → adresse blob
const enCours = new Map<string, Promise<string | null>>();
/** Service injoignable : on n'insiste pas pendant une minute (pas de rafale d'échecs). */
let muetJusqua = 0;

const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';
const CACHE = 'voix-cuisine-v1';

const cle = (t: string) => {
    let h = 5381;
    for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
    return `/voix-cuisine/${t.length}-${h >>> 0}`;
};

/** À appeler DANS un geste de l'utilisateur : autorise ensuite l'audio et la synthèse. */
export function debloquerVoix(): void {
    if (typeof window === 'undefined') return;
    if (!lecteur) { lecteur = new Audio(); lecteur.preload = 'auto'; (lecteur as any).playsInline = true; }
    if (!debloque) {
        debloque = true;
        try { lecteur.src = SILENCE; void lecteur.play().catch(() => {}); } catch { /* noop */ }
        // La voix de l'appareil, en repli : même déblocage par un énoncé muet.
        try {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.resume();
                const u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis.speak(u);
            }
        } catch { /* noop */ }
    }
}

async function jeton(): Promise<string> {
    try { return (await supabase.auth.getSession()).data.session?.access_token || ''; } catch { return ''; }
}

/** L'adresse d'un audio prêt à jouer, ou `null` si le service ne répond pas. */
async function obtenir(texte: string): Promise<string | null> {
    const deja = enMemoire.get(texte);
    if (deja) return deja;
    const encours = enCours.get(texte);
    if (encours) return encours;
    if (Date.now() < muetJusqua) return null;

    const p = (async () => {
        try {
            const cache = typeof caches !== 'undefined' ? await caches.open(CACHE).catch(() => null) : null;
            const k = cle(texte);
            const trouve = cache ? await cache.match(k) : null;
            let blob: Blob | null = trouve ? await trouve.blob() : null;
            if (!blob) {
                const t = await jeton();
                const r = await fetch('/api/tts', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json', ...(t ? { authorization: `Bearer ${t}` } : {}) },
                    body: JSON.stringify({ text: texte }),
                });
                if (r.status !== 200) { muetJusqua = Date.now() + 60000; return null; }
                blob = await r.blob();
                if (cache) await cache.put(k, new Response(blob, { headers: { 'content-type': 'audio/mpeg' } })).catch(() => {});
            }
            const url = URL.createObjectURL(blob);
            enMemoire.set(texte, url);
            return url;
        } catch { muetJusqua = Date.now() + 60000; return null; }
        finally { enCours.delete(texte); }
    })();
    enCours.set(texte, p);
    return p;
}

/** Prépare une phrase à l'avance (la suivante), sans la jouer. */
export function precharger(texte: string): void { void obtenir(texte); }

/** Coupe ce qui se joue. */
export function taireVoix(): void {
    try { lecteur?.pause(); } catch { /* noop */ }
}

/**
 * Joue la phrase avec la voix naturelle. Résout à la FIN de la lecture, avec
 * `true` ; avec `false` si le service n'a rien donné (l'appelant prend alors la
 * voix de l'appareil).
 */
export async function direNaturel(texte: string): Promise<boolean> {
    if (!lecteur) return false;
    const url = await obtenir(texte);
    if (!url) return false;
    const el = lecteur;
    return new Promise<boolean>((fin) => {
        let fini = false;
        const clore = (ok: boolean) => { if (fini) return; fini = true; el.onended = null; el.onerror = null; fin(ok); };
        el.onended = () => clore(true);
        el.onerror = () => clore(false);
        try {
            el.src = url;
            const p = el.play();
            if (p) p.catch(() => clore(false));
        } catch { clore(false); }
        // Filet : si ni `ended` ni `error` ne viennent, on rend la main après un
        // temps raisonnable (la phrase la plus longue dure moins de 45 s).
        setTimeout(() => clore(true), 45000);
    });
}
