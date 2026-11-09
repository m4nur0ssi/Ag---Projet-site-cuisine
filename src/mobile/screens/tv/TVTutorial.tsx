'use client';

/**
 * Visite guidée « Apple TV+ » (mobile ET desktop — le desktop rend le même
 * composant en modale). Un écran = une idée, balayé horizontalement.
 *
 * Chaque étape porte désormais une VRAIE petite scène illustrée (SVG) qui
 * dépeint l'écran décrit — héros, rangées, appui long, fiche, filtres,
 * recherche, planificateur, liste… — au lieu d'une simple icône de trait.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { haptic } from './TVHome';
import styles from './TVTutorial.module.css';
import TutoScene, { aSceneReelle } from '@/components/TutoScene/TutoScene';
import DemoVideo from '@/components/DemoVideo/DemoVideo';
import { etapesTuto, marquerAstuceVue, type Art, type Step } from '@/lib/tutoriel';

/** Mini-scène illustrée d'une étape. Cadre commun + contenu spécifique. */
function Illus({ kind, accent }: { kind: Art; accent: string }) {
    const c = accent;
    const soft = 'rgba(255,255,255,0.10)';
    const soft2 = 'rgba(255,255,255,0.18)';
    const frame = (children: React.ReactNode) => (
        <svg className={styles.art} viewBox="0 0 220 150" fill="none" aria-hidden>
            <defs>
                <linearGradient id={`g-${kind}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={c} stopOpacity="0.9" />
                    <stop offset="1" stopColor={c} stopOpacity="0.4" />
                </linearGradient>
            </defs>
            {children}
        </svg>
    );
    const r = (x: number, y: number, w: number, h: number, rad = 6, fill = soft, stroke?: string) => (
        <rect x={x} y={y} width={w} height={h} rx={rad} fill={fill} stroke={stroke} strokeWidth={stroke ? 1 : 0} />
    );

    switch (kind) {
        case 'tags': return frame(<>
            {r(60, 8, 100, 66, 12, `url(#g-${kind})`)}
            {[['#ITALIE', 36], ['#PÂTES', 92], ['#EXPRESS', 148]].map(([t, x], k) => (
                <g key={t as string} className={k === 0 ? styles.pulse : undefined}>
                    {r(x as number, 82, 50, 16, 8, k === 0 ? c : soft2)}
                    <text x={(x as number) + 25} y="93" textAnchor="middle" fontSize="7" fontWeight="700" fill={k === 0 ? '#111' : '#fff'}>{t}</text>
                </g>
            ))}
            <circle className={styles.tap} cx="61" cy="90" r="9" fill="#fff" fillOpacity="0.85" />
            {[0, 1, 2, 3, 4, 5].map((k) => r(30 + (k % 6) * 27, 112, 22, 28, 5, k % 2 ? soft : `url(#g-${kind})`))}
        </>);
        case 'timers': return frame(<>
            {r(30, 8, 160, 78, 14, 'rgba(30,30,34,0.95)', soft2)}
            {[18, 50].map((y, k) => (
                <g key={y}>
                    {r(40, y, 26, 26, 6, k === 0 ? `url(#g-${kind})` : soft2)}
                    {r(72, y + 5, 54, 7, 3, soft2)}{r(72, y + 15, 36, 5, 3, soft)}
                    <text x="150" y={y + 17} textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff">{k === 0 ? '3:12' : '14:05'}</text>
                    <circle cx="176" cy={y + 13} r="7" fill={soft2} />
                    <path d={`M173 ${y + 10}l6 6M179 ${y + 10}l-6 6`} stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
                </g>
            ))}
            {r(30, 106, 130, 30, 15, 'rgba(30,30,34,0.95)', soft2)}
            <g className={styles.pulse}>
                <circle cx="176" cy="121" r="15" fill={c} />
                <text x="176" y="125" textAnchor="middle" fontSize="9" fontWeight="800" fill="#111">3:12</text>
            </g>
        </>);
        case 'demarrer': return frame(<>
            {['19:05', '19:20', '19:40', '20:00'].map((t, k) => (
                <g key={t}>
                    {r(20, 54 + k * 22, 180, 17, 6, k === 0 ? soft2 : soft)}
                    <text x="30" y={66 + k * 22} fontSize="8" fontWeight="800" fill="#fff">{t}</text>
                    {r(62, 59 + k * 22, 100 - k * 12, 7, 3, k === 0 ? c : soft2)}
                </g>
            ))}
            <g className={styles.drop}>
                {r(24, 6, 172, 40, 12, 'rgba(48,22,14,0.95)', c)}
                <text x="34" y="20" fontSize="8" fontWeight="800" fill={c}>19:05 · C’EST L’HEURE</text>
                {r(34, 27, 70, 13, 6, '#fff')}<text x="69" y="36" textAnchor="middle" fontSize="7" fontWeight="800" fill="#111">OK, c’est fait</text>
                {r(110, 27, 70, 13, 6, soft2)}<text x="145" y="36" textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff">Dans 10 min</text>
            </g>
        </>);
        case 'plus': return frame(<>
            {r(20, 10, 180, 20, 9, soft)}
            <text x="51" y="23" fontSize="8" fill="#bbb" textAnchor="middle">Semaine</text>
            <text x="110" y="23" fontSize="8" fill="#bbb" textAnchor="middle">Jour/jour</text>
            {r(146, 13, 50, 14, 6, '#fff')}<text x="171" y="23" fontSize="8" fontWeight="700" fill="#111" textAnchor="middle">En +</text>
            {r(20, 40, 180, 100, 12, soft)}
            {r(30, 48, 30, 30, 7, `url(#g-${kind})`)}{r(68, 56, 90, 9, 4, soft2)}
            {[88, 104, 120].map((y) => (<g key={y}><circle cx="36" cy={y + 4} r="4" stroke="#fff" strokeWidth="1.6" />{r(46, y, 140, 8, 4, soft2)}</g>))}
            <circle className={styles.tap} cx="45" cy="63" r="9" fill="#fff" fillOpacity="0.85" />
        </>);
        case 'hero': return frame(<>
            {r(30, 12, 160, 96, 14, `url(#g-${kind})`)}
            {r(46, 84, 60, 12, 6, 'rgba(0,0,0,0.35)')}
            <path d="M150 84h26a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-26z" fill="#fff" />
            <path d="M18 60l-8 0M10 60l4-4M10 60l4 4" stroke={soft2} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M202 60l8 0M210 60l-4-4M210 60l-4 4" stroke={soft2} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            {r(78, 118, 64, 10, 5)}
        </>);
        case 'rows': return frame(<>
            {r(16, 14, 90, 10, 5, soft2)}
            {[30, 68, 106].map((y, k) => (
                <g key={k}>
                    {[16, 58, 100, 142, 184].map((x) => r(x, y, 34, 26, 6, k === 1 ? `url(#g-${kind})` : soft))}
                </g>
            ))}
        </>);
        case 'press': return frame(<>
            {r(28, 22, 96, 106, 12, `url(#g-${kind})`)}
            <circle cx="76" cy="86" r="10" fill="#fff" />
            <circle cx="76" cy="86" r="20" stroke="#fff" strokeOpacity="0.6" strokeWidth="2" />
            <circle cx="76" cy="86" r="30" stroke="#fff" strokeOpacity="0.3" strokeWidth="2" />
            {r(132, 30, 74, 88, 12, 'rgba(30,30,34,0.95)', soft2)}
            {[42, 60, 78, 96].map((y) => r(142, y, 54, 8, 4, soft2))}
        </>);
        case 'card': return frame(<>
            {r(44, 10, 132, 44, 12, `url(#g-${kind})`)}
            {r(44, 62, 132, 78, 12, soft)}
            {[72, 92, 112].map((y) => (<g key={y}><circle cx="58" cy={y} r="5" stroke={c} strokeWidth="2" />{r(72, y - 4, 74, 8, 4, soft2)}</g>))}
            {r(150, 66, 22, 12, 6, c)}
        </>);
        case 'filter': return frame(<>
            {r(14, 12, 74, 126, 12, soft)}
            {r(24, 24, 40, 8, 4, soft2)}
            {[40, 56, 72, 88, 104].map((y, k) => (<g key={y}>{r(24, y, 54, 10, 5, k < 2 ? c : soft2)}{k < 2 && <path d="M70 72" />}</g>))}
            {r(100, 12, 106, 126, 12, soft)}
            {[24, 60, 96].map((y) => (<g key={y}>{r(110, y, 40, 28, 6, `url(#g-${kind})`)}{r(156, y, 40, 28, 6, soft2)}</g>))}
        </>);
        case 'search': return frame(<>
            {r(24, 16, 172, 22, 11, soft)}
            <circle cx="40" cy="27" r="6" stroke={c} strokeWidth="2.4" /><path d="M45 32l5 5" stroke={c} strokeWidth="2.4" strokeLinecap="round" />
            {r(24, 48, 172, 22, 8, soft)}
            {r(28, 51, 55, 16, 6, '#fff')}
            <text x="55" y="63" textAnchor="middle" fontSize="9" fontWeight="700" fill="#111">Recette</text>
            <text x="118" y="63" textAnchor="middle" fontSize="9" fill="#bbb">Frigo</text>
            <text x="170" y="63" textAnchor="middle" fontSize="9" fill="#bbb">Assistant</text>
            {[82, 102, 122].map((y) => r(24, y, 172, 12, 6, soft2))}
        </>);
        case 'planner': return frame(<>
            {r(20, 12, 180, 16, 8, soft)}
            {[26, 52, 78, 104, 130, 156, 182].map((x, k) => <circle key={x} cx={x} cy={20} r="7" fill={k === 2 ? c : soft2} />)}
            {r(20, 40, 180, 44, 10, `url(#g-${kind})`)}<text x="30" y="52" fontSize="8" fill="#fff" fillOpacity="0.85">MIDI</text>
            {r(20, 92, 180, 44, 10, soft)}<text x="30" y="104" fontSize="8" fill="#fff" fillOpacity="0.6">SOIR</text>
        </>);
        case 'side': return frame(<>
            {r(40, 14, 140, 56, 12, `url(#g-${kind})`)}
            <text x="52" y="46" fontSize="10" fill="#fff" fillOpacity="0.9">Plat servi nu</text>
            {r(60, 82, 120, 46, 12, soft, soft2)}
            <path d="M110 70v10" stroke={soft2} strokeWidth="2" />
            <text x="74" y="109" fontSize="9" fill={c}>+ Accompagnement</text>
        </>);
        case 'compose': return frame(<>
            {[16, 58, 100, 142, 184].map((x) => [22, 60, 98].map((y, k) => r(x, y, 34, 30, 6, (x + y) % 3 === 0 ? `url(#g-${kind})` : soft)))}
            <path d="M170 20l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#fff" />
        </>);
        case 'jourj': return frame(<>
            {r(20, 12, 180, 16, 8, soft)}{r(112, 14, 84, 12, 6, '#fff')}
            <text x="66" y="23" fontSize="8" fill="#bbb" textAnchor="middle">Semaine</text>
            <text x="154" y="23" fontSize="8" fill="#111" textAnchor="middle" fontWeight="700">Jour J</text>
            {['Apéritif', 'Entrée', 'Plat', 'Dessert'].map((t, k) => (<g key={t}>{r(20, 38 + k * 26, 180, 20, 6, k === 2 ? `url(#g-${kind})` : soft)}<text x="30" y={52 + k * 26} fontSize="8" fill="#fff" fillOpacity="0.8">{t}</text></g>))}
        </>);
        case 'fill': return frame(<>
            {r(14, 24, 74, 100, 10, soft)}{[36, 54, 72, 90].map((y) => r(24, y, 54, 8, 4, soft2))}
            <path d="M96 74h28M124 74l-6-5M124 74l-6 5" stroke={c} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            {r(132, 24, 74, 100, 10, `url(#g-${kind})`)}{[36, 54, 72, 90].map((y) => (<g key={y}><circle cx="144" cy={y + 4} r="4" stroke="#fff" strokeWidth="1.6" />{r(154, y, 44, 8, 4, 'rgba(0,0,0,0.25)')}</g>))}
        </>);
        case 'views': return frame(<>
            {r(20, 14, 180, 20, 9, soft)}
            {r(24, 17, 54, 14, 6, '#fff')}<text x="51" y="27" fontSize="8" fontWeight="700" fill="#111" textAnchor="middle">Semaine</text>
            <text x="112" y="27" fontSize="8" fill="#bbb" textAnchor="middle">Jour/jour</text>
            <text x="172" y="27" fontSize="8" fill="#bbb" textAnchor="middle">En +</text>
            {r(20, 42, 90, 8, 4, c)}
            {[56, 74, 92, 110].map((y) => (<g key={y}><circle cx="30" cy={y + 4} r="4" stroke="#fff" strokeWidth="1.6" />{r(40, y, 160, 8, 4, soft2)}</g>))}
        </>);
        case 'cocktail': return frame(<>
            <path d="M70 44h80l-34 40v26h-12V84z" fill={`url(#g-${kind})`} stroke={soft2} strokeWidth="1.5" />
            {r(96, 118, 28, 8, 4, soft2)}
            <circle cx="150" cy="40" r="7" fill="#FFD24B" />
            <path d="M150 33v-8M150 25l-3 3M150 25l3 3" stroke="#FFD24B" strokeWidth="2" strokeLinecap="round" />
            <path d="M60 60l-8-4M62 74h-9" stroke={soft2} strokeWidth="2" strokeLinecap="round" />
        </>);
        case 'dock': return frame(<>
            {r(30, 92, 160, 34, 17, 'rgba(30,30,34,0.95)', soft2)}
            {[54, 88, 122, 156].map((x, k) => <circle key={x} cx={x} cy={109} r="8" fill={k === 2 ? soft2 : soft} />)}
            <circle cx="176" cy="109" r="12" fill={c} />
            <circle cx="176" cy="106" r="4" stroke="#fff" strokeWidth="2" /><path d="M179 109l3 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            {r(60, 26, 100, 52, 10, `url(#g-${kind})`)}
        </>);
        case 'ext': return frame(<>
            {/* Fenêtre du magasin + panneau de la liste posé par-dessus. */}
            {r(14, 18, 192, 110, 10, 'rgba(255,255,255,0.06)', soft2)}
            {r(14, 18, 192, 16, 10, soft)}
            {[24, 34, 44].map((x) => <circle key={x} cx={x} cy={26} r="3" fill={soft2} />)}
            {r(26, 46, 74, 44, 8, soft)}
            {r(26, 98, 52, 8, 4, soft)}
            {r(122, 44, 70, 74, 10, `url(#g-${kind})`)}
            {[56, 72, 88, 104].map((y) => (
                <g key={y}>
                    <path d={`M132 ${y}l4 4 7-8`} stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    {r(148, y - 4, 34, 6, 3, 'rgba(255,255,255,0.55)')}
                </g>
            ))}
        </>);
        case 'cave': return frame(<>
            {/* Étagère de cave : trois bouteilles, celle du milieu mise en avant. */}
            {r(24, 116, 172, 8, 4, soft2)}
            {[54, 166].map((x) => (
                <g key={x}>
                    <path d={`M${x - 6} 116V70c0-6 2-8 2-14V44h8v12c0 6 2 8 2 14v46z`} fill={soft} />
                    {r(x - 6, 86, 12, 12, 2, soft2)}
                </g>
            ))}
            <path d="M104 116V64c0-7 3-9 3-16V32h6v16c0 7 3 9 3 16v52z" fill={`url(#g-${kind})`} />
            {r(104, 78, 12, 16, 2, 'rgba(255,255,255,0.75)')}
            {/* Verre servi, à droite. */}
            <path d="M176 24h20l-3 14a7 7 0 0 1-14 0z" fill={c} opacity="0.85" />
            <path d="M186 38v10M180 48h12" stroke={soft2} strokeWidth="2" strokeLinecap="round" />
        </>);
        case 'clic': return frame(<>
            {/* Curseur sur une carte + menu contextuel ouvert à côté. */}
            {r(20, 24, 92, 102, 12, `url(#g-${kind})`)}
            <path d="M64 76l0 30 8-8 6 12 6-3-6-12 11 0z" fill="#fff" stroke="#111" strokeWidth="1.4" strokeLinejoin="round" />
            {r(120, 30, 84, 90, 12, 'rgba(30,30,34,0.95)', soft2)}
            {[42, 60, 78, 96].map((y) => r(130, y, 64, 8, 4, soft2))}
        </>);
        case 'cook': return frame(<>
            {/* Une étape en grand + le minuteur qui tourne. */}
            {r(16, 16, 128, 118, 12, soft)}
            <text x="30" y="40" fontSize="9" fill="#fff" fillOpacity="0.5">ÉTAPE 3 / 7</text>
            {[54, 70, 86].map((y) => r(30, y, 100, 8, 4, soft2))}
            {r(30, 106, 60, 16, 8, '#fff')}
            <circle cx="178" cy="70" r="28" stroke={soft2} strokeWidth="5" />
            <path d="M178 42a28 28 0 0 1 20 47" stroke={c} strokeWidth="5" strokeLinecap="round" />
            <text x="178" y="74" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff">8:00</text>
        </>);
        case 'sidebar': return frame(<>
            {/* La barre latérale, et la page qui vit à sa droite. */}
            {r(10, 10, 62, 130, 10, 'rgba(30,30,34,0.95)', soft2)}
            {r(20, 20, 34, 8, 4, soft2)}
            {[38, 54, 70, 86, 102, 118].map((y, k) => (
                <g key={y}>
                    <circle cx="27" cy={y + 4} r="4" fill={k === 0 ? c : soft2} />
                    {r(37, y, k === 0 ? 28 : 24, 8, 4, k === 0 ? `url(#g-${kind})` : soft2)}
                </g>
            ))}
            {r(82, 10, 128, 44, 10, soft)}
            {[62, 100].map((y) => [82, 126, 170].map((x) => r(x, y, 38, 32, 6, soft)))}
        </>);
        case 'library': return frame(<>
            {/* Une pastille glissée depuis la liste vers la bibliothèque épinglée. */}
            {r(10, 10, 76, 130, 10, 'rgba(30,30,34,0.95)', soft2)}
            <text x="20" y="26" fontSize="8" fill="#fff" fillOpacity="0.5">BIBLIOTHÈQUE</text>
            {[34, 50].map((y) => r(20, y, 56, 10, 5, `url(#g-${kind})`))}
            {r(20, 66, 56, 1, 0.5, soft2)}
            {[76, 92, 108, 124].map((y) => r(20, y, 56, 10, 5, soft))}
            <path d="M96 100c22-6 30-30 50-40" stroke={soft2} strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
            {r(140, 46, 56, 12, 6, c)}
            <path d="M150 66l0 22 6-6 5 9 5-2-5-9 8 0z" fill="#fff" stroke="#111" strokeWidth="1.2" strokeLinejoin="round" />
        </>);
        case 'trophy': return frame(<>
            {/* Six badges, quatre débloqués. */}
            {[0, 1, 2].map((col) => [0, 1].map((ligne) => {
                const x = 24 + col * 60; const y = 22 + ligne * 58; const on = col + ligne * 3 < 4;
                return (
                    <g key={`${col}-${ligne}`}>
                        <circle cx={x + 20} cy={y + 20} r="19" fill={on ? `url(#g-${kind})` : soft} stroke={soft2} strokeWidth="1" />
                        <path d={`M${x + 14} ${y + 28}h12M${x + 20} ${y + 24}v4M${x + 14} ${y + 12}h12v5a6 6 0 0 1-12 0z`}
                            stroke={on ? '#fff' : soft2} strokeWidth="1.8" strokeLinecap="round" fill="none" />
                        {r(x + 6, y + 44, 28, 5, 2.5, on ? soft2 : soft)}
                    </g>
                );
            }))}
        </>);
        case 'taste': return frame(<>
            {/* Le paquet de cartes, celle du dessus partie à droite. */}
            {r(52, 26, 84, 100, 12, soft)}
            {r(62, 20, 84, 106, 12, soft2)}
            <g transform="rotate(9 130 70)">
                {r(96, 14, 88, 112, 12, `url(#g-${kind})`)}
            </g>
            <path d="M172 46c3-5 11-3 11 3 0 6-7 10-11 13-4-3-11-7-11-13 0-6 8-8 11-3z" fill="#fff" />
            <path d="M34 62l14 14M48 62l-14 14" stroke={soft2} strokeWidth="3" strokeLinecap="round" />
        </>);
        case 'install': return frame(<>
            {/* L'icône qui saute de la fenêtre vers l'écran d'accueil. */}
            {r(14, 22, 84, 96, 12, soft, soft2)}
            {r(24, 32, 64, 10, 5, soft2)}
            {r(38, 58, 36, 36, 9, `url(#g-${kind})`)}
            <path d="M104 70h28M132 70l-7-6M132 70l-7 6" stroke={soft2} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            {r(142, 14, 64, 122, 14, 'rgba(30,30,34,0.95)', soft2)}
            {[26, 62].map((y) => [150, 182].map((x) => r(x, y, 24, 24, 7, soft)))}
            {r(150, 98, 24, 24, 7, `url(#g-${kind})`)}
            {r(182, 98, 24, 24, 7, soft)}
        </>);
        default: return frame(null);
    }
}

/**
 * `embedded` : rendu DANS le shell desktop TV+ (panneau, menu à gauche) au lieu
 * du calque plein écran — même moule que Favoris et la Recherche.
 */
export default function TVTutorial({ onClose, embedded = false }: { onClose: () => void; embedded?: boolean }) {
    const [i, setI] = useState(0);
    const [mounted, setMounted] = useState(false);
    const pagerRef = useRef<HTMLDivElement>(null);

    /*
     * `embedded` n'est vrai que dans le shell de bureau (TVDesktopHome) ; le
     * téléphone rend toujours le calque plein écran. C'est donc aussi le
     * signal le plus sûr de la plateforme — plus sûr qu'une largeur d'écran,
     * qui ment sur un iPad en paysage ou une fenêtre étroite.
     */
    /*
     * LA VISITE EST FILMÉE, désormais.
     *
     * Les dessins expliquaient l'application ; les vidéos la MONTRENT en train
     * de servir, doigt compris. On ne garde donc que les étapes qui ont leur
     * démonstration — une visite mi-dessinée mi-filmée ferait douter de ce qu'on
     * voit. Les scènes restantes se tournent avec `npm run tuto:videos`, et
     * l'étape apparaît d'elle-même dès que la vidéo existe.
     *
     * Les listes dessinées (`STEPS_MOBILE`, `STEPS_BUREAU`) restent en réserve :
     * elles servent de filet si aucune vidéo n'est encore tournée.
     */
    const STEPS: Step[] = etapesTuto(embedded);

    useEffect(() => { setMounted(true); }, []);

    // L'étape vue ici vaut la bulle d'astuce qui la montre ailleurs : elle ne
    // reviendra pas expliquer ce qu'on vient de lire (registre commun).
    const astuceAffichee = STEPS[i]?.astuce;
    useEffect(() => { if (astuceAffichee) marquerAstuceVue(astuceAffichee); }, [astuceAffichee]);

    useEffect(() => {
        // En panneau, la page derrière n'est pas recouverte : on ne fige rien.
        if (embedded) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [embedded]);

    const onScroll = useCallback(() => {
        const el = pagerRef.current;
        if (!el) return;
        const next = Math.round(el.scrollLeft / el.clientWidth);
        setI((v) => (v === next ? v : Math.min(STEPS.length - 1, Math.max(0, next))));
    }, [STEPS.length]);

    const goTo = (n: number) => {
        const el = pagerRef.current;
        if (!el) return;
        const left = n * el.clientWidth;
        const before = el.scrollLeft;
        setI(n);
        el.scrollTo({ left, behavior: 'smooth' });
        window.setTimeout(() => { if (el.scrollLeft === before) el.scrollLeft = left; }, 260);
    };

    const next = () => {
        haptic(8);
        if (i >= STEPS.length - 1) onClose();
        else goTo(i + 1);
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight' && i < STEPS.length - 1) goTo(i + 1);
            if (e.key === 'ArrowLeft' && i > 0) goTo(i - 1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [i, onClose, STEPS.length]);

    if (!mounted) return null;

    const step = STEPS[i];

    const body = (
        <>
            <div className={styles.glow} style={{ background: step.tint }} />

            {embedded && (
                <div className={styles.panelHead}>
                    <div className={styles.panelKicker}>Visite guidée</div>
                    <h1 className={styles.panelTitle}>Tutoriel</h1>
                    <p className={styles.panelSub}>La visite guidée du site, écran par écran.</p>
                </div>
            )}

            <header className={styles.head}>
                <div className={styles.bar}>
                    <div className={styles.barFill} style={{ width: `${((i + 1) / STEPS.length) * 100}%` }} />
                </div>
                {!embedded && <button className={styles.skip} onClick={onClose}>Passer</button>}
            </header>

            <div className={styles.pager} ref={pagerRef} onScroll={onScroll}>
                {STEPS.map((s, n) => (
                    <section className={`${styles.slide} ${n === i ? styles.slideActive : ''}`} key={s.title}>
                        {/* La scène se rejoue à chaque arrivée sur l'étape (clé = actif). */}
                        <div key={n === i ? 'on' : 'off'} className={`${styles.artStage} ${s.video ? styles.artStageVideo : ''}`} style={{ ['--tuto-accent' as any]: s.accent }}>
                            {/* La vidéo est tournée sur le VRAI site (npm run tuto:videos) :
                                elle passe avant la scène dessinée en HTML. */}
                            {s.video
                                ? <DemoVideo id={s.video} accent={s.accent} actif={n === i} />
                                : aSceneReelle(s.art)
                                    ? <TutoScene art={s.art} bureau={embedded} />
                                    : <Illus kind={s.art} accent={s.accent} />}
                        </div>
                        <div className={styles.kicker}>{s.kicker} · {n + 1} / {STEPS.length}</div>
                        <h2 className={styles.title}>{s.title}</h2>
                        <p className={styles.text}>{s.text}</p>
                        <div className={styles.hint}>
                            <span className={styles.hintMark} aria-hidden>☞</span>
                            <span>{s.hint}</span>
                        </div>
                    </section>
                ))}
            </div>

            <footer className={styles.foot}>
                <div className={styles.dots}>
                    {STEPS.map((s, n) => (
                        <span key={s.title} className={`${styles.dot} ${n === i ? styles.dotOn : ''}`} />
                    ))}
                </div>
                <button className={styles.next} onClick={next}>
                    {i === STEPS.length - 1 ? 'Terminer' : 'Suivant'}
                </button>
            </footer>
        </>
    );

    if (embedded) return <div className={`${styles.root} ${styles.embedded}`}>{body}</div>;

    return createPortal(
        <div className={styles.root} role="dialog" aria-modal="true" aria-label="Visite guidée">
            {body}
        </div>,
        document.body
    );
}
