'use client';
/**
 * Palmarès « Apple TV+ » — gamification discrète et premium (aucun emoji).
 * Lit l'activité réelle locale : recettes cuisinées (drapeaux recipe-cooking-*),
 * favoris, pays distincts cuisinés, semaine planifiée. Badges en icônes de trait.
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { mockRecipes } from '@/mobile/data/mockData';

const COUNTRY_TAGS = ['france', 'italie', 'espagne', 'grece', 'liban', 'usa', 'mexique', 'orient', 'asie', 'afrique'];

function cookedIds(): string[] {
    const out: string[] = [];
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i) || ''; if (k.startsWith('recipe-cooking-')) out.push(k.slice(15)); } } catch { /* noop */ }
    return out;
}
const ICON: Record<string, string> = {
    flame: 'M12 3c1.4 2.8.6 4.6-.9 6.1C9.4 10.8 8.5 12 8.5 14a3.5 3.5 0 0 0 7 0c0-1.2-.5-2.1-1-2.9 1.6.4 2.3 2 2.3 3.5A4.8 4.8 0 0 1 12 19.5 4.8 4.8 0 0 1 7 14.6c0-2.9 2-4.4 3.4-6.1C11.5 7 12 5.6 12 3z',
    hat: 'M6 13v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-5M5 13a3 3 0 0 1 .5-6 4 4 0 0 1 7.5-1 4 4 0 0 1 5.5 1A3 3 0 0 1 19 13z',
    pot: 'M4 10h16M6 10v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-7M9 10V7m6 3V7M3 10h1m16 0h1',
    heart: 'M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.7-7 9-7 9z',
    globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.6 9h16.8M3.6 15h16.8M12 3c2.5 2.4 2.5 15.6 0 18M12 3c-2.5 2.4-2.5 15.6 0 18',
    calendar: 'M7 3v3m10-3v3M3.5 9h17M5 5h14a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 19 21H5a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 5 5z',
};

