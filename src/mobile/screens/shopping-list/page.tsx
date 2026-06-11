'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, useAnimation, PanInfo } from 'framer-motion';
import Link from 'next/link';
import Header from '@/mobile/components/Header/Header';
import WeekMenuCarousel from '@/mobile/components/WeekMenuCarousel/WeekMenuCarousel';
import { fmtQty, carrefourTerm, buildConsolidatedItems, getIngIcon as getIcon, doneKeysOf, isItemDone, parseIngredient, cleanIngredientText } from '@/mobile/lib/ingredients';
import type { ConsolItem } from '@/mobile/lib/ingredients';
import ShopActions from '@/mobile/components/ShopActions/ShopActions';
import { RAYONS, RAYON_BY_ID, RAYON_ORDER, rayonOf, readRayonOverrides, writeRayonOverride } from '@/lib/rayons';
import styles from './shopping-list.module.css';

interface ListData {
    [key: string]: {
        title: string;
        image?: string;
        ingredients: { name: string; checked: boolean }[];
        source?: 'planner' | 'manuel';
    }
}

export default function ShoppingListPage() {
    const [shoppingList, setShoppingList] = useState<ListData>({});
    const [weekPlan, setWeekPlan] = useState<Record<string, Record<string, unknown>>>({});
    const [weekChecked, setWeekChecked] = useState<Set<string>>(new Set());
    const [mounted, setMounted] = useState(false);
    const [mode, setMode] = useState<'jour' | 'recette' | 'fusionnee'>('fusionnee');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [recipeSel, setRecipeSel] = useState<Set<string>>(new Set()); // coché en mode "Par recette" (clé `id|idx`)
    const [done, setDone] = useState<Set<string>>(new Set());
    const [carrefourIdx, setCarrefourIdx] = useState<number | null>(null);
    const [manualName, setManualName] = useState('');
    const [manualQty, setManualQty] = useState('');
    const [includeJourJ] = useState(true);
    const [rayonOverrides, setRayonOverrides] = useState<Record<string, string>>({});
    const [collapsedRayons, setCollapsedRayons] = useState<Set<string>>(new Set());
    const [rayonPickerKey, setRayonPickerKey] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
        const read = () => {
            try { setShoppingList(JSON.parse(localStorage.getItem('magic-shopping-list') || '{}')); } catch { setShoppingList({}); }
            try { setWeekPlan(JSON.parse(localStorage.getItem('meal-planner-week') || '{}')); } catch { setWeekPlan({}); }
            try { setWeekChecked(new Set(JSON.parse(localStorage.getItem('meal-week-checked') || '[]'))); } catch { setWeekChecked(new Set()); }
            try { setDone(new Set(JSON.parse(localStorage.getItem('shop-done') || '[]'))); } catch { setDone(new Set()); }
            setRayonOverrides(readRayonOverrides());
            try { setCollapsedRayons(new Set(JSON.parse(localStorage.getItem('shop-rayons-collapsed') || '[]'))); } catch { setCollapsedRayons(new Set()); }
        };
        read();
        window.addEventListener('shoppingListUpdated', read);
        window.addEventListener('storage', read);
        return () => {
            window.removeEventListener('shoppingListUpdated', read);
            window.removeEventListener('storage', read);
        };
    }, []);

    const items = useMemo<ConsolItem[]>(
        () => buildConsolidatedItems(weekPlan, weekChecked, shoppingList, includeJourJ),
        [shoppingList, weekPlan, weekChecked, includeJourJ]
    );

    const keysSig = items.map(i => i.key).join(',');
    useEffect(() => { setSelected(new Set()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [keysSig]);

    // Groupement par rayon (affichage seulement — état coché/rayé/sélectionné intact).
    const groupedRayons = useMemo(() => {
        const map = new Map<string, ConsolItem[]>();
        items.forEach(it => {
            const rid = rayonOf(it.name, rayonOverrides);
            if (!map.has(rid)) map.set(rid, []);
            map.get(rid)!.push(it);
        });
        return [...map.entries()].sort((a, b) => (RAYON_ORDER[a[0]] ?? 99) - (RAYON_ORDER[b[0]] ?? 99));
    }, [items, rayonOverrides]);

    const toggleRayonCollapse = (rid: string) => setCollapsedRayons(prev => {
        const n = new Set(prev);
        n.has(rid) ? n.delete(rid) : n.add(rid);
        localStorage.setItem('shop-rayons-collapsed', JSON.stringify([...n]));
        return n;
    });
    const reassignRayon = (it: ConsolItem, rid: string) => {
        writeRayonOverride(it.name, rid);
        setRayonOverrides(readRayonOverrides());
        setRayonPickerKey(null);
    };

    // ── persistance localStorage ──
    const saveList = (newData: ListData) => {
        window.localStorage.setItem('magic-shopping-list', JSON.stringify(newData));
        setShoppingList(newData);
        window.dispatchEvent(new Event('shoppingListUpdated'));
    };
    const removeRecipe = (id: string) => { const n = { ...shoppingList }; delete n[id]; saveList(n); };
    const toggleCheck = (recipeId: string, ingIdx: number) => {
        const n = { ...shoppingList };
        const recipe = n[recipeId];
        if (recipe && recipe.ingredients[ingIdx]) {
            const ing = recipe.ingredients[ingIdx];
            if (typeof ing === 'string') recipe.ingredients[ingIdx] = { name: ing, checked: true };
            else ing.checked = !ing.checked;
            saveList(n);
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
        }
    };

    // ── sélection (cible Carrefour / partage) ──
    const toggle = (key: string) => setSelected(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
    const allSelected = items.length > 0 && selected.size === items.length;
    const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map(i => i.key)));

    // ── rayé / fait ──
    const persistDone = (s: Set<string>) => { localStorage.setItem('shop-done', JSON.stringify([...s])); window.dispatchEvent(new Event('shoppingListUpdated')); };
    const toggleDone = (it: ConsolItem) => setDone(prev => {
        const n = new Set(prev); const ks = doneKeysOf(it); const already = ks.every(k => n.has(k));
        ks.forEach(k => (already ? n.delete(k) : n.add(k))); persistDone(n); return n;
    });
    const markDone = (it: ConsolItem) => setDone(prev => { const n = new Set(prev); doneKeysOf(it).forEach(k => n.add(k)); persistDone(n); return n; });

    // ── ajout manuel ──
    const addManual = () => {
        const name = manualName.trim();
        if (!name) return;
        const qty = manualQty.trim() || '1';
        const raw = `${qty} ${name}`;
        // localStorage écrit AVANT le dispatch (sinon le handler relit un état vide → l'item disparaît).
        const next = { ...shoppingList };
        const entry = next.manuel
            ? { ...next.manuel, ingredients: [...next.manuel.ingredients] }
            : { title: 'Ajouts manuels', source: 'manuel' as const, ingredients: [] as { name: string; checked: boolean }[] };
        entry.ingredients.push({ name: raw, checked: false });
        next.manuel = entry;
        localStorage.setItem('magic-shopping-list', JSON.stringify(next));
        setShoppingList(next);
        window.dispatchEvent(new Event('shoppingListUpdated'));
        setManualName(''); setManualQty('');
    };

    const clearList = () => {
        if (!confirm('Vider toute la liste de courses ?')) return;
        localStorage.removeItem('magic-shopping-list');
        setShoppingList({});
        const checked = new Set(weekChecked);
        Object.keys(weekPlan).forEach(dayKey => {
            const day = (weekPlan[dayKey] || {}) as Record<string, { ingredients?: unknown[] }>;
            Object.keys(day).forEach(mealKey => {
                (day[mealKey]?.ingredients || []).forEach((_: unknown, idx: number) => checked.add(`${dayKey}|${mealKey}|${idx}`));
            });
        });
        setWeekChecked(checked);
        localStorage.setItem('meal-week-checked', JSON.stringify([...checked]));
        window.dispatchEvent(new Event('shoppingListUpdated'));
    };

    // ── partage / Carrefour ──
    const lineFor = (it: ConsolItem) => it.qty != null ? `${fmtQty(it.qty)}${it.unit ? ' ' + it.unit : ''} ${it.name}` : it.name;
    const buildShareText = () => '🛒 Ma liste de courses\n\n' + items.filter(i => selected.has(i.key)).map(i => `• ${lineFor(i)}`).join('\n');
    const shareNative = async () => {
        const text = buildShareText();
        if (typeof navigator !== 'undefined' && (navigator as Navigator & { share?: (d: unknown) => Promise<void> }).share) {
            try { await (navigator as Navigator & { share: (d: unknown) => Promise<void> }).share({ title: 'Ma liste de courses', text }); } catch { /* annulé */ }
            return; // ne PAS retomber sur WhatsApp si annulé
        }
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };
    const shareWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(buildShareText())}`, '_blank');

    // ── Mode "Par recette" : coché (sélection magasin) indépendant du barré ──
    const toggleRecipeSel = (id: string, idx: number) => setRecipeSel(prev => {
        const k = `${id}|${idx}`; const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n;
    });
    // Tous les ingrédients (toutes recettes) en ConsolItem → cible filtrée par les cochés.
    const recipeItems: ConsolItem[] = Object.entries(shoppingList).flatMap(([id, entry]) =>
        (entry.ingredients || []).map((ing: { name: string } | string, idx: number) => {
            const raw = (typeof ing === 'string' ? ing : ing.name || '').replace(/^[-•\s]+/, '');
            const p = parseIngredient(raw);
            const key = `${id}|${idx}`;
            return { key, keys: [key], icon: getIcon(p.name || raw), name: p.name || raw, unit: '', qty: null, display: cleanIngredientText(raw) || raw, count: 1 };
        })
    );


    // Cible = uniquement les ingrédients cochés (la barre magasin n'apparaît que s'il y en a).
    const selectedItems = items.filter(i => selected.has(i.key));
    const openCarrefourFor = (i: number) => {
        const it = selectedItems[i];
        if (!it) return;
        window.open(`https://www.carrefour.fr/s?q=${encodeURIComponent(carrefourTerm(it.name))}`, 'carrefourCart');
        markDone(it);
    };
    const startCarrefour = () => { if (!selectedItems.length) return; setCarrefourIdx(0); openCarrefourFor(0); };
    const carrefourGo = (i: number) => { const n = Math.max(0, Math.min(i, selectedItems.length - 1)); setCarrefourIdx(n); openCarrefourFor(n); };

    if (!mounted) return null;

    const recipesCount = Object.keys(shoppingList).length;

    return (
        <div className={styles.page}>
            <Header title="Ma liste" showBack={true} />

            <main className={styles.main}>
                <div className={styles.headerRow}>
                    <div>
                        <h1 className={styles.mainTitle}>Courses</h1>
                        <p className={styles.count}>
                            {mode === 'fusionnee'
                                ? `${items.length} ingrédient${items.length > 1 ? 's' : ''}`
                                : `${recipesCount} recette${recipesCount > 1 ? 's' : ''}`}
                        </p>
                    </div>
                    {(mode === 'fusionnee' ? items.length > 0 : recipesCount > 0) && (
                        <button onClick={clearList} className={styles.clearBtn}>Tout vider</button>
                    )}
                </div>

                {/* Bascule de mode */}
                <div className={styles.modeToggle}>
                    <button className={`${styles.modeBtn} ${mode === 'jour' ? styles.modeBtnActive : ''}`} onClick={() => setMode('jour')}>Par jour</button>
                    <button className={`${styles.modeBtn} ${mode === 'fusionnee' ? styles.modeBtnActive : ''}`} onClick={() => setMode('fusionnee')}>Fusionnée</button>
                    <button className={`${styles.modeBtn} ${mode === 'recette' ? styles.modeBtnActive : ''}`} onClick={() => setMode('recette')}>Par recette</button>
                </div>

                {mode === 'jour' ? (
                    <WeekMenuCarousel />
                ) : mode === 'fusionnee' ? (
                    <>
                        {/* Ajout manuel */}
                        <div className={styles.addItemBar}>
                            <span className={styles.addItemPreview}>{manualName.trim() ? getIcon(manualName) : '🛒'}</span>
                            <input className={styles.addItemInput} value={manualName} onChange={e => setManualName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') addManual(); }} placeholder="Ajouter un article" />
                            <input className={styles.addItemQty} value={manualQty} onChange={e => setManualQty(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') addManual(); }} placeholder="Qté" />
                            <button className={styles.addItemBtn} onClick={addManual} disabled={!manualName.trim()} aria-label="Ajouter">+</button>
                        </div>

                        {items.length === 0 ? (
                            <div className={styles.empty}>
                                <div className={styles.emptyIcon}>🛒</div>
                                <h2 className={styles.emptyTitle}>Panier vide</h2>
                                <p className={styles.emptySubtitle}>Ajoute des ingrédients depuis une recette ou un article ci-dessus.</p>
                            </div>
                        ) : (
                            <>
                                <div className={styles.selectBar}>
                                    <span className={styles.selectBarInfo}>{selected.size} / {items.length} sélectionné{selected.size > 1 ? 's' : ''}</span>
                                    <button className={styles.selectAllBtn} onClick={toggleAll}>{allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}</button>
                                </div>
                                <div className={styles.consolList}>
                                    {groupedRayons.map(([rid, rayonItems]) => {
                                        const rayon = RAYON_BY_ID[rid] || RAYON_BY_ID['autre'];
                                        const collapsed = collapsedRayons.has(rid);
                                        return (
                                            <div key={rid} className={styles.rayonGroup}>
                                                <button className={styles.rayonHeader} onClick={() => toggleRayonCollapse(rid)}>
                                                    <span className={styles.rayonEmoji}>{rayon.emoji}</span>
                                                    <span className={styles.rayonLabel}>{rayon.label}</span>
                                                    <span className={styles.rayonCount}>{rayonItems.length}</span>
                                                    <svg className={`${styles.rayonChevron} ${collapsed ? styles.rayonChevronUp : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="6 9 12 15 18 9" />
                                                    </svg>
                                                </button>
                                                {!collapsed && rayonItems.map(it => {
                                                    const sel = selected.has(it.key);
                                                    const isDone = isItemDone(it, done);
                                                    const picking = rayonPickerKey === it.key;
                                                    return (
                                                        <div key={it.key} className={`${styles.consolItem} ${sel ? styles.consolItemSel : ''} ${isDone ? styles.consolItemDone : ''}`}>
                                                            <span className={styles.consolIcon} onClick={() => toggleDone(it)}>{it.icon}</span>
                                                            <span className={styles.consolName} onClick={() => toggleDone(it)}>{it.display}</span>
                                                            <div className={styles.rayonMoveWrap}>
                                                                <button className={styles.rayonMoveBtn} onClick={(e) => { e.stopPropagation(); setRayonPickerKey(picking ? null : it.key); }} aria-label="Changer de rayon">{rayon.emoji}</button>
                                                                {picking && (
                                                                    <div className={styles.rayonPicker} onClick={e => e.stopPropagation()}>
                                                                        {RAYONS.map(r => (
                                                                            <button key={r.id} className={`${styles.rayonPickerItem} ${r.id === rid ? styles.rayonPickerActive : ''}`} onClick={() => reassignRayon(it, r.id)}>
                                                                                <span>{r.emoji}</span> {r.label}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <button className={styles.consolCheck} onClick={(e) => { e.stopPropagation(); toggle(it.key); }} aria-label="Sélectionner">
                                                                {sel && (
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                                                        <polyline points="20 6 9 17 4 12" />
                                                                    </svg>
                                                                )}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}

                        {/* Barre de partage flottante — visible UNIQUEMENT quand au moins un ingrédient
                            est coché ; cible = exactement les ingrédients cochés. */}
                        {selected.size > 0 && (
                            <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(20,20,20,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 40, padding: '10px 16px', zIndex: 100, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginRight: 4 }}>{selected.size ? `${selected.size} à partager` : `${items.length} ingr.`}</span>
                                <button onClick={shareNative} style={btnStyle('linear-gradient(135deg,#8b5cf6,#6366f1)')}><ShareIcon /> Partager</button>
                                <button onClick={shareWhatsApp} style={btnStyle('#25D366')} title="WhatsApp"><WhatsAppIcon /></button>
                                <button onClick={startCarrefour} style={btnStyle('#0066CC')} title="Carrefour">🛒</button>
                            </div>
                        )}

                        {/* Stepper Carrefour */}
                        {carrefourIdx !== null && selectedItems[carrefourIdx] && (
                            <div style={{ position: 'fixed', bottom: 150, left: '50%', transform: 'translateX(-50%)', width: 'min(440px, 92vw)', display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(20,20,20,0.97)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 22, padding: '14px 16px', zIndex: 101, boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.05em', color: '#5aa9ff' }}>🛒 CARREFOUR · {carrefourIdx + 1}/{selectedItems.length}</span>
                                    <button onClick={() => setCarrefourIdx(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontSize: '1.5rem' }}>{selectedItems[carrefourIdx].icon}</span>
                                    <span style={{ flex: 1, fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>{selectedItems[carrefourIdx].name}</span>
                                    {selectedItems[carrefourIdx].qty != null && (
                                        <span style={{ fontWeight: 800, color: '#c4b5fd' }}>{fmtQty(selectedItems[carrefourIdx].qty!)}{selectedItems[carrefourIdx].unit ? ` ${selectedItems[carrefourIdx].unit}` : ''}</span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button onClick={() => carrefourGo(carrefourIdx - 1)} disabled={carrefourIdx === 0} style={{ ...btnStyle('rgba(255,255,255,0.1)'), opacity: carrefourIdx === 0 ? 0.4 : 1 }}>◀</button>
                                    <button onClick={() => openCarrefourFor(carrefourIdx)} style={{ ...btnStyle('#0066CC'), flex: 1, justifyContent: 'center' }}>Rechercher</button>
                                    {carrefourIdx < selectedItems.length - 1 ? (
                                        <button onClick={() => carrefourGo(carrefourIdx + 1)} style={btnStyle('linear-gradient(135deg,#8b5cf6,#6366f1)')}>Suivant ▶</button>
                                    ) : (
                                        <button onClick={() => setCarrefourIdx(null)} style={btnStyle('#22c55e')}>Terminé ✓</button>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    recipesCount === 0 ? (
                        <div className={styles.empty}>
                            <div className={styles.emptyIcon}>🛒</div>
                            <h2 className={styles.emptyTitle}>Panier vide</h2>
                            <p className={styles.emptySubtitle}>Ajoutez des ingrédients depuis une recette.</p>
                        </div>
                    ) : (
                        <>
                            <div className={styles.list}>
                                {Object.entries(shoppingList).map(([id, data]) => (
                                    <SwipeableRecipe key={id} id={id} data={data} removeRecipe={removeRecipe} toggleCheck={toggleCheck} selected={recipeSel} onToggleSel={toggleRecipeSel} />
                                ))}
                            </div>
                            {/* Partager + Magasin : visibles seulement si ≥1 ingrédient coché, cible = cochés */}
                            <ShopActions items={recipeItems} checkedKeys={recipeSel} title="Ma sélection" size="md" />
                        </>
                    )
                )}
            </main>
        </div>
    );
}

const btnStyle = (color: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6, background: color, border: 'none',
    borderRadius: 24, padding: '8px 14px', color: 'white', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
});

function ShareIcon() {
    return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>);
}
function WhatsAppIcon() {
    return (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>);
}

function SwipeableRecipe({ id, data, removeRecipe, toggleCheck, selected, onToggleSel }: { id: string, data: ListData[string], removeRecipe: (id: string) => void, toggleCheck: (id: string, idx: number) => void, selected: Set<string>, onToggleSel: (id: string, idx: number) => void }) {
    const controls = useAnimation();
    const handleDragEnd = async (_event: unknown, info: PanInfo) => {
        if (info.offset.x < -100 || info.velocity.x < -500) {
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
            await controls.start({ x: -window.innerWidth, opacity: 0, transition: { duration: 0.25, ease: 'easeOut' } });
            removeRecipe(id);
        } else {
            controls.start({ x: 0, transition: { type: 'spring', bounce: 0.4, duration: 0.5 } });
        }
    };
    return (
        <div className={styles.swipeContainer}>
            <div className={styles.deleteBackground} onClick={() => removeRecipe(id)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
                <span>Supprimer</span>
            </div>
            <motion.div className={styles.recipeGroup} drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={{ left: 1, right: 0 }}
                onDragEnd={handleDragEnd} animate={controls} whileDrag={{ scale: 0.98, boxShadow: '0 15px 35px rgba(0,0,0,0.2)' }}
                style={{ position: 'relative', zIndex: 2, background: 'var(--color-bg-tertiary)' }}>
                {data.image && (
                    <Link href={`/recipe/${id}`} className={styles.recipeImageWrapper}>
                        <img src={data.image} alt={data.title} className={styles.recipeImage} />
                    </Link>
                )}
                <div className={styles.recipeHeader}><h3 className={styles.recipeTitle}>{data.title}</h3></div>
                <div className={styles.ingredients}>
                    {data.ingredients.map((ing: { name: string; checked: boolean } | string, idx: number) => {
                        const isObject = typeof ing === 'object' && ing !== null;
                        const name = isObject ? ing.name : (ing as string);
                        const checked = isObject ? ing.checked : false;
                        const sel = selected.has(`${id}|${idx}`);
                        return (
                            <div key={idx} className={`${styles.ingItem} ${checked ? styles.checked : ''}`}>
                                {/* Clic nom = barrer (je n'en ai pas besoin) */}
                                <div className={styles.checkboxContainer} onClick={() => toggleCheck(id, idx)}>
                                    <svg className={styles.checkIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                </div>
                                <label className={styles.label} onClick={() => toggleCheck(id, idx)}>{name.replace('- ', '')}</label>
                                {/* Cercle = cocher (sélection magasin/partage) */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onToggleSel(id, idx); }}
                                    aria-label="Sélectionner"
                                    style={{
                                        width: 24, height: 24, borderRadius: '50%', flexShrink: 0, padding: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                        border: sel ? '2px solid transparent' : '2px solid rgba(255,255,255,0.3)',
                                        background: sel ? 'linear-gradient(135deg,#8b5cf6,#6366f1)' : 'none',
                                        color: '#fff',
                                    }}
                                >
                                    {sel && (
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </motion.div>
        </div>
    );
}
