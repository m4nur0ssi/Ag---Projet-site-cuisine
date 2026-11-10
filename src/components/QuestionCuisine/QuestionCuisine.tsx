'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { demanderAssistant } from '@/lib/assistant-cuisine';
import { debloquerVoix, direNaturel, pourLaVoix, taireVoix } from '@/lib/voixCuisine';
import styles from './QuestionCuisine.module.css';

interface QuestionCuisineProps {
    titre: string;
    /** Texte de l'étape affichée ; vide avant le début (mise en place). */
    etape?: string;
    /** « 400 ml crème liquide »… : de quoi répondre sur ce qu'on a en main. */
    ingredients: string[];
    /** Bouton plus grand (mode préparation). */
    grand?: boolean;
}

/**
 * Un bouton discret pour poser une question à l'assistant (« par quoi remplacer la
 * crème ? », « je n'ai que 3 œufs »). On écrit, on envoie avec « Demander », la
 * réponse s'affiche et peut être écoutée. Aucun micro.
 */
export default function QuestionCuisine({ titre, etape = '', ingredients, grand = false }: QuestionCuisineProps) {
    const [ouvert, setOuvert] = useState(false);
    const [texte, setTexte] = useState('');
    const [charge, setCharge] = useState(false);
    const [echange, setEchange] = useState<{ question: string; reponse: string } | null>(null);
    const [lecture, setLecture] = useState(false);
    const champ = useRef<HTMLTextAreaElement>(null);
    // Dictée : reconnaissance vocale du navigateur (Chrome, Edge, Safari). Absente ailleurs.
    const [ecoute, setEcoute] = useState(false);
    const reco = useRef<any>(null);
    const dictee = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;

    const arreterDictee = () => { try { reco.current?.stop(); } catch { /* noop */ } reco.current = null; setEcoute(false); };
    useEffect(() => () => arreterDictee(), []); // eslint-disable-line react-hooks/exhaustive-deps

    const dicter = () => {
        if (ecoute) { arreterDictee(); return; }
        if (!dictee) return;
        debloquerVoix();
        const avant = texte.trim();
        const r = new dictee();
        r.lang = 'fr-FR';
        r.interimResults = true;
        r.continuous = true;
        r.onresult = (e: any) => {
            let dit = '';
            for (let i = 0; i < e.results.length; i++) dit += e.results[i][0].transcript;
            setTexte(`${avant ? avant + ' ' : ''}${dit.trim()}`);
        };
        r.onend = () => { reco.current = null; setEcoute(false); };
        r.onerror = () => { reco.current = null; setEcoute(false); };
        reco.current = r;
        setEcoute(true);
        try { r.start(); } catch { arreterDictee(); }
    };

    useEffect(() => {
        if (ouvert && !echange) setTimeout(() => champ.current?.focus(), 120);
    }, [ouvert, echange]);

    // Échap referme ; fermer coupe aussi la lecture.
    useEffect(() => {
        if (!ouvert) return;
        const auClavier = (e: KeyboardEvent) => { if (e.key === 'Escape') fermer(); };
        window.addEventListener('keydown', auClavier);
        return () => window.removeEventListener('keydown', auClavier);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ouvert]);

    const fermer = () => { taireVoix(); setLecture(false); setOuvert(false); };

    const envoyer = async () => {
        const question = texte.trim();
        if (!question || charge) return;
        debloquerVoix(); // dans le geste : la réponse pourra être lue ensuite
        setCharge(true);
        const rep = await demanderAssistant({ question, titre, etape, ingredients });
        setEchange({
            question,
            reponse: rep || "Je n'ai pas pu répondre pour l'instant. Réessayez dans un instant.",
        });
        setTexte('');
        setCharge(false);
    };

    const ecouter = async () => {
        if (!echange) return;
        if (lecture) { taireVoix(); setLecture(false); return; }
        debloquerVoix();
        setLecture(true);
        const dit = pourLaVoix(echange.reponse);
        let ok = false;
        try { ok = await direNaturel(dit); } catch { ok = false; }
        // Pas de voix robot en repli (logique Pilvoice).
        setLecture(false);
    };

    return (
        <>
            <button
                type="button"
                className={`${styles.bouton} ${grand ? styles.grand : ''} ${ouvert ? styles.boutonActif : ''}`}
                onClick={() => (ouvert ? fermer() : setOuvert(true))}
                aria-expanded={ouvert}
                aria-label="Poser une question"
            >
                <svg className={styles.icone} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4 3.5V16h-.5A2.5 2.5 0 0 1 4 13.5v-7Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                    <path className={styles.eclat} d="M12 7.2l.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9.9-2Z" fill="currentColor" />
                </svg>
                <span className={styles.libelle}>Question</span>
            </button>

            <AnimatePresence>
                {ouvert && (
                    <motion.div
                        className={styles.panneau}
                        role="dialog"
                        aria-label="Poser une question"
                        initial={{ opacity: 0, y: -10, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <div className={styles.entete}>
                            <span className={styles.titrePanneau}>Une question ?</span>
                            <button type="button" className={styles.fermer} onClick={fermer} aria-label="Fermer">✕</button>
                        </div>

                        {echange ? (
                            <div className={styles.echange}>
                                <div className={styles.question}>{echange.question}</div>
                                <p className={styles.reponse}>{echange.reponse}</p>
                                <div className={styles.actions}>
                                    <button type="button" className={styles.secondaire} onClick={ecouter}>
                                        {lecture ? 'Arrêter la lecture' : 'Écouter'}
                                    </button>
                                    <button type="button" className={styles.secondaire} onClick={() => { taireVoix(); setLecture(false); setEchange(null); }}>
                                        Nouvelle question
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form
                                className={styles.formulaire}
                                onSubmit={(e) => { e.preventDefault(); void envoyer(); }}
                            >
                                <div className={styles.champLigne}>
                                    <textarea
                                        ref={champ}
                                        className={styles.champ}
                                        value={texte}
                                        onChange={(e) => setTexte(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void envoyer(); } }}
                                        placeholder="Par quoi remplacer la crème ? Je n'ai que 3 œufs…"
                                        rows={2}
                                        maxLength={300}
                                        disabled={charge}
                                    />
                                    {dictee && (
                                        <button
                                            type="button"
                                            className={`${styles.micro} ${ecoute ? styles.microActif : ''}`}
                                            onClick={dicter}
                                            aria-pressed={ecoute}
                                            aria-label={ecoute ? 'Arrêter la dictée' : 'Dicter ma question'}
                                            title={ecoute ? 'Arrêter la dictée' : 'Dicter ma question'}
                                            disabled={charge}
                                        >
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                                <rect x="9" y="2" width="6" height="12" rx="3" />
                                                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                                <button type="submit" className={styles.envoyer} disabled={!texte.trim() || charge}>
                                    {charge ? <span className={styles.points} aria-label="Réflexion en cours"><i /><i /><i /></span> : 'Demander'}
                                </button>
                            </form>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
