import React, { useEffect, useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useCustomers } from '../../hooks/useCustomers';
import { useProducts } from '../../hooks/useProducts';
import { useStageOptions } from '../../hooks/useStageOptions';
import { fetchCurrentUser } from '../../utils/mondayApi';
import ProductSelect from '../ProductSelect';
import StageSelect from '../StageSelect';
import ConfirmDialog from '../ConfirmDialog';
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
    setSelectedItem: setPropSelectedItem = null,
    monday
}) {
    const { customSettings } = useSettings();
    const { customers, loading: loadingCustomers, error: customersError, refetch: refetchCustomers } = useCustomers();
    const { createProduct, fetchForCustomer, products, loading: loadingProducts } = useProducts();
    
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
    
    // State - צריך להיות מוגדר לפני useEffect שמשתמש בו
    const [notes, setNotes] = useState("");
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [selectedStage, setSelectedStage] = useState(null);
    const [isCreatingProduct, setIsCreatingProduct] = useState(false);
    // State נפרד למוצרים של הלקוח הנבחר - כמו ב-AllDayEventModal
    const [selectedItemProducts, setSelectedItemProducts] = useState([]);
    
    // State - תיבת אישור למחיקה
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    
    // טעינת ערכי שלב
    const [boardId, setBoardId] = useState(null);
    useEffect(() => {
        if (monday) {
            monday.get('context').then(context => {
                setBoardId(context.data?.boardId);
            });
        }
    }, [monday]);
    
    const { stageOptions, loading: loadingStages } = useStageOptions(
        monday,
        customSettings.stageColumnId && boardId ? boardId : null,
        customSettings.stageColumnId
    );
    
    // עדכון selectedItem כש-localCustomers משתנה (אם יש propSelectedItem)
    // אבל לא בעת יצירת מוצר חדש כדי למנוע race conditions
    useEffect(() => {
        if (propSelectedItem !== null && localCustomers.length > 0 && setPropSelectedItem && !isCreatingProduct) {
            // לא צריך לעדכן את propSelectedItem כאן - המוצרים ייטענו דרך useProducts
            // כשהלקוח נבחר
        }
    }, [localCustomers, propSelectedItem, setPropSelectedItem, isCreatingProduct]);

    // Reset state when dialog opens
    useEffect(() => {
        if (isOpen) {
            if (isEditMode && eventToEdit) {
                // מצב עריכה - טעינת נתונים קיימים
                setNotes(eventToEdit.notes || "");
                setSelectedProduct(eventToEdit.productId || null);
                setSelectedStage(eventToEdit.stageId || null);
                // מציאת הלקוח מהרשימה
                if (eventToEdit.customerId && localCustomers.length > 0) {
                    const customer = localCustomers.find(c => c.id === eventToEdit.customerId);
                    if (customer) {
                        setSelectedItem(customer);
                        
                        // הוספת המוצר הנבחר לרשימה מיד (בלי לחכות לטעינת כל המוצרים)
                        if (eventToEdit.selectedProductData) {
                            setSelectedItemProducts([eventToEdit.selectedProductData]);
                            setSelectedProduct(eventToEdit.selectedProductData.id);
                        }
                        
                        // טעינת כל המוצרים ברקע (לא חוסם את פתיחת התיבה)
                        if (customSettings.productsCustomerColumnId) {
                            fetchForCustomer(customer.id);
                        }
                    }
                }
            } else {
                // מצב יצירה - איפוס
                setSelectedItem(null);
                setSelectedItemProducts([]);
                setNotes("");
                setSelectedProduct(null);
                setSelectedStage(null);
                setIsCreatingProduct(false);
            }
        }
    }, [isOpen, isEditMode, eventToEdit, localCustomers, setSelectedItem, customSettings.productsCustomerColumnId, fetchForCustomer]);

    // טעינת מוצרים כשמשתמש בוחר לקוח
    useEffect(() => {
        if (selectedItem && !isCreatingProduct && customSettings.productsCustomerColumnId) {
            // במצב יצירה - טעינת מוצרים
            if (!isEditMode) {
                setSelectedItemProducts([]);
                setSelectedProduct(null);
                // איפוס שלב כשהמוצר מוסר
                setSelectedStage(null);
                fetchForCustomer(selectedItem.id);
            }
            // במצב עריכה - לא עושים כלום כאן (כי כבר טענו ב-useEffect הקודם)
        } else if (!selectedItem) {
            setSelectedItemProducts([]);
        }
    }, [selectedItem, isCreatingProduct, customSettings.productsCustomerColumnId, fetchForCustomer, isEditMode]);
    
    // איפוס שלב כשהמוצר מוסר (אבל לא כשהמוצר משתנה)
    useEffect(() => {
        if (!selectedProduct && customSettings.stageColumnId) {
            setSelectedStage(null);
        }
    }, [selectedProduct, customSettings.stageColumnId]);
    
    // עדכון selectedItemProducts כשהמוצרים נטענים (במצב עריכה - עדכון הרשימה אחרי שהתיבה כבר נפתחה)
    useEffect(() => {
        if (products && products.length > 0 && selectedItem) {
            // עדכון הרשימה עם כל המוצרים (מחליף את המוצר הבודד שהיה)
            setSelectedItemProducts(products);
            // במצב עריכה, אם יש productId ב-eventToEdit, נבחר אותו
            if (isEditMode && eventToEdit?.productId) {
                // בדיקה שהמוצר קיים ברשימה
                const productExists = products.some(p => p.id === eventToEdit.productId);
                if (productExists) {
                    setSelectedProduct(eventToEdit.productId);
                }
            }
        } else if (products && products.length === 0 && selectedItem) {
            // אם אין מוצרים, אבל יש מוצר נבחר במצב עריכה, נשאיר אותו
            if (!isEditMode || !eventToEdit?.selectedProductData) {
                setSelectedItemProducts([]);
            }
        }
    }, [products, selectedItem, isEditMode, eventToEdit]);

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
                
                // לא צריך לעדכן את localCustomers או selectedItem - המוצרים נשמרים ב-selectedItemProducts
                // והם ייטענו מחדש דרך useProducts כשצריך
            }
        } finally {
            setIsCreatingProduct(false);
        }
    };

    const handleCreate = async () => {
        // מאפשרים שמירה גם אם רק יש הערה, או רק פרויקט, או שניהם
        if (!selectedItem && !notes.trim()) return;
        
        // בדיקת בחירת מוצר אם מגדרות מוגדרות
        if (customSettings.productColumnId && !selectedProduct) {
            alert('יש לבחור מוצר');
            return;
        }
        
        // בדיקת בחירת שלב אם יש מוצר
        if (customSettings.productColumnId && selectedProduct && customSettings.stageColumnId && !selectedStage) {
            alert('יש לבחור שלב');
            return;
        }

        // שליפת שם המשתמש ושם המוצר
        const currentUser = await fetchCurrentUser(monday);
        const reporterName = currentUser?.name || 'לא ידוע';
        const product = selectedItemProducts.find(p => p.id === selectedProduct);
        const productName = product?.name || 'ללא מוצר';
        
        const eventData = {
            title: `${productName} - ${reporterName}`,  // במקום selectedItem.name
            itemId: selectedItem?.id,
            notes: notes,
            productId: selectedProduct,
            stageId: selectedStage
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
        if (customSettings.productColumnId && selectedProduct && customSettings.stageColumnId && !selectedStage) return false;
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
        <div className={styles.overlay} onClick={(e) => {
            // לא לסגור אם תיבת confirm פתוחה
            if (showDeleteConfirm) {
                return;
            }
            if (e.target === e.currentTarget) {
                onClose();
            }
        }}>
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
                        <label className={styles.label}>לקוח</label>
                        {isEditMode ? (
                            // במצב עריכה - הצגה read-only
                            <div className={styles.readOnlyField}>
                                {selectedItem ? selectedItem.name : 'לא נבחר לקוח'}
                            </div>
                        ) : (
                            // במצב יצירה - כפתורי בחירה
                            <div className={styles.grid}>
                                {loadingCustomers ? (
                                    <div className={styles.loading}>טוען...</div>
                                ) : customersError ? (
                                    <div className={styles.loading}>{customersError}</div>
                                ) : localCustomers
                                    .slice()
                                    .sort((a, b) => a.name.localeCompare(b.name, 'he'))
                                    .map(item => (
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
                        )}
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

                    {/* סעיף בחירת שלב */}
                    {customSettings.stageColumnId && selectedItem && (
                        <div className={styles.formGroup}>
                            <label className={styles.label}>שלב {customSettings.productColumnId && selectedProduct && <span className={styles.required}></span>}</label>
                            <div className={styles.productSection}>
                                <StageSelect 
                                    stages={stageOptions}
                                    selectedStage={selectedStage}
                                    onSelectStage={setSelectedStage}
                                    isLoading={loadingStages}
                                    disabled={false}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className={styles.footer}>
                    {isEditMode && onDelete && (
                        <button 
                            className={`${styles.btn} ${styles.btnDanger}`}
                            onClick={() => setShowDeleteConfirm(true)}
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
            
            {/* תיבת אישור למחיקה */}
            <ConfirmDialog
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={() => {
                    setShowDeleteConfirm(false);
                    if (onDelete) {
                        onDelete();
                    }
                    onClose();
                }}
                onCancel={() => setShowDeleteConfirm(false)}
                title="מחיקת אירוע"
                message="האם אתה בטוח שברצונך למחוק את האירוע?"
                confirmText="מחק"
                cancelText="ביטול"
                confirmButtonStyle="danger"
            />
        </div>
    );
}

