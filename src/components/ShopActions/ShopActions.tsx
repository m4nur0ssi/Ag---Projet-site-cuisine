'use client';

import { useState } from 'react';
import { carrefourTerm } from '@/lib/ingredients';
import type { ConsolItem } from '@/lib/ingredients';
import { usePreferredStore, STORE_BY_ID } from '@/lib/stores';
import StoreButton from '@/components/StoreSelector/StoreButton';
import styles from './ShopActions.module.css';

interface ShopActionsProps {
    items: ConsolItem[];
    title?: string;
    size?: 'sm' | 'md';
    checkedKeys?: Set<string>; // ingrédients cochés (sélectionnés) → cible de Carrefour/partage
    onShopped?: (item: ConsolItem) => void; // recherché sur Carrefour → rayer au retour
}

// Boutons Partager + Carrefour. Si des ingrédients sont cochés, ils sont la cible
// (du haut vers le bas) ; sinon on prend toute la liste.
export default function ShopActions({ items, title = 'Ma liste de courses', size = 'sm', checkedKeys, onShopped }: ShopActionsProps) {
    const [idx, setIdx] = useState<number | null>(null);
    const [store] = usePreferredStore();
    const shop = STORE_BY_ID[store];

    // Cible = items cochés (dans l'ordre d'affichage), sinon tout.
    const targeted = checkedKeys && checkedKeys.size
        ? items.filter(it => it.keys.some(k => checkedKeys.has(k)))
        : items;
    const list = targeted.length ? targeted : items;
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
        // Fenêtre nommée réutilisée → reste sur l'onglet magasin, relance le produit suivant.
        window.open(shop.search(carrefourTerm(it.name)), 'storeCart');
        onShopped?.(it);
    };
    const go = (i: number) => { const n = Math.max(0, Math.min(i, list.length - 1)); setIdx(n); openStore(n); };

    return (
        <>
            <div className={`${styles.bar} ${size === 'md' ? styles.barMd : ''}`}>
                <button className={styles.shareBtn} onClick={(e) => { e.stopPropagation(); share(); }}>↗ Partager</button>
                <StoreButton onLaunch={() => { setIdx(0); openStore(0); }} />
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
