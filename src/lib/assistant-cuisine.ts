'use client';

/** Pose une question écrite à l'assistant de cuisine (route /api/assistant-cuisine). */
/** Envoie la question avec le contexte de l'étape. Rend la réponse, ou `null` si l'assistant est muet. */
export async function demanderAssistant(q: {
    question: string; titre: string; etape: string; ingredients: string[];
}): Promise<string | null> {
    try {
        const r = await fetch('/api/assistant-cuisine', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(q),
        });
        if (!r.ok) return null;
        const d = await r.json();
        return typeof d?.reponse === 'string' ? d.reponse : null;
    } catch {
        return null;
    }
}
