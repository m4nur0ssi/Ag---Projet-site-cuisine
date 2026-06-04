export interface ParsedIngredient {
    raw: string;
    emoji: string;
    quantity: string | null;
    unit: string | null;
    name: string;
}

export function parseIngredient(rawText: string): ParsedIngredient {
    if (!rawText) return { raw: '', emoji: '', quantity: null, unit: null, name: '' };
    
    let text = rawText.trim();
    
    // 1. Extract and remove Emoji
    let emoji = '';
    const emojiMatch = text.match(/^[\u0020-\u007E]*([\uD83C-\uDBFF\uDC00-\uDFFF\uFE0F]+)/);
    if (emojiMatch) {
        emoji = emojiMatch[1];
        text = text.replace(emojiMatch[0], '').trim();
    }
    
    // Remove leading punctuation/newline
    text = text.replace(/^[\n\r]+/, '').trim();
    
    // 2. Extract quantities and units
    // Group 1: quantity (numbers, fractions, written numbers)
    // Group 2: unit
    // Group 3: remaining text (the ingredient name)
    const regex = /^((?:\d+(?:[\.,]\d+)?(?:\s*\/\s*\d+)?)|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|½|¼|¾)?\s*(cuillères?\s*(?:à\s*café|à\s*soupe)?|cuil\.?\s*(?:à\s*café|à\s*soupe)?|c\.\s*à\s*(?:soupe|café)|cas|cac|c\.a\.c|c\.à\.s|c\.à\.c|pincées?\s*de|poignées?\s*de|tablettes?|morceaux?|tranches?|gousses?|conserves?|sachets?|briques?|verres?\s*de|filets?|bottes?|tasses?|cubes?|pots?\s*de|boîtes?\s*de|boite\s*de|g|grammes?|ml|millilitres?|cl|centilitres?|l|litres?|kg|kilogrammes?|pincées?|poignées?|verres?|pots?)?\s*(?:de\s+|d['’\u0027]|du\s+|des\s+)?(.*)$/i;

    const match = text.match(regex);
    let quantity = null;
    let unit = null;
    let name = text;

    if (match) {
        quantity = match[1] ? match[1].trim() : null;
        unit = match[2] ? match[2].trim() : null;
        
        // Sometimes the match captures nothing meaningful and whole text is in group 3
        if (match[3]) {
            name = match[3].trim();
        }
        
        // Handle cases where unit implies a quantity of 1 (e.g., "un filet d'huile")
        if (!quantity && unit) {
            if (/^(?:une?|un)\s+/i.test(unit)) {
                quantity = '1';
                unit = unit.replace(/^(?:une?|un)\s+/i, '').trim();
            }
        }
    }
    
    // Capitalize first letter of name
    if (name.length > 0) {
        name = name.charAt(0).toUpperCase() + name.slice(1);
    }

    return { raw: rawText, emoji, quantity, unit, name };
}
