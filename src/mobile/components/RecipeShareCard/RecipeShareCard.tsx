'use client';
/**
 * « Partager en image » : génère une carte verticale (story 9:16) sur un canvas
 * — puis propose de la partager (Web Share niveau fichier si dispo) ou de la
 * télécharger.
 *
 * Deux affiches, pas une :
 *
 *   • une RECETTE — photo en bandeau, titre, méta, QR ;
 *   • une COLLECTION — trois cartes en éventail sur un fond teinté par la photo
 *     elle-même, le nom de la collection, le compte en pastille, le QR en pied.
 *     Une seule photo ne disait pas qu'il y avait vingt-cinq recettes derrière ;
 *     la pile, si.
 *
 * Note CORS : les photos servies depuis un autre domaine « salissent » le canvas
 * et bloquent l'export. On passe donc par le proxy du site en premier, et on ne
 * retombe sur l'URL directe que s'il échoue — un aperçu sali vaut mieux qu'un
 * cadre vide.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { estimateRecipeTiming } from '@/lib/recipe-timing';
import { decodeHtml } from '@/mobile/lib/utils';
import styles from './RecipeShareCard.module.css';

/** Collection à partager : son nom, son lien, sa taille, et de quoi la montrer. */
export type ShareColl = {
    label: string;
    tag: string;
    count: number;
    /** Deux photos de la collection, pour les cartes du fond. */
    photos?: string[];
};

const W = 1080, H = 1920;
const ACCENT = '#FF6B4A';
const FOND = '#08080b';

/* ── Outils de dessin ───────────────────────────────────────────────────── */

const rrect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
};

/** Photo qui REMPLIT sa case, recadrée au centre — jamais déformée. */
const couvrir = (c: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
    const k = Math.max(w / img.width, h / img.height);
    const iw = img.width * k, ih = img.height * k;
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    c.restore();
};

/**
 * Lettres espacées, dessinées une à une.
 *
 * `ctx.letterSpacing` n'existe pas avant Safari 17 : les petites capitales s'y
 * seraient tassées. On le fait donc à la main, partout pareil.
 */
const espace = (c: CanvasRenderingContext2D, texte: string, x: number, y: number, ecart: number, centre = false) => {
    const l = [...texte].reduce((n, ch) => n + c.measureText(ch).width + ecart, -ecart);
    let cx = centre ? x - l / 2 : x;
    for (const ch of texte) { c.fillText(ch, cx, y); cx += c.measureText(ch).width + ecart; }
};

/** Découpe un titre en lignes et réduit le corps jusqu'à ce qu'il tienne. */
const titrer = (c: CanvasRenderingContext2D, texte: string, maxW: number, maxLignes: number, depart: number, mini: number) => {
    let corps = depart;
    for (;;) {
        c.font = `900 ${corps}px -apple-system, system-ui, sans-serif`;
        const lignes: string[] = [];
        let ligne = '';
        for (const mot of texte.split(' ')) {
            if (ligne && c.measureText(`${ligne} ${mot}`).width > maxW) { lignes.push(ligne); ligne = mot; }
            else ligne = ligne ? `${ligne} ${mot}` : mot;
        }
        if (ligne) lignes.push(ligne);
        const debord = lignes.some((l) => c.measureText(l).width > maxW);
        if ((!debord && lignes.length <= maxLignes) || corps <= mini) return { lignes, corps };
        corps -= 5;
    }
};

/**
 * Teinte dominante d'une photo, pour en tirer le fond de l'affiche.
 *
 * `getImageData` lève dès que le canevas est sali par une image d'un autre
 * domaine — c'est le cas quand le proxy a échoué. On retombe alors sur une
 * teinte neutre plutôt que de laisser l'affiche entière échouer.
 */
