// Fonction de sync partagée — appelle /api/sync
export async function triggerSync(source = 'button'): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger_source: source })
    });
    const data = await res.json();
    if (res.ok) {
        return { ok: true, message: data.message || 'Synchronisation lancée !' };
    }
    return { ok: false, message: data.error || `Erreur ${res.status}` };
}
