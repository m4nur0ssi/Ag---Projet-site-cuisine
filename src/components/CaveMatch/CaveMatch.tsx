'use client';
/**
 * Pilule « Ma cave » dans la fiche recette : propose, parmi les vins de TA cave,
 * ceux qui vont avec le plat (bonne couleur d'abord). Clic sur un vin → lien
 * Vivino. Cave vide → invite à en ajouter.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { readCave, caveMatchForRecipe, type CaveWine, type WineColor } from '@/lib/cave';
import styles from './CaveMatch.module.css';

const COLOR_GLASS: Record<WineColor, string> = { rouge: '#7b1e2b', blanc: '#e6d27a', rose: '#e08a97', liqueur: '#c98a2b' };
const COLOR_LABEL: Record<WineColor, string> = { rouge: 'Rouge', blanc: 'Blanc', rose: 'Rosé', liqueur: 'Liqueur' };
const vivino = (w: CaveWine) => `https://www.vivino.com/search/wines?q=${encodeURIComponent(`${w.name} ${w.region || ''}`.trim())}`;

export default function CaveMatch({ recipe }: { recipe: { title?: string; category?: string; tags?: string[]; ingredients?: any[] } }) {
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const { ideal, wines, why } = useMemo(
        () => (open
            ? caveMatchForRecipe(recipe, readCave())
            : { ideal: 'rouge' as WineColor, wines: [] as CaveWine[], why: () => '' }),
        [open, recipe],
    );
    // Deux bouteilles mises en avant, pas la cave entière : c'est un conseil,
    // pas un inventaire.
    const picks = wines.slice(0, 2);

    return (
        <>
            <button type="button" className={styles.pill} onClick={() => setOpen(true)}>
                Ma cave
            </button>

            {open && createPortal(
                <div className={styles.backdrop} onClick={() => setOpen(false)}>
                    <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.head}>
                            <div>
                                <div className={styles.kick}>Dans ta cave</div>
                                <div className={styles.title}>Pour ce plat : un {COLOR_LABEL[ideal].toLowerCase()}</div>
                            </div>
                            <button className={styles.close} onClick={() => setOpen(false)}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
                        </div>

                        {wines.length === 0 ? (
                            <div className={styles.empty}>
                                <p>Ta cave est vide. Ajoute tes bouteilles pour des accords personnalisés.</p>
                                <button className={styles.go} onClick={() => { setOpen(false); router.push('/ma-cave'); }}>Ouvrir ma cave</button>
                            </div>
                        ) : (
                            <div className={styles.list}>
                                {picks.map((w, i) => (
                                    <a key={w.id} className={`${styles.row} ${i === 0 ? styles.rowBest : ''}`} href={vivino(w)} target="_blank" rel="noopener noreferrer">
                                        {w.photo
                                            ? <img className={styles.shot} src={w.photo} alt="" />
                                            : <span className={styles.dot} style={{ background: COLOR_GLASS[w.color] }} />}
                                        <span className={styles.info}>
                                            <span className={styles.name}>{w.name}{w.year ? ` · ${w.year}` : ''}</span>
                                            <span className={styles.meta}>{why(w)}</span>
                                        </span>
                                        {i === 0 && <span className={styles.best}>Mon choix</span>}
                                    </a>
                                ))}
                                <button className={styles.go} onClick={() => { setOpen(false); router.push('/ma-cave'); }}>
                                    {wines.length > picks.length ? `Voir mes ${wines.length} bouteilles` : 'Voir ma cave'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
