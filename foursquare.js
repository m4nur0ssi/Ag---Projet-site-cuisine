/**
 * foursquare.js — infos restaurant via l'API Foursquare Places (2025).
 * GRATUIT avec une clé (foursquare.com/developers), SANS carte bancaire.
 * Donne : adresse, téléphone, site, note, prix, horaires (selon dispo du plan).
 *
 * Nécessite FSQ_API_KEY. Sans clé → null (skip).
 * API 2025 : host places-api.foursquare.com, Authorization: Bearer, header version.
 */
const fetch = require('node-fetch');

const BASE = 'https://places-api.foursquare.com';
const API_VERSION = process.env.FSQ_API_VERSION || '2025-06-17';
const PRICE_MAP = { 1: 1, 2: 2, 3: 3, 4: 3 }; // prix Foursquare (1–4) → € du site (1–3)

async function fetchJson(url, key, ms = 6000) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), ms);
    try {
        const res = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${key}`,
                'X-Places-Api-Version': API_VERSION,
                'Accept': 'application/json',
            },
            signal: ctrl.signal,
        });
        if (!res.ok) { console.log(`   ⚠️ Foursquare HTTP ${res.status}`); return null; }
        return await res.json();
    } catch { return null; } finally { clearTimeout(to); }
}

function pick(d) {
    const info = {};
    const addr = d.location && (d.location.formatted_address || d.location.address);
    if (addr) info.address = addr;
    if (d.tel) info.phone = d.tel;
    if (d.website) info.website = d.website;
    if (typeof d.rating === 'number') info.rating = Math.round((d.rating / 2) * 10) / 10; // 0-10 → /5
    if (typeof d.price === 'number') info.priceLevel = PRICE_MAP[d.price] || 2;
    if (d.hours && (d.hours.display || d.hours.display_hours)) info.hours = d.hours.display || d.hours.display_hours;
    return info;
}

async function enrichRestaurant(name, cityHint = 'Paris') {
    const key = process.env.FSQ_API_KEY;
    if (!key || !name) return null;
    try {
        // 1) Recherche → fsq_place_id (catégorie restauration 13000)
        const searchUrl = `${BASE}/places/search?query=${encodeURIComponent(name)}&near=${encodeURIComponent(cityHint)}&limit=1`;
        const search = await fetchJson(searchUrl, key);
        const place = search && search.results && search.results[0];
        const id = place && (place.fsq_place_id || place.fsq_id);
        if (!id) { console.log(`   🔎 Foursquare : aucun lieu pour "${name}"`); return null; }

        // La recherche renvoie déjà des champs → on les prend, puis on complète via détails.
        let info = pick(place);
        const det = await fetchJson(`${BASE}/places/${id}`, key);
        if (det) info = { ...info, ...pick(det) };

        return Object.keys(info).length ? info : null;
    } catch (e) {
        console.log('   ⚠️ Foursquare échec :', e.message);
        return null;
    }
}

module.exports = { enrichRestaurant };
