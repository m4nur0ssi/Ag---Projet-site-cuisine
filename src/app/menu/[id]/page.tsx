import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import styles from './menu.module.css';

/**
 * La page d'un menu partagé.
 * ==========================
 *
 * Publique, en lecture seule, sans compte : celui qui reçoit le lien voit les
 * plats et la liste de courses, un point c'est tout. Rien n'est modifiable ici
 * — ce n'est pas son menu.
 *
 * La table n'accorde AUCUNE lecture publique : on passe par une fonction de
 * base (`menu_partage`) qui rend un menu, et seulement celui dont on donne le
 * jeton exact. Personne ne peut donc demander « la liste des menus » — et la
 * page n'a besoin d'aucune clé privilégiée pour faire son travail.
 */

export const dynamic = 'force-dynamic';

const BASE = 'https://lesrecettesmagiques.fr';

interface Plat { creneau: string; id: string; titre: string; image?: string; minutes?: number }
interface Jour { jour: string; plats: Plat[] }
interface Rayon { rayon: string; lignes: string[] }
interface Menu { mode: string; titre: string; jours: Jour[]; courses: Rayon[] }

async function lireMenu(id: string): Promise<Menu | null> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    // Un jeton, c'est douze caractères d'un alphabet connu : tout le reste est
    // écarté sans aller déranger la base.
    if (!url || !anon || !/^[a-z0-9]{6,32}$/.test(id)) return null;
    const supabase = createClient(url, anon, { auth: { persistSession: false } });
    const { data, error } = await supabase.rpc('menu_partage', { jeton: id });
    if (error) return null;
    return (data as Menu) || null;
}

/** L'image de partage : le premier plat du menu, en adresse absolue. */
function imageDePartage(menu: Menu): string | undefined {
    const src = menu.jours.flatMap((j) => j.plats).map((p) => p.image).find(Boolean);
    if (!src) return undefined;
    if (src.startsWith('http')) return src;
    return `${BASE}${src.startsWith('/') ? '' : '/'}${src}`;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
    const menu = await lireMenu(params.id);
    if (!menu) return { title: 'Menu introuvable', robots: { index: false } };

    const plats = menu.jours.flatMap((j) => j.plats).map((p) => p.titre);
    const description = plats.slice(0, 4).join(' · ') + (plats.length > 4 ? `… et ${plats.length - 4} autres` : '');
    const image = imageDePartage(menu);

    return {
        title: menu.titre,
        description,
        // Un menu partagé s'envoie à quelqu'un ; il n'a rien à faire dans les
        // résultats de recherche.
        robots: { index: false, follow: false },
        openGraph: {
            type: 'article',
            title: menu.titre,
            description,
            url: `${BASE}/menu/${params.id}`,
            images: image ? [image] : undefined,
        },
        twitter: { card: image ? 'summary_large_image' : 'summary', title: menu.titre, description, images: image ? [image] : undefined },
    };
}

export default async function PageMenuPartage({ params }: { params: { id: string } }) {
    const menu = await lireMenu(params.id);
    if (!menu) notFound();

    const nbPlats = menu.jours.reduce((n, j) => n + j.plats.length, 0);
    const nbArticles = menu.courses.reduce((n, r) => n + r.lignes.length, 0);

    return (
        <main className={styles.page}>
            <header className={styles.entete}>
                <div className={styles.kicker}>Les recettes magiques</div>
                <h1 className={styles.titre}>{menu.titre}</h1>
                <p className={styles.sous}>
                    {nbPlats} plat{nbPlats > 1 ? 's' : ''}
                    {nbArticles > 0 && <> · {nbArticles} article{nbArticles > 1 ? 's' : ''} à prendre</>}
                </p>
            </header>

            {menu.jours.map((jour) => (
                <section key={jour.jour} className={styles.jour}>
                    <h2 className={styles.jourNom}>{jour.jour}</h2>
                    <div className={styles.plats}>
                        {jour.plats.map((plat) => (
                            <a
                                key={`${jour.jour}-${plat.creneau}-${plat.id}`}
                                className={styles.plat}
                                href={plat.id ? `/recipe/${plat.id}` : '/'}
                            >
                                {plat.image
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    ? <img className={styles.vignette} src={plat.image} alt="" loading="lazy" />
                                    : <span className={styles.vignette} />}
                                <span className={styles.platTexte}>
                                    <span className={styles.creneau}>{plat.creneau}</span>
                                    <span className={styles.platNom}>{plat.titre}</span>
                                    {plat.minutes ? <span className={styles.duree}>{plat.minutes} min</span> : null}
                                </span>
                            </a>
                        ))}
                    </div>
                </section>
            ))}

            {menu.courses.length > 0 && (
                <section className={styles.courses}>
                    <h2 className={styles.coursesTitre}>La liste de courses</h2>
                    {menu.courses.map((rayon) => (
                        <div key={rayon.rayon} className={styles.rayon}>
                            <h3 className={styles.rayonNom}>{rayon.rayon}</h3>
                            <ul className={styles.lignes}>
                                {rayon.lignes.map((ligne, i) => <li key={`${rayon.rayon}-${i}`}>{ligne}</li>)}
                            </ul>
                        </div>
                    ))}
                </section>
            )}

            <footer className={styles.pied}>
                <p>Ce menu a été composé sur Les Recettes Magiques.</p>
                <a className={styles.bouton} href="/">Composer le mien</a>
            </footer>
        </main>
    );
}
