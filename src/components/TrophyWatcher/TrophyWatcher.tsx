'use client';
/**
 * Révélation GLOBALE d'un trophée : dès qu'un badge se débloque n'importe où
 * (cocher une étape, ajouter un favori, planifier une semaine), son logo
 * s'affiche en grand 3 s au centre. Sobre — pas de confetti.
 * Monté une fois dans le shell (mobile + desktop).
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { pullNewlyUnlocked, TROPHY_ICON, type Trophy } from '@/lib/trophies';

export default function TrophyWatcher() {
    const [reveal, setReveal] = useState<Trophy | null>(null);
    const [mounted, setMounted] = useState(false);
    const queue = useRef<Trophy[]>([]);
    const busy = useRef(false);
    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        const drain = () => {
            if (busy.current) return;
            const t = queue.current.shift();
            if (!t) { setReveal(null); return; }
            busy.current = true; setReveal(t);
            window.setTimeout(() => { busy.current = false; drain(); }, 3000);
        };
        const check = () => {
            const newly = pullNewlyUnlocked();
            if (newly.length) { queue.current.push(...newly); drain(); }
        };
        // Léger différé : laisse les écritures localStorage se poser avant de lire.
        const onEvt = () => window.setTimeout(check, 150);
        const evts = ['tv-progress-change', 'magic-favorite-change', 'shoppingListUpdated', 'focus'];
        evts.forEach((e) => window.addEventListener(e, onEvt));
        check();
        return () => evts.forEach((e) => window.removeEventListener(e, onEvt));
    }, []);

    if (!mounted || !reveal) return null;
    return createPortal(
        <div className="trophyReveal" key={reveal.name}>
            <div className="ic" style={{ ['--t' as any]: reveal.tint }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={TROPHY_ICON[reveal.icon]} /></svg>
            </div>
            <div className="kick">Trophée débloqué</div>
            <div className="name">{reveal.name}</div>
            <style jsx>{`
                .trophyReveal { position: fixed; inset: 0; z-index: 5000; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px;
                    background: rgba(8,8,11,.86); -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px); animation: twFade .4s ease both; }
                .ic { width: 168px; height: 168px; border-radius: 999px; display: flex; align-items: center; justify-content: center; color: var(--t);
                    background: radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--t) 30%, transparent), transparent 70%);
                    box-shadow: 0 0 0 1px color-mix(in srgb, var(--t) 45%, transparent), 0 30px 90px color-mix(in srgb, var(--t) 35%, transparent);
                    animation: twPop .6s cubic-bezier(.32,.72,0,1) both; }
                .ic svg { width: 84px; height: 84px; }
                .kick { font-size: 12px; font-weight: 800; letter-spacing: .3em; text-transform: uppercase; color: rgba(235,235,245,.55); animation: twUp .5s .1s both; }
                .name { font-family: 'Outfit', sans-serif; font-weight: 900; font-size: 30px; letter-spacing: -.02em; text-transform: uppercase; transform: skewX(-5deg); color: #fff; animation: twUp .5s .18s both; }
                @keyframes twFade { from { opacity: 0; } to { opacity: 1; } }
                @keyframes twPop { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: none; } }
                @keyframes twUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
                @media (prefers-reduced-motion: reduce) { .ic, .kick, .name { animation: none; } }
            `}</style>
        </div>,
        document.body
    );
}
