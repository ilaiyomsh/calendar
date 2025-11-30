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
                    }
                }
            } else {
                // מצב יצירה - איפוס
                setSelectedItem(null);
                setNotes("");
                setSelectedProduct(null);
                setIsCreatingProduct(false);
            }
        }
    }, [isOpen, isEditMode, eventToEdit, localCustomers, setSelectedItem]);

    // איפוס בחירת מוצר כשמשנים לקוח
    useEffect(() => {
        if (selectedItem) {
            setSelectedProduct(null);
        }
    }, [selectedItem]);

    const handleCreateProduct = async (productName) => {
        if (!selectedItem) return;
        
        setIsCreatingProduct(true);
        try {
            const newProduct = await createProduct(selectedItem.id, productName);
            if (newProduct) {
                // עדכון localCustomers עם המוצר החדש
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
                setSelectedProduct(newProduct.id);
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
                
                {/* סעיף בחירת מוצר */}
                {customSettings.productColumnId && selectedItem && (
                    <div className={styles.productSection}>
                        <ProductSelect 
                            products={selectedItem?.products || []}
                            selectedProduct={selectedProduct}
                            onSelectProduct={setSelectedProduct}
                            onCreateNew={handleCreateProduct}
                            isLoading={false}
                            disabled={false}
                            isCreatingProduct={isCreatingProduct}
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

