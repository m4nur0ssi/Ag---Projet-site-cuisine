import { NextResponse } from 'next/server';

/*
 * Quelle version du site le serveur sert-il EN CE MOMENT ?
 *
 * La valeur est figée à la construction (next.config.js), dans le code du
 * serveur comme dans celui du navigateur. Une page ouverte qui reçoit ici une
 * autre valeur que la sienne sait qu'un déploiement a eu lieu depuis.
 *
 * Jamais mise en cache : c'est justement le changement qu'on veut voir.
 */
export const dynamic = 'force-dynamic';

export function GET() {
    return NextResponse.json(
        { version: process.env.NEXT_PUBLIC_VERSION_APP || '' },
        { headers: { 'cache-control': 'no-store, max-age=0' } },
    );
}
