/**
 * foursquare.js — infos restaurant via l'API Foursquare Places (v3).
 * GRATUIT avec une clé (foursquare.com/developers), SANS carte bancaire.
 * Donne : note, prix, horaires, adresse, téléphone, site.
 *
 * Nécessite la variable d'env FSQ_API_KEY. Sans clé → renvoie null (skip).
 */
const fetch = require('node-fetch');

// prix Foursquare (1–4) → indice € du site (1–3)
const PRICE_MAP = { 1: 1, 2: 2, 3: 3, 4: 3 };

async function fetchJson(url, key, ms = 6000) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), ms);
    try {
        const res = await fetch(url, { headers: { 'Authorization': key, 'Accept': 'application/json' }, signal: ctrl.signal });
        if (!res.ok) return null;
        return await res.json();
    } catch { return null; } finally { clearTimeout(to); }
}

async function enrichRestaurant(name, cityHint = 'Paris') {
    const key = process.env.FSQ_API_KEY;
    if (!key || !name) return null;
    try {
        // 1) Recherche → fsq_id du meilleur résultat restauration
        const searchUrl = `https://api.foursquare.com/v3/places/search?query=${encodeURIComponent(name)}&near=${encodeURIComponent(cityHint)}&categories=13000&limit=1&language=fr`;
        const search = await fetchJson(searchUrl, key);
        const place = search && search.results && search.results[0];
        if (!place || !place.fsq_id) { console.log(`   🔎 Foursquare : aucun lieu pour "${name}"`); return null; }

        // 2) Détails
        const fields = 'name,location,tel,website,rating,price,hours,social_media';
        const detUrl = `https://api.foursquare.com/v3/places/${place.fsq_id}?fields=${fields}&language=fr`;
        const d = await fetchJson(detUrl, key);
        if (!d) return null;

        const info = {};
        if (d.location && d.location.formatted_address) info.address = d.location.formatted_address;
        if (d.tel) info.phone = d.tel;
        if (d.website) info.website = d.website;
        if (typeof d.rating === 'number') info.rating = Math.round((d.rating / 2) * 10) / 10; // 0-10 → /5
        if (typeof d.price === 'number') info.priceLevel = PRICE_MAP[d.price] || 2;
        if (d.hours && d.hours.display) info.hours = d.hours.display;
        return Object.keys(info).length ? info : null;
    } catch (e) {
        console.log('   ⚠️ Foursquare échec :', e.message);
        return null;
    }
}

module.exports = { enrichRestaurant };
