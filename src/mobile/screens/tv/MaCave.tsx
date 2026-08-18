'use client';
/**
 * « Ma cave » — maquette Apple TV+ (mobile + desktop).
 * - Scanner l'étiquette (caméra mobile) → l'IA (/api/wine-lookup) remplit nom,
 *   cépage, année, couleur, région, note. Saisie manuelle aussi.
 * - Chaque vin est présenté dans une SCÈNE de cave (tonneau de chêne) rendue en
 *   CSS : seule la bouteille change.
 * - Onglets Rouges / Blancs / Liqueurs. Sur un vin → « Quelle recette ? » propose
 *   une dizaine de recettes du site adaptées ; clic → ouvre la fiche.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { mockRecipes } from '@/mobile/data/mockData';
import { decodeHtml } from '@/mobile/lib/utils';
import {
    readCave, addWine, removeWine, seedCaveIfEmpty, recipesForWine,
    openBottle, setQty, drinkWindow,
    CAVE_EVENT, type CaveWine, type WineColor,
} from '@/lib/cave';
import styles from './MaCave.module.css';

const COLOR_LABEL: Record<WineColor, string> = { rouge: 'Rouge', blanc: 'Blanc', liqueur: 'Liqueur' };
const COLOR_GLASS: Record<WineColor, string> = { rouge: '#7b1e2b', blanc: '#e6d27a', liqueur: '#c98a2b' };

/** Bouteille dessinée (repli quand pas de photo) — teintée selon la couleur. */
function BottleSVG({ color }: { color: WineColor }) {
    const c = COLOR_GLASS[color];
    return (
        <svg viewBox="0 0 60 180" className={styles.bottleSvg} aria-hidden>
            <defs>
                <linearGradient id={`b-${color}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor={c} stopOpacity="0.65" />
                    <stop offset="0.5" stopColor={c} />
                    <stop offset="1" stopColor="#000" stopOpacity="0.55" />
                </linearGradient>
            </defs>
            <path d="M24 6h12v34c0 6 9 12 9 26v76a6 6 0 0 1-6 6H21a6 6 0 0 1-6-6V72c0-14 9-20 9-26z" fill={`url(#b-${color})`} stroke="rgba(0,0,0,.5)" strokeWidth="1.5" />
            <rect x="22" y="4" width="16" height="8" rx="2" fill="#2a1a12" />
            <rect x="16" y="96" width="28" height="42" rx="3" fill="#f3ecd9" opacity="0.95" />
            <rect x="20" y="104" width="20" height="3" rx="1.5" fill="#8a1526" />
            <rect x="20" y="120" width="20" height="2.4" rx="1.2" fill="rgba(0,0,0,.35)" />
        </svg>
    );
}

export default function MaCave({ embedded = false }: { embedded?: boolean }) {
    const router = useRouter();
    const [wines, setWines] = useState<CaveWine[]>([]);
    const [filter, setFilter] = useState<'tous' | WineColor>('tous');
    const [adding, setAdding] = useState(false);
    const [pairing, setPairing] = useState<CaveWine | null>(null);
    const [q, setQ] = useState('');
    const [sort, setSort] = useState<'recent' | 'annee' | 'region'>('recent');

    useEffect(() => {
        seedCaveIfEmpty();
        const load = () => setWines(readCave());
        load();
        window.addEventListener(CAVE_EVENT, load);
        window.addEventListener('storage', load);
        return () => { window.removeEventListener(CAVE_EVENT, load); window.removeEventListener('storage', load); };
    }, []);

    const shown = useMemo(() => {
        let list = filter === 'tous' ? wines : wines.filter((w) => w.color === filter);
        const query = q.trim().toLowerCase();
        if (query) list = list.filter((w) => `${w.name} ${w.region} ${w.grape} ${w.year}`.toLowerCase().includes(query));
        const s = [...list];
        if (sort === 'annee') s.sort((a, b) => (parseInt(b.year, 10) || 0) - (parseInt(a.year, 10) || 0));
        else if (sort === 'region') s.sort((a, b) => (a.region || '').localeCompare(b.region || '', 'fr'));
        else s.sort((a, b) => b.addedAt - a.addedAt);
        return s;
    }, [wines, filter, q, sort]);
    const counts = useMemo(() => ({
        rouge: wines.filter((w) => w.color === 'rouge').length,
        blanc: wines.filter((w) => w.color === 'blanc').length,
        liqueur: wines.filter((w) => w.color === 'liqueur').length,
    }), [wines]);

    return (
        <div className={`${styles.page} ${embedded ? styles.emb : ''}`}>
            <header className={styles.head}>
                {!embedded && (
                    <button className={styles.back} onClick={() => router.push('/')} aria-label="Retour">
                        <svg viewBox="0 0 8 14" width="13" height="13" fill="none"><path d="M7 1L1 7l6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                )}
                <div>
                    <div className={styles.kicker}>Ta cave</div>
                    <h1 className={styles.title}>Ma cave</h1>
                </div>
                <button className={styles.addTop} onClick={() => setAdding(true)}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    Ajouter
                </button>
            </header>

            <div className={styles.tabs}>
                {([['tous', `Tous ${wines.length}`], ['rouge', `Rouges ${counts.rouge}`], ['blanc', `Blancs ${counts.blanc}`], ['liqueur', `Liqueurs ${counts.liqueur}`]] as const).map(([k, lbl]) => (
                    <button key={k} className={`${styles.tab} ${filter === k ? styles.tabOn : ''}`} onClick={() => setFilter(k as any)}>{lbl}</button>
                ))}
            </div>

            <div className={styles.toolbar}>
                <div className={styles.searchWrap}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
                    <input className={styles.search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher (nom, région, cépage…)" />
                </div>
                <div className={styles.sortWrap}>
                    {([['recent', 'Récent'], ['annee', 'Année'], ['region', 'Région']] as const).map(([k, lbl]) => (
                        <button key={k} className={`${styles.sortBtn} ${sort === k ? styles.sortOn : ''}`} onClick={() => setSort(k)}>{lbl}</button>
                    ))}
                </div>
            </div>

            {shown.length === 0 ? (
                <div className={styles.empty}>
                    <div className={styles.emptyIc}>
                        <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 22h8M12 15v7M5 3h14l-1 6a6 6 0 0 1-12 0z" /></svg>
                    </div>
                    <h2>Ta cave est vide</h2>
                    <p>Scanne l’étiquette d’une bouteille pour l’ajouter.</p>
                    <button className={styles.cta} onClick={() => setAdding(true)}>Ajouter un vin</button>
                </div>
            ) : (
                <div className={styles.grid}>
                    {shown.map((w) => (
                        <WineCard key={w.id} wine={w} onPair={() => setPairing(w)} onRemove={() => removeWine(w.id)} />
                    ))}
                </div>
            )}

            {adding && <AddWine onClose={() => setAdding(false)} />}
            {pairing && <PairSheet wine={pairing} onClose={() => setPairing(null)} />}
        </div>
    );
}

/* ── Carte vin : scène de cave (tonneau) + bouteille ──────────────────────── */
function WineCard({ wine, onPair, onRemove }: { wine: CaveWine; onPair: () => void; onRemove: () => void }) {
    const lp = useRef<ReturnType<typeof setTimeout> | null>(null);
    return (
        <div
            className={styles.card}
            onPointerDown={() => { lp.current = setTimeout(onPair, 500); }}
            onPointerUp={() => { if (lp.current) clearTimeout(lp.current); }}
            onPointerLeave={() => { if (lp.current) clearTimeout(lp.current); }}
        >
            <div className={styles.scene}>
                <div className={styles.spot} />
                <div className={styles.barrel} />
                <div className={styles.bottle}>
                    {wine.photo ? <img src={wine.photo} alt="" className={styles.bottlePhoto} /> : <BottleSVG color={wine.color} />}
                </div>
                <span className={`${styles.colorTag} ${styles['tag_' + wine.color]}`}>{COLOR_LABEL[wine.color]}</span>
                <button className={styles.del} onClick={(e) => { e.stopPropagation(); onRemove(); }} aria-label="Retirer">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
            </div>
            <div className={styles.info}>
                <div className={styles.wName}>{wine.name}{wine.year ? <span className={styles.wYear}> · {wine.year}</span> : null}</div>
                <div className={styles.wMeta}>{[wine.grape, wine.region].filter(Boolean).join(' · ')}</div>
                {(() => {
                    const w = drinkWindow(wine);
                    if (!w) return null;
                    const cls = w.status === 'À boire vite' ? styles.apoLate : w.status === 'À garder' ? styles.apoWait : styles.apoNow;
                    return <div className={`${styles.apogee} ${cls}`}>{w.status} · {w.from}–{w.to}</div>;
                })()}
                <div className={styles.stockRow}>
                    <div className={styles.stepper}>
                        <button onClick={(e) => { e.stopPropagation(); setQty(wine.id, (wine.qty ?? 1) - 1); }} aria-label="Moins">−</button>
                        <span>{wine.qty ?? 1} <small>bt</small></span>
                        <button onClick={(e) => { e.stopPropagation(); setQty(wine.id, (wine.qty ?? 1) + 1); }} aria-label="Plus">+</button>
                    </div>
                    <button className={styles.openBtn} disabled={(wine.qty ?? 1) <= 0} onClick={(e) => { e.stopPropagation(); openBottle(wine.id); }}>Ouvrir</button>
                </div>
                <button className={styles.pairBtn} onClick={onPair}>
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16M7 4v6a5 5 0 0 0 10 0V4M12 15v5M9 20h6" /></svg>
                    Quelle recette ?
                </button>
            </div>
        </div>
    );
}

/* ── Accord : recettes du site pour ce vin ────────────────────────────────── */
function PairSheet({ wine, onClose }: { wine: CaveWine; onClose: () => void }) {
    const recipes = useMemo(() => recipesForWine(wine, mockRecipes as any, 12), [wine]);
    const open = (r: any) => { window.dispatchEvent(new CustomEvent('openRecipe', { detail: r })); onClose(); };
    return (
        <div className={styles.backdrop} onClick={onClose}>
            <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
                <div className={styles.sheetHead}>
                    <div>
                        <div className={styles.sheetKick}>Avec {wine.name}</div>
                        <div className={styles.sheetTitle}>À cuisiner ce soir</div>
                    </div>
                    <button className={styles.sheetClose} onClick={onClose}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
                </div>
                <div className={styles.pairGrid}>
                    {recipes.map((r: any) => (
                        <button key={r.id} className={styles.pairCard} onClick={() => open(r)}>
                            <img src={r.image} alt="" />
                            <span>{decodeHtml(r.title)}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ── Ajout d'un vin : scan étiquette + IA, ou saisie manuelle ─────────────── */
function AddWine({ onClose }: { onClose: () => void }) {
    const [photo, setPhoto] = useState<string>('');
    const [label, setLabel] = useState('');
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState<{ name: string; grape: string; year: string; color: WineColor; region: string; note: string }>(
        { name: '', grape: '', year: '', color: 'rouge', region: '', note: '' });
    const fileRef = useRef<HTMLInputElement>(null);

    const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]; if (!f) return;
        const rd = new FileReader();
        rd.onload = () => setPhoto(String(rd.result || ''));
        rd.readAsDataURL(f);
    };

    const recognize = async () => {
        const q = label.trim() || form.name.trim();
        if (!q) return;
        setBusy(true);
        try {
            const res = await fetch('/api/wine-lookup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: q }) });
            const data = await res.json();
            if (data?.wine) setForm((f) => ({ ...f, ...data.wine, note: data.wine.note || f.note }));
        } catch { /* saisie manuelle */ }
        setBusy(false);
    };

    const save = () => {
        if (!form.name.trim()) return;
        addWine({ ...form, name: form.name.trim(), photo: photo || undefined });
        onClose();
    };

    return (
        <div className={styles.backdrop} onClick={onClose}>
            <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
                <div className={styles.sheetHead}>
                    <div className={styles.sheetTitle}>Ajouter un vin</div>
                    <button className={styles.sheetClose} onClick={onClose}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
                </div>

                <div className={styles.addBody}>
                    <div className={styles.scanRow}>
                        <button className={styles.scanBtn} onClick={() => fileRef.current?.click()}>
                            {photo ? <img src={photo} alt="" className={styles.scanThumb} /> : (
                                <span className={styles.scanIc}>
                                    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9V7a2 2 0 0 1 2-2h2M17 5h2a2 2 0 0 1 2 2v2M21 15v2a2 2 0 0 1-2 2h-2M7 19H5a2 2 0 0 1-2-2v-2M7 12h10" /></svg>
                                    Scanner l’étiquette
                                </span>
                            )}
                        </button>
                        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} hidden />
                        <div className={styles.scanHint}>Prends la bouteille en photo, puis l’IA remplit les infos.</div>
                    </div>

                    <div className={styles.recRow}>
                        <input className={styles.inp} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nom lu sur l’étiquette (ex. Château Margaux 2016)" />
                        <button className={styles.recBtn} onClick={recognize} disabled={busy || (!label.trim() && !form.name.trim())}>{busy ? '…' : 'Reconnaître'}</button>
                    </div>

                    <div className={styles.fields}>
                        <input className={styles.inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nom du vin" />
                        <div className={styles.two}>
                            <input className={styles.inp} value={form.grape} onChange={(e) => setForm({ ...form, grape: e.target.value })} placeholder="Cépage" />
                            <input className={styles.inp} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="Année" inputMode="numeric" />
                        </div>
                        <input className={styles.inp} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="Région / appellation" />
                        <div className={styles.colorPick}>
                            {(['rouge', 'blanc', 'liqueur'] as WineColor[]).map((c) => (
                                <button key={c} className={`${styles.colorOpt} ${form.color === c ? styles.colorOptOn : ''}`} onClick={() => setForm({ ...form, color: c })}>
                                    <span className={styles.colorDot} style={{ background: COLOR_GLASS[c] }} />{COLOR_LABEL[c]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button className={styles.saveBtn} onClick={save} disabled={!form.name.trim()}>Ajouter à ma cave</button>
                </div>
            </div>
        </div>
    );
}
