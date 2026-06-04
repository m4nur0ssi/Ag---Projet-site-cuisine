'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';

export default function Template({ children }: { children: React.ReactNode }) {
    // Read swipe config synchronously on first render, before framer-motion captures `initial`.
    // useRef with undefined sentinel = runs once per component instance (re-runs on each navigation).
    const configRef = useRef<{
        skip: boolean;
        xInitial: string | number;
        yInitial: number;
    } | undefined>(undefined);

    if (configRef.current === undefined) {
        let skip = false;

        if (typeof window !== 'undefined') {
            try {
                // Nettoie toujours swipe-direction pour éviter xInitial parasite
                sessionStorage.removeItem('swipe-direction');
                if ((window as any).__swipeNoEntry) {
                    delete (window as any).__swipeNoEntry;
                    skip = true;
                    sessionStorage.removeItem('swipe-no-entry');
                } else {
                    const noEntry = sessionStorage.getItem('swipe-no-entry');
                    if (noEntry) {
                        skip = true;
                        sessionStorage.removeItem('swipe-no-entry');
                    }
                }
            } catch {}
        }

        configRef.current = { skip, xInitial: 0, yInitial: 0 };
    }

    const { skip, xInitial, yInitial } = configRef.current;

    // Swipe was finger-driven: new page appears without animation (old page already slid off)
    if (skip) {
        return (
            <div style={{ minHeight: '100vh', overflow: 'visible' }}>
                {children}
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, x: xInitial, y: yInitial }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{
                type: 'tween',
                ease: [0.4, 0, 0.2, 1],
                duration: 0.22,
            }}
            style={{ minHeight: '100vh', overflow: 'visible' }}
        >
            {children}
        </motion.div>
    );
}
