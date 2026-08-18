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

const COLOR_GLASS: Record<WineColor, string> = { rouge: '#7b1e2b', blanc: '#e6d27a', liqueur: '#c98a2b' };
const COLOR_LABEL: Record<WineColor, string> = { rouge: 'Rouge', blanc: 'Blanc', liqueur: 'Liqueur' };
const vivino = (w: CaveWine) => `https://www.vivino.com/search/wines?q=${encodeURIComponent(`${w.name} ${w.region || ''}`.trim())}`;

export default function CaveMatch({ recipe }: { recipe: { title?: string; category?: string; tags?: string[]; ingredients?: any[] } }) {
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const { ideal, wines } = useMemo(() => (open ? caveMatchForRecipe(recipe, readCave()) : { ideal: 'rouge' as WineColor, wines: [] as CaveWine[] }), [open, recipe]);

    return (
        <>
            <button type="button" className={styles.pill} onClick={() => setOpen(true)}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 22h8M12 15v7M5 3h14l-1 6a6 6 0 0 1-12 0z" /></svg>
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
                                {wines.slice(0, 6).map((w) => (
                                    <a key={w.id} className={`${styles.row} ${w.color === ideal ? styles.rowBest : ''}`} href={vivino(w)} target="_blank" rel="noopener noreferrer">
                                        <span className={styles.dot} style={{ background: COLOR_GLASS[w.color] }} />
                                        <span className={styles.info}>
                                            <span className={styles.name}>{w.name}{w.year ? ` · ${w.year}` : ''}</span>
                                            <span className={styles.meta}>{[w.grape, w.region].filter(Boolean).join(' · ')}</span>
                                        </span>
                                        {w.color === ideal && <span className={styles.best}>Idéal</span>}
                                    </a>
                                ))}
                                <button className={styles.go} onClick={() => { setOpen(false); router.push('/ma-cave'); }}>Voir toute ma cave</button>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
