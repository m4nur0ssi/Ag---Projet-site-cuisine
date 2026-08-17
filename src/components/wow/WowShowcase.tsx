'use client';
/**
 * Vitrine locale « effet wahou » (route /wow). Prototypes jouables, autonomes,
 * NON reliés à la prod. Quatre démos : Goûts (onboarding), Soirée (timeline de
 * préparation), Partage (carte story sur canvas), Trophées (gamification).
 *
 * Ce qui n'est PAS ici, car non faisable en web pur : widgets iOS / Live
 * Activity (natif), liste de courses partagée en temps réel (backend realtime).
 */
import { useMemo, useRef, useState, useEffect } from 'react';
import { mockRecipes } from '@/mobile/data/mockData';
import { estimateRecipeTiming } from '@/lib/recipe-timing';

type Tab = 'gouts' | 'soiree' | 'partage' | 'trophees';
const cookable = mockRecipes.filter((r: any) => r.category !== 'restaurant' && r.image && (r.steps?.length || 0) > 1);
const pick = (n: number, seed = 0) => cookable.slice(seed).filter((_, i) => i % 2 === 0).slice(0, n);
const decode = (s: string) => (typeof document === 'undefined' ? s : Object.assign(document.createElement('textarea'), { innerHTML: s }).value);
const totalMin = (r: any) => { const t = estimateRecipeTiming(r.steps); return t.prepTime + t.cookTime; };

