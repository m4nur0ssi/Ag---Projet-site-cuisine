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
                data-shelf="cave"
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
                        <AddTile onClick={() => setAdding('cave')} label="Ajouter un vin" />
                    </div>
                )}
            </section>

            {/* ── Étagère 2 : bues, notées, gardées en mémoire ── */}
            <section
                data-shelf="tasted"
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
                </div>

                {tastedList.length === 0 ? (
                    <div className={styles.grid}>
                        <AddTile onClick={() => setAdding('tasted')} label="Une bouteille goûtée" />
                    </div>
                ) : (
                    <div className={styles.grid}>
                        {tastedList.map((w) => (
                            <WineCard key={w.id} wine={w} onPair={() => setPairing(w)} onRemove={() => removeWine(w.id)} onZoom={() => w.photo && setZoom(w.photo)} onMenu={(x, y) => setMenu({ wine: w, x, y })} />
                        ))}
                        <AddTile onClick={() => setAdding('tasted')} label="Une bouteille goûtée" />
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


/**
 * Viseur d'étiquette — on POINTE, ça se déclenche tout seul.
 *
 * Le flux passe dans un <canvas> réduit à 64 px de large. Deux mesures y sont
 * prises à chaque image :
 *   • la NETTETÉ : somme des écarts entre pixels voisins. Une photo floue a des
 *     transitions douces, donc une somme basse — une étiquette lisible tranche.
 *   • la STABILITÉ : écart moyen avec l'image précédente. Un téléphone qu'on
 *     promène change beaucoup ; un téléphone tenu devant une bouteille, presque
 *     pas.
 * Quand les deux sont bonnes pendant 700 ms d'affilée, on prend la photo en
 * pleine résolution et on enchaîne sur la lecture d'étiquette. Le déclencheur
 * manuel reste là pour les cas où la lumière ne veut rien savoir.
 */
function LabelScanner({ onShot, onClose, busy, message }: {
    onShot: (dataUrl: string) => void;
    onClose: () => void;
    busy: boolean;
    message: string;
}) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const prev = useRef<Uint8ClampedArray | null>(null);
    const steady = useRef(0);
    const fired = useRef(false);
    const [err, setErr] = useState('');
    const [hint, setHint] = useState('Cadre l’étiquette');
    const [aim, setAim] = useState(0);        // 0 → 1 : à quel point on y est

    const frameRef = useRef<HTMLDivElement>(null);

    /**
     * Photo de ce qui est DANS LE CADRE, pas de toute la pièce.
     *
     * La vidéo est affichée en `object-fit: cover` : l'image source est agrandie
     * puis rognée pour remplir l'écran. On refait donc le calcul à l'envers pour
     * retrouver, en pixels de la caméra, le rectangle que l'utilisateur voit
     * entre les quatre coins — et on ne garde que celui-là. Le plan de travail,
     * le mur de la cuisine et le reste du salon disparaissent d'eux-mêmes.
     */
    const grab = () => {
        const v = videoRef.current;
        const f = frameRef.current;
        if (!v || !v.videoWidth) return null;

        const cv = document.createElement('canvas');
        const ctx = cv.getContext('2d');
        if (!ctx) return null;

        if (f) {
            const vr = v.getBoundingClientRect();
            const fr = f.getBoundingClientRect();
            const scale = Math.max(vr.width / v.videoWidth, vr.height / v.videoHeight);
            // Coin haut-gauche de l'image source tel qu'il est posé à l'écran.
            const offX = vr.left + (vr.width - v.videoWidth * scale) / 2;
            const offY = vr.top + (vr.height - v.videoHeight * scale) / 2;
            const sx = Math.max(0, (fr.left - offX) / scale);
            const sy = Math.max(0, (fr.top - offY) / scale);
            const sw = Math.min(v.videoWidth - sx, fr.width / scale);
            const sh = Math.min(v.videoHeight - sy, fr.height / scale);
            if (sw > 40 && sh > 40) {
                cv.width = Math.round(sw); cv.height = Math.round(sh);
                ctx.drawImage(v, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
                return cv.toDataURL('image/jpeg', 0.9);
            }
        }
        cv.width = v.videoWidth; cv.height = v.videoHeight;
        ctx.drawImage(v, 0, 0);
        return cv.toDataURL('image/jpeg', 0.9);
    };

    const shoot = () => {
        if (fired.current || busy) return;
        const shot = grab();
        if (!shot) return;
        fired.current = true;
        navigator.vibrate?.(14);
        onShot(shot);
    };

    // Une lecture ratée relance la surveillance : on ne fige pas le viseur.
    useEffect(() => { if (!busy) { fired.current = false; steady.current = 0; } }, [busy]);

    useEffect(() => {
        let raf = 0;
        let stop = false;

        const start = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
                    audio: false,
                });
                if (stop) { stream.getTracks().forEach((t) => t.stop()); return; }
                streamRef.current = stream;
                const v = videoRef.current;
                if (v) { v.srcObject = stream; await v.play().catch(() => {}); }
                loop();
            } catch (e: any) {
                setErr(e?.name === 'NotAllowedError'
                    ? 'Accès à l’appareil photo refusé. Autorise-le, ou prends la photo depuis la pellicule.'
                    : 'Pas d’appareil photo utilisable ici — prends la photo depuis la pellicule.');
            }
        };

        const loop = () => {
            if (stop) return;
            raf = requestAnimationFrame(loop);
            const v = videoRef.current;
            if (!v || !v.videoWidth || busy || fired.current) return;

            if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
            const cv = canvasRef.current;
            cv.width = 64; cv.height = 48;
            const ctx = cv.getContext('2d', { willReadFrequently: true });
            if (!ctx) return;
            ctx.drawImage(v, 0, 0, 64, 48);
            const img = ctx.getImageData(0, 0, 64, 48).data;

            // Niveaux de gris, puis netteté (contraste local) et mouvement.
            const gray = new Uint8ClampedArray(64 * 48);
            for (let i = 0, p = 0; i < img.length; i += 4, p++) {
                gray[p] = (img[i] * 0.299 + img[i + 1] * 0.587 + img[i + 2] * 0.114) | 0;
            }
            let sharp = 0;
            for (let y = 1; y < 47; y++) {
                for (let x = 1; x < 63; x++) {
                    const p = y * 64 + x;
                    sharp += Math.abs(gray[p] * 2 - gray[p - 1] - gray[p + 1]);
                }
            }
            sharp /= 62 * 46;

            let move = 999;
            if (prev.current) {
                let d = 0;
                for (let i = 0; i < gray.length; i++) d += Math.abs(gray[i] - prev.current[i]);
                move = d / gray.length;
            }
            prev.current = gray;

            const ok = sharp > 6 && move < 4;
            steady.current = ok ? steady.current + 16 : 0;
            setAim(Math.min(1, steady.current / 700));
            setHint(!ok && move >= 4 ? 'Ne bouge plus…'
                : !ok ? 'Approche l’étiquette, cherche la lumière'
                : 'C’est net, on y est');
            if (steady.current >= 700) shoot();
        };

        start();
        return () => {
            stop = true;
            cancelAnimationFrame(raf);
            streamRef.current?.getTracks().forEach((t) => t.stop());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [busy]);

    return (
        <div className={styles.scanBack}>
            <video ref={videoRef} className={styles.scanVideo} playsInline muted autoPlay />
            <div className={styles.scanVeil} aria-hidden />

            <div className={styles.scanFrame} ref={frameRef}>
                <span className={styles.scanCorner} data-c="tl" />
                <span className={styles.scanCorner} data-c="tr" />
                <span className={styles.scanCorner} data-c="bl" />
                <span className={styles.scanCorner} data-c="br" />
                <div className={styles.scanAim} style={{ transform: `scaleX(${aim})` }} />
            </div>

            <div className={styles.scanTop}>
                <button className={styles.scanClose} onClick={onClose} aria-label="Fermer">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
            </div>

            <div className={styles.scanBottom}>
                <div className={styles.scanHintBig}>
                    {err || (busy ? (message || 'Lecture de l’étiquette…') : hint)}
                </div>
                {!err && !busy && (
                    <p className={styles.scanSub}>Tiens la bouteille dans le cadre : la photo part toute seule.</p>
                )}
                {/* Sans caméra, le déclencheur n'a rien à déclencher : on renvoie
                    directement vers la pellicule. */}
                {!busy && !err && (
                    <button className={styles.scanShutter} onClick={shoot} aria-label="Prendre la photo">
                        <span />
                    </button>
                )}
                {err && (
                    <button className={styles.scanPick} onClick={onClose}>Choisir une photo</button>
                )}
                {busy && <span className={styles.scanSpin} />}
            </div>
        </div>
    );
}

