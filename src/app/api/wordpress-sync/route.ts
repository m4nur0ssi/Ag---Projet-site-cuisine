import { NextResponse } from 'next/server';

/**
 * Endpoint pour WP Webhooks (WordPress).
 * URL à configurer dans WP Webhooks → Send Data → Post updated :
 * https://lesrecettesmagiques.vercel.app/api/wordpress-sync?secret=2TlsVemp
 *
 * Quand WordPress publie/modifie une recette → déclenche wp-sync.yml sur GitHub
 * → mockData.ts mis à jour → les 2 sites Vercel se reconstruisent automatiquement
 */
export async function POST(request: Request) {
    try {
        console.log('🔄 Webhook WordPress reçu...');

        const { searchParams } = new URL(request.url);
        const envSecret = process.env.WEBHOOK_SECRET || '2TlsVemp';

        // Lecture du secret (query string ou body)
        let secret = searchParams.get('secret') || '';
        let body: any = {};

        try {
            const text = await request.text();
            if (text) {
                try {
                    body = JSON.parse(text);
                } catch {
                    const match = text.match(/secret=([^&\s]+)/);
                    if (match) secret = match[1];
                }
            }
        } catch (_) {}

        if (!secret && body.secret) secret = body.secret;

        const headerSecret = request.headers.get('x-wp-secret') || request.headers.get('x-webhook-secret') || '';
        if (!secret && headerSecret) secret = headerSecret;

        if (!secret) {
            return NextResponse.json({ error: 'Secret manquant' }, { status: 401 });
        }

        if (secret !== envSecret) {
            console.error(`❌ Secret invalide: "${secret}"`);
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        const githubToken = process.env.GITHUB_PAT;
        if (!githubToken) {
            return NextResponse.json({ error: 'GITHUB_PAT non configuré sur Vercel' }, { status: 500 });
        }

        // Extraction de l'ID du post si dispo
        const postId = body?.post?.ID || body?.post?.id || body?.post_id || body?.ID || '';
        
        // Extraction de l'action de WordPress
        const wpAction = body?.action || searchParams.get('action') || 'post_update';
        let githubEventType = 'wp_recipe_updated';

        if (wpAction.includes('create') || wpAction === 'post_published') {
            githubEventType = 'wp_recipe_published';
        } else if (wpAction.includes('delete') || wpAction.includes('trash')) {
            githubEventType = 'wp_recipe_deleted';
        }

        console.log(`🚀 Déclenchement wp-sync.yml (action: ${githubEventType}, post_id: ${postId || 'inconnu'})`);

        // Déclenche wp-sync.yml via repository_dispatch
        const response = await fetch('https://api.github.com/repos/m4nur0ssi/Ag---Projet-site-cuisine/dispatches', {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `Bearer ${githubToken}`,
                'Content-Type': 'application/json',
                'User-Agent': 'RecetteMagique',
            },
            body: JSON.stringify({
                event_type: githubEventType,
                client_payload: {
                    trigger: 'wordpress-webhook',
                    post_id: String(postId),
                    timestamp: new Date().toISOString(),
                }
            })
        });

        if (response.status !== 204) {
            const err = await response.text();
            console.error(`❌ GitHub API error ${response.status}: ${err}`);
            throw new Error(`GitHub API: ${response.status}`);
        }

        console.log('✅ GitHub notifié — synchronisation en cours !');
        return NextResponse.json({
            success: true,
            message: 'Les 2 sites se mettent à jour ! Visible dans 2-3 minutes. ✨',
        });

    } catch (error: any) {
        console.error(`❌ Erreur Webhook WordPress: ${error.message}`);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// GET : test de connectivité
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const envSecret = process.env.WEBHOOK_SECRET || '2TlsVemp';
    const ok = secret === envSecret;

    return NextResponse.json({
        status: ok ? 'ready ✅' : 'accessible (secret manquant)',
        url_a_configurer: `${new URL(request.url).origin}/api/wordpress-sync?secret=${envSecret}`,
        instructions: 'WP Webhooks → Send Data → Post updated → Add Webhook URL → coller l\'URL ci-dessus',
    });
}
