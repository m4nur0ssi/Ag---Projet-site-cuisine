/* Courses Magiques — assistant magasin (content script).
 * Lit la file d'ingrédients passée par le site (#mlist=<base64 json>&mi=<index>),
 * affiche un widget flottant et permet d'avancer au produit suivant SANS quitter
 * l'onglet du magasin. Tente aussi de détecter le clic "Ajouter au panier".
 */
(function () {
    'use strict';

    // --- File depuis le hash de l'URL -------------------------------------
    function parseHash() {
        const h = location.hash.replace(/^#/, '');
        const p = new URLSearchParams(h);
        const raw = p.get('mlist');
        if (!raw) return null;
        try {
            const json = decodeURIComponent(escape(atob(decodeURIComponent(raw))));
            const list = JSON.parse(json);
            if (!Array.isArray(list) || !list.length) return null;
            return { list, idx: Math.max(0, parseInt(p.get('mi') || '0', 10) || 0), raw };
        } catch (_) { return null; }
    }

    const state = parseHash();
    if (!state) return; // pas piloté par le site → ne rien afficher

    // --- Construit l'URL de recherche selon le magasin --------------------
    function searchUrl(term) {
        const host = location.hostname;
        const q = encodeURIComponent(term);
        if (host.includes('carrefour')) return `https://www.carrefour.fr/s?q=${q}`;
        if (host.includes('picard'))    return `https://www.picard.fr/recherche?q=${q}`;
        if (host.includes('monoprix'))  return `https://www.monoprix.fr/courses/rechercher?q=${q}`;
        if (host.includes('franprix'))  return `https://www.franprix.fr/recherche?q=${q}`;
        return `https://www.google.com/search?q=${q}`;
    }

    function goTo(i) {
        const idx = Math.max(0, Math.min(i, state.list.length - 1));
        // On reconstruit l'URL AVEC le hash → l'état survit à la navigation même-onglet.
        location.href = searchUrl(state.list[idx]) + `#mlist=${state.raw}&mi=${idx}`;
    }

    const atLast = state.idx >= state.list.length - 1;

    // --- Widget flottant ---------------------------------------------------
    const box = document.createElement('div');
    box.id = 'magic-courses-widget';
    box.innerHTML = `
        <div class="mcw-head">
            <span class="mcw-title">🪄 Liste Magique</span>
            <span class="mcw-count">${state.idx + 1}/${state.list.length}</span>
            <button class="mcw-close" title="Fermer">✕</button>
        </div>
        <div class="mcw-item" title="${state.list[state.idx]}">${state.idx + 1}. ${state.list[state.idx]}</div>
        <div class="mcw-actions">
            <button class="mcw-prev" ${state.idx === 0 ? 'disabled' : ''}>◀</button>
            <button class="mcw-next">${atLast ? '✓ Terminer' : 'Ajouté → suivant ▶'}</button>
        </div>
        <div class="mcw-hint">Astuce : ajoute le produit au panier, puis clique « suivant ».</div>
    `;
    document.documentElement.appendChild(box);

    box.querySelector('.mcw-close').addEventListener('click', () => box.remove());
    box.querySelector('.mcw-prev').addEventListener('click', () => goTo(state.idx - 1));
    box.querySelector('.mcw-next').addEventListener('click', () => {
        if (atLast) { box.querySelector('.mcw-item').textContent = '✅ Liste terminée !'; box.querySelector('.mcw-actions').remove(); }
        else goTo(state.idx + 1);
    });

    // --- Auto-détection best-effort du clic "Ajouter au panier" -----------
    // (sélecteurs heuristiques ; si le site change, le bouton « suivant » reste fiable.)
    let advanced = false;
    function looksLikeAddToCart(el) {
        const node = el.closest('button, a, [role="button"]');
        if (!node) return false;
        const txt = (node.textContent || '').toLowerCase();
        const aria = (node.getAttribute('aria-label') || '').toLowerCase();
        const test = (node.getAttribute('data-testid') || node.id || node.className || '').toLowerCase();
        const hay = `${txt} ${aria} ${test}`;
        return /(ajouter|add).*(panier|cart|basket)|(au panier)|add-to-cart|addtocart|btn-add/.test(hay);
    }
    document.addEventListener('click', (e) => {
        if (advanced || atLast) return;
        if (looksLikeAddToCart(e.target)) {
            advanced = true;
            setTimeout(() => goTo(state.idx + 1), 1200); // laisse le panier s'enregistrer
        }
    }, true);
})();
