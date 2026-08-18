'use client';
import dynamic from 'next/dynamic';
const MaCave = dynamic(() => import('@/mobile/screens/tv/MaCave'), { ssr: false });
export default function Page() {
    return <MaCave />;
}
