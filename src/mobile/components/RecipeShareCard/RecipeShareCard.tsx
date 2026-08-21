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
import QRCode from 'qrcode';
import { estimateRecipeTiming } from '@/lib/recipe-timing';
import { decodeHtml } from '@/mobile/lib/utils';
import styles from './RecipeShareCard.module.css';

/**
 * `category` transforme la carte en affiche de COLLECTION : le nom du thème en
 * grand, une photo prise parmi ses recettes, le QR vers la collection — et
 * aucun titre de recette, puisque ce n'est pas une recette qu'on partage.
 */
export default function RecipeShareCard({ recipe, category, onClose }: {
    recipe: any;
    category?: { label: string; tag: string; count: number };
    onClose: () => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [url, setUrl] = useState('');
    const [tainted, setTainted] = useState(false);
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const shareUrl = category
        ? `https://lesrecettesmagiques.fr/?tag=${encodeURIComponent(category.tag)}`
        : `https://lesrecettesmagiques.fr/?fiche=${recipe.id}`;

    useEffect(() => {
        const cv = canvasRef.current; if (!cv) return;
        const ctx = cv.getContext('2d'); if (!ctx) return;
        const W = 1080, H = 1920; cv.width = W; cv.height = H;
        const t = estimateRecipeTiming(recipe.steps);
        const title = (category ? category.label : decodeHtml(recipe.title || '')).toUpperCase();
        const meta = category
            ? `LES RECETTES MAGIQUES   ·   ${category.count} RECETTE${category.count > 1 ? 'S' : ''}`
            : `${(recipe.category || '').toUpperCase()}   ·   ${(t.prepTime + t.cookTime)} MIN`;

        let qrImg: HTMLImageElement | null = null;

        const paint = (img: HTMLImageElement | null) => {
            ctx.fillStyle = '#08080b'; ctx.fillRect(0, 0, W, H);
            if (img) {
                const ratio = Math.max(W / img.width, (H * 0.56) / img.height);
                const w = img.width * ratio, h = img.height * ratio;
                ctx.drawImage(img, (W - w) / 2, 0, w, h);
            } else { ctx.fillStyle = '#1a1420'; ctx.fillRect(0, 0, W, H * 0.56); }
            const g = ctx.createLinearGradient(0, H * 0.26, 0, H * 0.58);
            g.addColorStop(0, 'rgba(8,8,11,0)'); g.addColorStop(1, '#08080b');
            ctx.fillStyle = g; ctx.fillRect(0, H * 0.24, W, H * 0.36);

            ctx.textAlign = 'left';
            const maxW = W - 176;

            /**
             * Le bloc de texte doit tenir DANS sa zone, entre la photo et le pied
             * de carte. L'ancienne version posait le titre à une hauteur fixe et
             * espaçait ses lignes de 112 px : un titre de trois lignes passait
             * sous le QR code et se faisait couper au bas de l'image.
             *
             * On calcule donc d'abord le découpage, puis on réduit le corps
             * jusqu'à ce que le tout tienne en largeur ET en hauteur.
             */
            // La photo s'arrête à 56 % : le tiers restant appartient au texte, qui
            // doit rester GRAND. À 64 % de photo, le titre se réduisait jusqu'à
            // devenir illisible sur une vignette de messagerie.
            const HAUT_TEXTE = H * 0.58;
            const BAS_TEXTE = H - 330;                // au-dessus du QR et du domaine
            const decouper = (taille: number): string[] => {
                ctx.font = `900 ${taille}px -apple-system, system-ui, sans-serif`;
                const lignes: string[] = [];
                let ligne = '';
                for (const mot of title.split(' ')) {
                    if (ctx.measureText(ligne + mot).width > maxW && ligne) { lignes.push(ligne.trim()); ligne = ''; }
                    ligne += mot + ' ';
                }
                if (ligne.trim()) lignes.push(ligne.trim());
                return lignes;
            };
            let corps = 104;
            let lignes = decouper(corps);
            while (corps > 46) {
                const troplarge = lignes.some((l) => ctx.measureText(l).width > maxW);
                const trophaut = lignes.length * (corps + 10) > BAS_TEXTE - HAUT_TEXTE - 70;
                if (!troplarge && !trophaut) break;
                corps -= 6;
                lignes = decouper(corps);
            }

            // Le bloc est calé sur le BAS de sa zone : la respiration se fait
            // au-dessus, contre la photo, jamais contre le pied de carte.
            const hauteurBloc = lignes.length * (corps + 10);
            const yTitre = Math.max(HAUT_TEXTE + 70, BAS_TEXTE - hauteurBloc) ;

            ctx.fillStyle = '#FF6B4A';
            ctx.font = '800 40px -apple-system, system-ui, sans-serif';
            ctx.fillText(meta, 88, yTitre - 46);

            ctx.fillStyle = '#fff';
            ctx.font = `900 ${corps}px -apple-system, system-ui, sans-serif`;
            lignes.forEach((l, i) => ctx.fillText(l, 88, yTitre + i * (corps + 10) + corps * 0.82));

            // QR en bas à droite : le lien de la recette voyage avec l'image,
            // même là où le texte-lien disparaît (stories Instagram/TikTok).
            const QR = 220, qx = W - QR - 88, qy = H - QR - 96;
            if (qrImg) {
                const pad = 16, r = 24;
                ctx.fillStyle = '#fff';
                roundRect(ctx, qx - pad, qy - pad, QR + pad * 2, QR + pad * 2, r); ctx.fill();
                ctx.drawImage(qrImg, qx, qy, QR, QR);
            }

            ctx.fillStyle = 'rgba(235,235,245,.6)';
            ctx.font = '600 44px -apple-system, system-ui, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('lesrecettesmagiques.fr', 88, H - 150);
            ctx.font = '600 34px -apple-system, system-ui, sans-serif';
            ctx.fillStyle = 'rgba(235,235,245,.4)';
            ctx.fillText('Scanne pour la recette', 88, H - 100);

            try { setUrl(cv.toDataURL('image/png')); setTainted(false); }
            catch { setTainted(true); }
        };

        const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rad: number) => {
            c.beginPath();
            c.moveTo(x + rad, y);
            c.arcTo(x + w, y, x + w, y + h, rad);
            c.arcTo(x + w, y + h, x, y + h, rad);
            c.arcTo(x, y + h, x, y, rad);
            c.arcTo(x, y, x + w, y, rad);
            c.closePath();
        };

        // La carte se dessine TOUT DE SUITE, sans attendre la photo, et se
        // redessine quand celle-ci arrive. L'ordre inverse — attendre la photo
        // pour dessiner — laissait l'aperçu vide et le bouton éteint pour
        // toujours dès que l'image ne répondait NI par un succès NI par une
        // erreur (hôte injoignable qui laisse la connexion ouverte).
        let photoImg: HTMLImageElement | null = null;
        const render = () => paint(photoImg);
        render();

        let fini = false;
        /**
         * Une tentative de chargement, avec sa propre limite de temps : un
         * `<img>` peut rester en attente indéfiniment, il n'a pas de délai.
         */
        const load = (src: string, next?: () => void) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            const abandon = setTimeout(() => { if (!fini) { if (next) next(); else fini = true; } }, 6000);
            img.onload = () => {
                if (fini) return;
                fini = true; clearTimeout(abandon);
                photoImg = img; render();
            };
            img.onerror = () => {
                if (fini) return;
                clearTimeout(abandon);
                if (next) next(); else fini = true;
            };
            img.src = src;
        };
        // Le proxy d'abord (même origine → export possible), la photo directe
        // ensuite : elle salira le canevas, mais mieux vaut un aperçu qu'un vide.
        if (recipe.image) {
            if (/^https?:\/\//i.test(recipe.image)) load(`/api/img?url=${encodeURIComponent(recipe.image)}`, () => load(recipe.image));
            else load(recipe.image);
        }

        // QR en parallèle : quand il est prêt, on redessine avec le QR.
        try {
            QRCode.toDataURL(shareUrl, { margin: 0, width: 220, errorCorrectionLevel: 'M', color: { dark: '#0d0b10', light: '#ffffff' } })
                .then((durl) => { const q = new Image(); q.onload = () => { qrImg = q; render(); }; q.src = durl; })
                .catch(() => { /* pas de QR, tant pis */ });
        } catch { /* pas de QR */ }
        // `mounted` DOIT figurer ici : au premier rendu le composant renvoie null
        // (le portail n'existe pas encore), donc `canvasRef` est vide et l'effet
        // sortait aussitôt. Sans cette dépendance il ne se rejouait jamais — le
        // canevas restait à sa taille par défaut, 300 × 150, et l'aperçu vide.
    }, [recipe, category, mounted]);

    const share = async () => {
        const title = category ? category.label : decodeHtml(recipe.title);
        const text = category
            ? `${title} sur Les Recettes Magiques : ${shareUrl}`
            : `${title} — la recette : ${shareUrl}`;
        try {
            const nav = navigator as any;
            if (url && nav.canShare && canvasRef.current) {
                const blob: Blob | null = await new Promise((res) => canvasRef.current!.toBlob(res as any, 'image/png'));
                if (blob) {
                    const file = new File([blob], category ? `collection-${category.tag}.png` : `recette-${recipe.id}.png`, { type: 'image/png' });
                    // Image + lien + texte : le destinataire reçoit la photo ET le
                    // lien cliquable (là où l'app le supporte).
                    if (nav.canShare({ files: [file] })) {
                        await nav.share({ files: [file], title, text, url: shareUrl });
                        return;
                    }
                }
            }
            // Pas de partage de fichier possible → au moins le lien.
            if (nav.share) { await nav.share({ title, text, url: shareUrl }); return; }
        } catch { /* annulé */ }
        if (url) { const a = document.createElement('a'); a.href = url; a.download = `recette-${recipe.id}.png`; a.click(); }
    };

    if (!mounted) return null;
    return createPortal(
        <div className={styles.backdrop} onClick={onClose}>
            <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
                <div className={styles.head}>
                    <span>{category ? 'Partager la collection' : 'Partager la recette'}</span>
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
