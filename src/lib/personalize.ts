// « Pour toi » — apprentissage PASSIF des goûts (aucun onboarding forcé).
// On lit ce que l'utilisateur a déjà fait dans l'app — recettes consultées,
// favoris, cuisinées — et on remonte des recettes proches (même catégorie, tags
// partagés). Plus il y a de signal, plus c'est pertinent ; sans signal, rien.

interface R { id: string | number; category?: string; tags?: string[]; image?: string; }

function readIds(key: string): string[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = JSON.parse(localStorage.getItem(key) || '[]');
        return (Array.isArray(raw) ? raw : []).map((x: any) => String(x?.id ?? x));
    } catch { return []; }
}

function cookedIds(): string[] {
    if (typeof window === 'undefined') return [];
    const out: string[] = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i) || '';
            if (k.startsWith('recipe-cooking-')) out.push(k.slice('recipe-cooking-'.length));
        }
    } catch { /* noop */ }
    return out;
}

/** Nombre de signaux de goût disponibles (0 = on n'affiche pas « Pour toi »). */
export function tasteSignalCount(): number {
    return new Set([...readIds('favorites'), ...readIds('recently-viewed'), ...cookedIds()]).size;
}

/**
 * Recettes recommandées selon les goûts déduits. `all` = catalogue.
 * Pondération : favori 3, cuisiné 3, consulté 1 → poids par catégorie et par tag.
 */
export function personalizedRecipes<T extends R>(all: T[], limit = 14): T[] {
    if (typeof window === 'undefined') return [];
    const weightOf = (id: string) =>
        (readIds('favorites').includes(id) ? 3 : 0) +
        (cookedIds().includes(id) ? 3 : 0) +
        (readIds('recently-viewed').includes(id) ? 1 : 0);

    const byId = new Map(all.map((r) => [String(r.id), r]));
    const catW = new Map<string, number>();
    const tagW = new Map<string, number>();
    const seed = new Set<string>();

    [...readIds('favorites'), ...cookedIds(), ...readIds('recently-viewed')].forEach((id) => {
        const r = byId.get(id); if (!r) return;
        seed.add(id);
        const w = weightOf(id) || 1;
        const c = (r.category || '').toLowerCase();
        if (c) catW.set(c, (catW.get(c) || 0) + w);
        (r.tags || []).forEach((t) => { const k = t.toLowerCase(); tagW.set(k, (tagW.get(k) || 0) + w); });
    });

    if (!catW.size && !tagW.size) return [];

    return all
        .filter((r) => !seed.has(String(r.id)) && r.image && (r.category || '').toLowerCase() !== 'restaurant')
        .map((r) => {
            let s = (catW.get((r.category || '').toLowerCase()) || 0) * 1.5;
            (r.tags || []).forEach((t) => { s += tagW.get(t.toLowerCase()) || 0; });
            return { r, s };
        })
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, limit)
        .map((x) => x.r);
}
