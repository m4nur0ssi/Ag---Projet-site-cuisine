'use client';
// TEST DE DESIGN (local) — liste de courses façon Apple TV+.
// La liste du site (/shopping-list) reste intacte.
import dynamic from 'next/dynamic';

const TVCourses = dynamic(() => import('@/mobile/screens/tv/TVCourses'), { ssr: false });

export default function Page() {
    return <TVCourses />;
}
