'use client';

import { useEffect, useRef, useState } from 'react';
import { STORES, STORE_BY_ID, usePreferredStore } from '@/lib/stores';
import styles from './StoreSelector.module.css';

// Sélecteur de magasin (dropdown avec logos). Le choix est global (localStorage)
// et se répercute partout où l'on "commande".
export default function StoreSelector({ compact = false }: { compact?: boolean }) {
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
            <button
                type="button"
                className={styles.current}
                style={{ borderColor: cur.color }}
                onClick={() => setOpen(o => !o)}
                title={`Magasin : ${cur.label}`}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <img src={cur.logo} alt={cur.label} className={styles.logo} />
                {!compact && <span className={styles.label}>{cur.label}</span>}
                <span className={styles.chev}>▾</span>
            </button>

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
                            <img src={s.logo} alt="" className={styles.logo} />
                            <span>{s.label}</span>
                            {s.id === store && <span className={styles.check}>✓</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
