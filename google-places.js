/**
 * google-places.js — enrichit une fiche restaurant avec des infos RÉELLES via
 * l'API Google Places (adresse, note, nombre d'avis, prix, horaires, lien Maps).
 *
 * Nécessite la variable d'environnement GOOGLE_PLACES_API_KEY.
 * Sans clé → renvoie null (skip silencieux, aucune erreur).
 *
 * TripAdvisor : pas d'API publique gratuite pour les avis → on fournit la note
 * Google + le lien Google Maps à la place (le champ tripAdvisorUrl reste manuel).
 */
const fetch = require('node-fetch');

// price_level Google (0–4) → indice € du site (1–3)
const PRICE_MAP = { 0: 1, 1: 1, 2: 2, 3: 3, 4: 3 };

async function enrichRestaurant(name, cityHint = 'Paris') {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key || !name) return null;
    try {
        const query = `${name} ${cityHint}`.trim();
        // 1) Find Place From Text → place_id
        const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id&language=fr&key=${key}`;
        const find = await (await fetch(findUrl)).json();
        const placeId = find.candidates && find.candidates[0] && find.candidates[0].place_id;
        if (!placeId) { console.log(`   🔎 Google Places : aucun lieu pour "${query}"`); return null; }

        // 2) Place Details
        const fields = 'formatted_address,formatted_phone_number,website,rating,user_ratings_total,price_level,opening_hours,name,url';
        const detUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&language=fr&key=${key}`;
        const d = (await (await fetch(detUrl)).json()).result;
        if (!d) return null;

        const info = {};
        if (d.formatted_address) info.address = d.formatted_address;
        if (d.formatted_phone_number) info.phone = d.formatted_phone_number;
        if (d.website) info.website = d.website;
        if (typeof d.rating === 'number') info.rating = Math.round(d.rating * 10) / 10;
        if (typeof d.user_ratings_total === 'number') info.reviewsCount = d.user_ratings_total;
        if (typeof d.price_level === 'number') info.priceLevel = PRICE_MAP[d.price_level] || 2;
        if (d.opening_hours && Array.isArray(d.opening_hours.weekday_text) && d.opening_hours.weekday_text.length) {
            info.hours = d.opening_hours.weekday_text.join(' · ');
        }
        if (d.url) info.mapsUrl = d.url; // lien Google Maps officiel (fiche du lieu)
        return Object.keys(info).length ? info : null;
    } catch (e) {
        console.log('   ⚠️ Google Places échec :', e.message);
        return null;
    }
}

module.exports = { enrichRestaurant };
