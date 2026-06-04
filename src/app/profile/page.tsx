'use client';
import dynamic from 'next/dynamic';
import { useIsMobile } from '@/components/device';
import DesktopPage from './DesktopPage';

const MobilePage = dynamic(() => import('@/mobile/screens/profile/page'), { ssr: false });

export default function Page() {
    const isMobile = useIsMobile();
    if (isMobile === true) return <MobilePage />;
    return <DesktopPage />;
}
