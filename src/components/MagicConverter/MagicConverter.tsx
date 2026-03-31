'use client';

import React, { useState, useMemo } from 'react';
import styles from './Converter.module.css';

const SUBSTITUTES: Record<string, string> = {
    'beurre': 'Huile de coco ou compote de pommes',
    'oeuf': 'Compote de pommes (50g) ou banane écrasée',
    'lait': 'Lait d\'amande, de soja ou d\'avoine',
    'creme': 'Lait de coco ou crème de soja',
    'sucre': 'Miel, sirop d\'agave ou stevia',
    'farine': 'Mix sans gluten ou poudre d\'amande',
};

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
                <span style={{ fontSize: '1.1rem' }}>⚖️</span>
                Convertisseur
            </button>

            {isOpen && (
                <div className={styles.modal}>
                    <div className={styles.section}>
                        <h4>Magic Converter</h4>
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

                    <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>
                       <span>✕</span> FERMER
                    </button>
                </div>
            )}
        </div>
    );
}
