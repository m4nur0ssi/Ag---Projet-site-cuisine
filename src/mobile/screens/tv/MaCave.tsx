'use client';
/**
 * « Ma cave » — maquette Apple TV+ (mobile + desktop).
 * - Scanner l'étiquette (caméra mobile) → /api/wine-lookup lit l'étiquette puis
 *   retrouve la bouteille chez le marchand : sa PHOTO OFFICIELLE, le nom, le
 *   cépage, l'année, la région et la note entrent directement dans la cave.
 *   Saisie manuelle toujours possible.
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
    openBottle, setQty, drinkWindow, updateWine, findKnownWine,
    moveToTasted, moveToCave, shelfOf,
    CAVE_EVENT, type CaveWine, type WineColor, type WineShelf,
} from '@/lib/cave';
import styles from './MaCave.module.css';

/**
 * Nom débarrassé du millésime qu'il traîne parfois : il est affiché à part, en
 * gris, toujours à la même place. Sans ça on lisait « … 'Charmes' 2010 · 2010 ».
 */
const stripYear = (name: string) => name.replace(/\s*[·,-]?\s*\b(19|20)\d{2}\b\s*$/, '').trim() || name;

/** Bandeau d'information de l'app (même canal que le reste du site). */
const toast = (msg: string) => window.dispatchEvent(new CustomEvent('magic-toast-notify', { detail: msg }));

