// Construit le catalogue compact envoyé à la recherche IA (/api/recipe-finder).
// Inclut les RESTAURANTS : on enrichit leurs tags avec le type de cuisine, la/les
// ville(s) et « terrasse » pour que l'IA (et le pré-filtre) répondent aux demandes
// du type « un restaurant italien avec terrasse » ou « un restaurant à Gonesse ».

export interface FinderRecipe { id: string; t: string; cat?: string; tags?: string[] }

// Extrait la ville d'une adresse (« 134 Av. …, 95500 Gonesse » → « gonesse »).
function cityFromAddress(addr?: string): string {
    if (!addr) return '';
    const m = addr.match(/\b\d{4,5}\b\s*(.+)$/); // texte après le code postal
    if (m && m[1]) return m[1].trim();
    const parts = addr.split(',');
    return (parts[parts.length - 1] || '').replace(/\b\d{4,5}\b/g, '').trim();
}

export function buildFinderCatalog(recipes: any[]): FinderRecipe[] {
    return (recipes || []).map((r) => {
        const tags: string[] = (r.tags || []).slice(0, 6).map((t: any) => String(t));
        if (r.category === 'restaurant' && r.restaurant) {
            const info = r.restaurant;
            const cities = new Set<string>();
            const c0 = cityFromAddress(info.address || r.address);
            if (c0) cities.add(c0);
            (info.locations || []).forEach((l: any) => { const c = cityFromAddress(l.address); if (c) cities.add(c); });
            const extra = [
                'restaurant',
                info.subType,
                info.terrace ? 'terrasse' : '',
                ...cities,
            ].filter(Boolean).map((s: any) => String(s).toLowerCase());
            return { id: String(r.id), t: r.title, cat: r.category, tags: [...tags, ...extra].slice(0, 12) };
        }
        return { id: String(r.id), t: r.title, cat: r.category, tags };
    });
}
