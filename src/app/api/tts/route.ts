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
 *   1. Gemini (`GEMINI_API_KEY`, voix « Kore », française, comme Pilvoice) ;
 *   2. ElevenLabs (`ELEVENLABS_API_KEY`, voix `ELEVENLABS_VOICE_ID`, « Sarah »
 *      par défaut) ;
 *   3. OpenAI (`OPENAI_API_KEY`, modèle `gpt-4o-mini-tts`, voix « shimmer »).
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
        if (!r.ok) { console.error('ElevenLabs TTS', r.status, (await r.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 220)); return null; }
        return await r.arrayBuffer();
    } catch (e) { console.error('ElevenLabs TTS', 'exception', String(e).slice(0, 120)); return null; }
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
        if (!r.ok) { console.error('OpenAI TTS', corps.model, r.status, (await r.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 220)); return null; }
        return await r.arrayBuffer();
    };
    try {
        return (await essai({
            model: 'gpt-4o-mini-tts',
            instructions: 'Parle en français, d’une voix naturelle, chaleureuse et claire, au rythme posé de quelqu’un qui guide une recette en cuisine. Ne lis pas les symboles.',
        })) || (await essai({ model: 'tts-1', speed: 0.95 }));
    } catch { return null; }
}

// Modèles Gemini TTS essayés dans l'ordre (même liste que Pilvoice, voix-naturelle.js).
const MODELES_GEMINI = ['gemini-3.8-flash-lite-tts', 'gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'];
/** Modèle → instant jusqu'auquel on ne l'essaie plus (404 : 1 h, 429 : 1 min, autre : 10 s). */
const indisponibles = new Map<string, number>();

/** PCM 16 bits mono 24 kHz → WAV (44 octets d'en-tête). */
function wavDepuisPcm(pcm: Buffer): Buffer {
    const h = Buffer.alloc(44);
    h.write('RIFF'); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8);
    h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
    h.writeUInt32LE(24000, 24); h.writeUInt32LE(48000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
    h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([h, pcm]);
}

/** Voix Gemini « Kore » : renvoie un WAV, ou null (on passe au fournisseur suivant). */
async function gemini(texte: string): Promise<ArrayBuffer | null> {
    const cle = process.env.GEMINI_API_KEY;
    if (!cle) return null;
    const payload = {
        contents: [{ parts: [{ text: 'Lis exactement en français de France, voix douce et naturelle, sans rien ajouter :\n' + texte }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } },
    };
    // Comme Pilvoice : 12 s au plus par modèle, 24 s en tout (la fonction a 30 s),
    // et un modèle en échec est écarté un moment au lieu d'être réessayé à chaque phrase.
    const limite = Date.now() + 24000;
    for (const modele of MODELES_GEMINI) {
        if ((indisponibles.get(modele) || 0) > Date.now()) continue;
        const delai = Math.min(12000, limite - Date.now());
        if (delai < 500) break;
        try {
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`, {
                method: 'POST',
                headers: { 'x-goog-api-key': cle, 'content-type': 'application/json' },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(delai),
            });
            if (!r.ok) {
                console.error('Gemini TTS', modele, r.status, (await r.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 220));
                indisponibles.set(modele, Date.now() + (r.status === 404 ? 3600000 : r.status === 429 ? 60000 : 10000));
                continue;
            }
            const j = await r.json();
            const d = j.candidates?.[0]?.content?.parts?.find((p: { inlineData?: unknown }) => p.inlineData)?.inlineData;
            if (!d?.data || !/^audio\/l16/i.test(d.mimeType || '')) continue;
            const taux = /rate=(\d+)/i.exec(d.mimeType)?.[1] || '24000';
            const canaux = /channels=(\d+)/i.exec(d.mimeType)?.[1] || '1';
            if (Number(taux) !== 24000 || Number(canaux) !== 1) continue;
            const pcm = Buffer.from(d.data, 'base64');
            if (pcm.length < 100 || pcm.length % 2) continue;
            const wav = wavDepuisPcm(pcm);
            return wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength) as ArrayBuffer;
        } catch { console.error('Gemini TTS', modele, 'generation-echouee'); indisponibles.set(modele, Date.now() + 10000); }
    }
    return null;
}

export async function POST(req: Request) {
    const compte = await compteDe(req);
    if (!compte) return vide(401);
    if (!dansLaLimite(compte)) return vide(429);

    let texte = '';
    try { texte = String((await req.json())?.text || ''); } catch { return vide(400); }
    texte = texte.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_CAR);
    if (!texte) return vide(400);

    const wav = await gemini(texte);
    if (wav) return new Response(wav, {
        status: 200,
        headers: { 'content-type': 'audio/wav', 'cache-control': 'private, max-age=31536000, immutable' },
    });
    const audio = (await elevenLabs(texte)) || (await openAI(texte));
    if (!audio) {
        console.error('TTS : aucun fournisseur n\'a répondu', { gemini: !!process.env.GEMINI_API_KEY, elevenlabs: !!process.env.ELEVENLABS_API_KEY, openai: !!process.env.OPENAI_API_KEY });
        return vide(204);
    }
    return new Response(audio, {
        status: 200,
        headers: { 'content-type': 'audio/mpeg', 'cache-control': 'private, max-age=31536000, immutable' },
    });
}
