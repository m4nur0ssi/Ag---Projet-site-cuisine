/**
 * Voix de la préparation : du texte → un MP3 à la voix naturelle.
 *
 * POURQUOI UN SERVEUR
 * -------------------
 * La voix intégrée à l'iPhone est celle d'un robot, et dans une appli installée
 * elle reste parfois muette. Pilvoice lit ses messages avec une voix ElevenLabs
 * servie par une route comme celle-ci, jouée dans une balise <audio> : c'est ce
 * qui donne une voix claire et qui marche sur iPhone. On fait pareil.
 *
 * FOURNISSEURS, DANS L'ORDRE
 * --------------------------
 *   1. ElevenLabs (`ELEVENLABS_API_KEY`, voix `ELEVENLABS_VOICE_ID`, « Sarah »
 *      par défaut, comme Pilvoice) ;
 *   2. OpenAI (`OPENAI_API_KEY`, modèle `gpt-4o-mini-tts`, voix « shimmer »).
 * Aucune clé, ou un échec → 204 : l'appli retombe sur la voix de l'appareil.
 *
 * GARDE-FOUS (une route qui transforme du texte en son COÛTE de l'argent)
 *   • réservée aux comptes connectés (jeton Supabase vérifié) ;
 *   • 500 caractères au plus (une étape de recette en fait 100 à 300) ;
 *   • 30 phrases par minute et par compte ;
 *   • le navigateur garde chaque phrase un an : relire une recette ne coûte rien.
 */
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_CAR = 500;
const PAR_MINUTE = 30;
const appels = new Map<string, number[]>();

const vide = (status = 204) => new Response(null, { status });

async function compteDe(req: Request): Promise<string | null> {
    // En développement local, pas de vrai compte : on laisse passer pour tester.
    if (process.env.NODE_ENV !== 'production') return 'local';
    const jeton = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!jeton) return null;
    try {
        const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
        const { data, error } = await sb.auth.getUser(jeton);
        return error || !data.user ? null : data.user.id;
    } catch { return null; }
}

function dansLaLimite(id: string): boolean {
    const now = Date.now();
    const liste = (appels.get(id) || []).filter((t) => now - t < 60000);
    if (liste.length >= PAR_MINUTE) { appels.set(id, liste); return false; }
    liste.push(now); appels.set(id, liste);
    return true;
}

async function elevenLabs(texte: string): Promise<ArrayBuffer | null> {
    const cle = process.env.ELEVENLABS_API_KEY;
    if (!cle) return null;
    const voix = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';
    try {
        const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voix}?output_format=mp3_44100_64`, {
            method: 'POST',
            headers: { 'xi-api-key': cle, 'content-type': 'application/json', accept: 'audio/mpeg' },
            body: JSON.stringify({
                text: texte, model_id: 'eleven_multilingual_v2', language_code: 'fr',
                voice_settings: { stability: 0.6, similarity_boost: 0.75, speed: 0.95 },
            }),
        });
        return r.ok ? await r.arrayBuffer() : null;
    } catch { return null; }
}

async function openAI(texte: string): Promise<ArrayBuffer | null> {
    const cle = process.env.OPENAI_API_KEY;
    if (!cle) return null;
    const essai = async (corps: Record<string, unknown>) => {
        const r = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: { authorization: `Bearer ${cle}`, 'content-type': 'application/json' },
            body: JSON.stringify({ voice: 'shimmer', response_format: 'mp3', input: texte, ...corps }),
        });
        return r.ok ? await r.arrayBuffer() : null;
    };
    try {
        return (await essai({
            model: 'gpt-4o-mini-tts',
            instructions: 'Parle en français, d’une voix naturelle, chaleureuse et claire, au rythme posé de quelqu’un qui guide une recette en cuisine. Ne lis pas les symboles.',
        })) || (await essai({ model: 'tts-1', speed: 0.95 }));
    } catch { return null; }
}

export async function POST(req: Request) {
    const compte = await compteDe(req);
    if (!compte) return vide(401);
    if (!dansLaLimite(compte)) return vide(429);

    let texte = '';
    try { texte = String((await req.json())?.text || ''); } catch { return vide(400); }
    texte = texte.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_CAR);
    if (!texte) return vide(400);

    const audio = (await elevenLabs(texte)) || (await openAI(texte));
    if (!audio) return vide(204);
    return new Response(audio, {
        status: 200,
        headers: { 'content-type': 'audio/mpeg', 'cache-control': 'private, max-age=31536000, immutable' },
    });
}
