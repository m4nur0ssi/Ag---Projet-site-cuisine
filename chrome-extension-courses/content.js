/* Courses Magiques — assistant magasin (content script).
 * Lit la file d'ingrédients passée par le site (#mlist=<base64 json>&mi=<index>),
 * affiche un widget flottant et permet d'avancer au produit suivant SANS quitter
 * l'onglet du magasin. Tente aussi de détecter le clic "Ajouter au panier".
 */
(function () {
    'use strict';

    /*
     * Sur LE SITE, l'extension ne fait qu'une chose : dire qu'elle est là.
     *
     * Une page web ne peut pas deviner ce qui est installé dans le navigateur.
     * Le site ne savait donc pas s'il envoyait quelqu'un au magasin avec
     * l'assistant… ou sans, et l'utilisateur découvrait le vide sur place. On
     * plante un drapeau, le site sait à quoi s'en tenir avant d'ouvrir.
     */
    const SUR_LE_SITE = /(^|\.)lesrecettesmagiques\.fr$/.test(location.hostname)
        || /\.vercel\.app$/.test(location.hostname)
        || location.hostname === 'localhost';
    if (SUR_LE_SITE) {
        document.documentElement.setAttribute('data-courses-magiques', '1.6.0');
        try { localStorage.setItem('magic-store-ext-active', '1'); } catch (_) {}
        return;
    }

    // --- File depuis le hash de l'URL -------------------------------------
    function parseHash() {
        const h = location.hash.replace(/^#/, '');
        const p = new URLSearchParams(h);
        const raw = p.get('mlist');
        const back = p.get('mo') || '';
        if (!raw) return null;
        try {
            const json = decodeURIComponent(escape(atob(raw)));
            const data = JSON.parse(json);
            const list = Array.isArray(data) ? data : data.terms;
            if (!Array.isArray(list) || !list.length || !list.every(term => typeof term === 'string')) return null;
            const session = Array.isArray(data) ? '' : (typeof data.session === 'string' ? data.session : '');
            const labels = Array.isArray(data.labels) ? data.labels : list;
            return { list, session, labels, idx: Math.max(0, Math.min(list.length - 1, parseInt(p.get('mi') || '0', 10) || 0)), raw, back };
        } catch (_) { return null; }
    }

    /**
     * La file SURVIT à la navigation dans le magasin.
     *
     * Le hash ne tient que le temps d'une recherche : dès qu'on ouvre une fiche
     * produit ou qu'on clique dans un rayon, il disparaît et le widget avec lui —
     * il fallait alors repartir du site pour le « réactiver ». On garde donc la
     * file en mémoire : elle revient sur chaque page du magasin, et s'efface
     * quand on ferme le widget ou qu'on finit la liste.
     *
     * localStorage et non sessionStorage : la mémoire de session meurt avec
     * l'onglet. Fermer Carrefour par mégarde, ou reprendre ses courses le
     * lendemain, obligeait à repartir du site — l'extension semblait éteinte.
     */
    const MEM = 'magic-courses-queue';
    function remember(st) {
        try { localStorage.setItem(MEM, JSON.stringify({ raw: st.raw, idx: st.idx, back: st.back, at: Date.now() })); } catch (_) {}
    }
    function forget() {
        try { localStorage.removeItem(MEM); sessionStorage.removeItem(MEM); } catch (_) {}
    }
    function recall() {
        try {
            // On relit l'ancienne mémoire de session tant qu'une file y traîne :
            // une liste en cours ne doit pas disparaître à la mise à jour.
            const m = JSON.parse(localStorage.getItem(MEM) || sessionStorage.getItem(MEM) || 'null');
            // Une file oubliée depuis une semaine n'est plus la liste du jour.
            if (m && m.at && Date.now() - m.at > 7 * 24 * 3600 * 1000) { forget(); return null; }
            if (!m || !m.raw) return null;
            const json = decodeURIComponent(escape(atob(m.raw)));
            const data = JSON.parse(json);
            const list = Array.isArray(data) ? data : data.terms;
            if (!Array.isArray(list) || !list.length || !list.every(term => typeof term === 'string')) return null;
            const session = Array.isArray(data) ? '' : (typeof data.session === 'string' ? data.session : '');
            const labels = Array.isArray(data.labels) ? data.labels : list;
            return { list, session, labels, idx: Math.max(0, Math.min(list.length - 1, m.idx || 0)), raw: m.raw, back: m.back || '' };
        } catch (_) { return null; }
    }

    window.addEventListener('hashchange', () => {
        const next = parseHash();
        if (next) { remember(next); location.reload(); }
    });

    const fromHash = parseHash();
    const state = fromHash || recall();

    /**
     * Aucune file en cours : l'extension ne se tait plus pour autant.
     *
     * Elle restait totalement invisible tant qu'on n'était pas arrivé depuis le
     * site — elle avait l'air désactivée. Une pastille discrète s'affiche donc
     * sur les sites de magasin ; elle mène à la liste, d'où l'on repart avec la
     * file. Un clic sur la croix la range jusqu'à la prochaine visite.
     */
    if (!state) {
        if (sessionStorage.getItem('magic-courses-hidden')) return;
        const puce = document.createElement('div');
        puce.id = 'magic-courses-badge';
        puce.innerHTML = `
            <a class="mcb-link" href="https://www.lesrecettesmagiques.fr/tv-courses" target="_blank" rel="noopener">
                🪄 Ma liste de courses
            </a>
            <button class="mcb-close" title="Masquer">✕</button>
        `;
        document.documentElement.appendChild(puce);
        puce.querySelector('.mcb-close').addEventListener('click', () => {
            try { sessionStorage.setItem('magic-courses-hidden', '1'); } catch (_) {}
            puce.remove();
        });
        return;
    }
    remember(state);

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
        if (host.includes('auchan')) return `https://www.auchan.fr/recherche?text=${q}`;
        if (host.includes('intermarche')) return `https://www.intermarche.com/recherche/${q}`;
        return location.href;
    }

    function goTo(i) {
        const idx = Math.max(0, Math.min(i, state.list.length - 1));
        // On reconstruit l'URL AVEC le hash → l'état survit à la navigation même-onglet.
        const back = state.back ? `&mo=${encodeURIComponent(state.back)}` : '';
        location.href = searchUrl(state.list[idx]) + `#mlist=${encodeURIComponent(state.raw)}&mi=${idx}${back}`;
    }

    // --- Renvoie « article validé » à l'onglet des Recettes Magiques ------
    // L'onglet magasin a été ouvert par le site (window.open nommé), donc
    // `window.opener` est notre page. Origine explicite : jamais '*'.
    function reportDone(idx, accepted) {
        if (!state.back || !window.opener || window.opener.closed) {
            box.querySelector('.mcw-hint').textContent = 'Retour vers la liste indisponible. Reviens dans Recettes Magiques pour valider cet article ; il n’a pas été barré automatiquement.';
            return;
        }
        let timeout;
        const receive = (event) => {
            const data = event.data;
            if (event.origin !== state.back || event.source !== window.opener || !data
                || data.source !== 'courses-magiques' || data.type !== 'item-done-ack'
                || data.index !== idx || data.session !== state.session) return;
            clearTimeout(timeout);
            window.removeEventListener('message', receive);
            accepted();
        };
        window.addEventListener('message', receive);
        timeout = setTimeout(() => {
            window.removeEventListener('message', receive);
            box.querySelector('.mcw-hint').textContent = 'La liste n’a pas confirmé la validation. Garde-la ouverte et clique de nouveau sur « Ajouté → suivant ».';
        }, 3000);
        try {
            window.opener.postMessage({ source: 'courses-magiques', type: 'item-done', index: idx,
                term: state.list[idx] || '', session: state.session }, state.back);
        } catch (_) { clearTimeout(timeout); window.removeEventListener('message', receive); }
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
        <div class="mcw-item"></div>
        <div class="mcw-actions">
            <button class="mcw-prev" ${state.idx === 0 ? 'disabled' : ''}>◀</button>
            <button class="mcw-next">${atLast ? '✓ Terminer' : 'Ajouté → suivant ▶'}</button>
        </div>
        <div class="mcw-hint">Astuce : ajoute le produit au panier, puis clique « suivant ».</div>
    `;
    box.querySelector('.mcw-item').textContent = `${state.idx + 1}. ${state.labels[state.idx] || state.list[state.idx]}`;
    document.documentElement.appendChild(box);

    let advanceTimer = null;
    let completed = false;
    let generation = 0;
    let closed = false;
    let baseline = null;
    let productScope = null;
    let manuallyConfirmed = false;
    function evidence(scope) {
        const quantities = scope && scope.querySelectorAll ? [...scope.querySelectorAll(
            'input[type="number"], [role="spinbutton"], [data-testid*="quantity" i], [class*="quantity-value" i]'
        )].map(el => {
            const value = el.value || el.getAttribute('aria-valuenow') || el.textContent || '';
            return /^\s*\d+(?:[.,]\d+)?\s*$/.test(value) ? Number(value.replace(',', '.')) : 0;
        }).join('|') : '';
        const status = [...document.querySelectorAll('[role="status"], [role="alert"], [class*="toast" i]')]
            .map(el => el.textContent || '').join(' ').toLowerCase();
        return { quantities, status };
    }
    function confirmed(before, after) {
        if (/erreur|echec|épuisé|indisponible|impossible|error|failed/.test(after.status) && after.status !== before.status) return false;
        if (after.status !== before.status && /ajout[eé].*(panier)|added.*(cart|basket)/.test(after.status)) return true;
        const a = before.quantities.split('|').map(Number), b = after.quantities.split('|').map(Number);
        return b.some((value, i) => value > (a[i] || 0));
    }
    function validateAndAdvance(manual = false) {
        if (completed || closed) return;
        const currentGeneration = ++generation;
        manuallyConfirmed = manuallyConfirmed || manual;
        if (advanceTimer) clearTimeout(advanceTimer);
        box.querySelector('.mcw-hint').textContent = 'Produit suivant dans 2 secondes après confirmation. Chaque ajout relance le délai.';
        advanceTimer = setTimeout(() => {
            if (!manuallyConfirmed && (!baseline || !confirmed(baseline, evidence(productScope)))) {
                box.querySelector('.mcw-hint').textContent = 'Ajout au panier non confirmé. Vérifie la quantité, puis clique « Ajouté → suivant » si le produit est bien dans ton panier.';
                return;
            }
            reportDone(state.idx, () => {
                if (closed || completed || generation !== currentGeneration) return;
                completed = true;
                if (atLast) {
                    forget();
                    box.querySelector('.mcw-item').textContent = '✅ Liste terminée !';
                    box.querySelector('.mcw-actions').remove();
                } else goTo(state.idx + 1);
            });
        }, 2000);
    }
    box.querySelector('.mcw-close').addEventListener('click', () => { closed = true; clearTimeout(advanceTimer); forget(); box.remove(); });
    box.querySelector('.mcw-prev').addEventListener('click', () => { closed = true; clearTimeout(advanceTimer); goTo(state.idx - 1); });
    box.querySelector('.mcw-next').addEventListener('click', () => validateAndAdvance(true));

    // --- Auto-détection du clic "Ajouter au panier" -----------------------
    // Trois pièges rencontrés sur les sites de magasin :
    //   1. le bouton vit dans un SHADOW DOM (composants web) : `e.target` est
    //      alors l'élément hôte et `closest()` ne trouve rien. `composedPath()`
    //      traverse, lui ;
    //   2. le libellé ne dit pas toujours « panier » — un « + » de quantité, ou
    //      un simple « Ajouter », suffit à mettre au panier ;
    //   3. le texte n'est parfois qu'une icône : il faut lire aussi l'aria-label,
    //      le data-testid et les classes.


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
            if (!node || node.disabled || node.getAttribute('aria-disabled') === 'true') continue;
            const hay = nodeText(node);
            const cart = /(panier|cart|basket)/.test(hay);
            const add = /\b(ajouter|ajout|add)\b|add[-_ ]?to[-_ ]?cart|addtocart|btn[-_]?add/.test(hay);
            const more = /(augmenter|increment|increase)/.test(hay) && /(quantit|qty)/.test(hay);
            if ((add && cart) || (cart && /^\s*\+\s*$/.test(node.textContent || '')) || more) return node;
        }
        return false;
    }

    document.addEventListener('click', (e) => {
        const button = looksLikeAddToCart(e);
        if (!button) return;
        const scope = button.closest && button.closest('article, [data-testid*="product" i], [class*="product-card" i], [class*="productCard"], [class*="quantity" i]');
        if (!baseline || productScope !== scope) { productScope = scope; baseline = evidence(scope); }
        validateAndAdvance();
    }, true);

})();
