'use client';

import { useEffect, useRef, useState } from 'react';
import { STORES, STORE_BY_ID, usePreferredStore } from '@/lib/stores';
import styles from './StoreButton.module.css';

// Bouton magasin fusionné : [logo + nom] lance les courses, [▾] ouvre le menu
// pour changer d'enseigne (Carrefour / Picard / Monoprix / Franprix).
export default function StoreButton({ onLaunch, compact = false }: { onLaunch: () => void; compact?: boolean }) {
    const [store, setStore] = usePreferredStore();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const cur = STORE_BY_ID[store];

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    return (
        <div ref={ref} className={styles.wrap} onClick={(e) => e.stopPropagation()}>
            <div className={styles.split} style={{ background: cur.color }}>
                <button type="button" className={styles.main} onClick={onLaunch} title={`Commander sur ${cur.label}`} aria-label={`Commander sur ${cur.label}`}>
                    <img src={cur.logo} alt={cur.label} className={styles.logo} />
                    {!compact && <span className={styles.label}>{cur.label}</span>}
                </button>
                <button
                    type="button"
                    className={styles.arrow}
                    onClick={() => setOpen(o => !o)}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    title="Changer de magasin"
                >▾</button>
            </div>

            {open && (
                <div className={styles.menu} role="listbox">
                    {STORES.map(s => (
                        <button
                            key={s.id}
                            type="button"
                            role="option"
                            aria-selected={s.id === store}
                            className={`${styles.item} ${s.id === store ? styles.active : ''}`}
                            onClick={() => { setStore(s.id); setOpen(false); }}
                        >
                            <img src={s.logo} alt="" className={styles.itemLogo} />
                            <span>{s.label}</span>
                            {s.id === store && <span className={styles.check}>✓</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
