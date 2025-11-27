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
    const { customers, loading: loadingCustomers, error: customersError } = useCustomers();
    const { products, loading: loadingProducts, fetchForCustomer, createProduct } = useProducts();
    
    // State - משתמש ב-prop אם קיים, אחרת state פנימי
    const [internalSelectedItem, setInternalSelectedItem] = useState(null);
    const selectedItem = propSelectedItem !== null ? propSelectedItem : internalSelectedItem;
    const setSelectedItem = setPropSelectedItem || setInternalSelectedItem;
    
    const [notes, setNotes] = useState("");
    const [selectedProduct, setSelectedProduct] = useState(null);

    // Reset state when dialog opens
    useEffect(() => {
        if (isOpen) {
            if (isEditMode && eventToEdit) {
                // מצב עריכה - טעינת נתונים קיימים
                setNotes(eventToEdit.notes || "");
                setSelectedProduct(eventToEdit.productId || null);
                // אחרי שטענו את הלקוחות, נטען את המוצרים אם יש לקוח
                if (eventToEdit.customerId) {
                    fetchForCustomer(eventToEdit.customerId);
                }
            } else {
                // מצב יצירה - איפוס
                setSelectedItem(null);
                setNotes("");
                setSelectedProduct(null);
            }
        }
    }, [isOpen, isEditMode, eventToEdit, fetchForCustomer, setSelectedItem]);

    // טעינת מוצרים כשנבחר לקוח
    useEffect(() => {
        if (selectedItem && customSettings.productColumnId) {
            fetchForCustomer(selectedItem.id);
            setSelectedProduct(null); // איפוס בחירת מוצר
        }
    }, [selectedItem, customSettings.productColumnId, fetchForCustomer]);

    const handleCreateProduct = async (productName) => {
        if (!selectedItem) return;
        
        const newProduct = await createProduct(selectedItem.id, productName);
        if (newProduct) {
            setSelectedProduct(newProduct.id);
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

    return (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className={styles.container}>
                {/* כותרת */}
                <h2 className={styles.title}>פרויקט</h2>

                {/* גריד לקוחות */}
                <div className={styles.grid}>
                    {loadingCustomers ? (
                        <div className={styles.loading}>טוען...</div>
                    ) : customersError ? (
                        <div className={styles.loading}>{customersError}</div>
                    ) : customers.map(item => (
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
                
                {/* סעיף בחירת מוצר */}
                {customSettings.productColumnId && selectedItem && (
                    <div className={styles.productSection}>
                        <ProductSelect 
                            products={products}
                            selectedProduct={selectedProduct}
                            onSelectProduct={setSelectedProduct}
                            onCreateNew={handleCreateProduct}
                            isLoading={loadingProducts}
                            disabled={false}
                        />
                    </div>
                )}

                {/* שדה תיאור חופשי */}
                <input
                    type="text"
                    placeholder="תיאור חופשי"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={styles.input}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />

                {/* כפתורי פעולה */}
                <div className={styles.actionsContainer}>
                    {isEditMode && onDelete && (
                        <button 
                            onClick={() => {
                                if (window.confirm('האם אתה בטוח שברצונך למחוק את האירוע?')) {
                                    onDelete();
                                    onClose();
                                }
                            }}
                            className={styles.deleteButton}
                            title="מחק אירוע"
                        >
                            🗑️
                        </button>
                    )}
                    <button 
                        onClick={handleCreate}
                        className={styles.saveButton}
                    >
                        {isEditMode ? 'עדכן' : 'שמור'}
                    </button>
                </div>
            </div>
        </div>
    );
}

