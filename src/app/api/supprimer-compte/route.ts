import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ipDe, memeOrigine, trop } from '@/lib/garde-api';
import TABLES from '@/lib/tables-personnelles.json';

/**
 * « Supprimer mon compte » — le droit à l'effacement, en libre-service (RGPD,
 * art. 17).
 *
 * L'identité vient du jeton de session, JAMAIS du corps de la requête : on
 * efface le compte de celui qui appelle, et personne d'autre. Le jeton est
 * vérifié auprès de Supabase avant tout.
 *
 * Il faut ensuite la clé de service, pour deux raisons : les règles des tables
 * n'autorisent pas forcément la suppression de toutes ses propres lignes (les
 * commentaires, par exemple), et seule cette clé peut supprimer le compte
 * lui-même dans auth.users.
 *
 * Ordre : les données d'abord, le compte ensuite. Si une table résiste, on
 * s'arrête AVANT de supprimer le compte — sinon il resterait des lignes
 * orphelines que plus personne ne pourrait réclamer.
 *
 * La liste des tables est partagée avec scripts/supprimer-compte.js.
 */
export async function POST(request: Request) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anon || !service) {
        return NextResponse.json({ error: 'Suppression indisponible pour le moment.' }, { status: 500 });
    }

    if (!memeOrigine(request)) {
        return NextResponse.json({ error: 'Requête refusée.' }, { status: 403 });
    }
    if (trop(`suppression:${ipDe(request)}`, 5, 60 * 60_000)) {
        return NextResponse.json({ error: 'Trop de tentatives — reprends dans un moment.' }, { status: 429 });
    }

    const jeton = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!jeton) return NextResponse.json({ error: 'Connecte-toi pour supprimer ton compte.' }, { status: 401 });

    const enTantQue = createClient(url, anon, {
        global: { headers: { Authorization: `Bearer ${jeton}` } },
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user } } = await enTantQue.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Session expirée : reconnecte-toi.' }, { status: 401 });

    const admin = createClient(url, service, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    for (const table of TABLES as string[]) {
        const { error } = await admin.from(table).delete().eq('user_id', user.id);
        // Table absente du projet (jamais créée) : rien à effacer, on continue.
        if (error && error.code !== '42P01' && !/does not exist|schema cache/i.test(error.message)) {
            console.error('[supprimer-compte]', table, error.message);
            return NextResponse.json(
                { error: 'La suppression n’a pas pu aller au bout. Rien n’est perdu : réessaie, ou écris-nous.' },
                { status: 500 },
            );
        }
    }

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
        console.error('[supprimer-compte] compte', error.message);
        return NextResponse.json(
            { error: 'Tes données sont effacées, mais le compte résiste. Écris-nous, on finit à la main.' },
            { status: 500 },
        );
    }

    return NextResponse.json({ ok: true });
}
