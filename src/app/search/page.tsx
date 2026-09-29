import { redirect } from 'next/navigation';

/**
 * L'ancienne recherche n'existe plus : l'accueil actuel ouvre sa propre
 * recherche à partir de `?q=` / `?ingredients=` (TVHome, TVDesktopHome).
 */
export default function Page({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams || {})) {
        if (typeof v === 'string') qs.set(k, v);
        else if (Array.isArray(v) && v[0]) qs.set(k, v[0]);
    }
    const s = qs.toString();
    redirect(s ? `/?${s}` : '/');
}
