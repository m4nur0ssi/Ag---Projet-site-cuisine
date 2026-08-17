'use client';
/**
 * « Partager en image » : génère une carte verticale (story 9:16) de la recette
 * sur un canvas — photo + titre + méta + domaine — puis propose de la partager
 * (Web Share niveau fichier si dispo) ou de la télécharger.
 *
 * Note CORS : les photos servies depuis un autre domaine « salissent » le canvas
 * et bloquent l'export. On tente crossOrigin, et si l'export échoue on prévient
 * proprement (à régler en prod par un proxy image sur le domaine du site).
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { estimateRecipeTiming } from '@/lib/recipe-timing';
import { decodeHtml } from '@/mobile/lib/utils';
import styles from './RecipeShareCard.module.css';

export default function RecipeShareCard({ recipe, onClose }: { recipe: any; onClose: () => void }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [url, setUrl] = useState('');
    const [tainted, setTainted] = useState(false);
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        const cv = canvasRef.current; if (!cv) return;
        const ctx = cv.getContext('2d'); if (!ctx) return;
        const W = 1080, H = 1920; cv.width = W; cv.height = H;
        const t = estimateRecipeTiming(recipe.steps);
        const title = decodeHtml(recipe.title || '').toUpperCase();
        const meta = `${(recipe.category || '').toUpperCase()}   ·   ${(t.prepTime + t.cookTime)} MIN`;

        const paint = (img: HTMLImageElement | null) => {
            ctx.fillStyle = '#08080b'; ctx.fillRect(0, 0, W, H);
            if (img) {
                const ratio = Math.max(W / img.width, (H * 0.64) / img.height);
                const w = img.width * ratio, h = img.height * ratio;
                ctx.drawImage(img, (W - w) / 2, 0, w, h);
            } else { ctx.fillStyle = '#1a1420'; ctx.fillRect(0, 0, W, H * 0.64); }
            const g = ctx.createLinearGradient(0, H * 0.32, 0, H * 0.72);
            g.addColorStop(0, 'rgba(8,8,11,0)'); g.addColorStop(1, '#08080b');
            ctx.fillStyle = g; ctx.fillRect(0, H * 0.30, W, H * 0.45);

            ctx.textAlign = 'left';
            ctx.fillStyle = '#FF6B4A';
            ctx.font = '800 40px -apple-system, system-ui, sans-serif';
            ctx.fillText(meta, 88, H * 0.70);

            ctx.fillStyle = '#fff';
            ctx.font = '900 104px -apple-system, system-ui, sans-serif';
            const maxW = W - 176; let line = ''; let y = H * 0.70 + 108;
            for (const word of title.split(' ')) {
                if (ctx.measureText(line + word).width > maxW && line) { ctx.fillText(line.trim(), 88, y); line = ''; y += 112; }
                line += word + ' ';
            }
            ctx.fillText(line.trim(), 88, y);

            ctx.fillStyle = 'rgba(235,235,245,.6)';
            ctx.font = '600 44px -apple-system, system-ui, sans-serif';
            ctx.fillText('lesrecettesmagiques.fr', 88, H - 110);

            try { setUrl(cv.toDataURL('image/png')); setTainted(false); }
            catch { setTainted(true); }
        };

        const img = new Image(); img.crossOrigin = 'anonymous';
        img.onload = () => paint(img);
        img.onerror = () => paint(null);
        if (recipe.image) img.src = recipe.image; else paint(null);
    }, [recipe]);

    const share = async () => {
        try {
            const nav = navigator as any;
            if (url && nav.canShare && canvasRef.current) {
                const blob: Blob | null = await new Promise((res) => canvasRef.current!.toBlob(res as any, 'image/png'));
                if (blob) {
                    const file = new File([blob], `recette-${recipe.id}.png`, { type: 'image/png' });
                    if (nav.canShare({ files: [file] })) { await nav.share({ files: [file], title: decodeHtml(recipe.title) }); return; }
                }
            }
        } catch { /* annulé */ }
        if (url) { const a = document.createElement('a'); a.href = url; a.download = `recette-${recipe.id}.png`; a.click(); }
    };

    if (!mounted) return null;
    return createPortal(
        <div className={styles.backdrop} onClick={onClose}>
            <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
                <div className={styles.head}>
                    <span>Partager en image</span>
                    <button className={styles.close} onClick={onClose} aria-label="Fermer">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                </div>
                <div className={styles.preview}>
                    {url ? <img src={url} alt="" /> : <div className={styles.ph} />}
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                </div>
                {tainted && <p className={styles.warn}>Export bloqué (photo externe). En production : proxy image sur le domaine du site.</p>}
                <button className={styles.cta} onClick={share} disabled={!url}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" /></svg>
                    Partager / Télécharger
                </button>
            </div>
        </div>,
        document.body
    );
}
