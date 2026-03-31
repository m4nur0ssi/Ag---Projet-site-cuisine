import styles from './CategoryScroll.module.css';

const categories = [
    { id: 'aperitifs', name: 'Apéritifs', icon: '🍹', color: '#3498db' },
    { id: 'entrees', name: 'Entrées', icon: '🥗', color: '#27ae60' },
    { id: 'plats', name: 'Plats', icon: '🍲', color: '#e67e22' },
    { id: 'desserts', name: 'Desserts', icon: '🍰', color: '#e74c3c' },
    { id: 'patisserie', name: 'Pâtisserie', icon: '🥐', color: '#9b59b6' },
    { id: 'restaurant', name: 'Restaurant', icon: '📍', color: '#f1c40f' }
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
                        <span className={styles.name}>{category.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
