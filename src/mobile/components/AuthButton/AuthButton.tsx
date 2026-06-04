'use client';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/mobile/hooks/useAuth';
import styles from './AuthButton.module.css';

export default function AuthButton() {
    const { user, loading, signInWithGoogle, signInWithApple, signOut } = useAuth();
    if (typeof window !== 'undefined') console.log('[AuthButton] user=', user?.email, 'loading=', loading);
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, right: 0 });
    const btnRef = useRef<HTMLButtonElement>(null);

    const handleOpen = () => {
        if (btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
        }
        setOpen(v => !v);
    };

    // Ouvrir le panneau de connexion sur demande (ex: clic sur un cœur déconnecté)
    useEffect(() => {
        const openAuth = () => {
            // Ignore si cette instance est masquée (ex: header en mobile) → évite double panneau
            if (!btnRef.current || btnRef.current.offsetParent === null) return;
            const rect = btnRef.current.getBoundingClientRect();
            setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
            setOpen(true);
        };
        window.addEventListener('magic-open-auth', openAuth);
        return () => window.removeEventListener('magic-open-auth', openAuth);
    }, []);

    // Fermer si clic dehors
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (!(e.target as Element).closest('[data-auth-dropdown]') &&
                !(e.target as Element).closest('[data-auth-btn]')) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const dropdown = open ? createPortal(
        <div
            data-auth-dropdown
            className={styles.dropdown}
            style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 99999 }}
        >
            {user ? (
                <>
                    <div className={styles.email}>{user.email}</div>
                    <div className={styles.syncStatus}>☁️ Sync activée</div>
                    <button className={styles.signOutBtn} onClick={() => { signOut(); setOpen(false); }}>
                        Se déconnecter
                    </button>
                </>
            ) : (
                <>
                    <div className={styles.dropdownTitle}>Sync multi-appareils</div>
                    <p className={styles.dropdownDesc}>
                        Connecte-toi pour retrouver tes recettes, favoris et planning sur tous tes appareils.
                    </p>
                    <button className={styles.googleBtn} onClick={() => { signInWithGoogle(); setOpen(false); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                        Continuer avec Google
                    </button>
                </>
            )}
        </div>,
        document.body
    ) : null;

    return (
        <div className={styles.wrapper}>
            <button
                ref={btnRef}
                data-auth-btn
                className={user ? styles.avatarBtn : styles.connectBtn}
                onClick={handleOpen}
                title={user ? (user.user_metadata?.full_name ?? user.email ?? '') : 'Se connecter'}
            >
                {user ? (
                    <>
                        {user.user_metadata?.avatar_url
                            ? <img
                                src={user.user_metadata.avatar_url}
                                alt=""
                                className={styles.avatarImg}
                                onError={e => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    (e.target as HTMLImageElement).nextElementSibling?.removeAttribute('style');
                                }}
                              />
                            : null
                        }
                        <span
                            className={styles.avatarInitial}
                            style={user.user_metadata?.avatar_url ? { display: 'none' } : undefined}
                        >
                            {(user.user_metadata?.full_name ?? user.email ?? '?')[0].toUpperCase()}
                        </span>
                        <span className={styles.avatarName}>
                            {user.user_metadata?.given_name ?? user.user_metadata?.full_name?.split(' ')[0] ?? user.email?.split('@')[0]}
                        </span>
                    </>
                ) : '👤'}
            </button>
            {dropdown}
        </div>
    );
}
