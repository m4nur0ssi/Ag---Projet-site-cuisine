'use client';

import { useEffect, useState } from 'react';
import { rechargerSiChunkPerime } from '@/lib/chunkPerime';

/**
 * L'écran d'erreur de DERNIER recours.
 *
 * `error.tsx` rattrape ce qui casse dans une page ; celui-ci rattrape ce qui
 * casse dans la mise en page racine elle-même. Il doit donc rendre `<html>` et
 * `<body>` : à ce stade, plus rien du gabarit de l'application ne tient debout.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    /*
     * Une page plus vieille que le site réclame un fichier qui n'existe plus :
     * ce n'est pas un plantage, c'est une version périmée. On recharge, une
     * fois — le nouveau document connaît les nouveaux fichiers.
     */
    const [recharge, setRecharge] = useState(false);
    useEffect(() => {
        if (rechargerSiChunkPerime(error)) { setRecharge(true); return; }
        // La console garde le détail complet pour qui vient regarder.
        console.error('[erreur]', error);
    }, [error]);

    // Le rechargement est lancé : ne rien montrer plutôt qu'un écran d'erreur
    // qui disparaîtrait aussitôt.
    if (recharge) return <html lang="fr"><body style={{ margin: 0, background: '#0a0a0c' }} /></html>;

    return (
        <html lang="fr">
        <body style={{ margin: 0 }}>
        <div style={enveloppe}>
            <div style={carte}>
                <p style={surtitre}>Les recettes magiques</p>
                <h1 style={titre}>Quelque chose a cassé</h1>
                <p style={texte}>
                    Ce n{'’'}est pas toi. Recharge la page : ce qui est enregistré — favoris, liste de
                    courses, planning — n{'’'}a pas bougé.
                </p>

                {(error?.message || error?.digest) && (
                    <p style={detail}>
                        {error.message || 'Erreur inconnue'}
                        {error.digest ? ` · ${error.digest}` : ''}
                    </p>
                )}

                <div style={boutons}>
                    <button style={secondaire} onClick={() => { window.location.href = '/'; }}>
                        Accueil
                    </button>
                    <button style={principal} onClick={reset}>Réessayer</button>
                </div>
            </div>
        </div>
        </body>
        </html>
    );
}

const enveloppe: React.CSSProperties = {
    minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24, background: '#0a0a0c', color: '#fff',
    fontFamily: '-apple-system, system-ui, sans-serif',
};
const carte: React.CSSProperties = { width: '100%', maxWidth: 380, textAlign: 'center' };
const surtitre: React.CSSProperties = {
    margin: '0 0 10px', fontSize: 11, fontWeight: 800, letterSpacing: '0.18em',
    textTransform: 'uppercase', color: '#ff6b4a',
};
const titre: React.CSSProperties = { margin: '0 0 12px', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' };
const texte: React.CSSProperties = { margin: '0 0 18px', fontSize: 15, lineHeight: 1.5, color: 'rgba(235,235,245,0.65)' };
const detail: React.CSSProperties = {
    margin: '0 0 22px', padding: '10px 12px', borderRadius: 12,
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.45,
    color: 'rgba(235,235,245,0.55)', wordBreak: 'break-word',
};
const boutons: React.CSSProperties = { display: 'flex', gap: 10 };
const base: React.CSSProperties = {
    flex: 1, height: 50, border: 'none', borderRadius: 16,
    fontSize: 15.5, fontWeight: 800, cursor: 'pointer',
};
const secondaire: React.CSSProperties = { ...base, background: 'rgba(255,255,255,0.1)', color: '#fff' };
const principal: React.CSSProperties = {
    ...base, background: 'linear-gradient(120deg, #FFC24B, #FF6B4A 60%, #FF3B6B)', color: '#180a06',
};
