'use client';
/**
 * Palmarès « Apple TV+ » — gamification discrète et premium (aucun emoji).
 * Lit l'activité réelle locale : recettes cuisinées (drapeaux recipe-cooking-*),
 * favoris, pays distincts cuisinés, semaine planifiée. Badges en icônes de trait.
 * À l'ouverture, un trophée fraîchement débloqué s'affiche en grand 3 s au centre.
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { mockRecipes } from '@/mobile/data/mockData';
import Tip from '@/components/Tip/Tip';

const COUNTRY_TAGS = ['france', 'italie', 'espagne', 'grece', 'liban', 'usa', 'mexique', 'orient', 'asie', 'afrique'];
const SEEN_KEY = 'trophies-seen-v1';

function cookedIds(): string[] {
    const out: string[] = [];
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i) || ''; if (k.startsWith('recipe-cooking-')) out.push(k.slice(15)); } } catch { /* noop */ }
    return out;
}
const ICON: Record<string, string> = {
    flame: 'M12 3c1.4 2.8.6 4.6-.9 6.1C9.4 10.8 8.5 12 8.5 14a3.5 3.5 0 0 0 7 0c0-1.2-.5-2.1-1-2.9 1.6.4 2.3 2 2.3 3.5A4.8 4.8 0 0 1 12 19.5 4.8 4.8 0 0 1 7 14.6c0-2.9 2-4.4 3.4-6.1C11.5 7 12 5.6 12 3z',
    hat: 'M6 13v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-5M5 13a3 3 0 0 1 .5-6 4 4 0 0 1 7.5-1 4 4 0 0 1 5.5 1A3 3 0 0 1 19 13z',
    pot: 'M4 10h16M6 10v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-7M9 10V7m6 3V7',
    heart: 'M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.7-7 9-7 9z',
    globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.6 9h16.8M3.6 15h16.8M12 3c2.5 2.4 2.5 15.6 0 18M12 3c-2.5 2.4-2.5 15.6 0 18',
    calendar: 'M7 3v3m10-3v3M3.5 9h17M5 5h14a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 19 21H5a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 5 5z',
};

interface Badge { icon: string; name: string; desc: string; val: number; goal: number; tint: string; }

