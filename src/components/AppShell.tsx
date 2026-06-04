'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { DeviceContext } from './device';

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

// Lecture synchrone du flag posé par le script inline du layout (avant React)
const initialMobile = (): boolean | null => {
    if (typeof window === 'undefined') return null; // SSR
    const w = window as unknown as { __isMobile?: boolean };
    if (typeof w.__isMobile === 'boolean') return w.__isMobile;
    return detect();
};

export default function AppShell({ children }: { children: React.ReactNode }) {
    // 1er rendu client = déjà correct (flag inline) → pas de flash desktop sur iPhone.
    const [isMobile, setIsMobile] = useState<boolean | null>(initialMobile);

    useEffect(() => {
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
