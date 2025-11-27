import React, { useEffect, useRef, useState } from 'react';
import mondaySdk from "monday-sdk-js";
import { useSettings } from '../contexts/SettingsContext';

const monday = mondaySdk();

// רכיב Dropdown למוצרים עם אפשרות להוסיף מוצר חדש
const ProductSelect = ({ products, selectedProduct, onSelectProduct, onCreateNew, isLoading, disabled }) => {
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

    return (
        <div style={{ position: 'relative', width: '100%' }} ref={containerRef}>
            {/* הטריגר */}
            <div 
                style={{
                    width: "100%",
                    backgroundColor: disabled ? "#f6f7fb" : "transparent",
                    border: isOpen ? "2px solid #1f2b3e" : "2px solid #1f2b3e",
                    borderRadius: "50px",
                    padding: "12px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.5 : 1,
                    transition: "all 0.2s",
                    boxSizing: 'border-box'
                }}
                onClick={() => !disabled && !isLoading && setIsOpen(!isOpen)}
            >
                <span style={{
                    fontSize: "14px",
                    color: selectedOption ? "#1f2b3e" : "#1f2b3e",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                }}>
                    {selectedOption ? selectedOption.name : (isLoading ? "טוען..." : "בחר מוצר ...")}
                </span>
                <div style={{ color: "#1f2b3e", fontSize: "16px", marginRight: "4px" }}>
                    {isLoading ? "⏳" : (isOpen ? "▲" : "▼")}
                </div>
            </div>

            {/* הרשימה הנפתחת */}
            {isOpen && !disabled && (
                <div style={{
                    position: "absolute",
                    zIndex: 10010,
                    width: "100%",
                    marginTop: "8px",
                    backgroundColor: "#ffffff",
                    border: "2px solid #1f2b3e",
                    borderRadius: "8px",
                    boxShadow: "0 6px 16px rgba(0, 0, 0, 0.12)",
                    maxHeight: "240px",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column"
                }}>
                    
                    {/* רשימת מוצרים */}
                    <div style={{ 
                        overflowY: "auto", 
                        flex: 1,
                        padding: "8px"
                    }}>
                        {products.length > 0 ? (
                            products.map((product) => (
                                <div
                                    key={product.id}
                                    style={{
                                        padding: "10px 12px",
                                        fontSize: "14px",
                                        borderRadius: "6px",
                                        cursor: "pointer",
                                        transition: "background-color 0.15s",
                                        backgroundColor: selectedProduct === product.id ? "#1f2b3e" : "transparent",
                                        color: selectedProduct === product.id ? "#ffffff" : "#323338",
                                        fontWeight: selectedProduct === product.id ? "600" : "normal"
                                    }}
                                    onClick={() => handleSelect(product.id)}
                                    onMouseEnter={(e) => {
                                        if (selectedProduct !== product.id) {
                                            e.currentTarget.style.backgroundColor = "#f0f2f5";
                                            e.currentTarget.style.color = "#1f2b3e";
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (selectedProduct !== product.id) {
                                            e.currentTarget.style.backgroundColor = "transparent";
                                            e.currentTarget.style.color = "#323338";
                                        }
                                    }}
                                >
                                    {product.name}
                                </div>
                            ))
                        ) : (
                            <div style={{
                                padding: "16px",
                                textAlign: "center",
                                fontSize: "12px",
                                color: "#676879"
                            }}>
                                אין מוצרים זמינים
                            </div>
                        )}
                    </div>

                    {/* כפתור הוסף מוצר חדש או תיבת קלט */}
                    <div style={{
                        borderTop: "1px solid #e0e0e0",
                        padding: "8px",
                        backgroundColor: "#ffffff"
                    }}>
                        {!isCreating ? (
                            <button
                                onClick={handleCreateClick}
                                style={{
                                    width: "100%",
                                    padding: "10px 12px",
                                    backgroundColor: "#ffffff",
                                    border: "1px solid #1f2b3e",
                                    borderRadius: "6px",
                                    fontSize: "13px",
                                    fontWeight: "600",
                                    color: "#1f2b3e",
                                    cursor: "pointer",
                                    transition: "all 0.2s"
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = "#f0f2f5";
                                    e.currentTarget.style.borderColor = "#1f2b3e";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = "#ffffff";
                                    e.currentTarget.style.borderColor = "#1f2b3e";
                                }}
                            >
                                + הוסף מוצר חדש
                            </button>
                        ) : (
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder="שם המוצר"
                                    value={newProductName}
                                    onChange={(e) => setNewProductName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleCreateProduct();
                                        if (e.key === 'Escape') {
                                            setIsCreating(false);
                                            setNewProductName('');
                                        }
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        border: '1px solid #1f2b3e',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                                <button
                                    onClick={handleCreateProduct}
                                    style={{
                                        padding: '8px 12px',
                                        backgroundColor: '#1f2b3e',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        fontWeight: '600'
                                    }}
                                >
                                    ✓
                                </button>
                                <button
                                    onClick={() => {
                                        setIsCreating(false);
                                        setNewProductName('');
                                    }}
                                    style={{
                                        padding: '8px 12px',
                                        backgroundColor: '#f0f2f5',
                                        color: '#1f2b3e',
                                        border: '1px solid #d0d4e4',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        fontWeight: '600'
                                    }}
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
    const dialogRef = useRef(null);
    const { customSettings } = useSettings();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // State - משתמש ב-prop אם קיים, אחרת state פנימי
    const [internalSelectedItem, setInternalSelectedItem] = useState(null);
    const selectedItem = propSelectedItem !== null ? propSelectedItem : internalSelectedItem;
    const setSelectedItem = setPropSelectedItem || setInternalSelectedItem;
    
    const [notes, setNotes] = useState("");
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [products, setProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(false);

    // Reset state when dialog opens
    useEffect(() => {
        if (isOpen) {
            if (isEditMode && eventToEdit) {
                // מצב עריכה - טעינת נתונים קיימים
                setNotes(eventToEdit.notes || "");
                setSelectedProduct(eventToEdit.productId || null);
                // selectedItem יטען מ-loadEventDataForEdit
                fetchMyItems();
                // אחרי שטענו את הלקוחות, נטען את המוצרים אם יש לקוח
                if (eventToEdit.customerId) {
                    fetchProductsForCustomer(eventToEdit.customerId);
                }
            } else {
                // מצב יצירה - איפוס
                setSelectedItem(null);
                setNotes("");
                setSelectedProduct(null);
                fetchMyItems();
            }
        }
    }, [isOpen, isEditMode, eventToEdit]);

    // Fetch items logic
    const fetchMyItems = async () => {
        if (!customSettings.connectedBoardId || !customSettings.peopleColumnId) {
            setError("חסרות הגדרות לוח");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const query = `query {
                boards(ids: ${customSettings.connectedBoardId}) {
                    items_page(
                        query_params: {
                            rules: [
                                {
                                    column_id: "${customSettings.peopleColumnId}",
                                    compare_value: ["assigned_to_me"],
                                    operator: any_of
                                }
                            ]
                        }
                    ) {
                        items {
                            id
                            name
                        }
                    }
                }
            }`;

            const res = await monday.api(query);
            
            if (res.data && res.data.boards && res.data.boards[0]) {
                setItems(res.data.boards[0].items_page.items);
            } else {
                setItems([]);
            }
        } catch (err) {
            console.error("Error fetching items:", err);
            setError("שגיאה בטעינת הנתונים");
        } finally {
            setLoading(false);
        }
    };

    // טעינת מוצרים לפי לקוח
    const fetchProductsForCustomer = async (customerId) => {
        if (!customSettings.productsBoardId || !customSettings.productsCustomerColumnId) return;
        
        setLoadingProducts(true);
        try {
            const query = `query {
                boards(ids: [${customSettings.productsBoardId}]) {
                    items_page(
                        limit: 100,
                        query_params: {
                            rules: [
                                {
                                    column_id: "${customSettings.productsCustomerColumnId}",
                                    compare_value: [${customerId}]
                                }
                            ]
                        }
                    ) {
                        items {
                            id
                            name
                        }
                    }
                }
            }`;
            
            const res = await monday.api(query);
            if (res.data?.boards?.[0]?.items_page?.items) {
                setProducts(res.data.boards[0].items_page.items);
            } else {
                setProducts([]);
            }
        } catch (err) {
            console.error('Error fetching products for customer:', err);
            setProducts([]);
        } finally {
            setLoadingProducts(false);
        }
    };
    
    // יצירת מוצר חדש
    const createNewProduct = async (productName) => {
        if (!customSettings.productsBoardId || !customSettings.productsCustomerColumnId || !productName?.trim() || !selectedItem) return;
        
        try {
            const columnValues = JSON.stringify({
                [customSettings.productsCustomerColumnId]: {
                    item_ids: [parseInt(selectedItem.id)]
                }
            });
            
            const mutation = `mutation {
                create_item(
                    board_id: ${customSettings.productsBoardId},
                    item_name: "${productName}",
                    column_values: ${JSON.stringify(columnValues)}
                ) {
                    id
                    name
                }
            }`;
            
            const res = await monday.api(mutation);
            if (res.data?.create_item) {
                const newProduct = res.data.create_item;
                setProducts(prev => [...prev, newProduct]);
                setSelectedProduct(newProduct.id);
                console.log('✅ Product created:', newProduct);
            }
        } catch (err) {
            console.error('Error creating product:', err);
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

    // Styles definition based on the image
    const styles = {
        overlay: {
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            zIndex: 10005,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontFamily: 'Figtree, Roboto, Rubik, Noto Kufi Arabic, sans-serif',
        },
        container: {
            backgroundColor: '#e2e4e6', // אפור בהיר מהתמונה
            border: '3px solid #1f2b3e', // מסגרת כחולה כהה עבה
            borderRadius: '24px',
            padding: '24px',
            width: '400px',
            maxWidth: '90%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            position: 'relative'
        },
        title: {
            fontSize: '20px',
            fontWeight: '600',
            color: '#323338',
            margin: 0,
            marginBottom: '10px'
        },
        grid: {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            width: '100%'
        },
        itemButton: (isSelected) => ({
            padding: '12px 8px',
            backgroundColor: isSelected ? '#1f2b3e' : 'transparent', // כחול כהה בבחירה
            color: isSelected ? '#ffffff' : '#1f2b3e',
            border: '2px solid #1f2b3e',
            borderRadius: '50px', // Pill shape
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s',
            textAlign: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
        }),
        input: {
            width: '100%',
            padding: '12px 20px',
            backgroundColor: 'transparent',
            border: '2px solid #1f2b3e',
            borderRadius: '50px',
            fontSize: '14px',
            color: '#1f2b3e',
            textAlign: 'center',
            outline: 'none',
            boxSizing: 'border-box',
            marginTop: '10px'
        },
        saveButton: {
            backgroundColor: '#6a5acd', // סגול מהתמונה
            color: 'white',
            border: '3px solid #1f2b3e',
            borderRadius: '4px', // ריבוע עם פינות מעוגלות קלות
            padding: '10px 40px',
            fontSize: '18px',
            fontWeight: '600',
            cursor: 'pointer',
            marginTop: '20px',
            boxShadow: '0 4px 0 #1f2b3e', // אפקט תלת מימד קטן מהמסגרת
            transition: 'transform 0.1s, box-shadow 0.1s',
            flex: 1
        },
        deleteButton: {
            backgroundColor: '#d83a52',
            color: 'white',
            border: '3px solid #1f2b3e',
            borderRadius: '4px',
            padding: '10px 20px',
            fontSize: '18px',
            fontWeight: '600',
            cursor: 'pointer',
            marginTop: '20px',
            boxShadow: '0 4px 0 #1f2b3e',
            transition: 'transform 0.1s, box-shadow 0.1s',
        },
        productSection: {
            marginTop: '12px',
            width: '100%'
        },
        productLabel: {
            fontSize: '12px',
            fontWeight: '600',
            color: '#1f2b3e',
            marginBottom: '8px',
            display: 'block',
            textAlign: 'center'
        },
        select: {
            width: '100%',
            padding: '8px 12px',
            backgroundColor: '#ffffff',
            border: '1px solid #d0d4e4',
            borderRadius: '4px',
            fontSize: '13px',
            color: '#323338',
            outline: 'none',
            boxSizing: 'border-box',
            cursor: 'pointer'
        },
        productInputSection: {
            display: 'flex',
            gap: '4px',
            alignItems: 'center'
        },
    };

    return (
        <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div style={styles.container}>
                {/* כותרת */}
                <h2 style={styles.title}>פרויקט</h2>

                {/* גריד לקוחות */}
                <div style={styles.grid}>
                    {loading ? (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center' }}>טוען...</div>
                    ) : items.map(item => (
                        <button
                            key={item.id}
                            onClick={() => {
                                setSelectedItem(item.id === selectedItem?.id ? null : item);
                                // טעינת מוצרים כשנבחר לקוח
                                if (item.id !== selectedItem?.id && customSettings.productColumnId) {
                                    fetchProductsForCustomer(item.id);
                                }
                                setSelectedProduct(null); // איפוס בחירת מוצר
                            }}
                            style={styles.itemButton(selectedItem?.id === item.id)}
                        >
                            {item.name}
                        </button>
                    ))}
                </div>
                
                {/* סעיף בחירת מוצר */}
                {customSettings.productColumnId && selectedItem && (
                    <div style={styles.productSection}>
                        <ProductSelect 
                            products={products}
                            selectedProduct={selectedProduct}
                            onSelectProduct={setSelectedProduct}
                            onCreateNew={createNewProduct}
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
                    style={styles.input}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />

                {/* כפתורי פעולה */}
                <div style={{ display: 'flex', gap: '12px', width: '100%', alignItems: 'center' }}>
                    {isEditMode && onDelete && (
                        <button 
                            onClick={() => {
                                if (window.confirm('האם אתה בטוח שברצונך למחוק את האירוע?')) {
                                    onDelete();
                                    onClose();
                                }
                            }}
                            style={styles.deleteButton}
                            title="מחק אירוע"
                        >
                            🗑️
                        </button>
                    )}
                    <button 
                        onClick={handleCreate}
                        style={styles.saveButton}
                        onMouseDown={(e) => {
                            e.currentTarget.style.transform = 'translateY(2px)';
                            e.currentTarget.style.boxShadow = '0 2px 0 #1f2b3e';
                        }}
                        onMouseUp={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 0 #1f2b3e';
                        }}
                    >
                        {isEditMode ? 'עדכן' : 'שמור'}
                    </button>
                </div>
            </div>
        </div>
    );
}
