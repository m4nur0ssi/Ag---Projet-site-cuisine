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
            return { list, idx: Math.max(0, parseInt(p.get('mi') || '0', 10) || 0), raw, back: back ? decodeURIComponent(back) : '' };
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
        if (host.includes('monoprix'))  return `https://courses.monoprix.fr/search?q=${q}`;
        // Leclerc Drive : le chemin magasin est dynamique (/magasin-159301-…) →
        // on le récupère depuis la page courante au lieu de le coder en dur.
        if (host.includes('leclercdrive')) {
            const m = location.pathname.match(/\/magasin-[^/]+/);
            const base = m ? `${location.origin}${m[0]}` : location.origin;
            return `${base}/recherche.aspx?TexteRecherche=${q}`;
        }
        return `https://www.google.com/search?q=${q}`;
    }

    function goTo(i) {
        const idx = Math.max(0, Math.min(i, state.list.length - 1));
        // On reconstruit l'URL AVEC le hash → l'état survit à la navigation même-onglet.
        const back = state.back ? `&mo=${encodeURIComponent(state.back)}` : '';
        location.href = searchUrl(state.list[idx]) + `#mlist=${state.raw}&mi=${idx}${back}`;
    }

    // --- Renvoie « article validé » à l'onglet des Recettes Magiques ------
    // L'onglet magasin a été ouvert par le site (window.open nommé), donc
    // `window.opener` est notre page. Origine explicite : jamais '*'.
    function reportDone(idx) {
        if (!state.back || !window.opener || window.opener.closed) return;
        try {
            window.opener.postMessage(
                { source: 'courses-magiques', type: 'item-done', index: idx, term: state.list[idx] || '' },
                state.back,
            );
        } catch (_) { /* onglet fermé entre-temps */ }
    }

    const atLast = state.idx >= state.list.length - 1;

    // --- Force l'exécution de la recherche pour le terme courant ----------
    // Certains magasins (Monoprix…) remplissent le champ mais NE lancent PAS la
    // recherche via l'URL : il faut cliquer le bouton. L'extension le fait.
    function setNativeValue(input, value) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function ensureSearch(term) {
        let tries = 0;
        const t = setInterval(() => {
            tries++;
            const input = document.querySelector(
                'input[type="search"], input[name="q"], input[name="search"], input[id*="search" i], input[placeholder*="recherch" i], input[aria-label*="recherch" i]'
            );
            if (input) {
                const cur = (input.value || '').trim().toLowerCase();
                if (!cur.includes(term.toLowerCase())) {
                    input.focus();
                    setNativeValue(input, term);
                    // 1) clic sur le bouton recherche à côté du champ
                    const form = input.closest('form');
                    const scope = form || document;
                    const btn = scope.querySelector(
                        'button[type="submit"], button[aria-label*="recherch" i], button[title*="recherch" i], [class*="search" i] button, button[class*="search" i]'
                    );
                    if (btn) { btn.click(); }
                    // 2) fallback : touche Entrée + submit du formulaire
                    ['keydown', 'keyup'].forEach(type =>
                        input.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }))
                    );
                    if (form) { try { form.requestSubmit ? form.requestSubmit() : form.submit(); } catch (_) {} }
                }
                clearInterval(t);
            }
            if (tries > 24) clearInterval(t); // ~6 s max
        }, 250);
    }
    ensureSearch(state.list[state.idx]);

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
        reportDone(state.idx); // « Ajouté » → rayé dans la liste restée ouverte
        if (atLast) { box.querySelector('.mcw-item').textContent = '✅ Liste terminée !'; box.querySelector('.mcw-actions').remove(); }
        else goTo(state.idx + 1);
    });

    // --- Auto-détection du clic "Ajouter au panier" -----------------------
    // Trois pièges rencontrés sur les sites de magasin :
    //   1. le bouton vit dans un SHADOW DOM (composants web) : `e.target` est
    //      alors l'élément hôte et `closest()` ne trouve rien. `composedPath()`
    //      traverse, lui ;
    //   2. le libellé ne dit pas toujours « panier » — un « + » de quantité, ou
    //      un simple « Ajouter », suffit à mettre au panier ;
    //   3. le texte n'est parfois qu'une icône : il faut lire aussi l'aria-label,
    //      le data-testid et les classes.
    let advanced = false;

    function nodeText(node) {
        const cls = typeof node.className === 'string' ? node.className : (node.getAttribute('class') || '');
        return [
            node.textContent || '',
            node.getAttribute('aria-label') || '',
            node.getAttribute('title') || '',
            node.getAttribute('data-testid') || '',
            node.id || '',
            cls,
        ].join(' ').replace(/\s+/g, ' ').toLowerCase();
    }

    function looksLikeAddToCart(e) {
        // `composedPath` voit à travers les shadow DOM, contrairement à e.target.
        const path = (e.composedPath && e.composedPath()) || [e.target];
        for (const el of path) {
            if (!el || el.nodeType !== 1) continue;
            if (el.id === 'magic-courses-widget' || (el.closest && el.closest('#magic-courses-widget'))) return false;
            const node = el.matches && el.matches('button, a, [role="button"], input[type="button"], input[type="submit"]')
                ? el
                : (el.closest && el.closest('button, a, [role="button"]'));
            if (!node) continue;
            const hay = nodeText(node);
            const cart = /(panier|cart|basket)/.test(hay);
            const add = /\b(ajouter|ajout|add)\b|add[-_ ]?to[-_ ]?cart|addtocart|btn[-_]?add/.test(hay);
            const more = /(augmenter|increment|increase)/.test(hay) && /(quantit|qty)/.test(hay);
            if ((add && cart) || (cart && /^\s*\+\s*$/.test(node.textContent || '')) || more || add) return true;
        }
        return false;
    }

    document.addEventListener('click', (e) => {
        if (advanced || atLast) return;
        if (!looksLikeAddToCart(e)) return;
        advanced = true;
        reportDone(state.idx);
        // On le DIT : sans retour visible, un passage au suivant qui tarde
        // ressemble à une extension qui ne fait rien.
        const item = box.querySelector('.mcw-item');
        if (item) item.textContent = 'Ajouté ✓ — je passe au suivant…';
        setTimeout(() => goTo(state.idx + 1), 1200); // laisse le panier s'enregistrer
    }, true);
})();
