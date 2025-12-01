import React, { useEffect, useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useCustomers } from '../../hooks/useCustomers';
import { useProducts } from '../../hooks/useProducts';
import ProductSelect from '../ProductSelect';
import styles from './EventModal.module.css';

export default function EventModal({
    isOpen,
    onClose,
    pendingSlot,
    onCreate,
    eventToEdit = null,
    isEditMode = false,
    onUpdate = null,
    onDelete = null,
    selectedItem: propSelectedItem = null,
    setSelectedItem: setPropSelectedItem = null
}) {
    const { customSettings } = useSettings();
    const { customers, loading: loadingCustomers, error: customersError, refetch: refetchCustomers } = useCustomers();
    const { createProduct } = useProducts();
    
    // State - משתמש ב-prop אם קיים, אחרת state פנימי
    const [internalSelectedItem, setInternalSelectedItem] = useState(null);
    const [localCustomers, setLocalCustomers] = useState(customers);
    
    // עדכון localCustomers כש-customers משתנה
    useEffect(() => {
        setLocalCustomers(customers);
    }, [customers]);
    
    // מציאת selectedItem מה-localCustomers
    const selectedItem = propSelectedItem !== null 
        ? (localCustomers.find(c => c.id === propSelectedItem.id) || propSelectedItem)
        : internalSelectedItem;
    const setSelectedItem = setPropSelectedItem || setInternalSelectedItem;
    
    // עדכון selectedItem כש-localCustomers משתנה (אם יש propSelectedItem)
    useEffect(() => {
        if (propSelectedItem !== null && localCustomers.length > 0 && setPropSelectedItem) {
            const updatedCustomer = localCustomers.find(c => c.id === propSelectedItem.id);
            if (updatedCustomer) {
                // עדכון רק אם יש שינוי במוצרים
                const currentProducts = propSelectedItem.products || [];
                const newProducts = updatedCustomer.products || [];
                if (currentProducts.length !== newProducts.length || 
                    !currentProducts.every((p, i) => p.id === newProducts[i]?.id)) {
                    setPropSelectedItem(updatedCustomer);
                }
            }
        }
    }, [localCustomers, propSelectedItem, setPropSelectedItem]);
    
    const [notes, setNotes] = useState("");
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isCreatingProduct, setIsCreatingProduct] = useState(false);
    // State נפרד למוצרים של הלקוח הנבחר - כמו ב-AllDayEventModal
    const [selectedItemProducts, setSelectedItemProducts] = useState([]);

    // Reset state when dialog opens
    useEffect(() => {
        if (isOpen) {
            if (isEditMode && eventToEdit) {
                // מצב עריכה - טעינת נתונים קיימים
                setNotes(eventToEdit.notes || "");
                setSelectedProduct(eventToEdit.productId || null);
                // מציאת הלקוח מהרשימה
                if (eventToEdit.customerId && localCustomers.length > 0) {
                    const customer = localCustomers.find(c => c.id === eventToEdit.customerId);
                    if (customer) {
                        setSelectedItem(customer);
                        setSelectedItemProducts(customer.products || []);
                    }
                }
            } else {
                // מצב יצירה - איפוס
                setSelectedItem(null);
                setSelectedItemProducts([]);
                setNotes("");
                setSelectedProduct(null);
                setIsCreatingProduct(false);
            }
        }
    }, [isOpen, isEditMode, eventToEdit, localCustomers, setSelectedItem]);

    // עדכון selectedItemProducts כשמשנים לקוח (אבל לא בעת יצירת מוצר חדש)
    useEffect(() => {
        if (selectedItem && !isCreatingProduct) {
            setSelectedItemProducts(selectedItem.products || []);
            setSelectedProduct(null);
        } else if (!selectedItem) {
            setSelectedItemProducts([]);
        }
    }, [selectedItem, isCreatingProduct]);

    const handleCreateProduct = async (productName) => {
        if (!selectedItem) return;
        
        setIsCreatingProduct(true);
        try {
            const newProduct = await createProduct(selectedItem.id, productName);
            if (newProduct) {
                // עדכון selectedItemProducts עם המוצר החדש - ישירות, כמו ב-AllDayEventModal
                // זה מבטיח שהמוצר יופיע מיד ברשימה
                setSelectedItemProducts(prev => [...prev, newProduct]);
                
                // בחירת המוצר החדש - מיד אחרי עדכון selectedItemProducts
                setSelectedProduct(newProduct.id);
                
                // עדכון localCustomers עם המוצר החדש - רק הלקוח הספציפי
                // זה נעשה אחרי בחירת המוצר כדי למנוע race conditions
                const updatedCustomers = localCustomers.map(customer =>
                    customer.id === selectedItem.id
                        ? { ...customer, products: [...(customer.products || []), newProduct] }
                        : customer
                );
                setLocalCustomers(updatedCustomers);
                
                // עדכון selectedItem עם המוצר החדש
                const updatedSelectedItem = {
                    ...selectedItem,
                    products: [...(selectedItem.products || []), newProduct]
                };
                setSelectedItem(updatedSelectedItem);
            }
        } finally {
            setIsCreatingProduct(false);
        }
    };

    const handleCreate = () => {
        // מאפשרים שמירה גם אם רק יש הערה, או רק פרויקט, או שניהם
        if (!selectedItem && !notes.trim()) return;
        
        // בדיקת בחירת מוצר אם מגדרות מוגדרות
        if (customSettings.productColumnId && !selectedProduct) {
            alert('יש לבחור מוצר');
            return;
        }

        const eventData = {
            title: selectedItem ? selectedItem.name : "אירוע ללא פרויקט",
            itemId: selectedItem?.id,
            notes: notes,
            productId: selectedProduct
        };

        if (isEditMode && onUpdate) {
            onUpdate(eventData);
        } else {
            onCreate(eventData);
        }
        onClose();
    };

    if (!pendingSlot || !isOpen) return null;

    // פורמט תאריך כותרת
    const dateStr = pendingSlot?.start 
        ? pendingSlot.start.toLocaleDateString('he-IL', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long' 
        }) 
        : '';

    // בדיקה אם הפרטים מלאים
    const isFormValid = () => {
        if (!selectedItem) return false;
        if (customSettings.productColumnId && !selectedProduct) return false;
        return true;
    };

    const formIsValid = isFormValid();

    // טיפול ב-Enter key
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && formIsValid && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            handleCreate();
        }
    };

    return (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div 
                className={styles.modal} 
                onClick={(e) => e.stopPropagation()} 
                onKeyDown={handleKeyDown}
                tabIndex={-1}
            >
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.titleGroup}>
                        <h2 className={styles.title}>דיווח שעות</h2>
                        <span className={styles.subtitle}>{dateStr}</span>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                {/* Content */}
                <div className={styles.content}>
                    {/* לקוח / פרויקט */}
                    <div className={styles.formGroup}>
                        <label className={styles.label}>לקוח / פרויקט</label>
                        <div className={styles.grid}>
                            {loadingCustomers ? (
                                <div className={styles.loading}>טוען...</div>
                            ) : customersError ? (
                                <div className={styles.loading}>{customersError}</div>
                            ) : localCustomers.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        setSelectedItem(item.id === selectedItem?.id ? null : item);
                                    }}
                                    className={`${styles.itemButton} ${selectedItem?.id === item.id ? styles.selected : ''}`}
                                >
                                    {item.name}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    {/* סעיף בחירת מוצר */}
                    {customSettings.productColumnId && selectedItem && (
                        <div className={styles.formGroup}>
                            <label className={styles.label}>מוצר</label>
                            <div className={styles.productSection}>
                                <ProductSelect 
                                    products={selectedItemProducts}
                                    selectedProduct={selectedProduct}
                                    onSelectProduct={setSelectedProduct}
                                    onCreateNew={async (productName) => await handleCreateProduct(productName)}
                                    isLoading={false}
                                    disabled={false}
                                    isCreatingProduct={isCreatingProduct}
                                />
                            </div>
                        </div>
                    )}

                    {/* הערות נוספות */}
                    <div className={styles.formGroup}>
                        <label className={styles.label}>הערות נוספות</label>
                        <input
                            type="text"
                            className={styles.input}
                            placeholder="פרטים נוספים על העבודה..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className={styles.footer}>
                    {isEditMode && onDelete && (
                        <button 
                            className={`${styles.btn} ${styles.btnDanger}`}
                            onClick={() => {
                                if (window.confirm('האם אתה בטוח שברצונך למחוק את האירוע?')) {
                                    onDelete();
                                    onClose();
                                }
                            }}
                        >
                            מחק
                        </button>
                    )}
                    <button 
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        onClick={onClose}
                    >
                        ביטול
                    </button>
                    <button 
                        className={`${styles.btn} ${formIsValid ? styles.btnPrimaryActive : styles.btnPrimary}`}
                        onClick={handleCreate}
                        disabled={!formIsValid}
                    >
                        {isEditMode ? 'עדכן' : 'שמור'}
                    </button>
                </div>
            </div>
        </div>
    );
}

