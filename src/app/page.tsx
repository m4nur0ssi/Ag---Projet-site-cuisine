'use client';
import dynamic from 'next/dynamic';
import { useIsMobile } from '@/components/device';
import DesktopHome from '@/components/DesktopHome';

const MobileHome = dynamic(() => import('@/mobile/screens/page'), { ssr: false });

export default function Page() {
    const isMobile = useIsMobile();
    if (isMobile === true) return <MobileHome />;
    return <DesktopHome />;
}
