/**
 * Parses a string to find the first duration in minutes.
 */
export function parseDuration(text: string): number | null {
    // Remove HTML tags first to avoid parsing inside tags
    const cleanText = text.replace(/<[^>]*>/g, '');

    // Pattern for "45 min", "1h", "1 h 30 min", "2 heures", etc.
    const match = cleanText.match(/(\d+)\s?(h|heures?|min|minutes?)/i);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    // Basic conversion
    let minutes = unit.startsWith('h') ? value * 60 : value;

    // Check for a second part (e.g., "1 h 30 min")
    const secondPart = cleanText.slice(match.index! + match[0].length);
    const secondMatch = secondPart.match(/^[\s]*(\d+)\s?(min|minutes?)/i);
    if (secondMatch && unit.startsWith('h')) {
        minutes += parseInt(secondMatch[1]);
    }

    return minutes;
}

export function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
}
