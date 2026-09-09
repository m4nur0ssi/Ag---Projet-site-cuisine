import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { corpsJson, ipDe, trop } from '@/lib/garde-api';

/**
 * Publier un menu derrière un lien.
 * =================================
 *
 * L'instantané est rangé sous un jeton court et imprévisible : c'est lui, et
 * lui seul, qui donne accès. La table n'autorise aucune lecture publique — la
 * page va chercher le menu côté serveur, par identifiant. Sans ça, la clé
 * publique du site permettrait de demander « donne-moi tous les menus », et le
 * jeton ne protégerait plus rien.
 */

export const runtime = 'nodejs';

/** Alphabet sans les caractères qu'on confond en les lisant à voix haute. */
const ALPHABET = '23456789abcdefghijkmnpqrstuvwxyz';

function jetonCourt(longueur = 12): string {
    const octets = crypto.getRandomValues(new Uint8Array(longueur));
    return Array.from(octets, (o) => ALPHABET[o % ALPHABET.length]).join('');
}

export async function POST(request: Request) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 });

    const jeton = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!jeton) return NextResponse.json({ error: 'Connecte-toi pour partager ton menu.' }, { status: 401 });

    // Le menu s'écrit sous l'identité de la personne : les règles de la table
    // s'appliquent telles quelles, sans clé de service.
    const supabase = createClient(url, anon, {
        global: { headers: { Authorization: `Bearer ${jeton}` } },
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Session expirée : reconnecte-toi.' }, { status: 401 });

    if (trop(`partage:${ipDe(request)}`, 20, 60 * 60_000)) {
        return NextResponse.json({ error: 'Beaucoup de partages d’un coup — reprends dans un moment.' }, { status: 429 });
    }

    const corps = await corpsJson<any>(request, 200_000);
    const menu = corps?.menu;
    if (!menu || !Array.isArray(menu.jours) || !menu.jours.length) {
        return NextResponse.json({ error: 'Ce menu est vide : compose-le d’abord.' }, { status: 400 });
    }

    // On ne range que ce que la page publique affiche : ni identifiants de
    // compte, ni notes personnelles, ni ce qui traîne dans l'appareil.
    const propre = {
        mode: menu.mode === 'jourj' ? 'jourj' : 'semaine',
        titre: String(menu.titre || 'Le menu').slice(0, 80),
        jours: menu.jours.slice(0, 8).map((j: any) => ({
            jour: String(j?.jour || '').slice(0, 30),
            plats: (Array.isArray(j?.plats) ? j.plats : []).slice(0, 8).map((p: any) => ({
                creneau: String(p?.creneau || '').slice(0, 30),
                id: String(p?.id || '').slice(0, 64),
                titre: String(p?.titre || '').slice(0, 160),
                image: typeof p?.image === 'string' ? p.image.slice(0, 400) : undefined,
                minutes: Number.isFinite(Number(p?.minutes)) ? Number(p.minutes) : undefined,
            })),
        })),
        courses: (Array.isArray(menu.courses) ? menu.courses : []).slice(0, 12).map((r: any) => ({
            rayon: String(r?.rayon || 'Divers').slice(0, 40),
            lignes: (Array.isArray(r?.lignes) ? r.lignes : []).slice(0, 60).map((l: any) => String(l).slice(0, 120)),
        })),
    };

    const id = jetonCourt();
    const { error } = await supabase.from('shared_menus').insert({
        id,
        user_id: user.id,
        titre: propre.titre,
        menu: propre,
        courses: propre.courses,
    });
    if (error) {
        console.error('[partager-menu]', error.message);
        return NextResponse.json({ error: 'Je n’ai pas pu publier ce menu.' }, { status: 500 });
    }

    const origine = new URL(request.url).origin;
    return NextResponse.json({ id, url: `${origine}/menu/${id}` });
}
