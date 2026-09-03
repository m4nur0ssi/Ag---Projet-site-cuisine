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

/**
 * Devine la ville à partir du texte de la fiche (légende TikTok ou ancien texte).
 *
 * L'ancienne version cherchait TOUJOURS « <nom>, Paris ». Deux des restaurants du
 * site ne sont pas à Paris (Le Raincy, Marly-le-Roi) : leur recherche ne pouvait
 * que rater, et leur fiche restait vide. On lit donc la ville quand le texte la
 * donne, au lieu de la supposer.
 */
const GRANDES_VILLES = ['paris', 'lyon', 'marseille', 'bordeaux', 'lille', 'toulouse', 'nantes',
    'nice', 'strasbourg', 'montpellier', 'rennes', 'reims', 'toulon', 'grenoble', 'dijon', 'angers',
    'nimes', 'nîmes', 'villeurbanne', 'clermont', 'aix', 'brest', 'tours', 'amiens', 'limoges',
    'annecy', 'metz', 'besancon', 'besançon', 'orleans', 'orléans', 'rouen', 'caen', 'nancy',
    'biarritz', 'cannes', 'deauville', 'bruxelles', 'geneve', 'genève', 'lausanne'];

function villeDuTexte(texte) {
    if (!texte) return null;
    const t = String(texte);
    // 1) Code postal suivi de la ville : « 93340, Le Raincy », « 78160 Marly-le-Roi ».
    const cp = t.match(/\b\d{5}\b[,\s]+([A-ZÉÈÀÂÎÔÛ][\wÀ-ÿ'’-]+(?:[ -][A-ZÉÈÀÂÎÔÛ]?[\wÀ-ÿ'’-]+){0,3})/);
    if (cp) return cp[1].replace(/\s+(France|FR)$/i, '').trim();
    // 2) Après le pin des créateurs : « 📍Santa Carne - Paris ».
    const pin = t.match(/📍[^#\n]{0,60}?[-–—]\s*([A-ZÉÈÀÂÎÔÛ][\wÀ-ÿ'’-]{2,}(?:[ -][A-ZÉÈÀÂÎÔÛ]?[\wÀ-ÿ'’-]+){0,2})/);
    if (pin) return pin[1].trim();
    // 3) « à Paris », « sur Lyon ». Attention : `\b` ne mord pas devant « à »,
    //    qui n'est pas un caractère de mot pour le moteur d'expressions.
    const prep = t.match(/(?:^|[\s(«"])(?:à|a|sur|au)\s+([A-ZÉÈÀÂÎÔÛ][\wÀ-ÿ'’-]{2,}(?:[ -][A-ZÉÈÀÂÎÔÛ]?[\wÀ-ÿ'’-]+){0,2})/);
    if (prep) return prep[1].trim();
    // 4) Hashtags : #sortiraparis, #restaurantparis, #foodlyon. On n'accepte que
    //    si le reste du tag est une ville connue — « sortiraparis » laisse
    //    « aparis », qu'il faut relire sans son « a » de liaison.
    const tags = t.toLowerCase().match(/#(?:sortir|restaurant|resto|food|bonneadresse|adresse)([a-zàâéèêîôûç-]{3,20})\b/g) || [];
    for (const brut of tags) {
        const reste = brut.replace(/^#(?:sortir|restaurant|resto|food|bonneadresse|adresse)/, '');
        for (const cand of [reste, reste.replace(/^a/, '')]) {
            if (GRANDES_VILLES.includes(cand)) return cand.charAt(0).toUpperCase() + cand.slice(1);
        }
    }
    return null;
}

async function chercherOSM(q) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&addressdetails=1&extratags=1&limit=1`;
    const res = await fetchWithTimeout(url, 6000);
    if (!res.ok) return null;
    const arr = await res.json();
    return (Array.isArray(arr) && arr[0]) || null;
}

const _pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function enrichRestaurant(name, cityHint = null) {
    if (!name) return null;
    try {
        // Évite de doubler la ville si le nom la contient déjà ("Cicciolina Paris" → "Cicciolina")
        const ville = cityHint || null;
        const cleanName = ville
            ? String(name).replace(new RegExp(`[ ,]+${ville}\\s*$`, 'i'), '').trim()
            : String(name).trim();

        // Trois tentatives, de la plus précise à la plus large. Nominatim impose
        // une requête par seconde : on attend entre deux essais.
        const essais = [];
        if (ville) essais.push(`${cleanName}, ${ville}`);
        essais.push(cleanName);
        if (!ville) essais.push(`${cleanName}, Paris`);

        let p = null;
        let q = essais[0];
        for (let i = 0; i < essais.length; i++) {
            if (i > 0) await _pause(1100);
            q = essais[i];
            const candidat = await chercherOSM(q);
            if (!candidat) continue;
            const FOOD = ['restaurant', 'cafe', 'bar', 'fast_food', 'pub', 'bakery', 'ice_cream', 'biergarten', 'food_court'];
            if (candidat.category !== 'amenity' || !FOOD.includes(candidat.type)) {
                console.log(`   🔎 OSM : match non-restaurant ignoré (${candidat.category}/${candidat.type}) pour "${q}"`);
                continue;
            }
            p = candidat;
            break;
        }
        if (!p) { console.log(`   🔎 OSM : aucun lieu pour "${cleanName}"${ville ? ` (${ville})` : ''}`); return null; }

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
        info.mapsQuery = q;
        // OSM range le type de cuisine : de quoi classer la fiche sans deviner.
        const cuisine = (et.cuisine || '').toLowerCase();
        if (/ital|pizza|pasta/.test(cuisine)) info.subType = 'italien';
        else if (/japanese|chinese|thai|asian|sushi|ramen|vietnamese|korean/.test(cuisine)) info.subType = 'asiatique';
        else if (/fine_dining|gourmet/.test(cuisine)) info.subType = 'gastro';
        else if (/tea|coffee_shop|cake|pastry/.test(cuisine)) info.subType = 'salon-de-the';
        else if (/french|brasserie|regional/.test(cuisine)) info.subType = 'brasserie';

        return Object.keys(info).length ? info : null;
    } catch (e) {
        console.log('   ⚠️ OSM lookup échec :', e.message);
        return null;
    }
}

module.exports = { enrichRestaurant, villeDuTexte };
