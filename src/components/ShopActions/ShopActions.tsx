'use client';

import { useEffect, useRef, useState } from 'react';
import { carrefourTerm, isItemDone } from '@/lib/ingredients';
import type { ConsolItem } from '@/lib/ingredients';
import { usePreferredStore, STORE_BY_ID, storeSearchWithQueue } from '@/lib/stores';
import { onStoreItemDone, isStoreExtensionActive } from '@/lib/storeFeedback';
import StoreButton from '@/components/StoreSelector/StoreButton';
import styles from './ShopActions.module.css';

interface ShopActionsProps {
    items: ConsolItem[];
    title?: string;
    size?: 'sm' | 'md';
    checkedKeys?: Set<string>; // ingrédients cochés (sélectionnés) → cible de Carrefour/partage
    doneKeys?: Set<string>;    // déjà barrés → hors de la file du magasin
    onShopped?: (item: ConsolItem) => void; // recherché sur Carrefour → rayer au retour
}

// Boutons Partager + Carrefour. Visibles UNIQUEMENT si au moins un ingrédient est
// coché ; la cible (et donc la recherche magasin) = exactement les ingrédients cochés.
// Barrer un ingrédient ne le sélectionne pas → ne fait pas apparaître ces boutons.
export default function ShopActions({ items, title = 'Ma liste de courses', size = 'sm', checkedKeys, doneKeys, onShopped }: ShopActionsProps) {
    const [idx, setIdx] = useState<number | null>(null);
    const [store] = usePreferredStore();
    const shop = STORE_BY_ID[store];

    // Cible = uniquement les items cochés (dans l'ordre d'affichage). Aucun coché → rien.
    // Les articles DÉJÀ BARRÉS sortent de la file : on en revient avec de
    // nouveaux ingrédients cochés, et le magasin doit reprendre là où on en est,
    // pas refaire défiler ce qui est déjà dans le panier.
    const list = (checkedKeys
        ? items.filter(it => it.keys.some(k => checkedKeys.has(k)))
        : items
    ).filter(it => !doneKeys || !isItemDone(it, doneKeys));

    // L'extension nous dit quel article vient d'être mis au panier : on le raye
    // ici, en direct, pendant que l'utilisateur est encore sur le magasin.
    // `listRef` évite de ré-abonner à chaque rendu (la liste est recalculée) ;
    // les hooks restent AVANT le `return null` sous peine de casser leur ordre.
    const listRef = useRef(list);
    listRef.current = list;
    const shoppedRef = useRef(onShopped);
    shoppedRef.current = onShopped;
    useEffect(() => onStoreItemDone(({ index }) => {
        const it = listRef.current[index];
        if (!it) return;
        shoppedRef.current?.(it);
        setIdx(Math.min(index + 1, listRef.current.length - 1));
    }), []);

    if (!list.length) return null;

    const text = `🛒 ${title}\n\n` + list.map(i => `• ${i.display}`).join('\n');

    const share = async () => {
        if (typeof navigator !== 'undefined' && (navigator as any).share) {
            try { await (navigator as any).share({ title, text }); } catch { /* partage annulé : ne rien faire */ }
            return; // ne PAS retomber sur WhatsApp si l'utilisateur annule
        }
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };
    const openStore = (i: number) => {
        const it = list[i];
        if (!it) return;
        // Ouvre le magasin avec la file complète (hash #mlist) → l'extension "Courses
        // Magiques" fait défiler les produits sans changer d'onglet. Fenêtre nommée réutilisée.
        const queue = list.map(x => carrefourTerm(x.name));
        window.open(storeSearchWithQueue(store, queue, i), 'storeCart');
        // Avec l'extension, c'est la mise au panier qui raye (plus juste). Sans elle,
        // personne ne nous préviendra : on raye dès la recherche, comme avant.
        if (!isStoreExtensionActive()) onShopped?.(it);
    };
    const go = (i: number) => { const n = Math.max(0, Math.min(i, list.length - 1)); setIdx(n); openStore(n); };

    return (
        <>
            <div className={`${styles.bar} ${size === 'md' ? styles.barMd : ''}`}>
                <button className={styles.shareBtn} onClick={(e) => { e.stopPropagation(); share(); }} aria-label="Partager" title="Partager">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 15V3" /><path d="m8 7 4-4 4 4" /><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
                    </svg>
                </button>
                <StoreButton onLaunch={() => { setIdx(0); openStore(0); }} compact />
            </div>

            {idx !== null && list[idx] && (
                <div className={styles.stepper} onClick={(e) => e.stopPropagation()}>
                    <div className={styles.stepHead}>
                        <span>🛒 {shop.label.toUpperCase()} · {idx + 1}/{list.length}</span>
                        <button className={styles.stepClose} onClick={() => setIdx(null)}>✕</button>
                    </div>
                    <div className={styles.stepBody}>
                        <span className={styles.stepIcon}>{list[idx].icon}</span>
                        <span className={styles.stepName}>{list[idx].display}</span>
                    </div>
                    <div className={styles.stepNav}>
                        <button className={styles.stepArrow} onClick={() => go(idx - 1)} disabled={idx === 0}>◀</button>
                        <button className={styles.stepSearch} onClick={() => openStore(idx)}>Rechercher sur {shop.label}</button>
                        {idx < list.length - 1
                            ? <button className={styles.stepNext} onClick={() => go(idx + 1)}>Suivant ▶</button>
                            : <button className={styles.stepDone} onClick={() => setIdx(null)}>Terminé ✓</button>}
                    </div>
                </div>
            )}
        </>
    );
}