/**
 * Champ à étiquette flottante : l'étiquette vit DANS le champ et remonte dès
 * qu'on écrit. On garde ainsi le nom de la donnée sous les yeux pendant la
 * saisie — un simple `placeholder` disparaît à la première lettre et on ne sait
 * plus ce qu'on remplit.
 */
function Field({ label, value, onChange, hint, inputMode, autoFocus }: {
    label: string; value: string; onChange: (v: string) => void;
    hint?: string; inputMode?: 'numeric' | 'text'; autoFocus?: boolean;
}) {
    return (
        <label className={`${styles.field} ${value ? styles.fieldFilled : ''}`}>
            <input
                className={styles.fieldInp}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                inputMode={inputMode}
                autoFocus={autoFocus}
                placeholder=" "
            />
            <span className={styles.fieldLbl}>{label}{hint ? <em> · {hint}</em> : null}</span>
        </label>
    );
}

/** Tuile « Ajouter » : elle occupe une case de la grille, juste après la
 *  dernière bouteille, et se décale d'elle-même quand une nouvelle entre. */
function AddTile({ onClick, label }: { onClick: () => void; label: string }) {
    return (
        <button className={styles.addTile} onClick={onClick}>
            <span className={styles.addTileIc}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </span>
            <span className={styles.addTileLbl}>{label}</span>
        </button>
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
    const shelf = shelfOf(wine);
    const cardRef = useRef<HTMLDivElement>(null);
    const press = useRef<ReturnType<typeof setTimeout> | null>(null);
    const from = useRef<{ x: number; y: number } | null>(null);
    const touch = useRef(false);
    const pointer = useRef<number | null>(null);
    const [dragging, setDragging] = useState(false);
    const hovered = useRef<HTMLElement | null>(null);

    /** Étagère survolée par le doigt, d'après ce qu'il y a sous le point. */
    const shelfUnder = (x: number, y: number) => {
        const el = document.elementFromPoint(x, y) as HTMLElement | null;
        return (el?.closest('[data-shelf]') as HTMLElement | null) || null;
    };
    const highlight = (el: HTMLElement | null) => {
        if (hovered.current === el) return;
        hovered.current?.classList.remove(styles.shelfDrop);
        if (el && el.dataset.shelf !== shelf) el.classList.add(styles.shelfDrop);
        hovered.current = el;
    };
    /** La carte décolle : elle suit le pointeur et cesse d'intercepter les clics
     *  (sinon le point sous le curseur désigne la carte, pas l'étagère visée). */
    const startDrag = (pointerId: number) => {
        if (press.current) { clearTimeout(press.current); press.current = null; }
        navigator.vibrate?.(12);
        setDragging(true);
        const card = cardRef.current;
        if (card) {
            card.style.pointerEvents = 'none';
            card.style.userSelect = 'none';
            try { card.setPointerCapture?.(pointerId); } catch { /* capture refusée */ }
        }
    };

    const endDrag = (x?: number, y?: number) => {
        if (press.current) { clearTimeout(press.current); press.current = null; }
        const card = cardRef.current;
        if (card) { card.style.transform = ''; card.style.zIndex = ''; card.style.pointerEvents = ''; card.style.userSelect = ''; }
        const target = x != null && y != null ? shelfUnder(x, y) : null;
        highlight(null);
        setDragging(false);
        from.current = null;
        if (target && target.dataset.shelf && target.dataset.shelf !== shelf) {
            navigator.vibrate?.(14);
            if (target.dataset.shelf === 'tasted') moveToTasted(wine.id); else moveToCave(wine.id);
        }
    };

    return (
        <div
            ref={cardRef}
            className={`${styles.card} ${shelf === 'tasted' ? styles.cardTasted : ''} ${dragging ? styles.cardDragging : ''}`}
            /* Maintenir la carte la DÉCOLLE et la fait suivre le doigt : c'est le
               geste attendu pour la ranger d'une étagère à l'autre. Le menu, lui,
               reste au clic droit (et sur le « ⋯ » de la carte, seule voie au
               doigt puisque le clic droit n'existe pas sur un téléphone). */
            onContextMenu={(e) => { e.preventDefault(); onMenu(e.clientX, e.clientY); }}
            onPointerDown={(e) => {
                if (e.button === 2) return;                    // clic droit : au menu
                const { clientX, clientY, pointerId } = e;
                from.current = { x: clientX, y: clientY };
                touch.current = e.pointerType !== 'mouse';
                pointer.current = pointerId;
                // Au DOIGT, on attend : sans ce délai, faire défiler la page
                // décollerait une carte. À la SOURIS, on ne peut pas attendre —
                // on presse et on tire dans le même mouvement, et le geste était
                // annulé avant même d'avoir commencé.
                if (touch.current) {
                    press.current = setTimeout(() => { startDrag(pointerId); }, 260);
                }
            }}
            onPointerMove={(e) => {
                if (!from.current) return;
                const dx = e.clientX - from.current.x;
                const dy = e.clientY - from.current.y;
                if (!dragging) {
                    const moved = Math.hypot(dx, dy);
                    if (!touch.current) {
                        // Souris : trois pixels suffisent à dire qu'on tire.
                        if (moved > 3) startDrag(pointer.current ?? e.pointerId);
                    } else if (moved > 12 && press.current) {
                        // Doigt : c'est un défilement, on renonce.
                        clearTimeout(press.current); press.current = null; from.current = null;
                    }
                    return;
                }
                const card = cardRef.current;
                if (card) { card.style.transform = `translate(${dx}px, ${dy}px) scale(1.04)`; card.style.zIndex = '50'; }
                highlight(shelfUnder(e.clientX, e.clientY));
            }}
            onPointerUp={(e) => endDrag(e.clientX, e.clientY)}
            onPointerCancel={() => endDrag()}
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
                <button
                    className={styles.more}
                    onClick={(e) => { e.stopPropagation(); onMenu(e.clientX, e.clientY); }}
                    aria-label="Actions"
                >
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
                </button>
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
                {/* Ta note à gauche (cliquable), celle des dégustateurs à droite —
                    elles ne disent pas la même chose et ne doivent pas se
                    confondre. La rangée ne se rogne plus : la note publique
                    disparaissait derrière une hauteur fixe. */}
                <div className={styles.ratings}>
                    <MyStars
                        value={wine.myRating ?? 0}
                        onSet={(n) => updateWine(wine.id, { myRating: n })}
                    />
                    {wine.rating ? (
                        <span className={styles.rating} title="Note des dégustateurs">
                            ★ {wine.rating.toFixed(1)}<small>/5</small>
                        </span>
                    ) : null}
                </div>
                <div className={styles.apoSlot}>
                    {(() => {
                        const w = drinkWindow(wine);
                        if (!w) return null;
                        const cls = w.status === 'tard' ? styles.apoLate
                            : w.status === 'jeune' ? styles.apoWait
                            : w.status === 'apogee' ? styles.apoPeak
                            : styles.apoNow;
                        return <span className={`${styles.apogee} ${cls}`}>{w.label}</span>;
                    })()}
                </div>
                {/* Une seule ligne d'actions, en texte : le stock à gauche (ou le
                    retour en cave), l'accord à droite. Un filet les sépare du
                    reste — plus de pile de dalles sous chaque bouteille. */}
                <div className={styles.stockRow}>
                    {shelf === 'cave' ? (
                        <div className={styles.stepper}>
                            <button onClick={(e) => { e.stopPropagation(); setQty(wine.id, (wine.qty ?? 1) - 1); }} aria-label="Moins">−</button>
                            <span>{wine.qty ?? 1}</span>
                            <button onClick={(e) => { e.stopPropagation(); setQty(wine.id, (wine.qty ?? 1) + 1); }} aria-label="Plus">+</button>
                        </div>
                    ) : (
                        <button className={styles.openBtn} onClick={(e) => { e.stopPropagation(); moveToCave(wine.id); }}>+ Ma cave</button>
                    )}
                    <button className={styles.pairBtn} onClick={onPair}>
                        Quelle recette
                        <svg viewBox="0 0 8 14" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l6 6-6 6" /></svg>
                    </button>
                </div>
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
                    {/* La bouteille reste sous les yeux pendant qu'on corrige :
                        c'est elle qu'on décrit, elle doit tenir la vedette. */}
                    <div className={styles.editHero}>
                        <div className={styles.editHeroGlow} aria-hidden />
                        {(f.photo || wine.photo)
                            ? <img className={styles.editHeroImg} src={f.photo || wine.photo} alt="" />
                            : <span className={styles.editHeroFallback}><BottleSVG color={f.color} /></span>}
                    </div>

                    <div className={styles.fields}>
                        <Field label="Nom du vin" value={f.name} onChange={(v) => setF({ ...f, name: v })} autoFocus />
                        <div className={styles.two}>
                            <Field label="Cépage" value={f.grape} onChange={(v) => setF({ ...f, grape: v })} />
                            <Field label="Année" value={f.year} onChange={(v) => setF({ ...f, year: v })} inputMode="numeric" />
                        </div>
                        <Field label="Région / appellation" value={f.region} onChange={(v) => setF({ ...f, region: v })} />
                        <Field label="Note de dégustation" value={f.note} onChange={(v) => setF({ ...f, note: v })} />
                        <Field label="Lien de la photo" value={f.photo} onChange={(v) => setF({ ...f, photo: v })} hint="facultatif" />

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
    // Viseur en direct : c'est la voie normale du scan. La pellicule reste en
    // secours (ordinateur sans caméra, autorisation refusée).
    const [viewfinder, setViewfinder] = useState(false);
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
    /**
     * Met la photo prise chez soi en SCÈNE DE CAVE : format portrait, fond noir,
     * et les bords fondus dans le noir. Ce n'est pas un détourage — il faudrait
     * un modèle de segmentation pour découper vraiment la bouteille — mais le
     * plan de travail et le mur s'effacent, et la bouteille se pose sur le même
     * noir que les photos du marchand. On ne s'en sert QUE quand le marchand n'a
     * pas retrouvé la bouteille : sa photo à lui est déjà un détourage studio.
     */
    const toStudio = (dataUrl: string, w = 600, h = 800): Promise<string> => new Promise((res) => {
        const img = new Image();
        img.onload = () => {
            const cv = document.createElement('canvas');
            cv.width = w; cv.height = h;
            const ctx = cv.getContext('2d');
            if (!ctx) return res(dataUrl);

            ctx.fillStyle = '#0b0806';
            ctx.fillRect(0, 0, w, h);

            // La photo remplit le cadre, centrée, sans déformation.
            const r = Math.max(w / img.width, h / img.height);
            const dw = img.width * r, dh = img.height * r;
            ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);

            // Fondu vers le noir sur tout le pourtour : le décor s'éteint, le
            // centre — la bouteille — reste net.
            const g = ctx.createRadialGradient(w / 2, h * 0.46, Math.min(w, h) * 0.28, w / 2, h * 0.46, Math.max(w, h) * 0.62);
            g.addColorStop(0, 'rgba(11,8,6,0)');
            g.addColorStop(0.62, 'rgba(11,8,6,0.55)');
            g.addColorStop(1, 'rgba(11,8,6,1)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);

            res(cv.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => res(dataUrl);
        img.src = dataUrl;
    });

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
                        // Photo du marchand quand il a retrouvé la bouteille (déjà
                        // détourée sur fond blanc) ; sinon la nôtre, mise en scène.
                        photo: w.photo || (await toStudio(dataUrl)), rating: w.rating, vivinoUrl: w.vivinoUrl,
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

    const save = async () => {
        const name = form.name.trim();
        if (!name) return;
        // Même règle qu'au scan : notre photo passe par la scène de cave, celle
        // du marchand (déjà détourée) est prise telle quelle.
        const mine = photoSmall ? await toStudio(photoSmall) : '';
        // Priorité : lien collé > photo officielle du marchand > photo scannée.
        const known = findKnownWine(name);
        addWine({
            ...form, name,
            photo: photoUrl.trim() || official.photo || mine || undefined,
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

                {viewfinder && (
                    <LabelScanner
                        busy={busy}
                        message={scanMsg}
                        onClose={() => setViewfinder(false)}
                        onShot={(url) => { setPhoto(url); scanAndAdd(url); }}
                    />
                )}

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
                        <button className={styles.scanBtn} onClick={() => setViewfinder(true)} disabled={busy}>
                            {official.photo || photo ? <img src={official.photo || photo} alt="" className={styles.scanThumb} /> : (
                                <span className={styles.scanIc}>
                                    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9V7a2 2 0 0 1 2-2h2M17 5h2a2 2 0 0 1 2 2v2M21 15v2a2 2 0 0 1-2 2h-2M7 19H5a2 2 0 0 1-2-2v-2M7 12h10" /></svg>
                                    Viser l’étiquette
                                </span>
                            )}
                            {busy && <span className={styles.scanBusy}><span className={styles.spin} />{scanMsg || 'Lecture de l’étiquette…'}</span>}
                        </button>
                        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} hidden />
                        <button className={styles.scanFallback} onClick={() => fileRef.current?.click()} disabled={busy}>
                            ou choisir une photo
                        </button>
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
