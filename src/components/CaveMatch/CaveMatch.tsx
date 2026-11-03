'use client';
/**
 * Pilule « Ma cave » dans la fiche recette : propose, parmi les vins de TA cave,
 * ceux qui vont avec le plat (bonne couleur d'abord). Choisir un vin ouvre une
 * tuile centrale « Retirer de ma cave ? » : Oui ouvre la bouteille (stock − 1,
 * la dernière part dans « Goûté & approuvé »), Non ne touche à rien. Cave vide
 * → invite à en ajouter.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { readCave, caveMatchForRecipe, openBottle, shelfOf, type CaveWine, type WineColor } from '@/lib/cave';
import styles from './CaveMatch.module.css';

const COLOR_GLASS: Record<WineColor, string> = {
    rouge: '#7b1e2b', blanc: '#e6d27a', rose: '#e08a97', liqueur: '#c98a2b',
    champagne: '#e8cf82', cidre: '#d79a3f', 'cidre-rose': '#e2a48f',
};
const COLOR_LABEL: Record<WineColor, string> = {
    rouge: 'Rouge', blanc: 'Blanc', rose: 'Rosé', liqueur: 'Liqueur',
    champagne: 'Champagne', cidre: 'Cidre', 'cidre-rose': 'Cidre rosé',
};
const vivino = (w: CaveWine) => `https://www.vivino.com/search/wines?q=${encodeURIComponent(`${w.name} ${w.region || ''}`.trim())}`;

export default function CaveMatch({ recipe }: { recipe: { title?: string; category?: string; tags?: string[]; ingredients?: any[] } }) {
    const [open, setOpen] = useState(false);
    // Le vin choisi, en attente du « Oui / Non », puis le mot qui confirme.
    const [choisi, setChoisi] = useState<CaveWine | null>(null);
    const [fait, setFait] = useState<string | null>(null);
    const [version, setVersion] = useState(0);
    const router = useRouter();
    const { ideal, wines, why } = useMemo(
        () => (open
            ? caveMatchForRecipe(recipe, readCave())
            : { ideal: 'rouge' as WineColor, wines: [] as CaveWine[], why: () => '' }),
        // `version` relit la cave après une bouteille retirée.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [open, recipe, version],
    );
    const enStock = (w: CaveWine) => shelfOf(w) === 'cave' && (w.qty ?? 0) > 0;
    const fermer = () => { setOpen(false); setChoisi(null); setFait(null); };

    const retirer = (w: CaveWine) => {
        const reste = Math.max(0, (w.qty ?? 1) - 1);
        openBottle(w.id);
        setChoisi(null);
        setVersion((v) => v + 1);
        setFait(reste > 0
            ? `C'est noté : il te reste ${reste} bouteille${reste > 1 ? 's' : ''} de ${w.name}.`
            : `Dernière bouteille de ${w.name} : elle passe dans « Goûté & approuvé ».`);
    };
    // Deux bouteilles mises en avant, pas la cave entière : c'est un conseil,
    // pas un inventaire.
    const picks = wines.slice(0, 2);

    return (
        <>
            <button type="button" className={styles.pill} onClick={() => setOpen(true)}>
                Ma cave
            </button>

            {open && createPortal(
                <div className={styles.backdrop} onClick={fermer}>
                    <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.head}>
                            <div>
                                <div className={styles.kick}>Dans ta cave</div>
                                <div className={styles.title}>Pour ce plat : un {COLOR_LABEL[ideal].toLowerCase()}</div>
                            </div>
                            <button className={styles.close} onClick={fermer} aria-label="Fermer"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
                        </div>

                        {wines.length === 0 ? (
                            <div className={styles.empty}>
                                <p>Ta cave est vide. Ajoute tes bouteilles pour des accords personnalisés.</p>
                                <button className={styles.go} onClick={() => { setOpen(false); router.push('/ma-cave'); }}>Ouvrir ma cave</button>
                            </div>
                        ) : (
                            <div className={styles.list}>
                                {fait && <div className={styles.fait} role="status">{fait}</div>}
                                {picks.map((w, i) => (
                                    <button
                                        key={w.id}
                                        type="button"
                                        className={`${styles.row} ${i === 0 && enStock(w) ? styles.rowBest : ''}`}
                                        onClick={() => {
                                            setFait(null);
                                            // Plus en cave : rien à retirer, on garde la fiche Vivino.
                                            if (enStock(w)) setChoisi(w);
                                            else window.open(vivino(w), '_blank', 'noopener');
                                        }}
                                    >
                                        {w.photo
                                            ? <img className={styles.shot} src={w.photo} alt="" />
                                            : <span className={styles.dot} style={{ background: COLOR_GLASS[w.color] }} />}
                                        <span className={styles.info}>
                                            <span className={styles.name}>{w.name}{w.year ? ` · ${w.year}` : ''}</span>
                                            <span className={styles.meta}>
                                                {enStock(w) ? `${w.qty} en cave · ${why(w)}` : `Plus en cave · ${why(w)}`}
                                            </span>
                                        </span>
                                        {i === 0 && enStock(w) && <span className={styles.best}>Mon choix</span>}
                                    </button>
                                ))}
                                <button className={styles.go} onClick={() => { fermer(); router.push('/ma-cave'); }}>
                                    {wines.length > picks.length ? `Voir mes ${wines.length} bouteilles` : 'Voir ma cave'}
                                </button>
                            </div>
                        )}
                    </div>

                    {choisi && (
                        <div className={styles.confirmFond} onClick={(e) => { e.stopPropagation(); setChoisi(null); }}>
                            <div className={styles.confirm} role="alertdialog" aria-modal="true" aria-labelledby="cave-confirm-titre" onClick={(e) => e.stopPropagation()}>
                                {choisi.photo
                                    ? <img className={styles.confirmShot} src={choisi.photo} alt="" />
                                    : <span className={styles.confirmDot} style={{ background: COLOR_GLASS[choisi.color] }} />}
                                <div id="cave-confirm-titre" className={styles.confirmTitre}>
                                    Voulez-vous retirer ce vin de votre cave ?
                                </div>
                                <div className={styles.confirmTexte}>
                                    {choisi.name}{choisi.year ? ` · ${choisi.year}` : ''}
                                    <br />
                                    {(choisi.qty ?? 1) > 1
                                        ? `Il en restera ${(choisi.qty ?? 1) - 1} sur ${choisi.qty}.`
                                        : 'C\'est la dernière : elle passera dans « Goûté & approuvé ».'}
                                </div>
                                <div className={styles.confirmBoutons}>
                                    <button type="button" className={styles.non} onClick={() => setChoisi(null)}>Non</button>
                                    <button type="button" className={styles.oui} onClick={() => retirer(choisi)} autoFocus>Oui</button>
                                </div>
                                <a className={styles.vivino} href={vivino(choisi)} target="_blank" rel="noopener noreferrer">Voir sur Vivino</a>
                            </div>
                        </div>
                    )}
                </div>,
                document.body
            )}
        </>
    );
}
