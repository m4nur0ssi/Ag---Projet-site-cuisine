'use client';
import dynamic from 'next/dynamic';
const TVTrophies = dynamic(() => import('@/mobile/screens/tv/TVTrophies'), { ssr: false });
export default function Page() {
    return <TVTrophies />;
}
