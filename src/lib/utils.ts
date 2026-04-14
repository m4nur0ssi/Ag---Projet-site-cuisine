
/**
 * Utility to scale cooking quantities
 */
export function scaleQuantity(quantity: string, ratio: number): string {
    if (!quantity || ratio === 1) return quantity;

    // Pattern for numbers (including decimals and fractions)
    // Supports: "500", "1.5", "1/2", "3,5"
    const numberPattern = /(\d+([.,]\d+)?)|(\d+\/\d+)/g;

    return quantity.replace(numberPattern, (match) => {
        // Handle fractions
        if (match.includes('/')) {
            const [num, den] = match.split('/').map(Number);
            const value = (num / den) * ratio;
            return formatNumber(value);
        }

        // Handle decimals with comma or dot
        const normalized = match.replace(',', '.');
        const value = parseFloat(normalized) * ratio;
        return formatNumber(value).replace('.', match.includes(',') ? ',' : '.');
    });
}

function formatNumber(num: number): string {
    // Round to 2 decimal places max
    const rounded = Math.round(num * 100) / 100;

    // If it's a whole number, return as is
    if (rounded % 1 === 0) return rounded.toString();

    // Otherwise return with up to 2 decimals
    return rounded.toFixed(rounded % 0.1 === 0 ? 1 : 2).replace(/\.0+$/, '');
}

/**
 * Decodes HTML entities commonly found in WordPress content
 */
export function decodeHtml(html: string): string {
    if (!html) return '';

    const entities: Record<string, string> = {
        '&#038;': '&', '&amp;': '&', '&#8217;': "'", '&rsquo;': "'",
        '&#8211;': '-', '&ndash;': '-', '&nbsp;': ' ',
        '&Agrave;': 'À', '&agrave;': 'à', '&Eacute;': 'É', '&eacute;': 'é',
        '&Egrave;': 'È', '&egrave;': 'è', '&circ;': '^', '&icirc;': 'î',
        '&ocirc;': 'ô', '&ucirc;': 'û', '&lt;': '<', '&gt;': '>',
        '&quot;': '"', '&apos;': "'", '&deg;': '°', '&euro;': '€',
        '&lsquo;': "'", '&ldquo;': '"', '&rdquo;': '"',
        '&#8220;': '"', '&#8221;': '"', '&#8216;': "'", '&#039;': "'",
        '&hellip;': '...', '&#8230;': '...', '&bull;': '•', '&middot;': '·'
    };

    let decoded = html.replace(/&[a-z0-9#]+;/gi, (match) => {
        const lower = match.toLowerCase();
        return entities[match] || entities[lower] || match;
    });

    decoded = decoded.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
    decoded = decoded.replace(/&#x([a-f0-9]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

    return decoded.replace(/\s+/g, ' ').trim();
}
