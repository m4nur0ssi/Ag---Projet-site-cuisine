import styles from './CategoryScroll.module.css';
import Image from 'next/image';

const categories = [
    { id: 'aperitifs', name: 'Apéritifs', image: '/mobile-img/categories/aperitif.jpg', color: '#10b981' },
    { id: 'entrees', name: 'Entrées', image: '/mobile-img/categories/entree.jpg', color: '#3b82f6' },
    { id: 'plats', name: 'Plats', image: '/mobile-img/categories/plats.jpg', color: '#f43f5e' },
    { id: 'desserts', name: 'Desserts', image: '/mobile-img/categories/desserts.jpg', color: '#d946ef' },
    { id: 'patisserie', name: 'Pâtisserie', image: '/mobile-img/categories/patisserie.jpg', color: '#f59e0b' },
    { id: 'restaurant', name: 'Restaurant', image: '/mobile-img/categories/patisserie.jpg', color: '#8b5cf6' }
];

export default function CategoryScroll() {
    return (
        <div className={styles.container}>
            <div className={styles.scroll}>
                {categories.map((category) => (
                    <button
                        key={category.id}
                        className={styles.categoryBtn}
                        style={{ '--category-color': category.color } as React.CSSProperties}
                    >
                        <div className={styles.iconWrapper}>
                            <img 
                                src={category.image} 
                                alt={category.name} 
                                className={styles.icon}
                            />
                        </div>
                        <span className={styles.name}>{category.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