export default function WowShowcase() {
    const [tab, setTab] = useState<Tab>('gouts');
    const TABS: [Tab, string, string][] = [
        ['gouts', 'Goûts', '❤️'],
        ['soiree', 'Soirée', '🕗'],
        ['partage', 'Partage', '📸'],
        ['trophees', 'Trophées', '🏆'],
    ];
    return (
        <div className="wow">
            <header className="hd">
                <div className="kick">Prototypes locaux</div>
                <h1>Effet wahou</h1>
                <p className="sub">Démos jouables — rien n&apos;est publié. <span className="dim">/wow</span></p>
            </header>

            <nav className="tabs">
                {TABS.map(([id, label, emo]) => (
                    <button key={id} className={`tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>
                        <span className="emo">{emo}</span>{label}
                    </button>
                ))}
            </nav>

            <main className="body">
                {tab === 'gouts' && <Gouts />}
                {tab === 'soiree' && <Soiree />}
                {tab === 'partage' && <Partage />}
                {tab === 'trophees' && <Trophees />}
            </main>

            <style jsx>{`
                .wow { min-height: 100vh; background: radial-gradient(120% 80% at 50% -10%, #1a1420 0%, rgba(8,8,11,0) 55%), #08080b; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif; padding: 28px 18px 80px; max-width: 900px; margin: 0 auto; }
                .hd { text-align: center; margin-bottom: 20px; }
                .kick { font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 800; letter-spacing: .3em; text-transform: uppercase; color: rgba(235,235,245,.5); }
                .hd h1 { font-family: 'Outfit', sans-serif; font-weight: 900; font-size: clamp(30px,7vw,46px); letter-spacing: -.03em; text-transform: uppercase; transform: skewX(-6deg); margin: 6px 0 4px; }
                .sub { color: rgba(235,235,245,.6); font-size: 14px; }
                .dim { color: rgba(235,235,245,.35); }
                .tabs { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-bottom: 24px; }
                .tab { display: inline-flex; align-items: center; gap: 7px; height: 40px; padding: 0 16px; border: none; border-radius: 999px; background: rgba(255,255,255,.07); box-shadow: inset 0 0 0 .5px rgba(255,255,255,.1); color: #fff; font-size: 14.5px; font-weight: 600; cursor: pointer; transition: transform .16s ease, background .2s; }
                .tab:active { transform: scale(.94); }
                .tab.on { background: #fff; color: #111; }
                .tab .emo { font-size: 15px; }
            `}</style>
        </div>
    );
}

/* ─────────────────────────── 1 · GOÛTS (onboarding) ─────────────────────── */
function Gouts() {
    const deck = useMemo(() => pick(10, 3), []);
    const [idx, setIdx] = useState(0);
    const [liked, setLiked] = useState<any[]>([]);
    const done = idx >= deck.length;
    const swipe = (love: boolean) => {
        if (love) setLiked((l) => [...l, deck[idx]]);
        setIdx((i) => i + 1);
    };
    // Accueil personnalisé : recettes partageant catégorie/tags avec les aimées.
    const reco = useMemo(() => {
        if (!liked.length) return [];
        const cats = new Set(liked.map((r) => r.category));
        const tags = new Set(liked.flatMap((r) => (r.tags || []).map((t: string) => t.toLowerCase())));
        const likedIds = new Set(liked.map((r) => String(r.id)));
        return cookable
            .filter((r: any) => !likedIds.has(String(r.id)))
            .map((r: any) => {
                let s = cats.has(r.category) ? 2 : 0;
                s += (r.tags || []).filter((t: string) => tags.has(t.toLowerCase())).length;
                return { r, s };
            })
            .filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 8).map((x) => x.r);
    }, [liked]);

    return (
        <section className="g">
            <h2 className="h2">On apprend tes goûts</h2>
            <p className="p">Aime ou passe : l&apos;accueil se personnalise en direct.</p>

            {!done ? (
                <div className="stage">
                    {deck.slice(idx, idx + 3).reverse().map((r, k, arr) => {
                        const top = k === arr.length - 1;
                        return (
                            <div key={r.id} className="card" style={{ transform: `translateY(${(arr.length - 1 - k) * 10}px) scale(${1 - (arr.length - 1 - k) * 0.04})`, zIndex: k, opacity: top ? 1 : 0.6 }}>
                                <img src={r.image} alt="" />
                                <div className="scrim" />
                                <div className="meta"><span className="cat">{r.category}</span><div className="ttl">{decode(r.title)}</div></div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="doneWrap">
                    <div className="doneTitle">✨ {liked.length} coup{liked.length > 1 ? 's' : ''} de cœur</div>
                    <p className="p">Voici ton accueil, rien qu&apos;à toi :</p>
                    <div className="row">
                        {reco.map((r) => (
                            <div key={r.id} className="mini"><img src={r.image} alt="" /><span>{decode(r.title)}</span></div>
                        ))}
                    </div>
                    <button className="again" onClick={() => { setIdx(0); setLiked([]); }}>Recommencer</button>
                </div>
            )}

            {!done && (
                <div className="ctrls">
                    <button className="no" onClick={() => swipe(false)} aria-label="Passer">✕</button>
                    <div className="count">{idx + 1} / {deck.length}</div>
                    <button className="yes" onClick={() => swipe(true)} aria-label="J'aime">♥</button>
                </div>
            )}

            <style jsx>{`
                .h2 { font-family: 'Outfit', sans-serif; font-weight: 900; text-transform: uppercase; transform: skewX(-6deg); font-size: 22px; margin: 0 0 4px; }
                .p { color: rgba(235,235,245,.6); font-size: 14px; margin: 0 0 18px; }
                .stage { position: relative; height: 400px; max-width: 320px; margin: 0 auto; }
                .card { position: absolute; inset: 0; border-radius: 22px; overflow: hidden; box-shadow: 0 30px 70px rgba(0,0,0,.6), inset 0 0 0 .5px rgba(255,255,255,.14); transition: transform .3s cubic-bezier(.32,.72,0,1), opacity .3s; }
                .card img { width: 100%; height: 100%; object-fit: cover; }
                .scrim { position: absolute; inset: 0; background: linear-gradient(0deg, rgba(8,8,11,.9), transparent 55%); }
                .meta { position: absolute; left: 18px; right: 18px; bottom: 18px; }
                .cat { font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; color: #FF6B4A; }
                .ttl { font-family: 'Outfit', sans-serif; font-weight: 900; font-size: 24px; line-height: 1.05; text-transform: uppercase; transform: skewX(-5deg); margin-top: 6px; }
                .ctrls { display: flex; align-items: center; justify-content: center; gap: 28px; margin-top: 26px; }
                .count { color: rgba(235,235,245,.5); font-size: 13px; font-weight: 700; min-width: 54px; text-align: center; }
                .no, .yes { width: 64px; height: 64px; border-radius: 999px; border: none; cursor: pointer; font-size: 26px; box-shadow: 0 10px 30px rgba(0,0,0,.4); transition: transform .14s; }
                .no:active, .yes:active { transform: scale(.88); }
                .no { background: rgba(255,255,255,.12); color: #fff; }
                .yes { background: linear-gradient(120deg,#FF2E63,#FF6B4A); color: #fff; }
                .doneWrap { text-align: center; }
                .doneTitle { font-family: 'Outfit', sans-serif; font-weight: 900; font-size: 26px; margin: 10px 0; }
                .row { display: flex; gap: 12px; overflow-x: auto; padding: 8px 2px 6px; scrollbar-width: none; }
                .row::-webkit-scrollbar { display: none; }
                .mini { flex: 0 0 130px; text-align: left; }
                .mini img { width: 130px; height: 88px; object-fit: cover; border-radius: 12px; }
                .mini span { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 12.5px; font-weight: 600; margin-top: 6px; }
                .again { margin-top: 18px; height: 44px; padding: 0 22px; border: none; border-radius: 14px; background: rgba(255,255,255,.1); color: #fff; font-weight: 700; cursor: pointer; }
            `}</style>
        </section>
    );
}

/* ─────────────────────── 2 · SOIRÉE (timeline de prépa) ─────────────────── */
function Soiree() {
    const menu = useMemo(() => {
        const byCat = (c: string) => cookable.filter((r: any) => r.category === c);
        return [byCat('entrees')[0] || cookable[2], byCat('plats')[0] || cookable[4], byCat('desserts')[0] || cookable[6]].filter(Boolean);
    }, []);
    const [serve, setServe] = useState('20:00');
    // On sert dans l'ordre entrée→plat→dessert ; chacun doit être prêt à son
    // heure. On planifie à rebours depuis l'heure de service du plat principal.
    const plan = useMemo(() => {
        const [h, m] = serve.split(':').map(Number);
        const serveDate = new Date(); serveDate.setHours(h, m, 0, 0);
        // Rétroplanning : dessert souvent préparé en avance, entrée juste avant.
        const offsets = [10, 0, -20]; // entrée servie +10, plat à l'heure, dessert -20 (déjà prêt)
        return menu.map((r, i) => {
            const dur = totalMin(r);
            const serveAt = new Date(serveDate.getTime() + offsets[i] * 60000);
            const startAt = new Date(serveAt.getTime() - dur * 60000);
            return { r, dur, startAt, serveAt };
        }).sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    }, [menu, serve]);
    const hm = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    return (
        <section className="s">
            <h2 className="h2">Ta soirée, minute par minute</h2>
            <p className="p">Dis l&apos;heure du service, on calcule quand lancer chaque plat.</p>
            <label className="timeRow">Service du plat principal
                <input type="time" value={serve} onChange={(e) => setServe(e.target.value)} />
            </label>
            <div className="tl">
                {plan.map(({ r, dur, startAt, serveAt }, i) => (
                    <div key={r.id} className="ev">
                        <div className="when"><b>{hm(startAt)}</b><span>{dur} min</span></div>
                        <div className="line"><span className="dot" />{i < plan.length - 1 && <span className="bar" />}</div>
                        <div className="what">
                            <img src={r.image} alt="" />
                            <div>
                                <div className="cat">{r.category}</div>
                                <div className="ttl">{decode(r.title)}</div>
                                <div className="ser">Prêt pour {hm(serveAt)}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <style jsx>{`
                .h2 { font-family:'Outfit',sans-serif; font-weight:900; text-transform:uppercase; transform:skewX(-6deg); font-size:22px; margin:0 0 4px; }
                .p { color: rgba(235,235,245,.6); font-size:14px; margin:0 0 16px; }
                .timeRow { display:flex; align-items:center; justify-content:space-between; gap:12px; background:rgba(255,255,255,.06); box-shadow:inset 0 0 0 .5px rgba(255,255,255,.12); border-radius:14px; padding:12px 16px; font-size:14px; font-weight:600; margin-bottom:22px; }
                .timeRow input { background:rgba(255,255,255,.1); border:none; border-radius:10px; color:#fff; font-size:16px; padding:8px 10px; }
                .tl { display:flex; flex-direction:column; }
                .ev { display:grid; grid-template-columns:66px 24px 1fr; align-items:start; }
                .when { text-align:right; padding-top:8px; }
                .when b { font-family:'Outfit',sans-serif; font-size:16px; display:block; }
                .when span { font-size:11px; color:rgba(235,235,245,.45); }
                .line { display:flex; flex-direction:column; align-items:center; padding-top:12px; }
                .dot { width:12px; height:12px; border-radius:999px; background:linear-gradient(120deg,#FFC24B,#FF6B4A); box-shadow:0 0 0 4px rgba(255,107,74,.18); }
                .bar { flex:1; width:2px; background:rgba(255,255,255,.14); margin:4px 0; min-height:52px; }
                .what { display:flex; gap:12px; padding:6px 0 22px; }
                .what img { width:64px; height:64px; border-radius:12px; object-fit:cover; }
                .cat { font-family:'Outfit',sans-serif; font-size:9.5px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; color:#FF6B4A; }
                .ttl { font-weight:700; font-size:15px; line-height:1.2; margin:2px 0; }
                .ser { font-size:12px; color:rgba(235,235,245,.5); }
            `}</style>
        </section>
    );
}

/* ─────────────────────── 3 · PARTAGE (carte story canvas) ───────────────── */
function Partage() {
    const options = useMemo(() => pick(6, 5), []);
    const [sel, setSel] = useState<any>(options[0]);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [url, setUrl] = useState('');

    useEffect(() => {
        const cv = canvasRef.current; if (!cv || !sel) return;
        const ctx = cv.getContext('2d'); if (!ctx) return;
        const W = 540, H = 960; cv.width = W; cv.height = H;
        const img = new Image(); img.crossOrigin = 'anonymous';
        const draw = (ok: boolean) => {
            ctx.fillStyle = '#08080b'; ctx.fillRect(0, 0, W, H);
            if (ok) {
                // couvre le haut
                const ratio = Math.max(W / img.width, (H * 0.62) / img.height);
                const w = img.width * ratio, h = img.height * ratio;
                ctx.drawImage(img, (W - w) / 2, 0, w, h);
            } else { ctx.fillStyle = '#1a1420'; ctx.fillRect(0, 0, W, H * 0.62); }
            const grad = ctx.createLinearGradient(0, H * 0.30, 0, H * 0.68);
            grad.addColorStop(0, 'rgba(8,8,11,0)'); grad.addColorStop(1, '#08080b');
            ctx.fillStyle = grad; ctx.fillRect(0, H * 0.30, W, H * 0.40);
            // kicker
            const t = estimateRecipeTiming(sel.steps);
            ctx.textAlign = 'left';
            ctx.fillStyle = '#FF6B4A'; ctx.font = '800 22px Outfit, sans-serif';
            ctx.fillText((sel.category || '').toUpperCase() + '  ·  ' + (t.prepTime + t.cookTime) + ' MIN', 44, H * 0.66);
            // titre
            ctx.fillStyle = '#fff'; ctx.font = '900 54px Outfit, sans-serif';
            const words = decode(sel.title).toUpperCase().split(' '); let line = '', y = H * 0.66 + 56;
            for (const wd of words) { if (ctx.measureText(line + wd).width > W - 88) { ctx.fillText(line.trim(), 44, y); line = ''; y += 58; } line += wd + ' '; }
            ctx.fillText(line.trim(), 44, y);
            // pied
            ctx.fillStyle = 'rgba(235,235,245,.55)'; ctx.font = '600 24px -apple-system, sans-serif';
            ctx.fillText('lesrecettesmagiques.fr', 44, H - 54);
            setUrl(cv.toDataURL('image/png'));
        };
        img.onload = () => draw(true); img.onerror = () => draw(false);
        img.src = sel.image;
    }, [sel]);

    return (
        <section className="pt">
            <h2 className="h2">Ta recette en story</h2>
            <p className="p">Une carte prête à partager, générée à la volée.</p>
            <div className="wrap">
                <div className="preview">
                    {url ? <img src={url} alt="" /> : <div className="ph" />}
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                </div>
                <div className="side">
                    <div className="chooseLbl">Choisis une recette</div>
                    <div className="grid">
                        {options.map((r) => (
                            <button key={r.id} className={`opt ${sel?.id === r.id ? 'on' : ''}`} onClick={() => setSel(r)}>
                                <img src={r.image} alt="" /><span>{decode(r.title)}</span>
                            </button>
                        ))}
                    </div>
                    <a className="dl" href={url || '#'} download={`recette-${sel?.id || 'story'}.png`}>⬇︎ Télécharger l&apos;image</a>
                </div>
            </div>
            <style jsx>{`
                .h2 { font-family:'Outfit',sans-serif; font-weight:900; text-transform:uppercase; transform:skewX(-6deg); font-size:22px; margin:0 0 4px; }
                .p { color:rgba(235,235,245,.6); font-size:14px; margin:0 0 16px; }
                .wrap { display:flex; gap:20px; flex-wrap:wrap; }
                .preview { flex:0 0 auto; }
                .preview img, .preview .ph { width:230px; border-radius:18px; box-shadow:0 24px 60px rgba(0,0,0,.55); display:block; }
                .preview .ph { aspect-ratio:540/960; background:#1a1420; }
                .side { flex:1 1 220px; min-width:220px; }
                .chooseLbl { font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:rgba(235,235,245,.5); margin-bottom:10px; }
                .grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
                .opt { border:none; background:rgba(255,255,255,.06); border-radius:12px; overflow:hidden; cursor:pointer; padding:0; text-align:left; box-shadow:inset 0 0 0 .5px transparent; transition:.15s; }
                .opt.on { box-shadow:inset 0 0 0 2px #FF6B4A; }
                .opt img { width:100%; height:64px; object-fit:cover; display:block; }
                .opt span { display:block; font-size:11px; font-weight:600; padding:6px 8px; line-height:1.2; -webkit-line-clamp:2; -webkit-box-orient:vertical; display:-webkit-box; overflow:hidden; color:#fff; }
                .dl { display:block; text-align:center; margin-top:14px; height:46px; line-height:46px; border-radius:14px; background:linear-gradient(120deg,#FFC24B,#FF6B4A 60%,#FF3B6B); color:#180a06; font-weight:800; text-decoration:none; }
            `}</style>
        </section>
    );
}

/* ─────────────────────────── 4 · TROPHÉES (gamification) ────────────────── */
function Trophees() {
    // Lit l'activité réelle (drapeaux « cuisson démarrée », favoris, notes).
    const [stats, setStats] = useState({ cooked: 0, favs: 0, rated: 0 });
    useEffect(() => {
        let cooked = 0, rated = 0;
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i) || '';
                if (k.startsWith('recipe-cooking-')) cooked++;
            }
        } catch { /* noop */ }
        let favs = 0;
        try { favs = (JSON.parse(localStorage.getItem('favorites') || '[]') || []).length; } catch { /* noop */ }
        setStats({ cooked, favs, rated });
    }, []);

    const badges = [
        { emo: '🔥', name: 'Première flamme', desc: 'Lance ta 1re préparation', got: stats.cooked >= 1, goal: 1, val: stats.cooked },
        { emo: '👨‍🍳', name: 'Apprenti', desc: 'Cuisine 5 recettes', got: stats.cooked >= 5, goal: 5, val: stats.cooked },
        { emo: '🍳', name: 'Chef de maison', desc: 'Cuisine 20 recettes', got: stats.cooked >= 20, goal: 20, val: stats.cooked },
        { emo: '❤️', name: 'Collectionneur', desc: '10 favoris', got: stats.favs >= 10, goal: 10, val: stats.favs },
        { emo: '🌍', name: 'Tour du monde', desc: 'Cuisine 5 pays différents', got: false, goal: 5, val: 0 },
        { emo: '⭐', name: 'Fin palais', desc: 'Note 15 recettes', got: false, goal: 15, val: stats.rated },
    ];
    const streak = Math.min(7, 1 + (stats.cooked % 7));

    return (
        <section className="tr">
            <h2 className="h2">Ta cuisine, ton palmarès</h2>
            <p className="p">Débloque des badges en cuisinant pour de vrai.</p>

            <div className="streak">
                <div className="stTitle">🔥 Série de {streak} jour{streak > 1 ? 's' : ''}</div>
                <div className="dots">{Array.from({ length: 7 }).map((_, k) => <span key={k} className={`d ${k < streak ? 'on' : ''}`} />)}</div>
            </div>

            <div className="grid">
                {badges.map((b) => (
                    <div key={b.name} className={`badge ${b.got ? 'got' : ''}`}>
                        <div className="emo">{b.emo}</div>
                        <div className="nm">{b.name}</div>
                        <div className="ds">{b.desc}</div>
                        {!b.got && <div className="pg"><span style={{ width: `${Math.min(100, (b.val / b.goal) * 100)}%` }} /></div>}
                        {b.got && <div className="ok">Débloqué ✓</div>}
                    </div>
                ))}
            </div>
            <p className="hint">Astuce : coche une étape dans une recette → le badge « Première flamme » s&apos;allume.</p>
            <style jsx>{`
                .h2 { font-family:'Outfit',sans-serif; font-weight:900; text-transform:uppercase; transform:skewX(-6deg); font-size:22px; margin:0 0 4px; }
                .p { color:rgba(235,235,245,.6); font-size:14px; margin:0 0 18px; }
                .streak { background:linear-gradient(120deg, rgba(255,107,74,.18), rgba(255,59,107,.12)); box-shadow:inset 0 0 0 .5px rgba(255,180,120,.3); border-radius:16px; padding:16px; margin-bottom:20px; }
                .stTitle { font-family:'Outfit',sans-serif; font-weight:900; font-size:18px; }
                .dots { display:flex; gap:8px; margin-top:12px; }
                .d { flex:1; height:8px; border-radius:999px; background:rgba(255,255,255,.12); }
                .d.on { background:linear-gradient(90deg,#FFC24B,#FF6B4A); }
                .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:12px; }
                .badge { background:rgba(255,255,255,.05); box-shadow:inset 0 0 0 .5px rgba(255,255,255,.1); border-radius:16px; padding:16px; text-align:center; opacity:.6; }
                .badge.got { opacity:1; box-shadow:inset 0 0 0 1px rgba(255,107,74,.5), 0 10px 30px rgba(255,90,60,.18); }
                .emo { font-size:34px; filter:grayscale(.6); }
                .badge.got .emo { filter:none; }
                .nm { font-family:'Outfit',sans-serif; font-weight:800; font-size:14px; margin-top:6px; }
                .ds { font-size:11.5px; color:rgba(235,235,245,.5); margin-top:2px; }
                .pg { height:5px; border-radius:999px; background:rgba(255,255,255,.1); margin-top:10px; overflow:hidden; }
                .pg span { display:block; height:100%; background:linear-gradient(90deg,#FFC24B,#FF6B4A); }
                .ok { color:#30D158; font-size:11.5px; font-weight:700; margin-top:10px; }
                .hint { color:rgba(235,235,245,.4); font-size:12.5px; margin-top:20px; }
            `}</style>
        </section>
    );
}
