import { buildConsolidatedItems, canonicalIng, doneKeysOf, extraLineKey, expandIngredientLines, parseIngredient, prettyQtyUnit, type ConsolItem } from './ingredients';

type Plan = Record<string, Record<string, any>>;
type List = Record<string, any>;
export const slotSignature = (recipe: any): string => 'v2:' + JSON.stringify([
    recipe?.id ?? recipe?.title, recipe?.ingredients || [], recipe?.side?.id ?? recipe?.side?.title, recipe?.side?.ingredients || [],
]);
export const planSignature = (plan: Plan): string => JSON.stringify(Object.keys(plan).sort().map(day =>
    [day, Object.keys(plan[day] || {}).sort().map(meal => [meal, slotSignature(plan[day][meal])])],
));

/** Reconcile before rendering, so a replacement recipe never inherits old purchases. */
export function reconcileShoppingState(plan: Plan, list: List, done: Set<string>, mask: Set<string>, edits: Record<string, number>,
    previousSlots: Record<string, string>, previousQuantities: Record<string, string>) {
    const slots: Record<string, string> = {};
    const legacy: Record<string, string> = {};
    Object.entries(plan).forEach(([day, meals]) => Object.entries(meals || {}).forEach(([meal, recipe]) => {
        slots[`${day}|${meal}`] = slotSignature(recipe);
        legacy[`${day}|${meal}`] = `${recipe?.id || recipe?.title || ''}#${(recipe?.ingredients || []).length}`;
    }));
    const changed = Object.keys(previousSlots).filter(k => previousSlots[k] !==
        (previousSlots[k].startsWith('v2:') ? slots[k] : legacy[k]));
    const sameSlot = (key: string) => !changed.some(slot => key.startsWith(slot + '|'));
    const masked = new Set([...mask].filter(sameSlot));
    const full = buildConsolidatedItems(plan, masked, list, true, true);
    const live = new Set(full.flatMap(it => [...doneKeysOf(it), ...(it.manual ? ['m:' + it.key] : []),
        ...it.keys.map(k => k.split('|').slice(0, 3).join('|'))]));
    const marks = new Set([...done].filter(key => sameSlot(key) && live.has(key)));
    const quantities: Record<string, string> = {};
    full.forEach(it => {
        quantities[it.key] = JSON.stringify([it.qty, it.unit, it.display, it.keys.map(key =>
            [key, key.startsWith('extra|') ? '' : slots[key.split('|').slice(0, 2).join('|')]])]);
    });
    const qty = { ...edits };
    Object.keys(qty).forEach(key => {
        if (!(key in quantities) || (previousQuantities[key] && previousQuantities[key] !== quantities[key])) delete qty[key];
    });
    return { done: marks, mask: masked, edits: qty, slots, quantities };
}

/** Overrides are total needs, not another unit and not an additional purchase. */
export function displayRemaining(total: ConsolItem, remaining: ConsolItem | undefined, override?: number): ConsolItem {
    const displayed = remaining ? { ...total, qty: remaining.qty, range: remaining.range, unit: remaining.unit, count: remaining.count, display: remaining.display } : total;
    if (override == null || total.range || total.mixedUnits || (remaining && total.unit !== remaining.unit)) return displayed;
    const bought = remaining && total.qty != null && remaining.qty != null ? total.qty - remaining.qty : 0;
    const qty = remaining ? Math.max(0, override - bought) : override;
    return { ...displayed, qty, display: `${prettyQtyUnit(qty, displayed.unit)} ${displayed.name}`.trim() };
}

/** Split a grouped extra only when needed; keep other products and their check state. */
export function removeShoppingProduct(list: List, target: string, marks?: Set<string>): List {
    const next: List = {};
    Object.entries(list).forEach(([id, entry]) => {
        const ingredients = (entry.ingredients || []).flatMap((ing: any) => {
            const raw = typeof ing === 'string' ? ing : ing.name;
            const pieces = expandIngredientLines(raw);
            const keep = pieces.filter(piece => {
                const parsed = parseIngredient(piece);
                return canonicalIng(parsed.name, parsed.unit, piece).name !== target;
            });
            if (keep.length === pieces.length) return [ing];
            return keep.map(piece => {
                const oldKey = extraLineKey(id, raw);
                if (marks?.has(oldKey) || marks?.has(`${oldKey}|${pieces.indexOf(piece)}`)) marks.add(`${extraLineKey(id, piece)}|0`);
                return typeof ing === 'string' ? piece : { ...ing, name: piece };
            });
        });
        if (ingredients.length) next[id] = { ...entry, ingredients };
    });
    return next;
}

/** Reopening one split line preserves the other lines of an old whole-line check. */
export function toggleSources(done: Set<string>, keys: string[], sources: ConsolItem[], already: boolean): Set<string> {
    const marks = new Set(done);
    keys.forEach(key => {
        const parent = key.split('|').slice(0, 3).join('|');
        if (key !== parent && marks.has(parent)) {
            marks.delete(parent);
            sources.flatMap(it => it.keys).filter(k => k.startsWith(parent + '|')).forEach(k => marks.add(k));
        }
    });
    keys.forEach(key => already ? marks.delete(key) : marks.add(key));
    return marks;
}
