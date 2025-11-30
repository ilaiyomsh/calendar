import React, { useEffect, useState } from 'react';
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
    const [projectReports, setProjectReports] = useState([]);
    
    // State - מוצרים נבחרים
    const [selectedProducts, setSelectedProducts] = useState({});
    // State - יצירת מוצר לכל פרויקט
    const [isCreatingProduct, setIsCreatingProduct] = useState({});
    
    // איפוס state כאשר התיבה נפתחת או נסגרת
    useEffect(() => {
        if (isOpen) {
            // איפוס כאשר התיבה נפתחת - רק selectedType, לא projectReports
            // projectReports יתעדכן על ידי fetchProjects כש-selectedType משתנה ל-'reports'
            logger.debug('AllDayEventModal', 'Modal opened - resetting selectedType only');
            setSelectedType(null);
            setSelectedProducts({});
            setIsCreatingProduct({});
            // רענון רשימת הלקוחות והמוצרים
            refetchCustomers().then(() => {
                logger.debug('AllDayEventModal', 'Customers refetched after modal opened');
            });
            // לא מאפסים projectReports כאן - זה יקרה ב-fetchProjects
        } else {
            // איפוס גם כאשר התיבה נסגרת (למקרה שהמשתמש סגר בלי לשמור)
            logger.debug('AllDayEventModal', 'Modal closed - resetting all state');
            setSelectedType(null);
            setProjectReports([]);
            setSelectedProducts({});
            setIsCreatingProduct({});
        }
    }, [isOpen, refetchCustomers]);
    
    // אחזור רשימת פרויקטים (לקוחות) - משתמש ב-customers מה-hook שכבר כולל מוצרים
    const fetchProjects = React.useCallback(() => {
        logger.debug('AllDayEventModal', `fetchProjects called - customers count: ${customers.length}`);
        
        if (customers.length === 0) {
            logger.warn('AllDayEventModal', 'No customers available');
            return;
        }
        
        logger.functionStart('AllDayEventModal.fetchProjects');
        
        // Initialize projectReports with empty hours, notes and product, כולל מוצרים
        const newProjectReports = customers.map(customer => ({
            projectId: customer.id,
            projectName: customer.name,
            hours: '',
            notes: '',
            productId: '',
            products: customer.products || []
        }));
        
        logger.debug('AllDayEventModal', `Setting projectReports with ${newProjectReports.length} items:`, newProjectReports.map(r => r.projectName));
        setProjectReports(newProjectReports);
        
        logger.functionEnd('AllDayEventModal.fetchProjects', { count: newProjectReports.length });
    }, [customers]);
    
    // אחזור פרויקטים בעת פתיחת ה-Modal
    useEffect(() => {
        logger.debug('AllDayEventModal', `useEffect triggered - isOpen: ${isOpen}, selectedType: ${selectedType}`);
        if (isOpen && selectedType === 'reports') {
            logger.debug('AllDayEventModal', 'Calling fetchProjects from useEffect - resetting projectReports first');
            // איפוס מפורש לפני טעינה חדשה
            setProjectReports([]);
            fetchProjects();
        } else if (selectedType !== 'reports' && projectReports.length > 0) {
            // אם הסוג שונה מ-'reports', נאפס את projectReports
            logger.debug('AllDayEventModal', 'Selected type changed away from reports - clearing projectReports');
            setProjectReports([]);
        }
    }, [isOpen, selectedType, fetchProjects]);
    
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
    
    const handleCreateProduct = async (projectId, productName) => {
        setIsCreatingProduct(prev => ({ ...prev, [projectId]: true }));
        try {
            const newProduct = await createProduct(projectId, productName);
            if (newProduct) {
                // עדכון projectReports עם המוצר החדש
                setProjectReports(prev =>
                    prev.map(report =>
                        report.projectId === projectId
                            ? { 
                                ...report, 
                                products: [...(report.products || []), newProduct]
                            }
                            : report
                    )
                );
                updateSelectedProduct(projectId, newProduct.id);
            }
        } finally {
            setIsCreatingProduct(prev => ({ ...prev, [projectId]: false }));
        }
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
        
        // איפוס state לפני סגירה
        setSelectedType(null);
        setProjectReports([]);
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
    
    return (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className={styles.container}>
                <h2 className={styles.title}>אירוע יומי</h2>
                <p className={styles.subtitle}>{dateStr}</p>
                
                {/* כפתורי סוג אירוע */}
                <div className={styles.typeButtons}>
                    <button
                        onClick={() => { setSelectedType('sick'); setProjectReports([]); }}
                        className={`${styles.typeButton} ${selectedType === 'sick' ? styles.selected : ''}`}
                    >
                        מחלה
                    </button>
                    <button
                        onClick={() => { setSelectedType('vacation'); setProjectReports([]); }}
                        className={`${styles.typeButton} ${selectedType === 'vacation' ? styles.selected : ''}`}
                    >
                        חופשה
                    </button>
                    <button
                        onClick={() => { setSelectedType('reserves'); setProjectReports([]); }}
                        className={`${styles.typeButton} ${selectedType === 'reserves' ? styles.selected : ''}`}
                    >
                        מילואים
                    </button>
                </div>
                
                {/* כפתור דיווחים מרובים */}
                <button
                    onClick={() => {
                        logger.debug('AllDayEventModal', 'Button clicked - setting selectedType to reports');
                        setSelectedType('reports');
                    }}
                    className={`${styles.typeButton} ${styles.typeButtonFullWidth} ${selectedType === 'reports' ? styles.selected : ''}`}
                >
                    דיווחים מרובים לפרויקטים
                </button>
                
                {/* טבלת דיווחים */}
                {selectedType === 'reports' && (
                    <div className={styles.reportsContainer}>
                        <p className={styles.subtitle} style={{ margin: '8px 0', flexShrink: 0 }}>
                            {loadingCustomers ? 'טוען פרויקטים...' : `בחר פרויקטים (${projectReports.filter(r => r.hours).length} מוגדרים)`}
                        </p>
                        
                        <div className={styles.reportsScrollable}>
                            {(() => {
                                logger.debug('AllDayEventModal', `Rendering ${projectReports.length} project reports:`, projectReports.map(r => r.projectName));
                                return null;
                            })()}
                            {!loadingCustomers && projectReports.map((report) => (
                                <div key={report.projectId} className={styles.reportRow}>
                                    <div className={styles.projectName}>{report.projectName}</div>
                                    {customSettings.productColumnId && (
                                        <ProductSelect 
                                            products={report.products || []}
                                            selectedProduct={selectedProducts[report.projectId] || ''}
                                            onSelectProduct={(productId) => updateSelectedProduct(report.projectId, productId)}
                                            onCreateNew={(productName) => handleCreateProduct(report.projectId, productName)}
                                            isLoading={false}
                                            disabled={false}
                                            isCreatingProduct={isCreatingProduct[report.projectId] || false}
                                        />
                                    )}
                                    <input
                                        type="number"
                                        placeholder="שעות"
                                        value={report.hours}
                                        onChange={(e) => updateProjectReport(report.projectId, 'hours', e.target.value)}
                                        min="0"
                                        step="0.25"
                                        className={styles.input}
                                    />
                                    <input
                                        type="text"
                                        placeholder="הערות"
                                        value={report.notes}
                                        onChange={(e) => updateProjectReport(report.projectId, 'notes', e.target.value)}
                                        className={styles.input}
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
                    className={`${styles.saveButton} ${selectedType ? styles.active : styles.inactive}`}
                    title={selectedType ? 'או לחץ Enter' : 'בחר סוג אירוע'}
                >
                    שמור
                </button>
            </div>
        </div>
    );
}

