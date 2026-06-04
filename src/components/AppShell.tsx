'use client';
import { useEffect, useLayoutEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { DeviceContext } from './device';

// useLayoutEffect côté client (bascule avant paint = pas de flash), useEffect en SSR (pas de warning)
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// ── Chrome desktop (site actuel) ──
import { TimerProvider } from '@/components/Timer/TimerContext';
import SplashScreen from '@/components/SplashScreen/SplashScreen';
import GlobalRecipeSheet from '@/components/GlobalRecipeSheet/GlobalRecipeSheet';

// ── Chrome mobile (app embarquée) ──
import { TimerProvider as MobileTimerProvider } from '@/mobile/components/Timer/TimerContext';
const MobileSplash = dynamic(() => import('@/mobile/components/SplashScreen/SplashScreen'), { ssr: false });
const MobileBottomNav = dynamic(() => import('@/mobile/components/BottomNav/BottomNav'), { ssr: false });
const MobileAccountSync = dynamic(() => import('@/mobile/components/AccountSync/AccountSync'), { ssr: false });

const detect = () =>
    window.matchMedia('(max-width: 1023px)').matches ||
    /iPhone|iPod|Android.*Mobile/i.test(navigator.userAgent);

export default function AppShell({ children }: { children: React.ReactNode }) {
    // null au SSR ET au 1er rendu client → arbre desktop identique des 2 côtés = pas de
    // mismatch d'hydratation (React #418/#423). Bascule mobile en useLayoutEffect (avant paint).
    const [isMobile, setIsMobile] = useState<boolean | null>(null);

    useIsoLayoutEffect(() => {
        const calc = () => setIsMobile(detect());
        calc();
        window.addEventListener('resize', calc);
        return () => window.removeEventListener('resize', calc);
    }, []);

    if (isMobile === true) {
        return (
            <DeviceContext.Provider value={true}>
                <MobileTimerProvider>
                    <MobileSplash />
                    <div className="main-content-wrapper">{children}</div>
                    <MobileBottomNav />
                    <MobileAccountSync />
                </MobileTimerProvider>
            </DeviceContext.Provider>
        );
    }

    // desktop (et état initial null)
    return (
        <DeviceContext.Provider value={isMobile === null ? null : false}>
            <TimerProvider>
                <SplashScreen />
                <div className="main-content-wrapper">{children}</div>
                <GlobalRecipeSheet />
            </TimerProvider>
        </DeviceContext.Provider>
    );
}
