import { NextResponse } from 'next/server';

/**
 * Endpoint pour la synchronisation automatique depuis WordPress
 * Utilisé par le plugin WP Webhooks (ou équivalent)
 * 
 * URL à configurer dans WP Webhooks:
 * https://[votre-app].vercel.app/api/wordpress-sync?secret=2TlsVemp
 * 
 * Déclenché sur : création, modification, suppression de recettes sur WordPress
 */
export async function POST(request: Request) {
    try {
        console.log('🔄 Webhook WordPress reçu...');
        
        const { searchParams } = new URL(request.url);
        const envSecret = process.env.WEBHOOK_SECRET || '2TlsVemp';

        // Support du secret dans query string, body JSON, ou header X-WP-Secret
        let secret = searchParams.get('secret') || '';
        
        // Tenter de lire le body pour trouver le secret dedans
        let body: any = {};
        try {
            const text = await request.text();
            if (text) {
                try { body = JSON.parse(text); } catch {
                    // Body non-JSON (form-urlencoded, text brut...)
                    // Chercher secret=xxx dans le body texte
                    const bodySecretMatch = text.match(/secret=([^&\s]+)/);
                    if (bodySecretMatch) secret = bodySecretMatch[1];
                }
            }
        } catch (_) {}

        // Secret peut aussi être dans le body JSON
        if (!secret && body.secret) secret = body.secret;
        
        // Ou dans le header X-WP-Secret
        const headerSecret = request.headers.get('x-wp-secret') || request.headers.get('x-webhook-secret') || '';
        if (!secret && headerSecret) secret = headerSecret;

        // Si aucun secret fourni du tout → on bloque
        if (!secret) {
            console.error('❌ Webhook WordPress : Aucun secret fourni');
            return NextResponse.json({ 
                error: 'Secret manquant. Ajoutez ?secret=VOTRE_SECRET à l\'URL du webhook.' 
            }, { status: 401 });
        }

        if (secret !== envSecret) {
            console.error(`❌ Webhook WordPress : Secret invalide (reçu: "${secret}")`);
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        const githubToken = process.env.GITHUB_PAT;
        if (!githubToken) {
            console.error('❌ GITHUB_PAT non configuré dans les variables Vercel');
            return NextResponse.json({ error: 'GITHUB_PAT non configuré. Ajoutez-le dans les variables d\'environnement Vercel.' }, { status: 500 });
        }

        const githubRepo = 'm4nur0ssi/magie-cuisine-tiktok';
        const workflowId = 'auto-recipe.yml';

        // Déterminer le type d'action WordPress (publier, modifier, supprimer)
        const action = body.action || body.hook || body.trigger || 'wordpress';
        const isDeletion = action.includes('delete') || action.includes('trash') || action.includes('remove');
        
        // --- EXTRACTION DE L'ID DU POST ---
        let postId = '';
        if (body.post && (body.post.ID || body.post.id)) {
            postId = (body.post.ID || body.post.id).toString();
        } else if (body.post_id || body.ID || body.id) {
            postId = (body.post_id || body.ID || body.id).toString();
        }

        // On construit une source descriptive pour le robot
        const triggerSource = `${action}${postId ? `_${postId}` : ''}`;
        console.log(`🚀 Webhook WP: Action=${action}, ID=${postId}, isDeletion=${isDeletion}`);

        const response = await fetch(`https://api.github.com/repos/${githubRepo}/actions/workflows/${workflowId}/dispatches`, {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `Bearer ${githubToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ref: 'main',
                inputs: {
                    video_url: '',
                    country: '',
                    trigger_source: triggerSource,
                    delete_id: isDeletion ? postId : '' 
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Erreur GitHub API: ${response.status} ${errorText}`);
            throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
        }

        console.log('✅ Pipeline GitHub déclenchée avec succès');
        return NextResponse.json({ 
            success: true, 
            message: 'Pipeline de synchronisation lancée ! ✨',
            details: 'Les changements (image, suppression, modification...) seront visibles dans 2-3 minutes sur le site.',
            trigger: triggerSource
        });

    } catch (error: any) {
        console.error(`❌ Erreur Webhook WordPress: ${error.message}`);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// GET : test de connectivité et instructions
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const envSecret = process.env.WEBHOOK_SECRET || '2TlsVemp';
    
    const isAuthenticated = secret === envSecret;
    
    return NextResponse.json({ 
        status: 'ready',
        message: isAuthenticated 
            ? '✅ Endpoint prêt. Configurez ce hook dans WP Webhooks.'
            : '⚠️ Endpoint accessible, mais secret manquant ou invalide.',
        instructions: {
            url: `${new URL(request.url).origin}/api/wordpress-sync?secret=${envSecret}`,
            method: 'POST',
            events: ['post_published', 'post_updated', 'post_deleted', 'attachment_updated'],
            note: 'Ajoute cette URL dans WP Webhooks → Send Data sur chaque événement souhaité'
        }
    });
}