export default function TVTrophies({ embedded = false }: { embedded?: boolean }) {
    const router = useRouter();
    const [cooked, setCooked] = useState<string[]>([]);
    const [favs, setFavs] = useState(0);
    const [hasWeek, setHasWeek] = useState(false);
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
    const badges = [
        { icon: 'flame', name: 'Première flamme', desc: 'Lance ta 1re préparation', val: n, goal: 1, tint: '#FF6B4A' },
        { icon: 'hat', name: 'Apprenti', desc: 'Cuisine 5 recettes', val: n, goal: 5, tint: '#FFC24B' },
        { icon: 'pot', name: 'Chef de maison', desc: 'Cuisine 20 recettes', val: n, goal: 20, tint: '#FF3B6B' },
        { icon: 'heart', name: 'Collectionneur', desc: '10 recettes en favoris', val: favs, goal: 10, tint: '#FF2E63' },
        { icon: 'globe', name: 'Tour du monde', desc: 'Cuisine 5 pays différents', val: countries, goal: 5, tint: '#0A84FF' },
        { icon: 'calendar', name: 'Organisé', desc: 'Planifie une semaine', val: hasWeek ? 1 : 0, goal: 1, tint: '#30D158' },
    ];
    const unlocked = badges.filter((b) => b.val >= b.goal).length;
    const streak = Math.min(7, Math.max(1, (n % 7) || (n ? 7 : 1)));

    return (
        <div className={`tp ${embedded ? 'emb' : ''}`}>
            {!embedded && (
                <header className="hd">
                    <button className="back" onClick={() => router.push('/')} aria-label="Retour">
                        <svg viewBox="0 0 8 14" width="13" height="13" fill="none"><path d="M7 1L1 7l6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                    <div><div className="kick">Ton profil</div><h1>Palmarès</h1></div>
                </header>
            )}

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
                            <div className="nm">{b.name}</div>
                            <div className="ds">{b.desc}</div>
                            {got ? <div className="ok">Débloqué</div> : <div className="pg"><span style={{ width: `${Math.min(100, (b.val / b.goal) * 100)}%` }} /></div>}
                        </div>
                    );
                })}
            </div>
            <p className="foot">Coche une étape dans une recette pour allumer ton premier trophée.</p>

            <style jsx>{`
                .tp { min-height: 100vh; background: radial-gradient(120% 80% at 50% -8%, #1a1420 0%, rgba(8,8,11,0) 55%), #08080b; color: #fff; padding: 28px 18px 90px; max-width: 760px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
                .tp.emb { min-height: 0; background: none; padding: 8px 4px 40px; }
                .hd { display: flex; align-items: center; gap: 14px; margin-bottom: 22px; }
                .back { width: 40px; height: 40px; border-radius: 999px; border: none; background: rgba(255,255,255,.08); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; }
                .kick { font-size: 11px; font-weight: 800; letter-spacing: .28em; text-transform: uppercase; color: rgba(235,235,245,.5); }
                h1 { font-family: 'Outfit', sans-serif; font-weight: 900; font-size: 30px; letter-spacing: -.03em; text-transform: uppercase; transform: skewX(-6deg); margin: 2px 0 0; }
                .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
                .stat { background: rgba(255,255,255,.05); box-shadow: inset 0 0 0 .5px rgba(255,255,255,.1); border-radius: 16px; padding: 16px 12px; text-align: center; }
                .v { font-family: 'Outfit', sans-serif; font-weight: 900; font-size: 30px; line-height: 1; }
                .tot { font-size: 16px; color: rgba(235,235,245,.4); }
                .l { font-size: 11.5px; color: rgba(235,235,245,.55); margin-top: 6px; }
                .streak { background: linear-gradient(120deg, rgba(255,107,74,.16), rgba(255,59,107,.1)); box-shadow: inset 0 0 0 .5px rgba(255,180,120,.3); border-radius: 16px; padding: 16px; margin-bottom: 20px; }
                .stTop { display: flex; justify-content: space-between; align-items: baseline; }
                .stTitle { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: rgba(235,235,245,.6); }
                .stN { font-family: 'Outfit', sans-serif; font-weight: 900; font-size: 18px; }
                .dots { display: flex; gap: 8px; margin-top: 12px; }
                .d { flex: 1; height: 8px; border-radius: 999px; background: rgba(255,255,255,.12); }
                .d.on { background: linear-gradient(90deg, #FFC24B, #FF6B4A); }
                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
                .badge { background: rgba(255,255,255,.05); box-shadow: inset 0 0 0 .5px rgba(255,255,255,.1); border-radius: 18px; padding: 18px 14px; text-align: center; opacity: .55; transition: opacity .2s; }
                .badge.got { opacity: 1; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--t) 55%, transparent), 0 12px 30px color-mix(in srgb, var(--t) 20%, transparent); }
                .ic { width: 52px; height: 52px; margin: 0 auto 10px; border-radius: 999px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.06); color: rgba(255,255,255,.5); }
                .ic svg { width: 26px; height: 26px; }
                .badge.got .ic { background: color-mix(in srgb, var(--t) 22%, transparent); color: var(--t); }
                .nm { font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 14.5px; }
                .ds { font-size: 11.5px; color: rgba(235,235,245,.5); margin-top: 3px; line-height: 1.35; }
                .pg { height: 5px; border-radius: 999px; background: rgba(255,255,255,.1); margin-top: 12px; overflow: hidden; }
                .pg span { display: block; height: 100%; background: linear-gradient(90deg, #FFC24B, #FF6B4A); }
                .ok { color: var(--t); font-size: 11.5px; font-weight: 800; margin-top: 12px; letter-spacing: .02em; }
                .foot { color: rgba(235,235,245,.4); font-size: 12.5px; margin-top: 22px; text-align: center; }
            `}</style>
        </div>
    );
}