const COLOR_LABEL: Record<WineColor, string> = { rouge: 'Rouge', blanc: 'Blanc', rose: 'Rosé', liqueur: 'Liqueur' };
const COLOR_GLASS: Record<WineColor, string> = { rouge: '#7b1e2b', blanc: '#e6d27a', rose: '#e08a97', liqueur: '#c98a2b' };

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
    // Destination du formulaire : la cave, ou l'étagère « Goûté & approuvé »
    // (bouteille bue chez un ami, au restaurant… qu'on ne possède pas).
    const [adding, setAdding] = useState<WineShelf | null>(null);
    const [dropOn, setDropOn] = useState<WineShelf | null>(null);
    const [pairing, setPairing] = useState<CaveWine | null>(null);
    const [zoom, setZoom] = useState<string | null>(null);
    const [editing, setEditing] = useState<CaveWine | null>(null);
    const [menu, setMenu] = useState<{ wine: CaveWine; x: number; y: number } | null>(null);
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
    // Les deux étagères, filtres et recherche déjà appliqués.
    const inCave = useMemo(() => shown.filter((w) => shelfOf(w) === 'cave'), [shown]);
    const tastedList = useMemo(() => shown.filter((w) => shelfOf(w) === 'tasted'), [shown]);

    /** Glisser-déposer d'une carte d'une étagère à l'autre. */
    const dropHandlers = (target: WineShelf) => ({
        onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDropOn(target); },
        onDragLeave: () => setDropOn((d) => (d === target ? null : d)),
        onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            setDropOn(null);
            const id = e.dataTransfer.getData('text/plain');
            if (!id) return;
            if (target === 'tasted') moveToTasted(id); else moveToCave(id);
        },
    });

    // Un onglet de couleur n'a de sens que s'il y a quelque chose dedans :
    // « Liqueurs 0 » n'apprend rien et encombre la barre.
    const tabs = useMemo(() => {
        const order: WineColor[] = ['rouge', 'blanc', 'rose', 'liqueur'];
        const plural: Record<WineColor, string> = { rouge: 'Rouges', blanc: 'Blancs', rose: 'Rosés', liqueur: 'Liqueurs' };
        const present = order
            .map((c) => ({ key: c, label: plural[c], n: wines.filter((w) => w.color === c).length }))
            .filter((t) => t.n > 0);
        return [{ key: 'tous' as const, label: 'Tous', n: wines.length }, ...present];
    }, [wines]);

    // Si l'onglet courant se vide (dernière bouteille retirée), on revient à « Tous ».
    useEffect(() => {
        if (filter !== 'tous' && !tabs.some((t) => t.key === filter)) setFilter('tous');
    }, [tabs, filter]);

    return (
        <div className={`${styles.page} ${embedded ? styles.emb : ''}`}>
            <header className={styles.head}>
                {!embedded && (
                    <button className={styles.back} onClick={() => router.push('/')} aria-label="Retour">
                        <svg viewBox="0 0 8 14" width="13" height="13" fill="none"><path d="M7 1L1 7l6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                )}
                <h1 className={styles.title}>Ma cave</h1>
                <button className={styles.addTop} onClick={() => setAdding('cave')}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    Ajouter
                </button>
            </header>

            <div className={styles.tabs}>
                {tabs.map((t) => (
                    <button key={t.key} className={`${styles.tab} ${filter === t.key ? styles.tabOn : ''}`} onClick={() => setFilter(t.key as any)}>
                        {t.label} {t.n}
                    </button>
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

            {/* ── Étagère 1 : ce qu'on a chez soi ── */}
            <section
                className={`${styles.shelf} ${dropOn === 'cave' ? styles.shelfDrop : ''}`}
                {...dropHandlers('cave')}
            >
                {inCave.length === 0 ? (
                    <div className={styles.empty}>
                        <div className={styles.emptyIc}>
                            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 22h8M12 15v7M5 3h14l-1 6a6 6 0 0 1-12 0z" /></svg>
                        </div>
                        <h2>Ta cave est vide</h2>
                        <p>Scanne l’étiquette d’une bouteille pour l’ajouter.</p>
                        <button className={styles.cta} onClick={() => setAdding('cave')}>Ajouter un vin</button>
                    </div>
                ) : (
                    <div className={styles.grid}>
                        {inCave.map((w) => (
                            <WineCard key={w.id} wine={w} onPair={() => setPairing(w)} onRemove={() => removeWine(w.id)} onZoom={() => w.photo && setZoom(w.photo)} onMenu={(x, y) => setMenu({ wine: w, x, y })} />
                        ))}
                    </div>
                )}
            </section>

            {/* ── Étagère 2 : bues, notées, gardées en mémoire ── */}
            <section
                className={`${styles.shelf} ${styles.shelfTasted} ${dropOn === 'tasted' ? styles.shelfDrop : ''}`}
                {...dropHandlers('tasted')}
            >
                <div className={styles.shelfHead}>
                    <div>
                        <h2 className={styles.shelfTitle}>Goûté &amp; approuvé</h2>
                        <p className={styles.shelfSub}>
                            Les bouteilles que tu as bues — ailleurs, ou jusqu’à la dernière.
                            Glisse une carte de ta cave ici, ou descends son stock à zéro.
                        </p>
                    </div>
                    <button className={styles.addTop} onClick={() => setAdding('tasted')}>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                        Ajouter
                    </button>
                </div>

                {tastedList.length === 0 ? (
                    <div className={styles.shelfEmpty}>
                        Rien encore. Une bouteille bue chez un ami ou au restaurant se scanne
                        d’ici, et rejoint tes notes comme n’importe quel vin de la cave.
                    </div>
                ) : (
                    <div className={styles.grid}>
                        {tastedList.map((w) => (
                            <WineCard key={w.id} wine={w} onPair={() => setPairing(w)} onRemove={() => removeWine(w.id)} onZoom={() => w.photo && setZoom(w.photo)} onMenu={(x, y) => setMenu({ wine: w, x, y })} />
                        ))}
                    </div>
                )}
            </section>

            {adding && <AddWine shelf={adding} onClose={() => setAdding(null)} />}
            {pairing && <PairSheet wine={pairing} onClose={() => setPairing(null)} embedded={embedded} />}
            {editing && <EditWine wine={editing} onClose={() => setEditing(null)} />}
            {menu && (
                <CardMenu
                    wine={menu.wine}
                    at={{ x: menu.x, y: menu.y }}
                    onClose={() => setMenu(null)}
                    onPair={() => setPairing(menu.wine)}
                    onEdit={() => setEditing(menu.wine)}
                    onRemove={() => removeWine(menu.wine.id)}
                />
            )}
            {zoom && <ZoomView src={zoom} onClose={() => setZoom(null)} />}
        </div>
    );
}

/* ── Zoom plein écran de la bouteille (molette / pincement + glisser) ──────── */
function ZoomView({ src, onClose }: { src: string; onClose: () => void }) {
    const [scale, setScale] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const drag = useRef<{ x: number; y: number } | null>(null);
    return (
        <div className={styles.zoomBack} onClick={onClose}
            onWheel={(e) => { setScale((s) => Math.min(5, Math.max(1, s - e.deltaY * 0.002))); }}>
            <button className={styles.zoomClose} onClick={onClose}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
            <img
                src={src} alt="" className={styles.zoomImg}
                style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})` }}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={() => { setScale((s) => (s > 1 ? 1 : 2.5)); setPos({ x: 0, y: 0 }); }}
                onPointerDown={(e) => { drag.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }; }}
                onPointerMove={(e) => { if (drag.current && scale > 1) setPos({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }); }}
                onPointerUp={() => { drag.current = null; }}
                draggable={false}
            />
            <div className={styles.zoomHint}>Molette / double-clic pour zoomer · glisser pour déplacer</div>
        </div>
    );
}

/* ── Carte vin : scène de cave (tonneau) + bouteille ──────────────────────── */
function WineCard({ wine, onPair, onRemove, onZoom, onMenu }: { wine: CaveWine; onPair: () => void; onRemove: () => void; onZoom: () => void; onMenu: (x: number, y: number) => void }) {
    const lp = useRef<ReturnType<typeof setTimeout> | null>(null);
    const shelf = shelfOf(wine);
    return (
        <div
            className={`${styles.card} ${shelf === 'tasted' ? styles.cardTasted : ''}`}
            /* La carte se glisse d'une étagère à l'autre (souris). Au doigt, le
               même déplacement passe par le menu de la carte. */
            draggable
            onDragStart={(e) => { e.dataTransfer.setData('text/plain', wine.id); e.dataTransfer.effectAllowed = 'move'; }}
            /* Clic droit (desktop) et appui long (iPhone, où le clic droit
               n'existe pas) ouvrent le même menu. */
            onContextMenu={(e) => { e.preventDefault(); onMenu(e.clientX, e.clientY); }}
            onPointerDown={(e) => {
                const { clientX, clientY } = e;
                lp.current = setTimeout(() => { navigator.vibrate?.(12); onMenu(clientX, clientY); }, 500);
            }}
            onPointerUp={() => { if (lp.current) clearTimeout(lp.current); }}
            onPointerLeave={() => { if (lp.current) clearTimeout(lp.current); }}
        >
            <div className={styles.scene}>
                <div className={styles.spot} />
                <div className={styles.barrel} />
                <div className={styles.bottle} onClick={(e) => { if (wine.photo) { e.stopPropagation(); onZoom(); } }}>
                    {wine.photo ? <img src={wine.photo} alt="" className={styles.bottlePhoto} /> : <BottleSVG color={wine.color} />}
                </div>
                {wine.photo && (
                    <button className={styles.zoomBtn} onClick={(e) => { e.stopPropagation(); onZoom(); }} aria-label="Agrandir">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4M11 8v6M8 11h6" /></svg>
                    </button>
                )}
                <span className={`${styles.colorTag} ${styles['tag_' + wine.color]}`}>{COLOR_LABEL[wine.color]}</span>
                <button className={styles.del} onClick={(e) => { e.stopPropagation(); onRemove(); }} aria-label="Retirer">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
            </div>
            <div className={styles.info}>
                <div className={styles.wName}>
                    {stripYear(wine.name)}
                    {wine.year ? <span className={styles.wYear}> · {wine.year}</span> : null}
                </div>
                <div className={styles.wMeta}>{[wine.grape, wine.region].filter(Boolean).join(' · ')}</div>
                <div className={styles.ratings}>
                    {wine.rating ? (
                        <span className={styles.rating} title="Note des dégustateurs">
                            ★ {wine.rating.toFixed(1)}<small>/5</small>
                        </span>
                    ) : null}
                    <MyStars
                        value={wine.myRating ?? 0}
                        onSet={(n) => updateWine(wine.id, { myRating: n })}
                    />
                </div>
                <div className={styles.apoSlot}>
                    {(() => {
                        const w = drinkWindow(wine);
                        if (!w) return null;
                        const cls = w.status === 'tard' ? styles.apoLate : w.status === 'jeune' ? styles.apoWait : styles.apoNow;
                        return <span className={`${styles.apogee} ${cls}`}>{w.label}</span>;
                    })()}
                </div>
                {shelf === 'cave' ? (
                    <div className={styles.stockRow}>
                        <div className={styles.stepper}>
                            <button onClick={(e) => { e.stopPropagation(); setQty(wine.id, (wine.qty ?? 1) - 1); }} aria-label="Moins">−</button>
                            <span>{wine.qty ?? 1}</span>
                            <button onClick={(e) => { e.stopPropagation(); setQty(wine.id, (wine.qty ?? 1) + 1); }} aria-label="Plus">+</button>
                        </div>
                    </div>
                ) : (
                    /* Plus de stock à compter ici : le seul geste utile est d'en
                       racheter une, ce qui la remet en cave. */
                    <div className={styles.stockRow}>
                        <span className={styles.tastedTag}>Goûté &amp; approuvé</span>
                        <button className={styles.openBtn} onClick={(e) => { e.stopPropagation(); moveToCave(wine.id); }}>Ajouter à la cave</button>
                    </div>
                )}
                <button className={styles.pairBtn} onClick={onPair}>
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16M7 4v6a5 5 0 0 0 10 0V4M12 15v5M9 20h6" /></svg>
                    Quelle recette ?
                </button>
            </div>
        </div>
    );
}

/**
 * Note personnelle : cinq étoiles cliquables, distinctes de la note globale.
 * Retoucher l'étoile déjà active efface la note (on s'est trompé de doigt).
 */
function MyStars({ value, onSet, big = false }: { value: number; onSet: (n: number) => void; big?: boolean }) {
    return (
        <span className={`${styles.myStars} ${big ? styles.myStarsBig : ''}`} title="Ta note">
            {[1, 2, 3, 4, 5].map((n) => (
                <button
                    key={n}
                    className={`${styles.myStar} ${n <= value ? styles.myStarOn : ''}`}
                    aria-label={`Mettre ${n} sur 5`}
                    onClick={(e) => { e.stopPropagation(); onSet(n === value ? 0 : n); }}
                >
                    ★
                </button>
            ))}
        </span>
    );
}

/**
 * Menu d'une bouteille — clic droit sur desktop, appui long sur iPhone où le
 * clic droit n'existe pas. Il réunit les deux gestes utiles sur une carte :
 * l'accord avec une recette et la correction de la fiche.
 */
function CardMenu({ wine, at, onClose, onPair, onEdit, onRemove }: {
    wine: CaveWine; at: { x: number; y: number };
    onClose: () => void; onPair: () => void; onEdit: () => void; onRemove: () => void;
}) {
    // On rabat le menu dans la fenêtre quand le clic tombe près d'un bord.
    const W = 210, H = 176;
    const x = Math.min(at.x, (typeof window !== 'undefined' ? window.innerWidth : 400) - W - 10);
    const y = Math.min(at.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - H - 10);
    const Item = ({ d, label, danger, onClick }: { d: string; label: string; danger?: boolean; onClick: () => void }) => (
        <button className={`${styles.ctxItem} ${danger ? styles.ctxDanger : ''}`} onClick={() => { onClick(); onClose(); }}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
            {label}
        </button>
    );
    return (
        <div className={styles.ctxBack} onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
            <div className={styles.ctxMenu} style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()}>
                <div className={styles.ctxTitle}>{wine.name}</div>
                <Item d="M4 4h16M7 4v6a5 5 0 0 0 10 0V4M12 15v5M9 20h6" label="Quelle recette ?" onClick={onPair} />
                <Item d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" label="Corriger la fiche" onClick={onEdit} />
                {/* Le déplacement d'une étagère à l'autre passe par ici au doigt :
                    le glissé n'existe pas vraiment sur un téléphone. */}
                {shelfOf(wine) === 'cave' ? (
                    <Item
                        d="M5 12l5 5L20 7"
                        label="Ranger dans « Goûté & approuvé »"
                        onClick={() => { moveToTasted(wine.id); onClose(); }}
                    />
                ) : (
                    <Item
                        d="M8 22h8M12 15v7M5 3h14l-1 6a6 6 0 0 1-12 0z"
                        label="Remettre dans ma cave"
                        onClick={() => { moveToCave(wine.id); onClose(); }}
                    />
                )}
                <Item d="M5 12h14" label={shelfOf(wine) === 'cave' ? 'Retirer de la cave' : 'Effacer cette bouteille'} danger onClick={onRemove} />
            </div>
        </div>
    );
}

/**
 * Modifier une bouteille — depuis le menu de sa carte.
 * L'IA se trompe (une couleur, un millésime, un cépage) : cette fiche permet de
 * rectifier sans repasser par un scan, dans le même langage visuel que le reste
 * de la cave plutôt que dans le vieux formulaire.
 */
function EditWine({ wine, onClose }: { wine: CaveWine; onClose: () => void }) {
    const [f, setF] = useState({
        name: wine.name, grape: wine.grape, year: wine.year,
        color: wine.color, region: wine.region, note: wine.note || '',
        photo: wine.photo || '', qty: wine.qty ?? 1, myRating: wine.myRating ?? 0,
    });
    const save = () => {
        const name = f.name.trim();
        if (!name) return;
        updateWine(wine.id, { ...f, name, photo: f.photo.trim() || undefined });
        onClose();
    };
    return (
        <div className={styles.backdrop} onClick={onClose}>
            <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
                <div className={styles.sheetHead}>
                    <div>
                        <div className={styles.sheetKick}>Corriger la fiche</div>
                        <div className={styles.sheetTitle}>{wine.name}</div>
                    </div>
                    <button className={styles.sheetClose} onClick={onClose} aria-label="Fermer">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                </div>

                <div className={styles.addBody}>
                    {(f.photo || wine.photo) && (
                        <div className={styles.editPreview}>
                            <img src={f.photo || wine.photo} alt="" />
                        </div>
                    )}

                    <div className={styles.fields}>
                        <input className={styles.inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nom du vin" />
                        <div className={styles.two}>
                            <input className={styles.inp} value={f.grape} onChange={(e) => setF({ ...f, grape: e.target.value })} placeholder="Cépage" />
                            <input className={styles.inp} value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} placeholder="Année" inputMode="numeric" />
                        </div>
                        <input className={styles.inp} value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} placeholder="Région / appellation" />
                        <input className={styles.inp} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Note de dégustation" />
                        <input className={styles.inp} value={f.photo} onChange={(e) => setF({ ...f, photo: e.target.value })} placeholder="Lien de la photo (optionnel)" />

                        <div className={styles.editLabel}>Couleur</div>
                        <div className={styles.colorPick}>
                            {(['rouge', 'blanc', 'rose', 'liqueur'] as WineColor[]).map((c) => (
                                <button key={c} className={`${styles.colorOpt} ${f.color === c ? styles.colorOptOn : ''}`} onClick={() => setF({ ...f, color: c })}>
                                    <span className={styles.colorDot} style={{ background: COLOR_GLASS[c] }} />{COLOR_LABEL[c]}
                                </button>
                            ))}
                        </div>

                        <div className={styles.editRow}>
                            <div>
                                <div className={styles.editLabel}>Bouteilles</div>
                                <div className={styles.stepper}>
                                    <button onClick={() => setF({ ...f, qty: Math.max(0, f.qty - 1) })} aria-label="Moins">−</button>
                                    <span>{f.qty}</span>
                                    <button onClick={() => setF({ ...f, qty: f.qty + 1 })} aria-label="Plus">+</button>
                                </div>
                            </div>
                            <div>
                                <div className={styles.editLabel}>Ta note</div>
                                <MyStars big value={f.myRating} onSet={(n) => setF({ ...f, myRating: n })} />
                            </div>
                        </div>
                    </div>

                    <button className={styles.saveBtn} onClick={save} disabled={!f.name.trim()}>Enregistrer</button>
                </div>
            </div>
        </div>
    );
}

/* ── Accord : recettes du site pour ce vin ────────────────────────────────── */
function PairSheet({ wine, onClose, embedded }: { wine: CaveWine; onClose: () => void; embedded?: boolean }) {
    const recipes = useMemo(() => recipesForWine(wine, mockRecipes as any, 12), [wine]);
    /**
     * Encastrée dans le shell desktop, la cave ouvre la fiche FLOTTANTE
     * (`openRecipeFromPlanner`) : la barre latérale et le titre « Ma cave »
     * restent en place. L'event `openRecipe` déclencherait la fiche plein
     * écran, qui recouvre le menu et fait perdre le fil.
     */
    const open = (r: any) => {
        window.dispatchEvent(new CustomEvent(embedded ? 'openRecipeFromPlanner' : 'openRecipe', { detail: r }));
        onClose();
    };
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

/* ── Ajout d'un vin : scan étiquette → ajout automatique ──────────────────── */
type Official = { photo?: string; rating?: number; vivinoUrl?: string };

function AddWine({ onClose, shelf: initialShelf = 'cave' }: { onClose: () => void; shelf?: WineShelf }) {
    // Où ranger la bouteille : en cave (on l'a) ou dans « Goûté & approuvé »
    // (bue chez un ami, au restaurant — on ne la possède pas).
    const [shelf, setShelf] = useState<WineShelf>(initialShelf);
    const [photo, setPhoto] = useState<string>('');       // aperçu (pleine taille)
    const [photoSmall, setPhotoSmall] = useState<string>(''); // version stockable
    const [photoUrl, setPhotoUrl] = useState('');
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState<{ name: string; grape: string; year: string; color: WineColor; region: string; note: string }>(
        { name: '', grape: '', year: '', color: 'rouge', region: '', note: '' });
    // Photo officielle + note du marchand quand la bouteille a été retrouvée.
    const [official, setOfficial] = useState<Official>({});
    const [scanMsg, setScanMsg] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    /**
     * Réduit la photo. Indispensable deux fois : 640 px suffit à lire une
     * étiquette et divise par deux les jetons envoyés au modèle vision (quota
     * Groq gratuit : 8000 jetons/minute) ; surtout, une photo d'iPhone brute
     * pèse 3 Mo en base64 et fait EXPLOSER le quota localStorage de Safari
     * (~5 Mo) dès la première bouteille gardée avec sa propre photo.
     */
    const compress = (dataUrl: string, max = 640): Promise<string> => new Promise((res) => {
        const img = new Image();
        img.onload = () => {
            const r = Math.min(1, max / Math.max(img.width, img.height));
            const cv = document.createElement('canvas'); cv.width = img.width * r; cv.height = img.height * r;
            const ctx = cv.getContext('2d'); if (!ctx) return res(dataUrl);
            ctx.drawImage(img, 0, 0, cv.width, cv.height);
            res(cv.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = () => res(dataUrl);
        img.src = dataUrl;
    });

    /**
     * Scan → ajout direct. La photo part à /api/wine-lookup, qui lit l'étiquette
     * puis retrouve la bouteille chez le marchand : on récupère la photo
     * officielle + nom/cépage/année/région, et le vin entre dans la cave sans
     * autre manipulation. Si la bouteille n'est pas reconnue, on retombe sur le
     * formulaire pré-rempli plutôt que d'ajouter n'importe quoi.
     */
    const scanAndAdd = async (dataUrl: string) => {
        setBusy(true); setScanMsg('Lecture de l’étiquette…');
        const step2 = setTimeout(() => setScanMsg('Recherche de la bouteille…'), 1400);
        try {
            const small = await compress(dataUrl);
            setPhotoSmall(small);
            const res = await fetch('/api/wine-lookup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: small }) });
            const data = await res.json();
            const w = data?.wine;
            if (w?.name) {
                // L'étiquette est lue : le vin entre en cave, point. Quand le
                // marchand a confirmé la bouteille on prend SA photo, sinon on
                // garde celle qui vient d'être prise — jamais celle d'un voisin.
                // Bouteille déjà passée par la cave ? On le dit — c'est justement
                // ce qu'on veut savoir en scannant au rayon.
                const known = findKnownWine(w.name);
                try {
                    addWine({
                        name: w.name, grape: w.grape || '', year: w.year || '',
                        color: (w.color || 'rouge') as WineColor, region: w.region || '', note: w.note || '',
                        photo: w.photo || small, rating: w.rating, vivinoUrl: w.vivinoUrl,
                        shelf, tasted: shelf === 'tasted' || undefined, qty: shelf === 'tasted' ? 0 : 1,
                    });
                    if (known) {
                        toast(known.year && w.year && known.year !== w.year
                            ? `Déjà dégusté — tu avais le ${known.year}`
                            : 'Déjà dégusté — ce vin est déjà passé par ta cave');
                    }
                } catch {
                    // localStorage plein : le vin est bon, c'est la place qui manque.
                    clearTimeout(step2); setBusy(false);
                    setScanMsg('Cave pleine côté navigateur — retire un vin puis rescanne.');
                    return;
                }
                onClose();
                return;
            }
            if (data?.quota) setScanMsg('Trop de scans d’affilée (quota IA) — réessaie dans une minute.');
            else setScanMsg('Étiquette illisible — reprends la photo ou complète à la main.');
        } catch { setScanMsg('Reconnaissance impossible — saisie manuelle.'); }
        clearTimeout(step2);
        setBusy(false);
    };

    const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]; if (!f) return;
        const rd = new FileReader();
        rd.onload = () => { const url = String(rd.result || ''); setPhoto(url); scanAndAdd(url); };
        rd.readAsDataURL(f);
    };

    // Recherche depuis le NOM tapé (si pas de photo) : même moteur, sans ajout
    // automatique puisque l'utilisateur est déjà en train de saisir.
    const recognize = async () => {
        const q = form.name.trim();
        if (!q) return;
        setBusy(true); setScanMsg('Recherche de la bouteille…');
        try {
            const res = await fetch('/api/wine-lookup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: q }) });
            const data = await res.json();
            const w = data?.wine;
            if (w) {
                setForm((f) => ({ ...f, name: w.name, grape: w.grape, year: w.year, color: w.color, region: w.region, note: w.note || f.note }));
                setOfficial(data.source === 'vivino' ? { photo: w.photo, rating: w.rating, vivinoUrl: w.vivinoUrl } : {});
                setScanMsg(data.source === 'vivino' ? 'Bouteille trouvée ✓' : 'Fiche estimée — pas de photo officielle.');
            }
        } catch { setScanMsg('Recherche impossible — saisie manuelle.'); }
        setBusy(false);
    };

    const save = () => {
        const name = form.name.trim();
        if (!name) return;
        // Priorité : lien collé > photo officielle du marchand > photo scannée.
        const known = findKnownWine(name);
        addWine({
            ...form, name,
            photo: photoUrl.trim() || official.photo || photoSmall || undefined,
            rating: official.rating, vivinoUrl: official.vivinoUrl,
            shelf, tasted: shelf === 'tasted' || undefined, qty: shelf === 'tasted' ? 0 : 1,
        });
        if (known) toast('Déjà dégusté — ce vin est déjà passé par ta cave');
        onClose();
    };

    return (
        <div className={styles.backdrop} onClick={onClose}>
            <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
                <div className={styles.sheetHead}>
                    <div className={styles.sheetTitle}>{shelf === 'tasted' ? 'Ajouter une bouteille goûtée' : 'Ajouter un vin'}</div>
                    <button className={styles.sheetClose} onClick={onClose}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
                </div>

                <div className={styles.addBody}>
                    {/* Où va la bouteille : on le demande AVANT le scan, parce que
                        la réponse change le sens du geste — au restaurant on ne
                        remplit pas sa cave, on garde une trace. */}
                    <div className={styles.destRow}>
                        {([['cave', 'Dans ma cave', 'Je l’ai chez moi'],
                           ['tasted', 'Goûté & approuvé', 'Bue ailleurs, je la note']] as const).map(([k, lbl, sub]) => (
                            <button
                                key={k}
                                className={`${styles.destBtn} ${shelf === k ? styles.destOn : ''}`}
                                onClick={() => setShelf(k)}
                            >
                                <span className={styles.destLbl}>{lbl}</span>
                                <span className={styles.destSub}>{sub}</span>
                            </button>
                        ))}
                    </div>

                    <div className={styles.scanRow}>
                        <button className={styles.scanBtn} onClick={() => fileRef.current?.click()} disabled={busy}>
                            {official.photo || photo ? <img src={official.photo || photo} alt="" className={styles.scanThumb} /> : (
                                <span className={styles.scanIc}>
                                    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9V7a2 2 0 0 1 2-2h2M17 5h2a2 2 0 0 1 2 2v2M21 15v2a2 2 0 0 1-2 2h-2M7 19H5a2 2 0 0 1-2-2v-2M7 12h10" /></svg>
                                    Scanner l’étiquette
                                </span>
                            )}
                            {busy && <span className={styles.scanBusy}><span className={styles.spin} />{scanMsg || 'Lecture de l’étiquette…'}</span>}
                        </button>
                        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} hidden />
                        <div className={styles.scanHint}>{(!busy && scanMsg) || (shelf === 'tasted' ? 'Prends la bouteille en photo : l’étiquette est lue, la bouteille est retrouvée chez le marchand, et elle rejoint tes dégustations avec sa vraie photo — même si tu ne l’as pas chez toi.' : 'Prends la bouteille en photo : l’étiquette est lue, la bouteille est retrouvée chez le marchand et entre dans ta cave avec sa vraie photo.')}</div>
                    </div>

                    <div className={styles.fields}>
                        <div className={styles.recRow}>
                            <input className={styles.inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nom du vin" />
                            <button className={styles.recBtn} onClick={recognize} disabled={busy || !form.name.trim()} title="Compléter par le nom">{busy ? '…' : 'IA'}</button>
                        </div>
                        <div className={styles.two}>
                            <input className={styles.inp} value={form.grape} onChange={(e) => setForm({ ...form, grape: e.target.value })} placeholder="Cépage" />
                            <input className={styles.inp} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="Année" inputMode="numeric" />
                        </div>
                        <input className={styles.inp} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="Région / appellation" />
                        <input className={styles.inp} value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="Lien de la photo officielle (optionnel, colle depuis le marchand)" />
                        <div className={styles.colorPick}>
                            {(['rouge', 'blanc', 'liqueur'] as WineColor[]).map((c) => (
                                <button key={c} className={`${styles.colorOpt} ${form.color === c ? styles.colorOptOn : ''}`} onClick={() => setForm({ ...form, color: c })}>
                                    <span className={styles.colorDot} style={{ background: COLOR_GLASS[c] }} />{COLOR_LABEL[c]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button className={styles.saveBtn} onClick={save} disabled={!form.name.trim()}>{shelf === 'tasted' ? 'Ajouter à « Goûté & approuvé »' : 'Ajouter à ma cave'}</button>
                </div>
            </div>
        </div>
    );
}
