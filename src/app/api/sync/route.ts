import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ipDe, trop } from '@/lib/garde-api';

/**
 * Déclencher la synchronisation du catalogue.
 * ===========================================
 *
 * Cette route lance un workflow GitHub Actions AVEC le jeton personnel du
 * dépôt. Elle acceptait n'importe quel POST : n'importe qui pouvait donc faire
 * tourner la chaîne en boucle, brûler les minutes d'exécution et déclencher
 * des commits du bot. Elle demande maintenant deux choses :
 *
 *   • une session (c'est un geste d'administration, pas une page publique) ;
 *   • un rythme humain — cinq lancements par heure suffisent largement à qui
 *     publie des recettes, et empêchent la boucle.
 */
export async function POST(request: Request): Promise<Response> {
    const urlSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const jeton = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!urlSupabase || !anon || !jeton) {
        return NextResponse.json({ error: 'Connecte-toi pour lancer la synchronisation.' }, { status: 401 });
    }
    const supabase = createClient(urlSupabase, anon, {
        global: { headers: { Authorization: `Bearer ${jeton}` } },
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Session expirée : reconnecte-toi.' }, { status: 401 });
    }
    if (trop(`sync:${ipDe(request)}`, 5, 60 * 60_000)) {
        return NextResponse.json({ error: 'Synchronisation déjà lancée plusieurs fois cette heure-ci.' }, { status: 429 });
    }

    try {
        // Lire le body pour obtenir la source du déclenchement
        let triggerSource = 'triple-click';
        try {
            const body = await request.json();
            triggerSource = body.trigger_source || triggerSource;
        } catch (_) {}

        if (process.env.NODE_ENV === 'development') {
            console.log('Mode dev: Lancement de la synchronisation locale...');
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execPromise = promisify(exec);
            await execPromise('node sync-recipes.js');
            return NextResponse.json({ message: 'Synchronisation locale réussie.', status: 'success' });
        }

        const githubToken = process.env.GITHUB_PAT;
        if (!githubToken) {
            console.error('❌ GITHUB_PAT non configuré dans les variables Vercel !');
            return NextResponse.json({ 
                error: 'GITHUB_PAT non configuré. Allez dans Vercel → Settings → Environment Variables et ajoutez GITHUB_PAT avec un token GitHub ayant accès aux Actions.' 
            }, { status: 500 });
        }

        const githubRepo = 'm4nur0ssi/Ag---Projet-site-cuisine';
        const workflowId = 'auto-recipe.yml';

        console.log(`🚀 Déclenchement synchronisation via GitHub Actions (source: ${triggerSource})...`);

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
                    video_url: '',       // Pas de vidéo, sync général
                    country: '',
                    trigger_source: triggerSource
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ GitHub API error: ${response.status} - ${errorText}`);
            throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
        }

        console.log('✅ Pipeline GitHub Actions déclenchée avec succès');
        return NextResponse.json({ 
            message: 'Synchronisation lancée !', 
            status: 'queued',
            trigger: triggerSource,
            details: 'GitHub Actions synchronise toutes les recettes WordPress. Les changements apparaîtront dans 2-3 minutes.'
        });
    } catch (error: any) {
        console.error(`Sync error: ${error.message}`);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
