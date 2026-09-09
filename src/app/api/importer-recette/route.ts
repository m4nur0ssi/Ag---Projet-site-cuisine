import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { estLienTikTok, identifiantVideo, lireVideo, structurerRecette } from '@/lib/import-video';

/**
 * « J'ai vu une vidéo » : le lien collé devient une recette PRIVÉE.
 * ================================================================
 *
 * Rien n'est publié : la fiche est rangée dans `user_recipes`, que seule la
 * personne connectée peut lire (RLS). C'est ce qui rend la chose simple —
 * aucune modération à tenir, aucune question de droits (la vidéo n'est pas
 * réhébergée, on cite son auteur et on renvoie chez lui).
 *
 * Deux gardes, apprises des autres routes de ce dossier :
 *
 *   • une SESSION est obligatoire. Les routes IA du site sont ouvertes à tous
 *     vents et n'importe qui peut y vider le quota Groq de la journée ; celle-ci
 *     ne s'ajoutera pas à la liste ;
 *   • une limite par personne et par jour. Un compte, ce n'est pas un blanc-seing.
 *
 * Le travail se fait dans la requête (lecture de la page ~1 s, modèle ~5 à 15 s) :
 * une fonction sans serveur ne survit pas à sa réponse, il n'y a donc pas de
 * « tâche de fond » possible ici. La ligne est créée AVANT, en « en_cours », pour
 * que l'écran ait tout de suite quelque chose à montrer.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

const PAR_JOUR = 10;

const echec = (message: string, code = 400) => NextResponse.json({ error: message }, { status: code });

export async function POST(request: Request) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return echec('Supabase non configuré', 500);

    // Le jeton de la personne, et rien d'autre : le client agit EN SON NOM, donc
    // les règles RLS de la table s'appliquent telles quelles. Pas de clé de
    // service ici — elle contournerait précisément ce qui nous protège.
    const jeton = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!jeton) return echec('Il faut être connecté pour importer une recette.', 401);

    const supabase = createClient(url, anon, {
        global: { headers: { Authorization: `Bearer ${jeton}` } },
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: erreurAuth } = await supabase.auth.getUser();
    if (erreurAuth || !user) return echec('Session expirée : reconnecte-toi.', 401);

    let lien = '';
    try {
        lien = String((await request.json())?.url || '').trim();
    } catch {
        return echec('Requête illisible.');
    }
    if (!lien) return echec('Colle le lien de la vidéo.');
    if (!estLienTikTok(lien)) return echec("Pour l'instant je ne sais lire que les vidéos TikTok.");

    // Déjà importée : on rend l'existante plutôt que de refaire tourner le modèle.
    const idConnu = identifiantVideo(lien);
    if (idConnu) {
        const { data } = await supabase
            .from('user_recipes').select('*')
            .eq('user_id', user.id).eq('video_id', idConnu).maybeSingle();
        if (data?.statut === 'prete') return NextResponse.json({ deja: true, recette: data });
    }

    const depuis = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await supabase
        .from('user_recipes').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).gte('created_at', depuis);
    if ((count ?? 0) >= PAR_JOUR) {
        return echec(`Doucement : ${PAR_JOUR} vidéos par jour, c'est déjà beaucoup de cuisine. Reviens demain.`, 429);
    }

    /*
     * On ouvre la fiche « en cours » à la main, sans `upsert` : l'unicité
     * (une personne, une vidéo) repose sur un index PARTIEL — il ne vaut que
     * lorsque l'identifiant est connu — et PostgREST ne sait pas viser un
     * index pareil. Relire puis écrire fait le même travail, sans surprise.
     */
    const enCours = { statut: 'en_cours', raison: null, source_url: lien, updated_at: new Date().toISOString() };
    const { data: precedente } = idConnu
        ? await supabase.from('user_recipes').select('id')
            .eq('user_id', user.id).eq('video_id', idConnu).maybeSingle()
        : { data: null };

    const { data: ligne, error: erreurInsert } = precedente
        ? await supabase.from('user_recipes').update(enCours).eq('id', precedente.id).select().single()
        : await supabase.from('user_recipes')
            .insert({ user_id: user.id, video_id: idConnu, ...enCours }).select().single();
    if (erreurInsert || !ligne) {
        console.error('[importer-recette] ouverture de fiche', erreurInsert?.message);
        return echec("Je n'ai pas pu ouvrir de fiche pour cette vidéo.", 500);
    }

    /** Range l'échec en clair : c'est ce que la personne lira à l'écran. */
    const abandonner = async (raison: string, code = 502) => {
        await supabase.from('user_recipes')
            .update({ statut: 'echec', raison, updated_at: new Date().toISOString() })
            .eq('id', ligne.id);
        return NextResponse.json({ id: ligne.id, statut: 'echec', raison }, { status: code });
    };

    try {
        const video = await lireVideo(lien);
        const recette = await structurerRecette(video);
        if (!recette) {
            return abandonner(
                video.transcription
                    ? "Je n'ai pas réussi à en tirer une recette — la vidéo ne dit peut-être pas les quantités."
                    : "Cette vidéo n'a pas de voix transcrite, et sa légende ne suffit pas à écrire une recette.",
            );
        }

        const { data: finie, error: erreurMaj } = await supabase.from('user_recipes')
            .update({
                statut: 'prete',
                raison: null,
                video_id: video.videoId,
                source_url: video.url,
                recipe: {
                    ...recette,
                    // De quoi rendre à l'auteur ce qui lui appartient, et retourner
                    // voir la vidéo depuis la fiche.
                    auteur: video.auteur,
                    sourceUrl: video.url,
                    /*
                     * Surtout PAS l'adresse de la vignette telle qu'on vient de
                     * la recevoir : elle est signée et expire en deux jours,
                     * la fiche perdrait son image. On garde le chemin qui la
                     * résout à la demande — la route existe déjà pour ça, et
                     * l'image reste chez TikTok.
                     */
                    image: `/api/tiktok-thumb?v=${video.videoId}`,
                    importedAt: new Date().toISOString(),
                },
                updated_at: new Date().toISOString(),
            })
            .eq('id', ligne.id).select().single();
        if (erreurMaj) return abandonner("La recette est écrite mais je n'ai pas pu la ranger.", 500);

        return NextResponse.json({ statut: 'prete', recette: finie });
    } catch (e: any) {
        return abandonner(e?.message || "Je n'ai pas pu lire cette vidéo.");
    }
}
