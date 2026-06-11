'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header/Header';
import WeekMenuCarousel from '@/components/WeekMenuCarousel/WeekMenuCarousel';
import { fmtQty, carrefourTerm, buildConsolidatedItems, getIngIcon as getIcon, doneKeysOf, isItemDone, parseIngredient, cleanIngredientText } from '@/lib/ingredients';
import type { ConsolItem } from '@/lib/ingredients';
import { RAYONS, RAYON_BY_ID, RAYON_ORDER, rayonOf, readRayonOverrides, writeRayonOverride } from '@/lib/rayons';
import { STORE_BY_ID, usePreferredStore, storeSearchWithQueue } from '@/lib/stores';
import StoreButton from '@/components/StoreSelector/StoreButton';
import ShopActions from '@/components/ShopActions/ShopActions';
import styles from './shopping-list.module.css';

interface ListData {
    [key: string]: {
        title: string;
        image?: string;
        ingredients: { name: string; checked: boolean }[];
        source?: 'planner' | 'manuel';
        count?: number;
    }
}

export default function ShoppingListPage() {
    const { user, loading: authLoading } = useAuth();
    const [shoppingList, setShoppingList] = useState<ListData>({});
    const [weekPlan, setWeekPlan] = useState<Record<string, Record<string, any>>>({});
    const [weekChecked, setWeekChecked] = useState<Set<string>>(new Set());
    const [mounted, setMounted] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [weekMode, setWeekMode] = useState<'semaine' | 'jourj' | 'fusion' | 'recettes'>('semaine');
    const [store] = usePreferredStore();
    const [carrefourIdx, setCarrefourIdx] = useState<number | null>(null);
    const [manualName, setManualName] = useState('');
    const [manualQty, setManualQty] = useState('');
    const [includeJourJ, setIncludeJourJ] = useState(true);
    const [done, setDone] = useState<Set<string>>(new Set());
    // Rayons : overrides manuels + rayons repliés + item dont le sélecteur est ouvert.
    const [rayonOverrides, setRayonOverrides] = useState<Record<string, string>>({});
    const [collapsedRayons, setCollapsedRayons] = useState<Set<string>>(new Set());
    const [rayonPickerKey, setRayonPickerKey] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
        // Onglet initial depuis l'URL (?tab=recettes) — le caddie d'une fiche y renvoie.
        try {
            const tab = new URLSearchParams(window.location.search).get('tab');
            if (tab && ['semaine', 'jourj', 'fusion', 'recettes'].includes(tab)) setWeekMode(tab as any);
        } catch {}
        const read = () => {
            try { setShoppingList(JSON.parse(localStorage.getItem('magic-shopping-list') || '{}')); } catch { setShoppingList({}); }
            try { setWeekPlan(JSON.parse(localStorage.getItem('meal-planner-week') || '{}')); } catch { setWeekPlan({}); }
            try { setWeekChecked(new Set(JSON.parse(localStorage.getItem('meal-week-checked') || '[]'))); } catch { setWeekChecked(new Set()); }
            try { setDone(new Set(JSON.parse(localStorage.getItem('shop-done') || '[]'))); } catch { setDone(new Set()); }
            setRayonOverrides(readRayonOverrides());
            try { setCollapsedRayons(new Set(JSON.parse(localStorage.getItem('shop-rayons-collapsed') || '[]'))); } catch { setCollapsedRayons(new Set()); }
            setIncludeJourJ(localStorage.getItem('jourj-in-fused') !== 'false');
        };
        read();
        window.addEventListener('shoppingListUpdated', read);
        window.addEventListener('storage', read);
        return () => {
            window.removeEventListener('shoppingListUpdated', read);
            window.removeEventListener('storage', read);
        };
    }, []);

    // Liste fusionnée = ingrédients de la semaine (hors cases cochées en vue "par jour")
    //                   + ajouts manuels (recettes hors planificateur)
    const items = useMemo<ConsolItem[]>(
        () => buildConsolidatedItems(weekPlan, weekChecked, shoppingList, includeJourJ),
        [shoppingList, weekPlan, weekChecked, includeJourJ]
    );

    // Groupement par rayon (affichage seulement — l'ordre/état des items reste intact).
    const groupedRayons = useMemo(() => {
        const map = new Map<string, ConsolItem[]>();
        items.forEach(it => {
            const rid = rayonOf(it.name, rayonOverrides);
            if (!map.has(rid)) map.set(rid, []);
            map.get(rid)!.push(it);
        });
        return [...map.entries()].sort((a, b) => (RAYON_ORDER[a[0]] ?? 99) - (RAYON_ORDER[b[0]] ?? 99));
    }, [items, rayonOverrides]);

    const toggleRayonCollapse = (rid: string) => {
        setCollapsedRayons(prev => {
            const n = new Set(prev);
            n.has(rid) ? n.delete(rid) : n.add(rid);
            localStorage.setItem('shop-rayons-collapsed', JSON.stringify([...n]));
            return n;
        });
    };

    const reassignRayon = (it: ConsolItem, rid: string) => {
        writeRayonOverride(it.name, rid);
        setRayonOverrides(readRayonOverrides());
        setRayonPickerKey(null);
    };

    // Sélection : RIEN coché par défaut. L'utilisateur coche ce qu'il veut acheter ;
    // Partager/Carrefour ciblent les ingrédients cochés (de haut en bas).
    const keysSig = items.map(i => i.key).join(',');
    useEffect(() => {
        setSelected(new Set());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keysSig]);

    const toggle = (key: string) => {
        setSelected(prev => {
            const n = new Set(prev);
            n.has(key) ? n.delete(key) : n.add(key);
            return n;
        });
    };

    // Rayé / fait (clic sur le NOM) — persiste dans 'shop-done', reste visible barré.
    const persistDone = (s: Set<string>) => {
        localStorage.setItem('shop-done', JSON.stringify([...s]));
        window.dispatchEvent(new Event('shoppingListUpdated'));
    };
    // Clic sur le nom/pilule = rayer (fait). Reste visible barré, persisté.
    const toggleDone = (it: ConsolItem) => {
        setDone(prev => {
            const n = new Set(prev);
            const ks = doneKeysOf(it);
            const already = ks.every(k => n.has(k));
            ks.forEach(k => (already ? n.delete(k) : n.add(k)));
            persistDone(n);
            return n;
        });
    };
    const markDone = (it: ConsolItem) => {
        setDone(prev => {
            const n = new Set(prev);
            doneKeysOf(it).forEach(k => n.add(k));
            persistDone(n);
            return n;
        });
    };
    const allSelected = items.length > 0 && selected.size === items.length;
    const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map(i => i.key)));

    // Ajout manuel d'un article (alimentaire ou non : papier toilette, javel, etc.)
    const addManual = () => {
        const name = manualName.trim();
        if (!name) return;
        // Pas de quantité saisie → 1 par défaut (validation à la touche Entrée)
        const qty = manualQty.trim() || '1';
        const raw = `${qty} ${name}`;
        // Écrit localStorage AVANT de dispatcher l'event (sinon le handler 'shoppingListUpdated'
        // relit un localStorage encore vide → reset de la liste = l'item n'apparaît pas).
        const next = { ...shoppingList };
        const entry = next.manuel
            ? { ...next.manuel, ingredients: [...next.manuel.ingredients] }
            : { title: 'Ajouts manuels', source: 'manuel' as const, ingredients: [] as { name: string; checked: boolean }[] };
        entry.ingredients.push({ name: raw, checked: false });
        next.manuel = entry;
        localStorage.setItem('magic-shopping-list', JSON.stringify(next));
        setShoppingList(next);
        window.dispatchEvent(new Event('shoppingListUpdated'));
        setManualName('');
        setManualQty('');
    };

    const clearList = () => {
        if (!confirm('Vider toute la liste ?')) return;
        // 1) supprime les ajouts manuels / recettes
        localStorage.removeItem('magic-shopping-list');
        setShoppingList({});
        // 2) coche (masque) tous les ingrédients planifiés de la semaine — la liste
        //    fusionnée les inclut, sinon elle ne se viderait pas. Le menu reste intact.
        const checked = new Set(weekChecked);
        Object.keys(weekPlan).forEach(dayKey => {
            const day = weekPlan[dayKey] || {};
            Object.keys(day).forEach(mealKey => {
                (day[mealKey]?.ingredients || []).forEach((_: any, idx: number) => {
                    checked.add(`${dayKey}|${mealKey}|${idx}`);
                });
            });
        });
        setWeekChecked(checked);
        localStorage.setItem('meal-week-checked', JSON.stringify([...checked]));
        window.dispatchEvent(new Event('shoppingListUpdated'));
    };

    // #6 — onglet "Recettes" : coche/raye un ingrédient d'une recette individuelle
    const toggleRecipeIngredient = (id: string, idx: number) => {
        const next = { ...shoppingList };
        const entry = next[id];
        if (!entry) return;
        const ings = entry.ingredients.map((ing, i) => i === idx ? { ...ing, checked: !ing.checked } : ing);
        next[id] = { ...entry, ingredients: ings };
        localStorage.setItem('magic-shopping-list', JSON.stringify(next));
        setShoppingList(next);
        window.dispatchEvent(new Event('shoppingListUpdated'));
    };

    // #6 — onglet "Recettes" : retirer une recette individuelle de la liste
    const removeRecipe = (id: string) => {
        const next = { ...shoppingList };
        delete next[id];
        if (Object.keys(next).length === 0) localStorage.removeItem('magic-shopping-list');
        else localStorage.setItem('magic-shopping-list', JSON.stringify(next));
        setShoppingList(next);
        window.dispatchEvent(new Event('shoppingListUpdated'));
    };

    const lineFor = (it: ConsolItem) =>
        it.qty != null ? `${fmtQty(it.qty)}${it.unit ? ' ' + it.unit : ''} ${it.name}` : it.name;

    const buildShareText = () => {
        // On partage uniquement les ingrédients cochés (la barre n'apparaît que s'il y en a).
        const src = items.filter(i => selected.has(i.key));
        const lines = src.map(i => `• ${lineFor(i)}`);
        return '🛒 Ma liste de courses\n\n' + lines.join('\n');
    };

    const shareNative = async () => {
        const text = buildShareText();
        if (typeof navigator !== 'undefined' && (navigator as any).share) {
            try { await (navigator as any).share({ title: 'Ma liste de courses', text }); } catch { /* annulé */ }
            return; // ne PAS retomber sur WhatsApp si annulé
        }
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };
    const shareWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(buildShareText())}`, '_blank');

    // ── Commander sur Carrefour : recherche pas-à-pas (1 ingrédient à la fois) ──
    // Cible = uniquement les ingrédients cochés (la barre magasin n'apparaît que s'il y en a).
    const selectedItems = items.filter(i => selected.has(i.key));
    const openCarrefourFor = (i: number) => {
        const it = selectedItems[i];
        if (!it) return;
        // #12 : fenêtre nommée 'storeCart' réutilisée + file complète (#mlist) →
        // l'extension fait défiler les produits sans changer d'onglet.
        const queue = selectedItems.map(x => carrefourTerm(x.name));
        window.open(storeSearchWithQueue(store, queue, i), 'storeCart');
        markDone(it); // recherché → rayé automatiquement
    };
    const startCarrefour = () => { if (!selectedItems.length) return; setCarrefourIdx(0); openCarrefourFor(0); };
    const carrefourGo = (i: number) => {
        const n = Math.max(0, Math.min(i, selectedItems.length - 1));
        setCarrefourIdx(n);
        openCarrefourFor(n);
    };

    if (!mounted || authLoading) return null;

    // Liste de courses réservée aux connectés — accès impossible sinon.
    if (!user) return (
        <div className={styles.page}>
            <Header title="Ma liste" showBack={true} />
            <main className={styles.main}>
                <div className={styles.empty}>
                    <div className={styles.emptyIcon}>🔒</div>
                    <h2 className={styles.emptyTitle}>Connecte-toi</h2>
                    <p className={styles.emptySubtitle}>
                        Ta liste de courses (semaine, jour J, fusionnée, recettes) est réservée aux membres connectés.
                    </p>
                    <button
                        className={styles.clearBtn}
                        style={{ marginTop: 18 }}
                        onClick={() => window.dispatchEvent(new Event('magic-open-auth'))}
                    >Se connecter</button>
                </div>
            </main>
        </div>
    );

    return (
        <div className={styles.page}>
            <Header title="Ma liste" showBack={true} />

            <main className={styles.main}>
                <div className={styles.headerRow}>
                    <div>
                        <h1 className={styles.mainTitle}>Courses</h1>
                        <p className={styles.count}>{items.length} ingrédient{items.length > 1 ? 's' : ''}</p>
                    </div>
                    {items.length > 0 && (
                        <button onClick={clearList} className={styles.clearBtn}>Tout vider</button>
                    )}
                </div>

                {/* Onglets : Semaine · Jour J · Fusionnée · Recettes */}
                <div className={styles.modeToggle}>
                    {([
                        ['semaine', 'Semaine'],
                        ['jourj', 'Jour J'],
                        ['fusion', 'Fusionnée'],
                        ['recettes', 'Recettes'],
                    ] as const).map(([id, label]) => (
                        <button
                            key={id}
                            className={`${styles.modeBtn} ${weekMode === id ? styles.modeBtnActive : ''}`}
                            onClick={() => setWeekMode(id)}
                        >{label}</button>
                    ))}
                </div>

                {weekMode === 'semaine' && <WeekMenuCarousel view="week" />}
                {weekMode === 'jourj' && <WeekMenuCarousel view="jourj" />}
                {weekMode === 'recettes' && (
                    <RecipesIndividualView
                        shoppingList={shoppingList}
                        onToggle={toggleRecipeIngredient}
                        onRemove={removeRecipe}
                    />
                )}
                {weekMode === 'fusion' && (
                  <>
                    {/* Ajout manuel d'un article (alimentaire ou ménager) */}
                    <div className={styles.addItemBar}>
                        <span className={styles.addItemPreview}>{manualName.trim() ? getIcon(manualName) : '🛒'}</span>
                        <input
                            className={styles.addItemInput}
                            value={manualName}
                            onChange={e => setManualName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') addManual(); }}
                            placeholder="Ajouter un article"
                        />
                        <input
                            className={styles.addItemQty}
                            value={manualQty}
                            onChange={e => setManualQty(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') addManual(); }}
                            placeholder="Qté"
                        />
                        <button className={styles.addItemBtn} onClick={addManual} disabled={!manualName.trim()} aria-label="Ajouter">+</button>
                    </div>

                    {items.length === 0 ? (
                    <div className={styles.empty}>
                        <div className={styles.emptyIcon}>🛒</div>
                        <h2 className={styles.emptyTitle}>Panier vide</h2>
                        <p className={styles.emptySubtitle}>
                            Valide un menu dans le planificateur ou ajoute des ingrédients depuis une recette.
                        </p>
                    </div>
                    ) : (
                    <>
                        <div className={styles.selectBar}>
                            <span className={styles.selectBarInfo}>{selected.size} / {items.length} sélectionné{selected.size > 1 ? 's' : ''}</span>
                            <button className={styles.selectAllBtn} onClick={toggleAll}>
                                {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                            </button>
                        </div>

                        <div className={styles.consolList}>
                            {groupedRayons.map(([rid, rayonItems]) => {
                                const rayon = RAYON_BY_ID[rid] || RAYON_BY_ID['autre'];
                                const collapsed = collapsedRayons.has(rid);
                                return (
                                    <div key={rid} className={styles.rayonGroup}>
                                        <button
                                            className={styles.rayonHeader}
                                            onClick={() => toggleRayonCollapse(rid)}
                                        >
                                            <span className={styles.rayonEmoji}>{rayon.emoji}</span>
                                            <span className={styles.rayonLabel}>{rayon.label}</span>
                                            <span className={styles.rayonCount}>{rayonItems.length}</span>
                                            <svg
                                                className={`${styles.rayonChevron} ${collapsed ? styles.rayonChevronUp : ''}`}
                                                width="16" height="16" viewBox="0 0 24 24" fill="none"
                                                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                            >
                                                <polyline points="6 9 12 15 18 9" />
                                            </svg>
                                        </button>

                                        {!collapsed && rayonItems.map(it => {
                                            const sel = selected.has(it.key);
                                            const isDone = isItemDone(it, done);
                                            const picking = rayonPickerKey === it.key;
                                            return (
                                                <div
                                                    key={it.key}
                                                    className={`${styles.consolItem} ${sel ? styles.consolItemSel : ''} ${isDone ? styles.consolItemDone : ''}`}
                                                >
                                                    {/* Clic sur la photo/nom = rayer (fait) */}
                                                    <span className={styles.consolIcon} onClick={() => toggleDone(it)}>{it.icon}</span>
                                                    <span className={styles.consolName} onClick={() => toggleDone(it)}>{it.display}</span>

                                                    {/* Réassignation manuelle de rayon */}
                                                    <div className={styles.rayonMoveWrap}>
                                                        <button
                                                            className={styles.rayonMoveBtn}
                                                            onClick={(e) => { e.stopPropagation(); setRayonPickerKey(picking ? null : it.key); }}
                                                            aria-label="Changer de rayon"
                                                            title="Changer de rayon"
                                                        >{rayon.emoji}</button>
                                                        {picking && (
                                                            <div className={styles.rayonPicker} onClick={e => e.stopPropagation()}>
                                                                {RAYONS.map(r => (
                                                                    <button
                                                                        key={r.id}
                                                                        className={`${styles.rayonPickerItem} ${r.id === rid ? styles.rayonPickerActive : ''}`}
                                                                        onClick={() => reassignRayon(it, r.id)}
                                                                    >
                                                                        <span>{r.emoji}</span> {r.label}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Clic sur le cercle = sélectionner (cible Carrefour/partage) */}
                                                    <button
                                                        className={styles.consolCheck}
                                                        onClick={(e) => { e.stopPropagation(); toggle(it.key); }}
                                                        aria-label="Sélectionner"
                                                    >
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
                  </>
                )}

                {/* Barre de partage flottante (mode fusion) — visible UNIQUEMENT quand au moins
                    un ingrédient est coché ; cible = exactement les ingrédients cochés. */}
                {weekMode === 'fusion' && selected.size > 0 && (
                    <div style={{
                        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                        display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(20,20,20,0.95)',
                        backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 40, padding: '10px 16px', zIndex: 100,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                    }}>
                        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginRight: 4 }}>
                            {selected.size ? `${selected.size} à partager` : `${items.length} ingrédient${items.length > 1 ? 's' : ''}`}
                        </span>
                        <button onClick={shareNative} style={btnStyle('linear-gradient(135deg,#8b5cf6,#6366f1)')}>
                            <ShareIcon /> Partager
                        </button>
                        <button onClick={shareWhatsApp} style={btnStyle('#25D366')} title="WhatsApp"><WhatsAppIcon /></button>
                        {/* Sélecteur magasin (dropdown logos, choix global) */}
                        <StoreButton onLaunch={startCarrefour} />
                    </div>
                )}

                {/* Stepper magasin : ouvre la recherche ingrédient par ingrédient */}
                {weekMode === 'fusion' && carrefourIdx !== null && selectedItems[carrefourIdx] && (
                    <div style={{
                        position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)',
                        width: 'min(440px, 92vw)',
                        display: 'flex', flexDirection: 'column', gap: 10,
                        background: 'rgba(20,20,20,0.97)', backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255,255,255,0.14)', borderRadius: 22,
                        padding: '14px 16px', zIndex: 101, boxShadow: '0 12px 40px rgba(0,0,0,0.6)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.05em', color: STORE_BY_ID[store].color }}>
                                🛒 {STORE_BY_ID[store].label.toUpperCase()} · {carrefourIdx + 1}/{selectedItems.length}
                            </span>
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
                            <button onClick={() => carrefourGo(carrefourIdx - 1)} disabled={carrefourIdx === 0}
                                style={{ ...btnStyle('rgba(255,255,255,0.1)'), opacity: carrefourIdx === 0 ? 0.4 : 1 }}>◀</button>
                            <button onClick={() => openCarrefourFor(carrefourIdx)} style={{ ...btnStyle(STORE_BY_ID[store].color), flex: 1, justifyContent: 'center' }}>
                                Rechercher sur {STORE_BY_ID[store].label}
                            </button>
                            {carrefourIdx < selectedItems.length - 1 ? (
                                <button onClick={() => carrefourGo(carrefourIdx + 1)} style={btnStyle('linear-gradient(135deg,#8b5cf6,#6366f1)')}>Suivant ▶</button>
                            ) : (
                                <button onClick={() => setCarrefourIdx(null)} style={btnStyle('#22c55e')}>Terminé ✓</button>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

const btnStyle = (color: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6,
    background: color, border: 'none', borderRadius: 24,
    padding: '8px 14px', color: 'white', fontSize: '0.8rem',
    fontWeight: 600, cursor: 'pointer'
});

function ShareIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
    );
}

function WhatsAppIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
    );
}

// #6 — Onglet "Recettes individuelles" : une carte par recette (ajoutée via le caddie de la fiche).
function RecipesIndividualView({ shoppingList, onToggle, onRemove }: {
    shoppingList: ListData;
    onToggle: (id: string, idx: number) => void;
    onRemove: (id: string) => void;
}) {
    const entries = Object.entries(shoppingList).filter(([, e]) => e && (e.ingredients?.length || 0) > 0);
    // Coché (sélection magasin) — clé `id|idx`. Indépendant du barré (ing.checked).
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const toggleSel = (k: string) => setSelected(prev => {
        const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n;
    });

    // Tous les ingrédients (toutes recettes confondues) en ConsolItem : cible commune
    // de la barre Partager/Magasin, filtrée par les seuls cochés dans ShopActions.
    const allItems: ConsolItem[] = entries.flatMap(([id, entry]) =>
        entry.ingredients.map((ing, idx) => {
            const raw = (ing.name || '').replace(/^[-•\s]+/, '');
            const p = parseIngredient(raw);
            const key = `${id}|${idx}`;
            return { key, keys: [key], icon: getIcon(p.name || raw), name: p.name || raw, unit: '', qty: null, display: cleanIngredientText(raw) || raw, count: 1 };
        })
    );

    if (entries.length === 0) {
        return (
            <div className={styles.empty}>
                <div className={styles.emptyIcon}>🧾</div>
                <h2 className={styles.emptyTitle}>Aucune recette</h2>
                <p className={styles.emptySubtitle}>
                    Ouvre une recette, coche des ingrédients puis touche le caddie 🛒 pour l’ajouter ici.
                </p>
            </div>
        );
    }
    return (
        <div className={styles.recipesIndividual}>
            {entries.map(([id, entry]) => {
                const title = id === 'manuel' ? 'Ajouts manuels' : entry.title;
                return (
                    <div key={id} className={styles.recipeBlock}>
                        <div className={styles.recipeBlockHeader}>
                            {entry.image && id !== 'manuel' && (
                                <img src={entry.image} alt="" className={styles.recipeBlockImg} />
                            )}
                            <span className={styles.recipeBlockTitle}>{title}</span>
                            <button
                                className={styles.recipeBlockRemove}
                                onClick={() => onRemove(id)}
                                aria-label={`Retirer ${title}`}
                                title="Retirer cette recette"
                            >✕</button>
                        </div>
                        <div className={styles.recipeBlockItems}>
                            {entry.ingredients.map((ing, idx) => {
                                const k = `${id}|${idx}`;
                                const sel = selected.has(k);
                                return (
                                    <div key={idx} className={`${styles.recipeIng} ${ing.checked ? styles.recipeIngDone : ''} ${sel ? styles.consolItemSel : ''}`}>
                                        {/* Clic nom = barrer (je n'en ai pas besoin) */}
                                        <span style={{ flex: 1 }} onClick={() => onToggle(id, idx)}>{ing.name}</span>
                                        {/* Cercle = cocher (sélection magasin/partage) */}
                                        <button className={styles.consolCheck} onClick={(e) => { e.stopPropagation(); toggleSel(k); }} aria-label="Sélectionner">
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
                    </div>
                );
            })}
            {/* Partager + Magasin : visibles seulement si ≥1 ingrédient coché, cible = cochés */}
            <ShopActions items={allItems} checkedKeys={selected} title="Ma sélection" size="md" />
        </div>
    );
}
