import React, { useEffect, useState, useRef } from 'react';
import mondaySdk from 'monday-sdk-js';
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
        <div style={{ position: 'relative', width: '100%', minWidth: 0 }} ref={containerRef}>
            {/* הטריגר */}
            <div 
                style={{
                    width: "100%",
                    minWidth: 0,
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
                    whiteSpace: "nowrap",
                    flex: 1,
                    minWidth: 0,
                    textAlign: 'right'
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

export default function AllDayEventModal({
    isOpen,
    onClose,
    pendingDate,
    onCreate
}) {
    const { customSettings } = useSettings();
    
    // State - בחירת סוג אירוע
    const [selectedType, setSelectedType] = useState(null); // 'sick' | 'vacation' | 'reserves' | 'reports'
    const [projects, setProjects] = useState([]);
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [projectReports, setProjectReports] = useState([]);
    
    // State - מוצרים
    const [products, setProducts] = useState({});
    const [loadingProducts, setLoadingProducts] = useState({});
    const [selectedProducts, setSelectedProducts] = useState({});
    
    // אחזור פרויקטים בעת פתיחת ה-Modal
    useEffect(() => {
        if (isOpen && selectedType === 'reports') {
            fetchProjects();
        }
    }, [isOpen, selectedType]);
    
    // אחזור רשימת פרויקטים (לקוחות)
    const fetchProjects = async () => {
        if (!customSettings.connectedBoardId) return;
        
        setLoadingProjects(true);
        try {
            const query = `query {
                boards(ids: [${customSettings.connectedBoardId}]) {
                    items_page(limit: 100) {
                        items {
                            id
                            name
                        }
                    }
                }
            }`;
            
            const res = await monday.api(query);
            if (res.data?.boards?.[0]?.items_page?.items) {
                const items = res.data.boards[0].items_page.items;
                setProjects(items);
                // Initialize projectReports with empty hours, notes and product
                setProjectReports(items.map(item => ({
                    projectId: item.id,
                    projectName: item.name,
                    hours: '',
                    notes: '',
                    productId: ''
                })));
                
                // טעינת מוצרים לכל לקוח
                const newProducts = {};
                for (const project of items) {
                    fetchProductsForCustomer(project.id);
                }
            }
        } catch (err) {
            console.error('Error fetching projects:', err);
        } finally {
            setLoadingProjects(false);
        }
    };
    
    // אחזור מוצרים לפי לקוח
    const fetchProductsForCustomer = async (customerId) => {
        if (!customSettings.productsBoardId || !customSettings.productsCustomerColumnId) return;
        
        setLoadingProducts(prev => ({ ...prev, [customerId]: true }));
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
                const items = res.data.boards[0].items_page.items;
                setProducts(prev => ({ ...prev, [customerId]: items }));
            }
        } catch (err) {
            console.error('Error fetching products for customer:', err);
        } finally {
            setLoadingProducts(prev => ({ ...prev, [customerId]: false }));
        }
    };
    
    // יצירת מוצר חדש
    const createNewProduct = async (customerId, productName) => {
        if (!customSettings.productsBoardId || !customSettings.productsCustomerColumnId || !productName?.trim()) return;
        
        try {
            const columnValues = JSON.stringify({
                [customSettings.productsCustomerColumnId]: {
                    item_ids: [parseInt(customerId)]
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
                setProducts(prev => ({
                    ...prev,
                    [customerId]: [...(prev[customerId] || []), newProduct]
                }));
                setSelectedProducts(prev => ({
                    ...prev,
                    [customerId]: newProduct.id
                }));
                console.log('✅ Product created:', newProduct);
            }
        } catch (err) {
            console.error('Error creating product:', err);
        }
    };
    
    // עדכון שעות, הערות או מוצר לפרויקט
    const updateProjectReport = (projectId, field, value) => {
        setProjectReports(prev =>
            prev.map(report =>
                report.projectId === projectId
                    ? { ...report, [field]: value }
                    : report
            )
        );
    };
    
    // עדכון מוצר שנבחר
    const updateSelectedProduct = (projectId, productId) => {
        setSelectedProducts(prev => ({
            ...prev,
            [projectId]: productId
        }));
        updateProjectReport(projectId, 'productId', productId);
    };
    
    const handleCreate = () => {
        if (!selectedType) return;
        
        if (selectedType === 'reports') {
            // סינון דיווחים עם שעות
            const validReports = projectReports.filter(r => r.hours && parseFloat(r.hours) > 0);
            if (validReports.length === 0) {
                alert('יש להוסיף לפחות פרויקט אחד עם שעות');
                return;
            }
            
            // בדיקת בחירת מוצרים אם מגדרות מוגדרות
            if (customSettings.productColumnId) {
                const missingProducts = validReports.filter(r => !r.productId);
                if (missingProducts.length > 0) {
                    alert('יש לבחור מוצר לכל דיווח שעות');
                    return;
                }
            }
            
            onCreate({
                type: 'reports',
                date: pendingDate,
                reports: validReports
            });
        } else {
            onCreate({
                type: selectedType,
                date: pendingDate
            });
        }
        
        onClose();
    };
    
    // טיפול בלחיצת Enter
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Enter' && selectedType && isOpen) {
                if (selectedType !== 'reports') {
                    // לבחירות sick/vacation/reserves - שמור מיד
                    handleCreate();
                } else {
                    // לדיווחים מרובים - בדוק אם יש דיווחים עם שעות
                    const validReports = projectReports.filter(r => r.hours && parseFloat(r.hours) > 0);
                    if (validReports.length > 0) {
                        handleCreate();
                    }
                }
            }
        };
        
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [selectedType, isOpen, projectReports]);
    
    if (!isOpen || !pendingDate) return null;
    
    const dateStr = pendingDate.toLocaleDateString('he-IL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
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
            backgroundColor: '#e2e4e6',
            border: '3px solid #1f2b3e',
            borderRadius: '24px',
            padding: '24px',
            width: '600px',
            maxWidth: '90%',
            maxHeight: '80vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            position: 'relative'
        },
        title: {
            fontSize: '20px',
            fontWeight: '600',
            color: '#323338',
            margin: 0,
            textAlign: 'center',
            flexShrink: 0
        },
        subtitle: {
            fontSize: '14px',
            color: '#676879',
            textAlign: 'center',
            margin: 0,
            flexShrink: 0
        },
        typeButtons: {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '12px',
            width: '100%',
            flexShrink: 0
        },
        typeButton: (isSelected) => ({
            padding: '12px 8px',
            backgroundColor: isSelected ? '#1f2b3e' : 'transparent',
            color: isSelected ? '#ffffff' : '#1f2b3e',
            border: '2px solid #1f2b3e',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s',
            textAlign: 'center'
        }),
        reportsContainer: {
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden'
        },
        reportsScrollable: {
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            overflowY: 'auto',
            overflowX: 'hidden',
            flex: 1,
            paddingRight: '4px'
        },
        reportRow: {
            display: 'grid',
            gridTemplateColumns: '15% 35% 15% 25%',
            gap: '8px',
            alignItems: 'center',
            padding: '0',
            width: '100%'
        },
        select: {
            padding: '6px 8px',
            backgroundColor: '#ffffff',
            border: '1px solid #d0d4e4',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#323338',
            outline: 'none',
            boxSizing: 'border-box',
            cursor: 'pointer'
        },
        addProductBtn: {
            padding: '4px 8px',
            backgroundColor: '#f0f2f5',
            border: '1px solid #d0d4e4',
            borderRadius: '4px',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s'
        },
        productInputSection: {
            display: 'flex',
            gap: '4px',
            alignItems: 'center'
        },
        productInput: {
            flex: 1,
            padding: '6px 8px',
            backgroundColor: '#ffffff',
            border: '1px solid #0073e6',
            borderRadius: '4px',
            fontSize: '12px',
            outline: 'none'
        },
        smallBtn: {
            padding: '4px 8px',
            fontSize: '11px',
            borderRadius: '3px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 'bold'
        },
        projectName: {
            fontSize: '13px',
            color: '#323338',
            fontWeight: '500',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
        },
        input: {
            padding: '10px 16px',
            backgroundColor: 'transparent',
            border: '2px solid #1f2b3e',
            borderRadius: '50px',
            fontSize: '13px',
            color: '#1f2b3e',
            outline: 'none',
            boxSizing: 'border-box'
        },
        saveButton: (isActive) => ({
            backgroundColor: isActive ? '#6a5acd' : '#d0d4e4',
            color: isActive ? 'white' : '#676879',
            border: '3px solid #1f2b3e',
            borderRadius: '4px',
            padding: '10px 40px',
            fontSize: '18px',
            fontWeight: '600',
            cursor: isActive ? 'pointer' : 'not-allowed',
            alignSelf: 'center',
            marginTop: 'auto',
            flexShrink: 0,
            opacity: isActive ? 1 : 0.6,
            transition: 'all 0.2s'
        })
    };
    
    return (
        <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div style={styles.container}>
                <h2 style={styles.title}>אירוע יומי</h2>
                <p style={styles.subtitle}>{dateStr}</p>
                
                {/* כפתורי סוג אירוע */}
                <div style={styles.typeButtons}>
                    <button
                        onClick={() => { setSelectedType('sick'); setProjectReports([]); }}
                        style={styles.typeButton(selectedType === 'sick')}
                    >
                        מחלה
                    </button>
                    <button
                        onClick={() => { setSelectedType('vacation'); setProjectReports([]); }}
                        style={styles.typeButton(selectedType === 'vacation')}
                    >
                        חופשה
                    </button>
                    <button
                        onClick={() => { setSelectedType('reserves'); setProjectReports([]); }}
                        style={styles.typeButton(selectedType === 'reserves')}
                    >
                        מילואים
                    </button>
                </div>
                
                {/* כפתור דיווחים מרובים */}
                <button
                    onClick={() => { setSelectedType('reports'); fetchProjects(); }}
                    style={{
                        ...styles.typeButton(selectedType === 'reports'),
                        gridColumn: '1 / -1',
                        marginTop: '8px',
                        flexShrink: 0
                    }}
                >
                    דיווחים מרובים לפרויקטים
                </button>
                
                {/* טבלת דיווחים */}
                {selectedType === 'reports' && (
                    <div style={styles.reportsContainer}>
                        <p style={{ ...styles.subtitle, margin: '8px 0', flexShrink: 0 }}>
                            {loadingProjects ? 'טוען פרויקטים...' : `בחר פרויקטים (${projectReports.filter(r => r.hours).length} מוגדרים)`}
                        </p>
                        
                        <div style={styles.reportsScrollable}>
                            {!loadingProjects && projectReports.map((report) => (
                                <div key={report.projectId} style={styles.reportRow}>
                                    <div style={styles.projectName}>{report.projectName}</div>
                                    {customSettings.productColumnId && (
                                        <ProductSelect 
                                            products={products[report.projectId] || []}
                                            selectedProduct={selectedProducts[report.projectId] || ''}
                                            onSelectProduct={(productId) => updateSelectedProduct(report.projectId, productId)}
                                            onCreateNew={(productName) => createNewProduct(report.projectId, productName)}
                                            isLoading={loadingProducts[report.projectId] || false}
                                            disabled={false}
                                        />
                                    )}
                                    <input
                                        type="number"
                                        placeholder="שעות"
                                        value={report.hours}
                                        onChange={(e) => updateProjectReport(report.projectId, 'hours', e.target.value)}
                                        min="0"
                                        step="0.25"
                                        style={styles.input}
                                    />
                                    <input
                                        type="text"
                                        placeholder="הערות"
                                        value={report.notes}
                                        onChange={(e) => updateProjectReport(report.projectId, 'notes', e.target.value)}
                                        style={styles.input}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* כפתור שמירה */}
                <button
                    onClick={handleCreate}
                    disabled={!selectedType}
                    style={styles.saveButton(!!selectedType)}
                    title={selectedType ? 'או לחץ Enter' : 'בחר סוג אירוע'}
                >
                    שמור
                </button>
            </div>
        </div>
    );
}

