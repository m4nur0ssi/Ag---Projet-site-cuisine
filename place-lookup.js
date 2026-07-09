/**
 * place-lookup.js — enrichit une fiche restaurant avec des infos RÉELLES via
 * OpenStreetMap / Nominatim. GRATUIT, aucune clé, aucune carte bancaire.
 *
 * Renvoie ce qu'OSM connaît sur le lieu : adresse, téléphone, site, horaires,
 * terrasse (outdoor_seating), + lien Google Maps (coordonnées).
 * OSM n'a PAS de note ni de prix → ces champs restent vides (ou manuels).
 *
 * Politique Nominatim : 1 requête/seconde max + User-Agent obligatoire.
 */
const fetch = require('node-fetch');

// fetch avec timeout dur (sinon un Nominatim lent fait HANGER tout le sync).
async function fetchWithTimeout(url, ms = 6000) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), ms);
    try {
        return await fetch(url, { headers: { 'User-Agent': 'les-recettes-magiques/1.0 (restaurant enrich)' }, signal: ctrl.signal });
    } finally {
        clearTimeout(to);
    }
}

async function enrichRestaurant(name, cityHint = 'Paris') {
    if (!name) return null;
    try {
        // Évite de doubler la ville si le nom la contient déjà ("Cicciolina Paris" → "Cicciolina")
        const cleanName = String(name).replace(new RegExp(`[ ,]+${cityHint}\\s*$`, 'i'), '').trim();
        const q = `${cleanName}, ${cityHint}`;
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&addressdetails=1&extratags=1&limit=1`;
        const res = await fetchWithTimeout(url, 6000);
        if (!res.ok) return null;
        const arr = await res.json();
        const p = Array.isArray(arr) && arr[0];
        if (!p) { console.log(`   🔎 OSM : aucun lieu pour "${q}"`); return null; }

        // Sécurité : n'accepter QUE les vrais lieux de restauration (sinon on
        // risque de matcher une rue au hasard → adresse fausse, pire que rien).
        const FOOD_TYPES = ['restaurant', 'cafe', 'bar', 'fast_food', 'pub', 'bakery', 'ice_cream', 'biergarten', 'food_court'];
        if (p.category !== 'amenity' || !FOOD_TYPES.includes(p.type)) {
            console.log(`   🔎 OSM : match non-restaurant ignoré (${p.category}/${p.type}) pour "${q}"`);
            return null;
        }

        const info = {};
        // Adresse structurée (repli sur display_name)
        const a = p.address || {};
        const line1 = [a.house_number, a.road].filter(Boolean).join(' ');
        const line2 = [a.postcode, a.city || a.town || a.village || a.municipality].filter(Boolean).join(' ');
        const structured = [line1, line2].filter(Boolean).join(', ');
        info.address = structured || (p.display_name || '').split(',').slice(0, 3).join(',').trim();

        const et = p.extratags || {};
        const phone = et.phone || et['contact:phone'];
        const website = et.website || et['contact:website'];
        if (phone) info.phone = phone;
        if (website) info.website = website;
        if (et.opening_hours) info.hours = et.opening_hours;         // format OSM (Mo-Fr 12:00-15:00…)
        if (et.outdoor_seating === 'yes') info.terrace = true;
        if (p.lat && p.lon) info.mapsUrl = `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`;

        return Object.keys(info).length ? info : null;
    } catch (e) {
        console.log('   ⚠️ OSM lookup échec :', e.message);
        return null;
    }
}

module.exports = { enrichRestaurant };