const teinte = (img: HTMLImageElement | null): ((k: number) => string) => {
    if (!img) return () => '#1a1420';
    try {
        const p = document.createElement('canvas'); p.width = p.height = 1;
        const pc = p.getContext('2d');
        if (!pc) throw new Error('pas de contexte');
        pc.drawImage(img, 0, 0, 1, 1);
        const [r, g, b] = pc.getImageData(0, 0, 1, 1).data;
        return (k: number) => `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
    } catch {
        return (k: number) => `rgb(${Math.round(70 * k)},${Math.round(52 * k)},${Math.round(92 * k)})`;
    }
};

export default function RecipeShareCard({ recipe, category, onClose }: {
    recipe: any;
    category?: ShareColl;
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
        cv.width = W; cv.height = H;

        const titreRecette = decodeHtml(recipe.title || '');
        // Devant, la recette d'où l'on partage ; derrière, deux autres de la
        // collection. Les doublons sont écartés : une même photo répétée trois
        // fois ne fait pas une pile.
        const sources = [...new Set([recipe.image, ...(category?.photos || [])].filter(Boolean))].slice(0, 3) as string[];
        const imgs: (HTMLImageElement | null)[] = [null, null, null];

        /* ── Affiche RECETTE ────────────────────────────────────────────── */
        const peindreRecette = (img: HTMLImageElement | null, qrImg: HTMLImageElement | null) => {
            const t = estimateRecipeTiming(recipe.steps);
            const title = titreRecette.toUpperCase();
            // Partagée depuis l'accueil, la recette n'a pas encore ses étapes :
            // le temps vaut alors zéro. « PLATS · 0 MIN » en travers d'une
            // affiche fait plus de mal que pas de temps du tout.
            const minutes = t.prepTime + t.cookTime;
            const cat = (recipe.category || '').toUpperCase();
            const meta = minutes ? `${cat}   ·   ${minutes} MIN` : cat;

            ctx.fillStyle = FOND; ctx.fillRect(0, 0, W, H);
            const BANDE = H * 0.56;
            if (img) couvrir(ctx, img, 0, 0, W, BANDE);
            else { ctx.fillStyle = '#1a1420'; ctx.fillRect(0, 0, W, BANDE); }
            const g = ctx.createLinearGradient(0, H * 0.26, 0, H * 0.58);
            g.addColorStop(0, 'rgba(8,8,11,0)'); g.addColorStop(1, FOND);
            ctx.fillStyle = g; ctx.fillRect(0, H * 0.24, W, H * 0.36);

            ctx.textAlign = 'left';
            const QR = 220, PAD = 16, qx = W - QR - 88, qy = H - QR - 96;
            /*
             * Le titre tient DANS sa zone, entre la photo et le QR.
             *
             * `titrer` ne surveille que la largeur : un titre de quatre lignes
             * restait à son corps de départ et sa dernière ligne venait buter
             * contre le carré blanc du QR. On le rapetisse donc tant que le bloc
             * dépasse la hauteur disponible.
             */
            const HAUT = H * 0.58 + 70;
            const BAS = qy - PAD - 56;
            let t2 = titrer(ctx, title, W - 176, 4, 104, 46);
            while (t2.corps > 46 && t2.lignes.length * (t2.corps + 10) > BAS - HAUT) {
                t2 = titrer(ctx, title, W - 176, 4, t2.corps - 6, 46);
            }
            const hBloc = t2.lignes.length * (t2.corps + 10);
            const yTitre = Math.max(HAUT, BAS - hBloc);

            ctx.fillStyle = ACCENT;
            ctx.font = '800 40px -apple-system, system-ui, sans-serif';
            ctx.fillText(meta, 88, yTitre - 46);
            ctx.fillStyle = '#fff';
            ctx.font = `900 ${t2.corps}px -apple-system, system-ui, sans-serif`;
            t2.lignes.forEach((l, i) => ctx.fillText(l, 88, yTitre + i * (t2.corps + 10) + t2.corps * 0.82));

            if (qrImg) {
                ctx.fillStyle = '#fff';
                rrect(ctx, qx - PAD, qy - PAD, QR + PAD * 2, QR + PAD * 2, 24); ctx.fill();
                ctx.drawImage(qrImg, qx, qy, QR, QR);
            }
            ctx.fillStyle = 'rgba(235,235,245,.6)';
            ctx.font = '600 44px -apple-system, system-ui, sans-serif';
            ctx.fillText('lesrecettesmagiques.fr', 88, H - 150);
            ctx.font = '600 34px -apple-system, system-ui, sans-serif';
            ctx.fillStyle = 'rgba(235,235,245,.4)';
            ctx.fillText('Scanne pour la recette', 88, H - 100);
        };

        /* ── Affiche COLLECTION : l'éventail ────────────────────────────── */
        const peindreCollection = (coll: ShareColl, qrImg: HTMLImageElement | null) => {
            const dispo = imgs.filter(Boolean) as HTMLImageElement[];
            const t = teinte(dispo[0] || null);

            const g = ctx.createLinearGradient(0, 0, W, H);
            g.addColorStop(0, t(0.62)); g.addColorStop(0.55, t(0.22)); g.addColorStop(1, '#07070a');
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
            const halo = ctx.createRadialGradient(W / 2, H * 0.30, 40, W / 2, H * 0.30, W * 0.82);
            halo.addColorStop(0, 'rgba(255,255,255,.18)'); halo.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);

            /**
             * Une carte de la pile. Celles du fond n'ont pas de titre : elles ne
             * servent qu'à dire « il y en a d'autres ». Seule celle de devant se lit.
             */
            const carte = (img: HTMLImageElement, titre: string | null, dx: number, dy: number, angle: number, k: number) => {
                const w = 640 * k, h = 820 * k;
                ctx.save();                                   // (1) repère de la carte
                ctx.translate(W / 2 + dx, H * 0.335 + dy);
                ctx.rotate(angle * Math.PI / 180);
                ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 70; ctx.shadowOffsetY = 30;
                ctx.fillStyle = '#141118'; rrect(ctx, -w / 2, -h / 2, w, h, 44 * k); ctx.fill();
                ctx.shadowColor = 'transparent';
                ctx.save();                                   // (2) découpe aux coins ronds
                rrect(ctx, -w / 2, -h / 2, w, h, 44 * k); ctx.clip();
                couvrir(ctx, img, -w / 2, -h / 2, w, titre ? h * 0.82 : h);
                if (titre) {
                    ctx.fillStyle = '#141118'; ctx.fillRect(-w / 2, -h / 2 + h * 0.82, w, h * 0.18);
                    ctx.fillStyle = 'rgba(255,255,255,.94)';
                    ctx.font = `800 ${Math.round(34 * k)}px -apple-system, system-ui, sans-serif`;
                    ctx.textAlign = 'left';
                    const court = titre.length > 24 ? `${titre.slice(0, 23)}…` : titre;
                    ctx.fillText(court, -w / 2 + 34 * k, -h / 2 + h * 0.82 + 76 * k);
                }
                ctx.restore();                                // ferme (2)
                // Sans ce second restore, la rotation d'une carte s'ajoute à la
                // suivante et la pile part en biais hors du cadre.
                ctx.restore();                                // ferme (1)
            };
            // Les cartes du fond dépassent d'un tiers : c'est ce débord qui
            // raconte la pile. Trop rentrées, elles disparaissent ; trop
            // sorties, le bord de l'affiche les coupe.
            if (dispo[1]) carte(dispo[1], null, -238, 44, -11, 0.84);
            if (dispo[2]) carte(dispo[2], null, 238, 44, 11, 0.84);
            if (dispo[0]) carte(dispo[0], titreRecette, 0, 0, 0, 1);

            /*
             * Le pied se construit DEPUIS LE BAS : le QR est un point d'ancrage,
             * pas un reste. Le domaine tient la dernière ligne, le QR juste
             * au-dessus, et le bloc de titre prend ce qui reste — quel que soit
             * le nombre de lignes du nom de la collection.
             */
            ctx.textAlign = 'center';
            const QR = 158, PAD = 13;
            const yDomaine = H - 78;
            const qy = yDomaine - 64 - QR;
            const yPastille = qy - PAD - 76 - 82;

            const tt = titrer(ctx, coll.label.toUpperCase(), W - 130, 2, 140, 58);
            const hBloc = tt.lignes.length * (tt.corps + 6);
            const yTitre = yPastille - 40 - hBloc;

            ctx.fillStyle = ACCENT; ctx.font = '800 33px -apple-system, system-ui, sans-serif';
            espace(ctx, 'LES RECETTES MAGIQUES', W / 2, yTitre - 42, 5.5, true);

            ctx.fillStyle = '#fff'; ctx.font = `900 ${tt.corps}px -apple-system, system-ui, sans-serif`;
            tt.lignes.forEach((l, n) => ctx.fillText(l, W / 2, yTitre + tt.corps * 0.82 + n * (tt.corps + 6)));

            // Pastille du compte : le chiffre se lit avant tout le reste.
            ctx.font = '800 40px -apple-system, system-ui, sans-serif';
            const texte = `${coll.count} recette${coll.count > 1 ? 's' : ''}`;
            const lp = ctx.measureText(texte).width + 78;
            ctx.fillStyle = ACCENT; rrect(ctx, W / 2 - lp / 2, yPastille, lp, 82, 41); ctx.fill();
            ctx.fillStyle = '#1b0a05'; ctx.fillText(texte, W / 2, yPastille + 56);

            if (qrImg) {
                const qx = (W - QR) / 2;
                ctx.fillStyle = '#fff'; rrect(ctx, qx - PAD, qy - PAD, QR + PAD * 2, QR + PAD * 2, 22); ctx.fill();
                ctx.drawImage(qrImg, qx, qy, QR, QR);
            }
            ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.font = '600 32px -apple-system, system-ui, sans-serif';
            ctx.fillText('lesrecettesmagiques.fr', W / 2, yDomaine);
        };

        let qrImg: HTMLImageElement | null = null;
        // La carte se dessine TOUT DE SUITE, sans attendre les photos, et se
        // redessine à chaque arrivée. L'ordre inverse laissait l'aperçu vide et
        // le bouton éteint pour toujours dès qu'une image ne répondait NI par un
        // succès NI par une erreur (hôte injoignable, connexion laissée ouverte).
        const render = () => {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.textAlign = 'left';
            if (category) peindreCollection(category, qrImg);
            else peindreRecette(imgs[0], qrImg);
            try { setUrl(cv.toDataURL('image/png')); setTainted(false); }
            catch { setTainted(true); }
        };
        render();

        /**
         * Une photo, avec sa propre limite de temps : un `<img>` peut rester en
         * attente indéfiniment, il n'a pas de délai à lui. Le proxy d'abord
         * (même origine → export possible), l'URL directe ensuite.
         */
        const charger = (src: string, rang: number) => {
            let fini = false;
            const essai = (u: string, suite?: () => void) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                const abandon = setTimeout(() => { if (!fini) { if (suite) suite(); else fini = true; } }, 6000);
                img.onload = () => {
                    if (fini) return;
                    fini = true; clearTimeout(abandon);
                    imgs[rang] = img; render();
                };
                img.onerror = () => {
                    if (fini) return;
                    clearTimeout(abandon);
                    if (suite) suite(); else fini = true;
                };
                img.src = u;
            };
            if (/^https?:\/\//i.test(src)) essai(`/api/img?url=${encodeURIComponent(src)}`, () => essai(src));
            else essai(src);
        };
        sources.forEach(charger);

        // QR en parallèle : quand il est prêt, on redessine avec le QR.
        try {
            QRCode.toDataURL(shareUrl, { margin: 0, width: 320, errorCorrectionLevel: 'M', color: { dark: '#0d0b10', light: '#ffffff' } })
                .then((durl) => { const q = new Image(); q.onload = () => { qrImg = q; render(); }; q.src = durl; })
                .catch(() => { /* pas de QR, tant pis */ });
        } catch { /* pas de QR */ }
        // `mounted` DOIT figurer ici : au premier rendu le composant renvoie null
        // (le portail n'existe pas encore), donc `canvasRef` est vide et l'effet
        // sortait aussitôt. Sans cette dépendance il ne se rejouait jamais — le
        // canevas restait à sa taille par défaut, 300 × 150, et l'aperçu vide.
    }, [recipe, category, mounted, shareUrl]);

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
        if (url) {
            const a = document.createElement('a');
            a.href = url;
            a.download = category ? `collection-${category.tag}.png` : `recette-${recipe.id}.png`;
            a.click();
        }
    };

    if (!mounted) return null;
    return createPortal(
        <div className={styles.backdrop} onClick={onClose}>
            <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
                <div className={styles.head}>
                    <span>{category ? `Partager « ${category.label} »` : 'Partager la recette'}</span>
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
