import React, { useEffect, useState } from 'react';
import { Sun, Thermometer, Briefcase, FileText, Plus, Trash2, X, Clock } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { useCustomers } from '../../hooks/useCustomers';
import { useProductsMultiple } from '../../hooks/useProductsMultiple';
import { useStageOptions } from '../../hooks/useStageOptions';
import ProductSelect from '../ProductSelect';
import StageSelect from '../StageSelect';
import TimeSelect from '../TimeSelect';
import ConfirmDialog from '../ConfirmDialog';
import { generateTimeOptions30Minutes, durationOptions30Minutes, roundToNearest30Minutes } from '../../constants/calendarConfig';
import logger from '../../utils/logger';
import styles from './AllDayEventModal.module.css';

export default function AllDayEventModal({
    isOpen,
    onClose,
    pendingDate,
    onCreate,
    eventToEdit = null,
    isEditMode = false,
    onUpdate = null,
    onDelete = null,
    monday
}) {
    const { customSettings } = useSettings();
    const { customers, loading: loadingCustomers, refetch: refetchCustomers } = useCustomers();
    const { createProduct, fetchForCustomer, products: productsByCustomer } = useProductsMultiple();
    
    // יצירת רשימת זמנים לפי טווח שעות העבודה
    const timeOptions = React.useMemo(() => {
        const minTime = customSettings.workDayStart || "00:00";
        const maxTime = customSettings.workDayEnd || "23:30";
        return generateTimeOptions30Minutes(minTime, maxTime);
    }, [customSettings.workDayStart, customSettings.workDayEnd]);
    
    // State - בחירת סוג אירוע
    const [selectedType, setSelectedType] = useState(null); // 'sick' | 'vacation' | 'reserves' | 'reports'
    
    // State - ניהול תצוגה
    const [viewMode, setViewMode] = useState('menu'); // 'menu' | 'form'
    const [searchTerm, setSearchTerm] = useState('');
    
    // State - דיווחים שנוספו (במקום projectReports שמכיל את כל הלקוחות)
    const [addedReports, setAddedReports] = useState([]);
    
    // State - מוצרים נבחרים
    const [selectedProducts, setSelectedProducts] = useState({});
    // State - שלבים נבחרים
    const [selectedStages, setSelectedStages] = useState({});
    // State - יצירת מוצר לכל פרויקט
    const [isCreatingProduct, setIsCreatingProduct] = useState({});
    
    // State - תיבות אישור
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [editingDuration, setEditingDuration] = useState({}); // state מקומי לעריכת שדה המשך
    
    // State - boardId
    const [boardId, setBoardId] = useState(null);
    useEffect(() => {
        if (monday) {
            monday.get('context').then(context => {
                setBoardId(context.data?.boardId);
            });
        }
    }, [monday]);
    
    // טעינת ערכי שלב
    const { stageOptions, loading: loadingStages } = useStageOptions(
        monday,
        customSettings.stageColumnId && boardId ? boardId : null,
        customSettings.stageColumnId
    );
    
    // --- פונקציות עזר לחישובי זמן (בהתאם לדוגמה) ---
    const parseTime = (timeStr) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };

    const formatTime = (minutes) => {
        let h = Math.floor(minutes / 60) % 24;
        let m = minutes % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const addTime = (start, durationStr) => {
        if (!start) return '';
        const totalMinutes = parseTime(start) + parseTime(durationStr || '01:00');
        return formatTime(totalMinutes);
    };
    
    // איפוס state כאשר התיבה נפתחת או נסגרת
    useEffect(() => {
        if (isOpen) {
            logger.debug('AllDayEventModal', 'Modal opened - resetting state');
            
            // אם במצב עריכה, זיהוי סוג האירוע לפי הכותרת
            if (isEditMode && eventToEdit) {
                const titleToType = {
                    'מחלה': 'sick',
                    'חופשה': 'vacation',
                    'מילואים': 'reserves'
                };
                const detectedType = titleToType[eventToEdit.title];
                if (detectedType) {
                    setSelectedType(detectedType);
                    logger.debug('AllDayEventModal', `Edit mode - detected type: ${detectedType}`);
                }
                // במצב עריכה של אירוע יומי פשוט - לא צריך לטעון לקוחות
            } else {
                // מצב יצירה - איפוס
                setSelectedType(null);
                setViewMode('menu');
                setAddedReports([]);
                setSearchTerm('');
                setSelectedProducts({});
                setSelectedStages({});
                setIsCreatingProduct({});
                setEditingDuration({}); // איפוס state של עריכת משך
                
                // רענון רשימת הלקוחות רק במצב יצירה (למקרה שיבחר "דיווחים מרובים")
                refetchCustomers().then(() => {
                    logger.debug('AllDayEventModal', 'Customers refetched after modal opened');
                });
            }
        } else {
            // איפוס גם כאשר התיבה נסגרת (למקרה שהמשתמש סגר בלי לשמור)
            logger.debug('AllDayEventModal', 'Modal closed - resetting all state');
            setSelectedType(null);
            setViewMode('menu');
            setAddedReports([]);
            setSearchTerm('');
            setSelectedProducts({});
            setSelectedStages({});
            setIsCreatingProduct({});
            setEditingDuration({}); // איפוס state של עריכת משך
        }
    }, [isOpen, isEditMode, eventToEdit, refetchCustomers]);
    
    // עדכון מוצרים ב-addedReports כשהמוצרים נטענים
    useEffect(() => {
        setAddedReports(prev => prev.map(report => ({
            ...report,
            products: productsByCustomer[report.projectId] || []
        })));
    }, [productsByCustomer]);
    
    // הוספת שורת דיווח מלקוח
    const addReportRow = (customer) => {
        if (!customer) return;
        
        // מאפשרים הוספת אותו לקוח מספר פעמים
        
        // טעינת מוצרים של הלקוח
        if (customSettings.productsCustomerColumnId) {
            fetchForCustomer(customer.id);
        }
        
        // חישוב שעת התחלה: הלקוח הראשון מקבל 8:00, האחרים ממשיכים מהסיום של הקודם
        let startTime = '08:00';
        if (addedReports.length > 0) {
            const lastReport = addedReports[addedReports.length - 1];
            if (lastReport.endTime) {
                startTime = lastReport.endTime;
            } else if (lastReport.startTime && lastReport.hours) {
                // אם יש התחלה ומשך, מחשבים את הסיום
                const hoursInMinutes = parseFloat(lastReport.hours) * 60;
                const startTotalMins = parseTime(lastReport.startTime);
                const endTotalMins = startTotalMins + hoursInMinutes;
                startTime = formatTime(endTotalMins);
            }
        }
        
        // משך ברירת מחדל: שעה אחת
        const defaultDuration = '01:00';
        const endTime = addTime(startTime, defaultDuration);
        const hours = '1.00'; // שעה אחת בפורמט שעות עשרוניות
        
        setAddedReports(prev => [...prev, {
            id: Date.now(),
            projectId: customer.id,
            projectName: customer.name,
            products: [],
            hours: hours,
            startTime: startTime,
            endTime: endTime,
            notes: '',
            productId: '',
            stageId: ''
        }]);
    };
    
    // הסרת שורת דיווח
    const removeReportRow = (id) => {
        const report = addedReports.find(r => r.id === id);
        if (report) {
            // הסרת המוצר הנבחר
            setSelectedProducts(prev => {
                const newSelected = { ...prev };
                delete newSelected[id];  // שימוש ב-id (reportId) במקום projectId
                return newSelected;
            });
            // הסרת השלב הנבחר
            setSelectedStages(prev => {
                const newSelected = { ...prev };
                delete newSelected[id];
                return newSelected;
            });
        }
        setAddedReports(prev => prev.filter(r => r.id !== id));
    };
    
    // סינון לקוחות לפי חיפוש ומיון לפי הא"ב
    const filteredCustomers = customers
        .filter(c => 
            c.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .slice() // יצירת עותק כדי לא לשנות את המערך המקורי
        .sort((a, b) => a.name.localeCompare(b.name, 'he')); // מיון לפי הא"ב בעברית
    
    // פונקציה לחישוב משך זמן משעות התחלה וסיום
    const calculateHoursFromTimeRange = (startTime, endTime) => {
        if (!startTime || !endTime) return null;
        
        const startTotalMinutes = parseTime(startTime);
        const endTotalMinutes = parseTime(endTime);
        
        if (endTotalMinutes <= startTotalMinutes) return null; // זמן סיום צריך להיות אחרי זמן התחלה
        
        const diffMinutes = endTotalMinutes - startTotalMinutes;
        const diffHours = diffMinutes / 60;
        
        // וידוא שהמשך מינימלי הוא 30 דקות (0.5 שעות)
        const minHours = 0.5;
        const finalHours = Math.max(diffHours, minHours);
        
        return finalHours.toFixed(2);
    };
    
    // פונקציה לחישוב משך זמן בפורמט HH:mm
    const calculateDurationStr = (start, end) => {
        if (!start || !end) return '01:00';
        let diff = parseTime(end) - parseTime(start);
        if (diff < 0) diff += 24 * 60; // טיפול במעבר יום
        return formatTime(diff);
    };
    
    // --- לוגיקת Smart Cascade (פתרון חפיפות אוטומטי) ---
    const resolveOverlaps = (currentEntries, startIndex) => {
        const updated = [...currentEntries];
        
        for (let i = startIndex; i < updated.length - 1; i++) {
            const current = updated[i];
            const next = updated[i + 1];

            // בדיקה אם יש שעות התחלה וסיום
            if (!current.startTime || !current.endTime || !next.startTime) {
                break; // אם אין שעות, לא מטפלים בחפיפות
            }

            // המרה לדקות להשוואה קלה
            const currentEndMins = parseTime(current.endTime);
            const nextStartMins = parseTime(next.startTime);

            // תנאי החפיפה: אם הסיום של הנוכחי "נכנס" לתוך ההתחלה של הבא
            if (currentEndMins > nextStartMins) {
                // שמירת המשך המקורי של הבא לפני השינוי
                let originalDuration = '01:00'; // ברירת מחדל
                if (next.endTime && next.startTime) {
                    originalDuration = calculateDurationStr(next.startTime, next.endTime);
                } else if (next.hours) {
                    originalDuration = formatTime(parseFloat(next.hours) * 60);
                }
                
                // דחיפת ההתחלה של הבא להיות שווה לסיום של הנוכחי
                next.startTime = current.endTime;
                
                // עדכון הסיום של הבא כדי לשמור על המשך (Duration) המקורי שלו
                next.endTime = addTime(next.startTime, originalDuration);
                
                // עדכון המשך בפורמט שעות עשרוניות
                if (next.startTime && next.endTime) {
                    const calculatedHours = calculateHoursFromTimeRange(next.startTime, next.endTime);
                    if (calculatedHours) {
                        next.hours = calculatedHours;
                    }
                }
            } else {
                // אם אין חפיפה (יש רווח או שהם צמודים), אין צורך להמשיך לבדוק את השאר
                break; 
            }
        }
        return updated;
    };
    
    // פונקציה לבדיקה אם יש דיווחים תקפים
    const hasValidReports = () => {
        if (selectedType !== 'reports' || viewMode !== 'form') return false;
        
        // בדיקה אם יש לפחות דיווח אחד עם לקוח, מוצר ומשך זמן (משך ישיר או מחושב משעות)
        const validReports = addedReports.filter(r => {
            const hasDirectHours = r.hours && parseFloat(r.hours) > 0;
            const hasTimeRange = r.startTime && r.endTime;
            const calculatedHours = hasTimeRange ? calculateHoursFromTimeRange(r.startTime, r.endTime) : null;
            const hasHours = hasDirectHours || (calculatedHours && parseFloat(calculatedHours) > 0);
            const hasProduct = !customSettings.productColumnId || r.productId;
            // שלב חובה רק אם יש מוצר
            const hasStage = !customSettings.productColumnId || !r.productId || (customSettings.stageColumnId && r.productId ? r.stageId : true);
            return hasHours && hasProduct && hasStage;
        });
        
        return validReports.length > 0;
    };
    
    // פונקציה לטיפול בסגירה עם אישור
    const handleCloseAttempt = () => {
        if (hasValidReports()) {
            // הצגת תיבת אישור
            setShowCloseConfirm(true);
        } else {
            // אין דיווחים תקפים - סוגר מיד
            onClose();
        }
    };
    
    // עדכון שעות, הערות או מוצר לדיווח (עם Smart Cascade)
    const updateReport = (id, field, value) => {
        setAddedReports(prev => {
            let newEntries = [...prev];
            const index = newEntries.findIndex(e => e.id === id);
            if (index === -1) return prev;

            const entry = { ...newEntries[index] }; // עותק לאירוע הבודד

            // עדכון השדה הספציפי
            entry[field] = value;

            // חישובים פנימיים לאותה שורה
            if (field === 'startTime') {
                // שינוי התחלה -> משמרים משך, מזיזים סיום
                // שמירת המשך המקורי לפני השינוי
                let originalDuration = '01:00'; // ברירת מחדל
                if (entry.endTime && entry.startTime) {
                    originalDuration = calculateDurationStr(entry.startTime, entry.endTime);
                } else if (entry.hours) {
                    originalDuration = formatTime(parseFloat(entry.hours) * 60);
                }
                
                // וידוא שהמשך מינימלי הוא 30 דקות
                const originalDurationMinutes = parseTime(originalDuration);
                const minDurationMinutes = 30;
                const finalDuration = originalDurationMinutes < minDurationMinutes 
                    ? formatTime(minDurationMinutes)
                    : originalDuration;
                
                // עדכון ההתחלה
                entry.startTime = value;
                
                // עדכון הסיום לפי המשך המקורי (לפחות 30 דקות)
                entry.endTime = addTime(value, finalDuration);
                
                // עדכון המשך בפורמט שעות עשרוניות
                if (entry.startTime && entry.endTime) {
                    const calculatedHours = calculateHoursFromTimeRange(entry.startTime, entry.endTime);
                    if (calculatedHours) {
                        entry.hours = calculatedHours;
                    }
                }
            } else if (field === 'endTime') {
                // שינוי סיום -> משנים משך
                if (entry.startTime) {
                    const calculatedHours = calculateHoursFromTimeRange(entry.startTime, value);
                    if (calculatedHours) {
                        // וידוא שהמשך מינימלי הוא 30 דקות (0.5 שעות)
                        const minHours = 0.5;
                        entry.hours = Math.max(parseFloat(calculatedHours), minHours).toFixed(2);
                        
                        // עדכון endTime אם היה צריך להגדיל
                        if (parseFloat(calculatedHours) < minHours) {
                            const startTotalMins = parseTime(entry.startTime);
                            const endTotalMins = startTotalMins + (minHours * 60);
                            entry.endTime = formatTime(endTotalMins);
                        }
                    }
                }
            } else if (field === 'hours') {
                // שינוי משך -> מזיזים סיום
                if (entry.startTime && value) {
                    // וידוא שהמשך מינימלי הוא 0.5 שעות (30 דקות)
                    const minHours = 0.5;
                    const finalHours = Math.max(parseFloat(value), minHours);
                    entry.hours = finalHours.toFixed(2);
                    
                    const hoursInMinutes = finalHours * 60;
                    const startTotalMins = parseTime(entry.startTime);
                    const endTotalMins = startTotalMins + hoursInMinutes;
                    entry.endTime = formatTime(endTotalMins);
                }
            }

            // החזרת האירוע המעודכן למערך
            newEntries[index] = entry;

            // הפעלת מנגנון פתרון חפיפות מהאירוע הנוכחי ומטה
            // (רק אם שונתה שעת סיום או התחלה שמשפיעה על המיקום)
            if (field === 'startTime' || field === 'endTime' || field === 'hours') {
                newEntries = resolveOverlaps(newEntries, index);
            }

            return newEntries;
        });
    };
    
    // עדכון מוצר שנבחר
    const updateSelectedProduct = (reportId, productId) => {
        const report = addedReports.find(r => r.id === reportId);
        if (report) {
            setSelectedProducts(prev => ({
                ...prev,
                [reportId]: productId  // שימוש ב-reportId כמפתח ייחודי לכל דיווח
            }));
            updateReport(reportId, 'productId', productId);
            // איפוס שלב רק אם המוצר הוסר לגמרי (לא אם רק השתנה)
            if (!productId) {
                setSelectedStages(prev => {
                    const newSelected = { ...prev };
                    delete newSelected[reportId];
                    return newSelected;
                });
                updateReport(reportId, 'stageId', '');
            }
        }
    };
    
    // עדכון שלב שנבחר
    const updateSelectedStage = (reportId, stageId) => {
        const report = addedReports.find(r => r.id === reportId);
        if (report) {
            setSelectedStages(prev => ({
                ...prev,
                [reportId]: stageId
            }));
            updateReport(reportId, 'stageId', stageId);
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
                                products: [...(productsByCustomer[r.projectId] || []), newProduct]
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
        // במצב עריכה, אם משנים את הסוג - מעדכנים את האירוע
        if (isEditMode) {
            // אם זה אותו סוג שכבר נבחר, לא עושים כלום
            if (selectedType === type) {
                return;
            }
            
            // אם יש שינוי בסוג, מעדכנים את האירוע
            if (onUpdate) {
                onUpdate(type);
            }
            return;
        }
        
        // במצב יצירה, יוצרים את האירוע
        setSelectedType(type);
        onCreate({
            type: type,
            date: pendingDate
        });
        onClose();
    };
    
    // טיפול בחזרה/ביטול
    const handleCancelOrBack = async () => {
        if (viewMode === 'form') {
            // אם יש דיווחים תקפים, שואלים אם לשמור
            if (hasValidReports()) {
                await handleCloseAttempt();
            } else {
                // אין דיווחים תקפים - חוזר לתפריט
                setViewMode('menu');
                setSelectedType(null);
                setAddedReports([]);
                setSearchTerm('');
            }
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
            
            // בדיקת בחירת שלבים אם יש מוצר
            if (customSettings.productColumnId && customSettings.stageColumnId) {
                const missingStages = validReports.filter(r => r.productId && !r.stageId);
                if (missingStages.length > 0) {
                    alert('יש לבחור שלב לכל דיווח שעות עם מוצר');
                    return;
                }
            }
            
            // המרה לפורמט המקורי (ללא id הפנימי)
            const formattedReports = validReports.map(r => {
                // אם יש שעות התחלה וסיום, מחשבים את המשך
                let hours = r.hours;
                if (r.startTime && r.endTime) {
                    const calculatedHours = calculateHoursFromTimeRange(r.startTime, r.endTime);
                    if (calculatedHours) {
                        hours = calculatedHours;
                    }
                }
                
                // מציאת שם המוצר
                const products = productsByCustomer[r.projectId] || [];
                const product = products.find(p => p.id === r.productId);
                const productName = product?.name || 'ללא מוצר';
                
                return {
                    projectId: r.projectId,
                    projectName: r.projectName,
                    hours: hours,
                    notes: r.notes,
                    productId: r.productId,
                    productName: productName,  // הוספת שם המוצר
                    stageId: r.stageId || null,
                    startTime: r.startTime || null,
                    endTime: r.endTime || null
                };
            });
            
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
        setSelectedStages({});
        
        onClose();
    };
    
    // חישוב סה"כ שעות
    const calculateTotalHours = () => {
        let totalMinutes = 0;
        addedReports.forEach(report => {
            if (report.startTime && report.endTime) {
                const duration = calculateDurationStr(report.startTime, report.endTime);
                totalMinutes += parseTime(duration);
            } else if (report.hours) {
                totalMinutes += parseFloat(report.hours) * 60;
            }
        });
        return formatTime(totalMinutes);
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
                    const validReports = addedReports.filter(r => {
                        const hasDirectHours = r.hours && parseFloat(r.hours) > 0;
                        const hasTimeRange = r.startTime && r.endTime;
                        const calculatedHours = hasTimeRange ? calculateHoursFromTimeRange(r.startTime, r.endTime) : null;
                        return hasDirectHours || (calculatedHours && parseFloat(calculatedHours) > 0);
                    });
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
                className={`${styles.menuButton} ${styles.btnVacation} ${selectedType === 'vacation' ? styles.selected : ''}`} 
                onClick={() => handleSingleTypeSelect('vacation')}
            >
                <span className={styles.icon}><Sun size={20} color="#00c875" /></span>
                <span style={{ marginRight: '12px' }}>חופשה</span>
                {isEditMode && selectedType === 'vacation' && <span style={{ marginRight: 'auto', color: '#00c875', fontWeight: 600 }}>✓ נבחר</span>}
            </button>
            <button 
                className={`${styles.menuButton} ${styles.btnSick} ${selectedType === 'sick' ? styles.selected : ''}`} 
                onClick={() => handleSingleTypeSelect('sick')}
            >
                <span className={styles.icon}><Thermometer size={20} color="#e2445c" /></span>
                <span style={{ marginRight: '12px' }}>מחלה</span>
                {isEditMode && selectedType === 'sick' && <span style={{ marginRight: 'auto', color: '#e2445c', fontWeight: 600 }}>✓ נבחר</span>}
            </button>
            <button 
                className={`${styles.menuButton} ${styles.btnReserves} ${selectedType === 'reserves' ? styles.selected : ''}`} 
                onClick={() => handleSingleTypeSelect('reserves')}
            >
                <span className={styles.icon}><Briefcase size={20} color="#579bfc" /></span>
                <span style={{ marginRight: '12px' }}>מילואים</span>
                {isEditMode && selectedType === 'reserves' && <span style={{ marginRight: 'auto', color: '#579bfc', fontWeight: 600 }}>✓ נבחר</span>}
            </button>
            {!isEditMode && (
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
            )}
        </div>
    );
    
    // רינדור תצוגה מפוצלת
    const renderSplitForm = () => {
        // מבנה Grid: לקוח+מוצר (40%) | התחלה (20%) | - (auto) | סיום (20%) | משך (20%) | מחיקה (50px)
        const gridColumns = '40% 20% auto 20% 20% 50px';
        
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
                    {addedReports.map((report, index) => (
                        <div key={report.id} className={styles.reportRow}>
                            {/* כפתור מחיקה - איקס בפינה השמאלית העליונה */}
                            <button 
                                onClick={() => removeReportRow(report.id)}
                                className={styles.deleteButtonTop}
                                title="מחק שורה"
                            >
                                <X size={18} strokeWidth={2} />
                            </button>
                            
                            {/* 1. לקוח + מוצר */}
                            <div className={styles.customerProductGroup}>
                                <div className={styles.customerName}>
                                    {report.projectName}
                                </div>
                                {customSettings.productColumnId && (
                                    <div className={styles.productField}>
                                        <ProductSelect 
                                            products={productsByCustomer[report.projectId] || []}
                                            selectedProduct={selectedProducts[report.id] || ''}  // שימוש ב-report.id כמפתח ייחודי
                                            onSelectProduct={(productId) => updateSelectedProduct(report.id, productId)}
                                            onCreateNew={async (productName) => await handleCreateProduct(report.id, productName)}
                                            isLoading={false}
                                            disabled={false}
                                            isCreatingProduct={isCreatingProduct[report.projectId] || false}
                                        />
                                    </div>
                                )}
                                {customSettings.stageColumnId && (
                                    <div className={styles.productField} style={{ marginTop: '8px' }}>
                                        <StageSelect 
                                            stages={stageOptions}
                                            selectedStage={selectedStages[report.id] || ''}
                                            onSelectStage={(stageId) => updateSelectedStage(report.id, stageId)}
                                            isLoading={loadingStages}
                                            disabled={false}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* 2. Times - All Editable */}
                            <div className={styles.timesGroup}>
                                {/* Start Time */}
                                <div className={styles.timeFieldWrapper}>
                                    <span className={styles.timeLabelSmall}>התחלה</span>
                                    <TimeSelect
                                        times={timeOptions}
                                        selectedTime={report.startTime || ''}
                                        onSelectTime={(time) => updateReport(report.id, 'startTime', time)}
                                        isLoading={false}
                                        disabled={false}
                                        placeholder="בחר שעה"
                                    />
                                </div>
                                
                                <span className={styles.timeSeparatorInline}>-</span>
                                
                                {/* End Time */}
                                <div className={styles.timeFieldWrapper}>
                                    <span className={styles.timeLabelSmall}>סיום</span>
                                    <TimeSelect
                                        times={timeOptions}
                                        selectedTime={report.endTime || ''}
                                        onSelectTime={(time) => updateReport(report.id, 'endTime', time)}
                                        isLoading={false}
                                        disabled={false}
                                        placeholder="בחר שעה"
                                    />
                                </div>
                            </div>

                            {/* SEPARATOR - Visual Divider */}
                            <div className={styles.visualSeparator}></div>

                            {/* 3. Duration */}
                            <div className={styles.durationWrapper}>
                                <span className={styles.timeLabelSmall}>משך</span>
                                <TimeSelect
                                    times={durationOptions30Minutes}
                                    selectedTime={
                                        report.startTime && report.endTime 
                                            ? calculateDurationStr(report.startTime, report.endTime)
                                            : (report.hours 
                                                ? (report.hours.includes(':') 
                                                    ? report.hours 
                                                    : formatTime(parseFloat(report.hours) * 60))
                                                : '')
                                    }
                                    onSelectTime={(duration) => {
                                        const minutes = parseTime(duration);
                                            const hours = (minutes / 60).toFixed(2);
                                            updateReport(report.id, 'hours', hours);
                                    }}
                                    isLoading={false}
                                    disabled={false}
                                    placeholder="בחר משך"
                                />
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
                                return (
                                    <div 
                                        key={customer.id} 
                                        className={styles.customerItem}
                                        onClick={() => addReportRow(customer)}
                                        title="לחץ להוספה"
                                    >
                                        <span>{customer.name}</span>
                                        <Plus size={14} color="#0073ea" />
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
        <div className={styles.overlay} onClick={(e) => {
            // לא לסגור אם תיבת confirm פתוחה
            if (showCloseConfirm || showDeleteConfirm) {
                return;
            }
            if (e.target === e.currentTarget) {
                handleCloseAttempt();
            }
        }}>
            <div 
                className={`${styles.modal} ${viewMode === 'form' ? styles.modalWide : ''}`}
                onClick={e => e.stopPropagation()}
            >
                <div className={styles.header}>
                    <h2>
                        {viewMode === 'menu' ? 'סוג דיווח ליום זה' : 'דיווח שעות מרוכז'}
                        {pendingDate && ` - ${pendingDate.toLocaleDateString('he-IL')}`}
                    </h2>
                    <button className={styles.closeButton} onClick={handleCloseAttempt}>
                        <X size={24} />
                    </button>
                </div>

                <div className={styles.content}>
                    {viewMode === 'menu' ? renderMenu() : renderSplitForm()}
                </div>

                <div className={styles.footer}>
                    {isEditMode && onDelete && (
                        <button 
                            className={`${styles.button} ${styles.deleteBtn}`} 
                            onClick={() => setShowDeleteConfirm(true)}
                        >
                            מחק
                        </button>
                    )}
                    {viewMode === 'form' && addedReports.length > 0 && (
                        <div className={styles.totalHours}>
                            <span className={styles.totalHoursLabel}>סה"כ שעות</span>
                            <span className={styles.totalHoursValue}>{calculateTotalHours()}</span>
                        </div>
                    )}
                    <button 
                        className={`${styles.button} ${styles.cancelBtn}`} 
                        onClick={handleCancelOrBack}
                    >
                        {viewMode === 'menu' ? 'ביטול' : 'חזרה'}
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
            
            {/* תיבת אישור לסגירה */}
            <ConfirmDialog
                isOpen={showCloseConfirm}
                onClose={() => setShowCloseConfirm(false)}
                onConfirm={() => {
                    setShowCloseConfirm(false);
                    handleCreate();
                }}
                onCancel={() => {
                    setShowCloseConfirm(false);
                    onClose();
                }}
                title="שמירת דיווחים"
                message="יש דיווחים שלא נשמרו. האם ברצונך לשמור את הדיווחים לפני סגירה?"
                confirmText="שמור דיווחים"
                cancelText="בטל"
                confirmButtonStyle="primary"
            />
            
            {/* תיבת אישור למחיקה */}
            <ConfirmDialog
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={() => {
                    setShowDeleteConfirm(false);
                    if (onDelete) {
                        onDelete();
                    }
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
