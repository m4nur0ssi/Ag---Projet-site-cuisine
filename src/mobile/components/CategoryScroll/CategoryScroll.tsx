import styles from './CategoryScroll.module.css';
import Image from 'next/image';

const categories = [
    { id: 'aperitifs', name: 'Apéritifs', image: '/images/categories/aperitif-theme.png', color: '#FF6B35' },
    { id: 'entrees', name: 'Entrées', image: '/images/categories/entree-theme.png', color: '#2DD4BF' },
    { id: 'plats', name: 'Plats', image: '/images/categories/plats-theme.png', color: '#6D28D9' },
    { id: 'desserts', name: 'Desserts', image: '/images/categories/desserts-theme.png', color: '#EC4899' },
    { id: 'patisserie', name: 'Pâtisserie', image: '/images/categories/patisserie-theme.png', color: '#A78BFA' },
    { id: 'restaurant', name: 'Restaurant', image: '/images/categories/restaurants.jpg', color: '#8b5cf6' }
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
