'use client';
// TEST DE DESIGN (local) — planificateur façon Apple TV+, jour par jour.
// Le planificateur du site (/meal-planner) reste intact.
import dynamic from 'next/dynamic';

const TVPlanner = dynamic(() => import('@/mobile/screens/tv/TVPlanner'), { ssr: false });

export default function Page() {
    return <TVPlanner />;
}
