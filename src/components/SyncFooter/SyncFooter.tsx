'use client';
import { useState } from 'react';
import { triggerSync } from '@/services/syncService';
import styles from './SyncFooter.module.css';

export default function SyncFooter() {
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'ok' | 'error'>('idle');

    const handleSync = async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        setSyncStatus('idle');
        try {
            const result = await triggerSync('footer-button');
            if (result.ok) {
                setSyncStatus('ok');
                alert('✨ Synchronisation lancée !\n\n🔄 GitHub Actions met à jour toutes les recettes WordPress.\n⏳ Reviens dans 2-3 minutes, le site se mettra à jour tout seul.');
            } else {
                setSyncStatus('error');
                alert(`❌ Échec : ${result.message}`);
            }
        } catch (err) {
            setSyncStatus('error');
        } finally {
            setIsSyncing(false);
            setTimeout(() => setSyncStatus('idle'), 3000);
        }
    };

    return (
        <footer className={styles.footer}>
            <div className={styles.divider} />
            <div className={styles.content}>
                <div className={styles.info}>
                    <p className={styles.explanation}>
                        <strong>Propulsé par Ag (Antigravity).</strong><br/>
                        Ce bouton permet de synchroniser manuellement les recettes entre WordPress et le site.
                        Il déclenche un workflow GitHub Actions qui rafraîchit les données.
                    </p>
                </div>
                <button 
                    className={`${styles.syncBtn} ${isSyncing ? styles.isSyncing : ''}`} 
                    onClick={handleSync}
                    disabled={isSyncing}
                >
                    <span className={styles.icon}>↻</span>
                    {isSyncing ? 'Mise à jour en cours...' : 'Synchronisation manuelle'}
                </button>
            </div>
            <p className={styles.copy}>© 2026 Les Recettes Magiques — Interface iOS 26 Premium</p>
        </footer>
    );
}
