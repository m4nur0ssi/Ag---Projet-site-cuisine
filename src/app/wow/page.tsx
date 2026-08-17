'use client';
// VITRINE LOCALE (route /wow) — prototypes « effet wahou », NON liés à la prod.
// But : voir vite ce que donnent les idées. Rien ici n'est branché ailleurs.
import dynamic from 'next/dynamic';
const WowShowcase = dynamic(() => import('@/components/wow/WowShowcase'), { ssr: false });
export default function Page() {
    return <WowShowcase />;
}
