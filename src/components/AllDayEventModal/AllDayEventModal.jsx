import React, { useEffect, useState } from 'react';
import { Sun, Thermometer, Briefcase, FileText, Plus, Trash2, X } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { useCustomers } from '../../hooks/useCustomers';
import { useProductsMultiple } from '../../hooks/useProductsMultiple';
import ProductSelect from '../ProductSelect';
import logger from '../../utils/logger';
import styles from './AllDayEventModal.module.css';

export default function AllDayEventModal({
    isOpen,
    onClose,
    pendingDate,
    onCreate
}) {
    const { customSettings } = useSettings();
    const { customers, loading: loadingCustomers, refetch: refetchCustomers } = useCustomers();
    const { createProduct } = useProductsMultiple();
    
    // State - בחירת סוג אירוע
    const [selectedType, setSelectedType] = useState(null); // 'sick' | 'vacation' | 'reserves' | 'reports'
    
    // State - ניהול תצוגה
    const [viewMode, setViewMode] = useState('menu'); // 'menu' | 'form'
    const [searchTerm, setSearchTerm] = useState('');
    
    // State - דיווחים שנוספו (במקום projectReports שמכיל את כל הלקוחות)
    const [addedReports, setAddedReports] = useState([]);
    
    // State - מוצרים נבחרים
    const [selectedProducts, setSelectedProducts] = useState({});
    // State - יצירת מוצר לכל פרויקט
    const [isCreatingProduct, setIsCreatingProduct] = useState({});
    
    // איפוס state כאשר התיבה נפתחת או נסגרת
    useEffect(() => {
        if (isOpen) {
            logger.debug('AllDayEventModal', 'Modal opened - resetting state');
            setSelectedType(null);
            setViewMode('menu');
            setAddedReports([]);
            setSearchTerm('');
            setSelectedProducts({});
            setIsCreatingProduct({});
            // רענון רשימת הלקוחות והמוצרים
            refetchCustomers().then(() => {
                logger.debug('AllDayEventModal', 'Customers refetched after modal opened');
            });
        } else {
            // איפוס גם כאשר התיבה נסגרת (למקרה שהמשתמש סגר בלי לשמור)
            logger.debug('AllDayEventModal', 'Modal closed - resetting all state');
            setSelectedType(null);
            setViewMode('menu');
            setAddedReports([]);
            setSearchTerm('');
            setSelectedProducts({});
            setIsCreatingProduct({});
        }
    }, [isOpen, refetchCustomers]);
    
    // הוספת שורת דיווח מלקוח
    const addReportRow = (customer) => {
        if (!customer) return;
        
        // בדיקה אם הלקוח כבר קיים
        if (addedReports.some(r => r.projectId === customer.id)) {
            return;
        }
        
        setAddedReports(prev => [...prev, {
            id: Date.now(),
            projectId: customer.id,
            projectName: customer.name,
            products: customer.products || [],
            hours: '',
            notes: '',
            productId: ''
        }]);
    };
    
    // הסרת שורת דיווח
    const removeReportRow = (id) => {
        const report = addedReports.find(r => r.id === id);
        if (report) {
            // הסרת המוצר הנבחר
            setSelectedProducts(prev => {
                const newSelected = { ...prev };
                delete newSelected[report.projectId];
                return newSelected;
            });
        }
        setAddedReports(prev => prev.filter(r => r.id !== id));
    };
    
    // סינון לקוחות לפי חיפוש
    const filteredCustomers = customers.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    // עדכון שעות, הערות או מוצר לדיווח
    const updateReport = (id, field, value) => {
        setAddedReports(prev =>
            prev.map(report =>
                report.id === id
                    ? { ...report, [field]: value }
                    : report
            )
        );
    };
    
    // עדכון מוצר שנבחר
    const updateSelectedProduct = (reportId, productId) => {
        const report = addedReports.find(r => r.id === reportId);
        if (report) {
            setSelectedProducts(prev => ({
                ...prev,
                [report.projectId]: productId
            }));
            updateReport(reportId, 'productId', productId);
        }
    };
    
    const handleCreateProduct = async (reportId, productName) => {
        const report = addedReports.find(r => r.id === reportId);
        if (!report) return;
        
        setIsCreatingProduct(prev => ({ ...prev, [report.projectId]: true }));
        try {
            const newProduct = await createProduct(report.projectId, productName);
            if (newProduct) {
                // עדכון addedReports עם המוצר החדש
                setAddedReports(prev =>
                    prev.map(r =>
                        r.id === reportId
                            ? { 
                                ...r, 
                                products: [...(r.products || []), newProduct]
                            }
                            : r
                    )
                );
                updateSelectedProduct(reportId, newProduct.id);
            }
        } finally {
            setIsCreatingProduct(prev => ({ ...prev, [report.projectId]: false }));
        }
    };
    
    // טיפול בבחירת סוג אירוע (sick/vacation/reserves)
    const handleSingleTypeSelect = (type) => {
        setSelectedType(type);
        onCreate({
            type: type,
            date: pendingDate
        });
        onClose();
    };
    
    // טיפול בחזרה/ביטול
    const handleCancelOrBack = () => {
        if (viewMode === 'form') {
            setViewMode('menu');
            setSelectedType(null);
            setAddedReports([]);
            setSearchTerm('');
        } else {
            onClose();
        }
    };
    
    const handleCreate = () => {
        if (!selectedType) return;
        
        if (selectedType === 'reports') {
            // סינון דיווחים עם שעות
            const validReports = addedReports.filter(r => r.hours && parseFloat(r.hours) > 0);
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
            
            // המרה לפורמט המקורי (ללא id הפנימי)
            const formattedReports = validReports.map(r => ({
                projectId: r.projectId,
                projectName: r.projectName,
                hours: r.hours,
                notes: r.notes,
                productId: r.productId
            }));
            
            onCreate({
                type: 'reports',
                date: pendingDate,
                reports: formattedReports
            });
        } else {
            onCreate({
                type: selectedType,
                date: pendingDate
            });
        }
        
        // איפוס state לפני סגירה
        setSelectedType(null);
        setViewMode('menu');
        setAddedReports([]);
        setSearchTerm('');
        setSelectedProducts({});
        
        onClose();
    };
    
    // טיפול בלחיצת Enter
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Enter' && selectedType && isOpen) {
                if (selectedType !== 'reports') {
                    // לבחירות sick/vacation/reserves - שמור מיד
                    handleCreate();
                } else if (viewMode === 'form') {
                    // לדיווחים מרובים - בדוק אם יש דיווחים עם שעות
                    const validReports = addedReports.filter(r => r.hours && parseFloat(r.hours) > 0);
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
    }, [selectedType, isOpen, addedReports, viewMode]);
    
    if (!isOpen || !pendingDate) return null;
    
    const dateStr = pendingDate.toLocaleDateString('he-IL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // רינדור תפריט ראשי
    const renderMenu = () => (
        <div className={styles.menuContainer}>
            <button 
                className={`${styles.menuButton} ${styles.btnVacation}`} 
                onClick={() => handleSingleTypeSelect('vacation')}
            >
                <span className={styles.icon}><Sun size={20} color="#00c875" /></span>
                <span style={{ marginRight: '12px' }}>חופשה</span>
            </button>
            <button 
                className={`${styles.menuButton} ${styles.btnSick}`} 
                onClick={() => handleSingleTypeSelect('sick')}
            >
                <span className={styles.icon}><Thermometer size={20} color="#e2445c" /></span>
                <span style={{ marginRight: '12px' }}>מחלה</span>
            </button>
            <button 
                className={`${styles.menuButton} ${styles.btnReserves}`} 
                onClick={() => handleSingleTypeSelect('reserves')}
            >
                <span className={styles.icon}><Briefcase size={20} color="#579bfc" /></span>
                <span style={{ marginRight: '12px' }}>מילואים</span>
            </button>
            <button 
                className={`${styles.menuButton} ${styles.btnMultiple}`} 
                onClick={() => {
                    logger.debug('AllDayEventModal', 'Button clicked - setting viewMode to form');
                    setSelectedType('reports');
                    setViewMode('form');
                }}
            >
                <span className={styles.icon}><FileText size={20} color="#a25ddc" /></span>
                <span style={{ marginRight: '12px' }}>דיווחים מרובים / שעות עבודה</span>
            </button>
        </div>
    );
    
    // רינדור תצוגה מפוצלת
    const renderSplitForm = () => {
        const hasProductColumn = customSettings.productColumnId;
        const gridColumns = hasProductColumn 
            ? '1.5fr 1.5fr 0.7fr 1.5fr 30px'  // לקוח, מוצר, שעות, הערות, מחיקה
            : '2fr 0.7fr 1.5fr 30px';         // לקוח, שעות, הערות, מחיקה
        
        return (
            <div className={styles.splitView}>
                <div className={styles.mainForm}>
                    {addedReports.length === 0 && (
                        <div className={styles.emptyState}>
                            <FileText size={48} color="#d0d4e4" />
                            <div>
                                בחר לקוח מהרשימה בצד שמאל כדי להתחיל
                            </div>
                        </div>
                    )}
                    {addedReports.map((report) => (
                        <div key={report.id} className={styles.reportRow}>
                            <div 
                                className={styles.rowGrid}
                                style={{ gridTemplateColumns: gridColumns }}
                            >
                                {/* שדה לקוח (קריאה בלבד) */}
                                <div className={styles.fieldGroup}>
                                    <label>לקוח</label>
                                    <input
                                        className={styles.input}
                                        value={report.projectName}
                                        readOnly
                                        style={{ backgroundColor: '#f7f9fa', color: '#666', border: '1px solid #e6e9ef' }}
                                    />
                                </div>

                                {/* שדה מוצר */}
                                {hasProductColumn && (
                                    <div className={styles.fieldGroup}>
                                        <label>מוצר</label>
                                        <ProductSelect 
                                            products={report.products || []}
                                            selectedProduct={selectedProducts[report.projectId] || ''}
                                            onSelectProduct={(productId) => updateSelectedProduct(report.id, productId)}
                                            onCreateNew={async (productName) => await handleCreateProduct(report.id, productName)}
                                            isLoading={false}
                                            disabled={false}
                                            isCreatingProduct={isCreatingProduct[report.projectId] || false}
                                        />
                                    </div>
                                )}

                                {/* שדה שעות */}
                                <div className={styles.fieldGroup}>
                                    <label>משך (שעות)</label>
                                    <input
                                        type="number"
                                        className={styles.input}
                                        value={report.hours}
                                        onChange={(e) => updateReport(report.id, 'hours', e.target.value)}
                                        step="0.5"
                                        min="0"
                                        placeholder="שעות"
                                    />
                                </div>

                                {/* שדה הערות */}
                                <div className={styles.fieldGroup}>
                                    <label>הערות</label>
                                    <input
                                        className={styles.input}
                                        value={report.notes}
                                        onChange={(e) => updateReport(report.id, 'notes', e.target.value)}
                                        placeholder="..."
                                    />
                                </div>

                                {/* מחיקה */}
                                <button 
                                    className={styles.removeBtn} 
                                    onClick={() => removeReportRow(report.id)}
                                    title="הסר דיווח"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className={styles.sidebar}>
                    <div className={styles.sidebarHeader}>בחר לקוח להוספה</div>
                    <input 
                        type="text" 
                        placeholder="חיפוש לקוח..." 
                        className={styles.searchBox}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                    <div className={styles.customerList}>
                        {loadingCustomers ? (
                            <div style={{ padding: '10px', color: '#999', fontSize: '0.8rem', textAlign: 'center' }}>
                                טוען לקוחות...
                            </div>
                        ) : filteredCustomers.length > 0 ? (
                            filteredCustomers.map(customer => {
                                const isAlreadyAdded = addedReports.some(r => r.projectId === customer.id);
                                return (
                                    <div 
                                        key={customer.id} 
                                        className={styles.customerItem}
                                        onClick={() => !isAlreadyAdded && addReportRow(customer)}
                                        style={{
                                            opacity: isAlreadyAdded ? 0.5 : 1,
                                            cursor: isAlreadyAdded ? 'not-allowed' : 'pointer'
                                        }}
                                        title={isAlreadyAdded ? 'לקוח זה כבר נוסף' : 'לחץ להוספה'}
                                    >
                                        <span>{customer.name}</span>
                                        {!isAlreadyAdded && <Plus size={14} color="#0073ea" />}
                                    </div>
                                );
                            })
                        ) : (
                            <div style={{ padding: '10px', color: '#999', fontSize: '0.8rem', textAlign: 'center' }}>
                                {searchTerm ? 'לא נמצאו לקוחות' : 'אין לקוחות זמינים'}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };
    
    return (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div 
                className={`${styles.modal} ${viewMode === 'form' ? styles.modalWide : ''}`}
                onClick={e => e.stopPropagation()}
            >
                <div className={styles.header}>
                    <h2>
                        {viewMode === 'menu' ? 'סוג דיווח ליום זה' : 'דיווח שעות מרוכז'}
                        {pendingDate && ` - ${pendingDate.toLocaleDateString('he-IL')}`}
                    </h2>
                    <button className={styles.closeButton} onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                <div className={styles.content}>
                    {viewMode === 'menu' ? renderMenu() : renderSplitForm()}
                </div>

                <div className={styles.footer}>
                    <button 
                        className={`${styles.button} ${styles.cancelBtn}`} 
                        onClick={handleCancelOrBack}
                    >
                        {viewMode === 'menu' ? 'ביטול' : 'חזרה לתפריט'}
                    </button>
                    {viewMode === 'form' && (
                        <button 
                            className={`${styles.button} ${styles.saveBtn}`} 
                            onClick={handleCreate}
                        >
                            שמור דיווחים
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
