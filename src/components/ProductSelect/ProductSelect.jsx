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
    disabled,
    isCreatingProduct = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newProductName, setNewProductName] = useState('');
    const [dropdownPosition, setDropdownPosition] = useState({ top: 'auto', bottom: 'auto', left: 'auto', width: 'auto' });
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);

    // חישוב מיקום ה-dropdown
    const calculateDropdownPosition = () => {
        if (!containerRef.current) return;
        
        const rect = containerRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        const dropdownHeight = 240; // max-height של ה-dropdown
        
        // חישוב מיקום אופקי
        const left = rect.left;
        const width = rect.width;
        
        // אם אין מספיק מקום למטה אבל יש למעלה, נציג למעלה
        if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
            setDropdownPosition({ 
                bottom: `${viewportHeight - rect.top + 4}px`,
                top: 'auto',
                left: `${left}px`,
                width: `${width}px`
            });
        } else {
            setDropdownPosition({ 
                top: `${rect.bottom + 4}px`,
                bottom: 'auto',
                left: `${left}px`,
                width: `${width}px`
            });
        }
    };

    useEffect(() => {
        if (isOpen) {
            calculateDropdownPosition();
            
            // עדכון מיקום בעת גלילה או שינוי גודל
            const handleScroll = () => {
                calculateDropdownPosition();
            };
            
            const handleResize = () => {
                calculateDropdownPosition();
            };
            
            window.addEventListener('scroll', handleScroll, true);
            window.addEventListener('resize', handleResize);
            
            return () => {
                window.removeEventListener('scroll', handleScroll, true);
                window.removeEventListener('resize', handleResize);
            };
        }
    }, [isOpen]);

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
                    {isCreatingProduct 
                        ? "מוסיף מוצר חדש..."
                        : (selectedOption 
                            ? selectedOption.name 
                            : (isLoading ? "טוען..." : "בחר מוצר ...")
                        )
                    }
                </span>
                <div className={styles.triggerIcon}>
                    {isLoading ? "⏳" : (isOpen ? "▲" : "▼")}
                </div>
            </div>

            {/* הרשימה הנפתחת */}
            {isOpen && !disabled && (
                <div 
                    ref={dropdownRef}
                    className={styles.dropdown}
                    style={{
                        top: dropdownPosition.top,
                        bottom: dropdownPosition.bottom,
                        left: dropdownPosition.left,
                        width: dropdownPosition.width
                    }}
                >
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

