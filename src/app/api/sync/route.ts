import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<Response> {
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

        const githubRepo = 'm4nur0ssi/magie-cuisine-tiktok';
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
