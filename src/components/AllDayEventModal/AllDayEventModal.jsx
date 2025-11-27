import React, { useEffect, useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useCustomers } from '../../hooks/useCustomers';
import { useProductsMultiple } from '../../hooks/useProductsMultiple';
import { fetchCustomersForUser } from '../../utils/mondayApi';
import ProductSelect from '../ProductSelect';
import logger from '../../utils/logger';
import mondaySdk from 'monday-sdk-js';
import styles from './AllDayEventModal.module.css';

const monday = mondaySdk();

export default function AllDayEventModal({
    isOpen,
    onClose,
    pendingDate,
    onCreate
}) {
    const { customSettings } = useSettings();
    const { customers, loading: loadingCustomers } = useCustomers();
    const { products, loadingProducts, fetchForCustomer, createProduct } = useProductsMultiple();
    
    // State - בחירת סוג אירוע
    const [selectedType, setSelectedType] = useState(null); // 'sick' | 'vacation' | 'reserves' | 'reports'
    const [projectReports, setProjectReports] = useState([]);
    
    // State - מוצרים נבחרים
    const [selectedProducts, setSelectedProducts] = useState({});
    
    // איפוס state כאשר התיבה נפתחת או נסגרת
    useEffect(() => {
        if (isOpen) {
            // איפוס כאשר התיבה נפתחת
            setSelectedType(null);
            setProjectReports([]);
            setSelectedProducts({});
        } else {
            // איפוס גם כאשר התיבה נסגרת (למקרה שהמשתמש סגר בלי לשמור)
            setSelectedType(null);
            setProjectReports([]);
            setSelectedProducts({});
        }
    }, [isOpen]);
    
    // אחזור פרויקטים בעת פתיחת ה-Modal
    useEffect(() => {
        if (isOpen && selectedType === 'reports') {
            fetchProjects();
        }
    }, [isOpen, selectedType]);
    
    // אחזור רשימת פרויקטים (לקוחות)
    const fetchProjects = async () => {
        if (!customSettings.connectedBoardId) return;
        
        logger.functionStart('AllDayEventModal.fetchProjects');

        try {
            // שימוש ב-customers מה-hook, או אחזור ישיר אם צריך
            let items = customers;
            
            if (!items || items.length === 0) {
                // אם אין לקוחות מה-hook, נטען ישירות
                items = await fetchCustomersForUser(
                    monday,
                    customSettings.connectedBoardId,
                    customSettings.peopleColumnId
                );
            }
            
            // Initialize projectReports with empty hours, notes and product
            setProjectReports(items.map(item => ({
                projectId: item.id,
                projectName: item.name,
                hours: '',
                notes: '',
                productId: ''
            })));
            
            // טעינת מוצרים לכל לקוח
            for (const project of items) {
                fetchForCustomer(project.id);
            }
            
            logger.functionEnd('AllDayEventModal.fetchProjects', { count: items.length });
        } catch (err) {
            logger.error('AllDayEventModal', 'Error fetching projects', err);
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
    
    const handleCreateProduct = async (projectId, productName) => {
        const newProduct = await createProduct(projectId, productName);
        if (newProduct) {
            updateSelectedProduct(projectId, newProduct.id);
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
                    onClick={() => { setSelectedType('reports'); fetchProjects(); }}
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
                            {!loadingCustomers && projectReports.map((report) => (
                                <div key={report.projectId} className={styles.reportRow}>
                                    <div className={styles.projectName}>{report.projectName}</div>
                                    {customSettings.productColumnId && (
                                        <ProductSelect 
                                            products={products[report.projectId] || []}
                                            selectedProduct={selectedProducts[report.projectId] || ''}
                                            onSelectProduct={(productId) => updateSelectedProduct(report.projectId, productId)}
                                            onCreateNew={(productName) => handleCreateProduct(report.projectId, productName)}
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