export default function TVTrophies({ embedded = false }: { embedded?: boolean }) {
    const router = useRouter();
    const [cooked, setCooked] = useState<string[]>([]);
    const [favs, setFavs] = useState(0);
    const [hasWeek, setHasWeek] = useState(false);
    const [reveal, setReveal] = useState<Badge | null>(null);

    useEffect(() => {
        setCooked(cookedIds());
        try { setFavs((JSON.parse(localStorage.getItem('favorites') || '[]') || []).length); } catch { /* noop */ }
        try { const p = JSON.parse(localStorage.getItem('meal-planner-week') || '{}'); setHasWeek(Object.keys(p).some((d) => d !== 'JourJ' && Object.keys(p[d] || {}).length)); } catch { /* noop */ }
    }, []);

    const countries = useMemo(() => {
        const byId = new Map(mockRecipes.map((r: any) => [String(r.id), r]));
        const set = new Set<string>();
        cooked.forEach((id) => { const r: any = byId.get(id); (r?.tags || []).forEach((t: string) => { const k = t.toLowerCase(); if (COUNTRY_TAGS.includes(k)) set.add(k); }); });
        return set.size;
    }, [cooked]);

    const n = cooked.length;
    const badges = useMemo<Badge[]>(() => [
        { icon: 'flame', name: 'Première flamme', desc: 'Lance ta 1re préparation', val: n, goal: 1, tint: '#FF6B4A' },
        { icon: 'hat', name: 'Apprenti', desc: 'Cuisine 5 recettes', val: n, goal: 5, tint: '#FFC24B' },
        { icon: 'pot', name: 'Chef de maison', desc: 'Cuisine 20 recettes', val: n, goal: 20, tint: '#FF3B6B' },
        { icon: 'heart', name: 'Collectionneur', desc: '10 recettes en favoris', val: favs, goal: 10, tint: '#FF2E63' },
        { icon: 'globe', name: 'Tour du monde', desc: 'Cuisine 5 pays différents', val: countries, goal: 5, tint: '#0A84FF' },
        { icon: 'calendar', name: 'Organisé', desc: 'Planifie une semaine', val: hasWeek ? 1 : 0, goal: 1, tint: '#30D158' },
    ], [n, favs, countries, hasWeek]);

    const unlocked = badges.filter((b) => b.val >= b.goal).length;
    const streak = Math.min(7, Math.max(1, (n % 7) || (n ? 7 : 1)));

    // Révélation des trophées nouvellement débloqués (grand, centré, 3 s, sobre).
    useEffect(() => {
        let seen: string[] = [];
        try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { /* noop */ }
        const newly = badges.filter((b) => b.val >= b.goal && !seen.includes(b.name));
        if (!newly.length) return;
        try { localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...seen, ...newly.map((b) => b.name)])])); } catch { /* noop */ }
        let i = 0; let timer: any;
        const showNext = () => {
            if (i >= newly.length) { setReveal(null); return; }
            setReveal(newly[i]); i += 1;
            timer = setTimeout(showNext, 3000);
        };
        showNext();
        return () => clearTimeout(timer);
    }, [badges]);

    return (
        <div className={`tp ${embedded ? 'emb' : ''}`}>
            <header className="hd">
                {!embedded && (
                    <button className="back" onClick={() => router.push('/')} aria-label="Retour">
                        <svg viewBox="0 0 8 14" width="13" height="13" fill="none"><path d="M7 1L1 7l6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                )}
                <div><div className="kick">Ton profil</div><h1>Palmarès</h1></div>
            </header>

            <div className="stats">
                <div className="stat"><div className="v">{n}</div><div className="l">Recettes cuisinées</div></div>
                <div className="stat"><div className="v">{countries}</div><div className="l">Pays explorés</div></div>
                <div className="stat"><div className="v">{unlocked}<span className="tot">/{badges.length}</span></div><div className="l">Trophées</div></div>
            </div>

            <div className="streak">
                <div className="stTop"><span className="stTitle">Série en cours</span><span className="stN">{streak} jour{streak > 1 ? 's' : ''}</span></div>
                <div className="dots">{Array.from({ length: 7 }).map((_, k) => <span key={k} className={`d ${k < streak ? 'on' : ''}`} />)}</div>
            </div>

            <div className="grid">
                {badges.map((b) => {
                    const got = b.val >= b.goal;
                    return (
                        <div key={b.name} className={`badge ${got ? 'got' : ''}`} style={{ ['--t' as any]: b.tint }}>
                            <div className="ic">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={ICON[b.icon]} /></svg>
                            </div>
                            <div className="txt">
                                <div className="nm">{b.name}</div>
                                <div className="ds">{b.desc}</div>
                            </div>
                            {got ? <div className="ok">Débloqué</div> : <div className="pg"><span style={{ width: `${Math.min(100, (b.val / b.goal) * 100)}%` }} /></div>}
                        </div>
                    );
                })}
            </div>
            <p className="foot">Coche une étape dans une recette pour allumer ton premier trophée.</p>

            {reveal && (
                <div className="reveal" key={reveal.name}>
                    <div className="revIc" style={{ ['--t' as any]: reveal.tint }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={ICON[reveal.icon]} /></svg>
                    </div>
                    <div className="revKick">Trophée débloqué</div>
                    <div className="revName">{reveal.name}</div>
                </div>
            )}

            <style jsx>{`
                .tp { min-height: 100vh; background: radial-gradient(120% 80% at 50% -8%, #1a1420 0%, rgba(8,8,11,0) 55%), #08080b; color: #fff; padding: 28px 18px 90px; max-width: 820px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
                .tp.emb { min-height: 0; background: none; padding: 4px 4px 40px; max-width: none; }
                /* En panneau de bureau : même en-tête que les autres écrans du
                   menu — même corps, même point de départ (voir tv.module.css). */
                .tp.emb .hd { margin-bottom: 18px; padding-left: 4px; }
                .tp.emb h1 { font-size: 40px; line-height: 1; }
                .hd { display: flex; align-items: center; gap: 14px; margin-bottom: 22px; }
                .back { width: 40px; height: 40px; border-radius: 999px; border: none; background: rgba(255,255,255,.08); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; flex: 0 0 auto; }
                .kick { font-size: 11px; font-weight: 800; letter-spacing: .28em; text-transform: uppercase; color: rgba(235,235,245,.5); }
                h1 { font-family: 'Outfit', sans-serif; font-weight: 900; font-size: 32px; letter-spacing: -.03em; text-transform: uppercase; transform: skewX(-6deg); margin: 2px 0 0; }

                .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
                .stat { background: rgba(255,255,255,.05); box-shadow: inset 0 0 0 .5px rgba(255,255,255,.1); border-radius: 18px; padding: 18px 12px; text-align: center; }
                .v { font-family: 'Outfit', sans-serif; font-weight: 900; font-size: 34px; line-height: 1; }
                .tot { font-size: 17px; color: rgba(235,235,245,.4); }
                .l { font-size: 11.5px; color: rgba(235,235,245,.55); margin-top: 7px; }

                .streak { background: linear-gradient(120deg, rgba(255,107,74,.16), rgba(255,59,107,.1)); box-shadow: inset 0 0 0 .5px rgba(255,180,120,.3); border-radius: 18px; padding: 18px; margin-bottom: 20px; }
                .stTop { display: flex; justify-content: space-between; align-items: baseline; }
                .stTitle { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: rgba(235,235,245,.6); }
                .stN { font-family: 'Outfit', sans-serif; font-weight: 900; font-size: 19px; }
                .dots { display: flex; gap: 8px; margin-top: 14px; }
                .d { flex: 1; height: 8px; border-radius: 999px; background: rgba(255,255,255,.12); }
                .d.on { background: linear-gradient(90deg, #FFC24B, #FF6B4A); }

                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; }
                .badge { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px;
                    min-height: 190px; padding: 22px 16px 18px;
                    background: rgba(255,255,255,.05); box-shadow: inset 0 0 0 .5px rgba(255,255,255,.1); border-radius: 20px;
                    opacity: .5; transition: opacity .25s; }
                .badge.got { opacity: 1; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--t) 55%, transparent), 0 14px 34px color-mix(in srgb, var(--t) 20%, transparent); }
                .ic { width: 58px; height: 58px; border-radius: 999px; display: flex; align-items: center; justify-content: center;
                    background: rgba(255,255,255,.06); color: rgba(255,255,255,.45); flex: 0 0 auto; }
                .ic svg { width: 28px; height: 28px; }
                .badge.got .ic { background: color-mix(in srgb, var(--t) 22%, transparent); color: var(--t); }
                .txt { display: flex; flex-direction: column; gap: 4px; flex: 1 1 auto; justify-content: flex-start; }
                .nm { font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 16px; line-height: 1.1; }
                .ds { font-size: 12.5px; color: rgba(235,235,245,.5); line-height: 1.35; }
                .pg { width: 100%; height: 5px; border-radius: 999px; background: rgba(255,255,255,.1); overflow: hidden; margin-top: auto; }
                .pg span { display: block; height: 100%; background: linear-gradient(90deg, #FFC24B, #FF6B4A); }
                .ok { margin-top: auto; color: var(--t); font-size: 12px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
                .foot { color: rgba(235,235,245,.4); font-size: 12.5px; margin-top: 24px; text-align: center; }

                /* Révélation : logo en grand, centré, 3 s. Rien d'autre. */
                .reveal { position: fixed; inset: 0; z-index: 4000; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px;
                    background: rgba(8,8,11,.86); -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px);
                    animation: revFade .4s ease both; }
                .revIc { width: 168px; height: 168px; border-radius: 999px; display: flex; align-items: center; justify-content: center;
                    color: var(--t); background: radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--t) 30%, transparent), transparent 70%);
                    box-shadow: 0 0 0 1px color-mix(in srgb, var(--t) 45%, transparent), 0 30px 90px color-mix(in srgb, var(--t) 35%, transparent);
                    animation: revPop .6s cubic-bezier(.32,.72,0,1) both; }
                .revIc svg { width: 84px; height: 84px; }
                .revKick { font-size: 12px; font-weight: 800; letter-spacing: .3em; text-transform: uppercase; color: rgba(235,235,245,.55); animation: revUp .5s .1s both; }
                .revName { font-family: 'Outfit', sans-serif; font-weight: 900; font-size: 30px; letter-spacing: -.02em; text-transform: uppercase; transform: skewX(-5deg); animation: revUp .5s .18s both; }
                @keyframes revFade { from { opacity: 0; } to { opacity: 1; } }
                @keyframes revPop { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: none; } }
                @keyframes revUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
                @media (prefers-reduced-motion: reduce) { .revIc, .revKick, .revName { animation: none; } }
            `}</style>
            <Tip id="palmares" delay={2600} />
        </div>
    );
}
