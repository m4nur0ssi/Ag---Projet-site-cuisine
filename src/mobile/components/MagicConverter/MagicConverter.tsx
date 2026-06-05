'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Portal from '@/mobile/components/Portal';
import styles from './Converter.module.css';


const UNITS = [
    { id: 'l', label: 'Litres', factor: 1000 },
    { id: 'dl', label: 'Décilitres', factor: 100 },
    { id: 'cl', label: 'Centilitres', factor: 10 },
    { id: 'ml', label: 'Millilitres', factor: 1 },
    { id: 'g', label: 'Grammes', factor: 1 },
    { id: 'cac', label: 'CàCafé (5ml)', factor: 5 },
    { id: 'cas', label: 'CàSoupe (15ml)', factor: 15 },
];

export default function MagicConverter() {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('100');
    const [fromUnit, setFromUnit] = useState('g');
    const [toUnit, setToUnit] = useState('cl');

    const result = useMemo(() => {
        const num = parseFloat(inputValue);
        if (isNaN(num)) return null;

        const from = UNITS.find(u => u.id === fromUnit);
        const to = UNITS.find(u => u.id === toUnit);
        
        if (!from || !to) return null;

        // Conversion base (ml/g)
        const inBase = num * from.factor;
        const final = inBase / to.factor;

        return final % 1 === 0 ? final.toString() : final.toFixed(2);
    }, [inputValue, fromUnit, toUnit]);

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
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9998 }}
                    />
                    <motion.div
                        className={styles.modal}
                        style={{
                            position: 'fixed', left: 12, right: 12, bottom: 20, top: 'auto',
                            width: 'auto', zIndex: 9999, maxHeight: '80vh', overflowY: 'auto',
                        }}
                        initial={{ y: "100%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "100%", opacity: 0 }}
                        transition={{
                            type: "spring",
                            damping: 25,
                            stiffness: 500,
                            mass: 0.8
                        }}
                        drag="y"
                        dragConstraints={{ top: 0, bottom: 800 }}
                        dragElastic={0.05}
                        onDragEnd={(_, info) => {
                            if (info.offset.y > 50 || info.velocity.y > 400) {
                                setIsOpen(false);
                            }
                        }}
                    >
                        <div className={styles.dragIndicator} />
                        
                        <div className={styles.modalHeader} style={{ cursor: 'grab' }}>
                            <h4 className={styles.modalTitle}>Magic Converter</h4>
                            <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>✕</button>
                        </div>
                        <div className={styles.section}>
                            <div className={styles.converterGrid}>
                                <div className={styles.converterRow}>
                                    <div className={styles.inputGroup}>
                                        <div className={styles.unitLabel}>De</div>
                                        <input
                                            type="number"
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            placeholder="Qté"
                                            className={styles.mainInput}
                                        />
                                        <select 
                                            value={fromUnit} 
                                            onChange={(e) => setFromUnit(e.target.value)}
                                            className={styles.unitSelect}
                                        >
                                            {UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
                                        </select>
                                    </div>

                                    <div className={styles.arrowSeparator}>
                                        <span>➞</span>
                                    </div>

                                    <div className={styles.inputGroup}>
                                        <div className={styles.unitLabel}>Vers</div>
                                        <select 
                                            value={toUnit} 
                                            onChange={(e) => setToUnit(e.target.value)}
                                            className={styles.unitSelect}
                                        >
                                            {UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
                                        </select>
                                        <div className={styles.finalResult}>
                                            {result || '?'} <span>{UNITS.find(u => u.id === toUnit)?.label.split(' ')[0] || toUnit}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </motion.div>
                    </>
                )}
            </AnimatePresence>
            </Portal>
        </div>
    );
}
