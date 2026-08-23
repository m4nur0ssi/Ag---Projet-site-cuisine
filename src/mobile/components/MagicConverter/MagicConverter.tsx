'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Portal from '@/mobile/components/Portal';
import styles from './Converter.module.css';

/**
 * `short` sert aux pilules, `label` au résultat. Les listes déroulantes ont
 * disparu : sept unités tiennent en deux rangées, et un doigt les atteint sans
 * ouvrir de menu système.
 *
 * `masse` distingue les grammes du reste. Le facteur les traite comme des
 * millilitres — vrai pour l'eau, faux pour la farine : on le dit sous le
 * résultat plutôt que de laisser croire à une équivalence.
 */
const UNITS = [
    { id: 'l', label: 'Litres', short: 'L', factor: 1000, masse: false },
    { id: 'dl', label: 'Décilitres', short: 'dL', factor: 100, masse: false },
    { id: 'cl', label: 'Centilitres', short: 'cL', factor: 10, masse: false },
    { id: 'ml', label: 'Millilitres', short: 'mL', factor: 1, masse: false },
    { id: 'g', label: 'Grammes', short: 'g', factor: 1, masse: true },
    { id: 'cac', label: 'Cuillères à café', short: 'c. à café', factor: 5, masse: false },
    { id: 'cas', label: 'Cuillères à soupe', short: 'c. à soupe', factor: 15, masse: false },
];

export default function MagicConverter() {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('100');
    const [fromUnit, setFromUnit] = useState('g');
    const [toUnit, setToUnit] = useState('cl');

    const from = UNITS.find((u) => u.id === fromUnit);
    const to = UNITS.find((u) => u.id === toUnit);

    const result = useMemo(() => {
        const num = parseFloat((inputValue || '').replace(',', '.'));
        if (isNaN(num) || !from || !to) return null;
        const final = (num * from.factor) / to.factor;
        return final % 1 === 0 ? final.toString() : final.toFixed(2);
    }, [inputValue, from, to]);

    /** Le pas suit l'ordre de grandeur : 50 pour les grammes, 1 pour les cuillères. */
    const pas = from && (from.id === 'g' || from.id === 'ml') ? 50 : 1;
    const bouger = (sens: number) =>
        // Forme fonctionnelle : plusieurs appuis rapides tombent dans le même
        // rendu et liraient tous la même valeur.
        setInputValue((prev) => {
            const n = parseFloat((prev || '').replace(',', '.')) || 0;
            const suivant = Math.max(0, n + sens * pas);
            return suivant % 1 === 0 ? String(suivant) : suivant.toFixed(2);
        });

    // Masse d'un côté, volume de l'autre : l'égalité ne tient que pour l'eau.
    const melangeMasseVolume = !!from && !!to && from.masse !== to.masse;

    const rangeeUnites = (choisi: string, choisir: (id: string) => void) => (
        <div className={styles.units}>
            {UNITS.map((u) => (
                <button
                    key={u.id}
                    className={`${styles.unit} ${choisi === u.id ? styles.unitOn : ''}`}
                    onClick={() => choisir(u.id)}
                >
                    {u.short}
                </button>
            ))}
        </div>
    );

    return (
        <div className={styles.container}>
            <button className={styles.toggle} onClick={() => setIsOpen(!isOpen)}>
                <span className={styles.icon}>⚖️</span>
                Convertisseur
            </button>

            <Portal>
                <AnimatePresence>
                    {isOpen && (
                        <>
                            <motion.div
                                onClick={() => setIsOpen(false)}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                // La fiche recette monte à 20000 et la barre du bas à 25000 :
                                // plus bas, cette fenêtre s'ouvrait DERRIÈRE la fiche d'où on
                                // l'appelle. Le bouton répondait, on ne voyait rien.
                                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 25990 }}
                            />
                            <motion.div
                                className={styles.modal}
                                style={{
                                    position: 'fixed', left: 10, right: 10, bottom: 14, top: 'auto',
                                    width: 'auto', zIndex: 26000, maxHeight: '86vh', overflowY: 'auto',
                                }}
                                initial={{ y: '100%', opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: '100%', opacity: 0 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 500, mass: 0.8 }}
                                drag="y"
                                dragConstraints={{ top: 0, bottom: 800 }}
                                dragElastic={0.05}
                                onDragEnd={(_, info) => {
                                    if (info.offset.y > 50 || info.velocity.y > 400) setIsOpen(false);
                                }}
                            >
                                <div className={styles.dragIndicator} />

                                <div className={styles.modalHeader}>
                                    <h4 className={styles.modalTitle}>Convertisseur</h4>
                                    <button className={styles.closeBtn} onClick={() => setIsOpen(false)} aria-label="Fermer">✕</button>
                                </div>

                                <div className={styles.section}>
                                    <div className={styles.amountRow}>
                                        <button className={styles.step} onClick={() => bouger(-1)} aria-label="Moins">−</button>
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            placeholder="0"
                                            className={styles.mainInput}
                                            aria-label="Quantité"
                                        />
                                        <button className={styles.step} onClick={() => bouger(1)} aria-label="Plus">+</button>
                                    </div>

                                    <p className={styles.unitLabel}>De</p>
                                    {rangeeUnites(fromUnit, setFromUnit)}

                                    <div className={styles.arrowSeparator}>
                                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 5v14M6 13l6 6 6-6" />
                                        </svg>
                                    </div>

                                    <div className={styles.finalResult}>
                                        {result ?? '—'} <span>{to?.short}</span>
                                    </div>

                                    <p className={styles.unitLabel}>Vers</p>
                                    {rangeeUnites(toUnit, setToUnit)}

                                    {melangeMasseVolume && (
                                        <p className={styles.caveat}>
                                            Poids et volume ne s’échangent qu’avec l’eau. Pour la farine
                                            ou le sucre, l’équivalence est approximative.
                                        </p>
                                    )}
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </Portal>
        </div>
    );
}
