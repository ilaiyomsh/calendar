import React, { useEffect, useRef, useState } from 'react';
import styles from './ProductSelect.module.css';

/**
 * רכיב Dropdown למוצרים עם אפשרות להוסיף מוצר חדש
 */
const ProductSelect = ({ 
    products, 
    selectedProduct, 
    onSelectProduct, 
    onCreateNew, 
    isLoading, 
    disabled 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newProductName, setNewProductName] = useState('');
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    // סגירת הדרופדאון בלחיצה מחוץ לרכיב
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
                setIsCreating(false);
                setNewProductName('');
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedOption = products.find(p => p.id === selectedProduct);

    const handleSelect = (productId) => {
        onSelectProduct(productId);
        setIsOpen(false);
    };

    const handleCreateClick = () => {
        setIsCreating(true);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const handleCreateProduct = () => {
        if (newProductName.trim()) {
            onCreateNew(newProductName);
            setNewProductName('');
            setIsCreating(false);
            setIsOpen(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleCreateProduct();
        } else if (e.key === 'Escape') {
            setIsCreating(false);
            setNewProductName('');
        }
    };

    return (
        <div className={styles.container} ref={containerRef}>
            {/* הטריגר */}
            <div 
                className={`${styles.trigger} ${disabled ? styles.disabled : ''}`}
                onClick={() => !disabled && !isLoading && setIsOpen(!isOpen)}
            >
                <span className={styles.triggerText}>
                    {selectedOption 
                        ? selectedOption.name 
                        : (isLoading ? "טוען..." : "בחר מוצר ...")
                    }
                </span>
                <div className={styles.triggerIcon}>
                    {isLoading ? "⏳" : (isOpen ? "▲" : "▼")}
                </div>
            </div>

            {/* הרשימה הנפתחת */}
            {isOpen && !disabled && (
                <div className={styles.dropdown}>
                    {/* רשימת מוצרים */}
                    <div className={styles.productsList}>
                        {products.length > 0 ? (
                            products.map((product) => (
                                <div
                                    key={product.id}
                                    className={`${styles.productItem} ${
                                        selectedProduct === product.id ? styles.selected : ''
                                    }`}
                                    onClick={() => handleSelect(product.id)}
                                >
                                    {product.name}
                                </div>
                            ))
                        ) : (
                            <div className={styles.emptyState}>
                                אין מוצרים זמינים
                            </div>
                        )}
                    </div>

                    {/* כפתור הוסף מוצר חדש או תיבת קלט */}
                    <div className={styles.footer}>
                        {!isCreating ? (
                            <button
                                onClick={handleCreateClick}
                                className={styles.addButton}
                            >
                                + הוסף מוצר חדש
                            </button>
                        ) : (
                            <div className={styles.createForm}>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder="שם המוצר"
                                    value={newProductName}
                                    onChange={(e) => setNewProductName(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className={styles.createInput}
                                />
                                <button
                                    onClick={handleCreateProduct}
                                    className={styles.createButton}
                                >
                                    ✓
                                </button>
                                <button
                                    onClick={() => {
                                        setIsCreating(false);
                                        setNewProductName('');
                                    }}
                                    className={styles.cancelButton}
                                >
                                    ✕
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductSelect;

