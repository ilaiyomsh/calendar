import React, { useEffect, useState, useRef } from 'react';
import { FileText, Plus, Minus, Trash2, X, Clock, Calendar } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { useSettings, STRUCTURE_MODES } from '../../contexts/SettingsContext';
import { useMobile } from '../../contexts/MobileContext';
import { useProjects } from '../../hooks/useProjects';
import { useTasksMultiple } from '../../hooks/useTasksMultiple';
import { useStageOptions } from '../../hooks/useStageOptions';
import { useNonBillableOptions } from '../../hooks/useNonBillableOptions';
import { getEffectiveBoardId } from '../../utils/boardIdResolver';
import { getAllDayIndexes, getNonBillableIndexes, getLabelText, getLabelColor, getLabelsByCategory, EVENT_CATEGORIES } from '../../utils/eventTypeMapping';
import TaskSelect from '../TaskSelect';
import TimeSelect from '../TimeSelect';
import ConfirmDialog from '../ConfirmDialog';
import CustomDatePicker from '../CustomDatePicker';
import { generateTimeOptions15Minutes, durationOptions15Minutes, roundToNearest15Minutes } from '../../constants/calendarConfig';
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
    monday,
    context = null
}) {
    const { customSettings } = useSettings();
    const isMobile = useMobile();
    const { projects, loading: loadingProjects, refetch: refetchProjects } = useProjects();

    // Body scroll lock on mobile
    useEffect(() => {
        if (isOpen && isMobile) {
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = ''; };
        }
    }, [isOpen, isMobile]);
    const { createTask, fetchForProject, tasks: tasksByProject } = useTasksMultiple();
    
    // יצירת רשימת זמנים לפי טווח שעות העבודה
    const timeOptions = React.useMemo(() => {
        const minTime = customSettings.workDayStart || "00:00";
        const maxTime = customSettings.workDayEnd || "23:45";
        return generateTimeOptions15Minutes(minTime, maxTime);
    }, [customSettings.workDayStart, customSettings.workDayEnd]);
    
    // State - בחירת סוג אירוע
    const [selectedType, setSelectedType] = useState(null); // 'sick' | 'vacation' | 'reserves' | 'reports'
    
    // State - תאריך סיום לאירוע יומי (ברירת מחדל: אותו יום כמו תאריך ההתחלה)
    const [endDate, setEndDate] = useState(null);
    
    // State - האם לוח השנה פתוח
    const [showDatePicker, setShowDatePicker] = useState(false);
    const datePickerRef = useRef(null);
    
    // State - ניהול תצוגה
    const [viewMode, setViewMode] = useState('menu'); // 'menu' | 'days-selection' | 'form'
    const [searchTerm, setSearchTerm] = useState('');
    
    // State - דיווחים שנוספו
    const [addedReports, setAddedReports] = useState([]);
    
    // State - משימות נבחרות
    const [selectedTasks, setSelectedTasks] = useState({});
    // State - שלבים נבחרים
    const [selectedStages, setSelectedStages] = useState({});
    // State - יצירת משימה לכל פרויקט
    const [isCreatingTask, setIsCreatingTask] = useState({});
    
    // State - תיבות אישור
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [editingDuration, setEditingDuration] = useState({});

    // חישוב לוח דיווחים אפקטיבי - העמודות נמצאות בלוח הזה
    const boardId = getEffectiveBoardId(customSettings, context);

    // טעינת ערכי שלב
    const { stageOptions, loading: loadingStages } = useStageOptions(
        monday,
        customSettings.stageColumnId && boardId ? boardId : null,
        customSettings.stageColumnId
    );

    // תווית תצוגה ל"לא לחיוב" - חישוב פעם אחת
    const nonBillableDisplayLabel = React.useMemo(() => {
        const nbIndexes = getNonBillableIndexes(customSettings.eventTypeMapping);
        return (nbIndexes.length > 0 && getLabelText(nbIndexes[0], customSettings.eventTypeLabelMeta)) || 'לא לחיוב';
    }, [customSettings.eventTypeMapping, customSettings.eventTypeLabelMeta]);

    const { nonBillableOptions, loading: loadingNonBillable } = useNonBillableOptions(
        monday,
        customSettings.nonBillableStatusColumnId && boardId ? boardId : null,
        customSettings.nonBillableStatusColumnId
    );
    
    // --- פונקציות עזר לחישובי זמן ---
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
            
            if (isEditMode && eventToEdit) {
                // זיהוי סוג אירוע יומי מתוך eventTypeIndex
                const allDayIndexes = getAllDayIndexes(customSettings.eventTypeMapping);
                const detectedIndex = allDayIndexes.find(idx => String(eventToEdit.eventTypeIndex) === idx);
                if (detectedIndex) {
                    setSelectedType(detectedIndex);
                    logger.debug('AllDayEventModal', `Edit mode - detected type index: ${detectedIndex}`);
                }
            } else {
                setSelectedType(null);
                setViewMode('menu');
                setAddedReports([]);
                setSearchTerm('');
                setSelectedTasks({});
                setSelectedStages({});
                setIsCreatingTask({});
                setEditingDuration({});
                setEndDate(null);
                setShowDatePicker(false);
                
                refetchProjects().then(() => {
                    logger.debug('AllDayEventModal', 'Projects refetched after modal opened');
                });
            }
        } else {
            logger.debug('AllDayEventModal', 'Modal closed - resetting all state');
            setSelectedType(null);
            setViewMode('menu');
            setAddedReports([]);
            setSearchTerm('');
            setSelectedTasks({});
            setSelectedStages({});
            setIsCreatingTask({});
            setEditingDuration({});
            setEndDate(null);
            setShowDatePicker(false);
        }
    }, [isOpen, isEditMode, eventToEdit, refetchProjects]);
    
    // עדכון משימות ב-addedReports כשהמשימות נטענות
    useEffect(() => {
        setAddedReports(prev => prev.map(report => ({
            ...report,
            tasks: tasksByProject[report.projectId] || []
        })));
    }, [tasksByProject]);
    
    // חישוב שעת התחלה לדיווח חדש
    const getNextStartTime = () => {
        let startTime = '08:00';
        if (addedReports.length > 0) {
            const lastReport = addedReports[addedReports.length - 1];
            if (lastReport.endTime) {
                startTime = lastReport.endTime;
            } else if (lastReport.startTime && lastReport.hours) {
                const hoursInMinutes = parseFloat(lastReport.hours) * 60;
                const startTotalMins = parseTime(lastReport.startTime);
                const endTotalMins = startTotalMins + hoursInMinutes;
                startTime = formatTime(endTotalMins);
            }
        }
        return startTime;
    };

    // הוספת שורת דיווח מפרויקט
    const addReportRow = (project) => {
        if (!project) return;
        
        // טעינת משימות של הפרויקט
        if (customSettings.tasksProjectColumnId) {
            fetchForProject(project.id);
        }
        
        const startTime = getNextStartTime();
        const defaultDuration = '01:00';
        const endTime = addTime(startTime, defaultDuration);
        const hours = '1.00';
        
        setAddedReports(prev => [...prev, {
            id: Date.now(),
            projectId: project.id,
            projectName: project.name,
            tasks: [],
            hours: hours,
            startTime: startTime,
            endTime: endTime,
            notes: '',
            taskId: '',
            stageId: '',
            isBillable: true,
            nonBillableType: ''
        }]);
    };

    // הוספת שורת דיווח לא לחיוב (ללא פרויקט)
    const addNonBillableReportRow = () => {
        const startTime = getNextStartTime();
        const defaultDuration = '01:00';
        const endTime = addTime(startTime, defaultDuration);
        const hours = '1.00';
        
        setAddedReports(prev => [...prev, {
            id: Date.now(),
            projectId: null,
            projectName: nonBillableDisplayLabel,
            tasks: [],
            hours: hours,
            startTime: startTime,
            endTime: endTime,
            notes: '',
            taskId: '',
            stageId: '',
            isBillable: false,
            nonBillableType: ''
        }]);
    };
    
    // הסרת שורת דיווח
    const removeReportRow = (id) => {
        const report = addedReports.find(r => r.id === id);
        if (report) {
            setSelectedTasks(prev => {
                const newSelected = { ...prev };
                delete newSelected[id];
                return newSelected;
            });
            setSelectedStages(prev => {
                const newSelected = { ...prev };
                delete newSelected[id];
                return newSelected;
            });
        }
        setAddedReports(prev => prev.filter(r => r.id !== id));
    };
    
    // סינון פרויקטים לפי חיפוש ומיון לפי הא"ב
    const filteredProjects = projects
        .filter(p => 
            p.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'he'));
    
    // פונקציה לחישוב משך זמן משעות התחלה וסיום
    const calculateHoursFromTimeRange = (startTime, endTime) => {
        if (!startTime || !endTime) return null;
        const startTotalMinutes = parseTime(startTime);
        const endTotalMinutes = parseTime(endTime);
        if (endTotalMinutes <= startTotalMinutes) return null;
        const diffMinutes = endTotalMinutes - startTotalMinutes;
        const diffHours = diffMinutes / 60;
        const minHours = 0.5;
        const finalHours = Math.max(diffHours, minHours);
        return finalHours.toFixed(2);
    };
    
    // פונקציה לחישוב משך זמן בפורמט HH:mm
    const calculateDurationStr = (start, end) => {
        if (!start || !end) return '01:00';
        let diff = parseTime(end) - parseTime(start);
        if (diff < 0) diff += 24 * 60;
        return formatTime(diff);
    };
    
    // --- לוגיקת Smart Cascade ---
    const resolveOverlaps = (currentEntries, startIndex) => {
        const updated = [...currentEntries];
        for (let i = startIndex; i < updated.length - 1; i++) {
            const current = updated[i];
            const next = updated[i + 1];
            if (!current.startTime || !current.endTime || !next.startTime) break;
            const currentEndMins = parseTime(current.endTime);
            const nextStartMins = parseTime(next.startTime);
            if (currentEndMins > nextStartMins) {
                let originalDuration = '01:00';
                if (next.endTime && next.startTime) {
                    originalDuration = calculateDurationStr(next.startTime, next.endTime);
                } else if (next.hours) {
                    originalDuration = formatTime(parseFloat(next.hours) * 60);
                }
                next.startTime = current.endTime;
                next.endTime = addTime(next.startTime, originalDuration);
                if (next.startTime && next.endTime) {
                    const calculatedHours = calculateHoursFromTimeRange(next.startTime, next.endTime);
                    if (calculatedHours) next.hours = calculatedHours;
                }
            } else break;
        }
        return updated;
    };
    
    // פונקציה לבדיקה אם יש דיווחים תקפים
    const hasValidReports = () => {
        if (selectedType !== 'reports' || viewMode !== 'form') return false;
        const { structureMode } = customSettings;
        
        const validReports = addedReports.filter(r => {
            const hasDirectHours = r.hours && parseFloat(r.hours) > 0;
            const hasTimeRange = r.startTime && r.endTime;
            const calculatedHours = hasTimeRange ? calculateHoursFromTimeRange(r.startTime, r.endTime) : null;
            const hasHours = hasDirectHours || (calculatedHours && parseFloat(calculatedHours) > 0);
            
            // משימה חובה רק במצב TASKS
            const needsTask = structureMode === STRUCTURE_MODES.PROJECT_WITH_TASKS && 
                             customSettings.taskColumnId;
            const hasTask = !needsTask || !r.isBillable || r.taskId;
            
            // סיווג חובה במצב STAGE
            const needsStage = customSettings.stageColumnId && 
                structureMode === STRUCTURE_MODES.PROJECT_WITH_STAGE;
            const hasStage = !needsStage || !r.isBillable || r.stageId;
            
            // ולידציה ללא לחיוב
            const hasNonBillableType = r.isBillable || r.nonBillableType;
            return hasHours && hasTask && hasStage && hasNonBillableType;
        });
        return validReports.length > 0;
    };
    
    // פונקציה לטיפול בסגירה עם אישור
    const handleCloseAttempt = () => {
        if (hasValidReports()) setShowCloseConfirm(true);
        else onClose();
    };
    
    // עדכון שעות, הערות או משימה לדיווח
    const updateReport = (id, field, value) => {
        setAddedReports(prev => {
            let newEntries = [...prev];
            const index = newEntries.findIndex(e => e.id === id);
            if (index === -1) return prev;
            const entry = { ...newEntries[index] };
            entry[field] = value;

            if (field === 'startTime') {
                let originalDuration = '01:00';
                if (entry.endTime && entry.startTime) originalDuration = calculateDurationStr(entry.startTime, entry.endTime);
                else if (entry.hours) originalDuration = formatTime(parseFloat(entry.hours) * 60);
                const originalDurationMinutes = parseTime(originalDuration);
                const finalDuration = originalDurationMinutes < 30 ? formatTime(30) : originalDuration;
                entry.startTime = value;
                entry.endTime = addTime(value, finalDuration);
                if (entry.startTime && entry.endTime) {
                    const calculatedHours = calculateHoursFromTimeRange(entry.startTime, entry.endTime);
                    if (calculatedHours) entry.hours = calculatedHours;
                }
            } else if (field === 'endTime') {
                if (entry.startTime) {
                    const calculatedHours = calculateHoursFromTimeRange(entry.startTime, value);
                    if (calculatedHours) {
                        entry.hours = Math.max(parseFloat(calculatedHours), 0.5).toFixed(2);
                        if (parseFloat(calculatedHours) < 0.5) {
                            const endTotalMins = parseTime(entry.startTime) + 30;
                            entry.endTime = formatTime(endTotalMins);
                        }
                    }
                }
            } else if (field === 'hours') {
                if (entry.startTime && value) {
                    const finalHours = Math.max(parseFloat(value), 0.5);
                    entry.hours = finalHours.toFixed(2);
                    const endTotalMins = parseTime(entry.startTime) + finalHours * 60;
                    entry.endTime = formatTime(endTotalMins);
                }
            }

            newEntries[index] = entry;
            if (field === 'startTime' || field === 'endTime' || field === 'hours') {
                newEntries = resolveOverlaps(newEntries, index);
            }
            return newEntries;
        });
    };
    
    // עדכון משימה שנבחרה
    const updateSelectedTask = (reportId, taskId) => {
        const report = addedReports.find(r => r.id === reportId);
        if (report) {
            setSelectedTasks(prev => ({ ...prev, [reportId]: taskId }));
            updateReport(reportId, 'taskId', taskId);
            if (!taskId) {
                setSelectedStages(prev => {
                    const newSelected = { ...prev };
                    delete newSelected[reportId];
                    return newSelected;
                });
                updateReport(reportId, 'stageId', '');
            }
        }
    };
    
    const updateSelectedStage = (reportId, stageId) => {
        const report = addedReports.find(r => r.id === reportId);
        if (report) {
            setSelectedStages(prev => ({ ...prev, [reportId]: stageId }));
            updateReport(reportId, 'stageId', stageId);
        }
    };
    
    const handleCreateTask = async (reportId, taskName) => {
        const report = addedReports.find(r => r.id === reportId);
        if (!report) return;
        
        setIsCreatingTask(prev => ({ ...prev, [report.projectId]: true }));
        try {
            const newTask = await createTask(report.projectId, taskName);
            if (newTask) {
                setAddedReports(prev =>
                    prev.map(r =>
                        r.id === reportId
                            ? { 
                                ...r, 
                                tasks: [...(tasksByProject[r.projectId] || []), newTask]
                            }
                            : r
                    )
                );
                updateSelectedTask(reportId, newTask.id);
            }
        } finally {
            setIsCreatingTask(prev => ({ ...prev, [report.projectId]: false }));
        }
    };
    
    const handleSingleTypeSelect = (type) => {
        if (isEditMode) {
            if (selectedType === type) return;
            if (onUpdate) onUpdate(type);
            return;
        }
        // מעבר לשלב בחירת תאריך סיום
        setSelectedType(type);
        setEndDate(pendingDate); // ברירת מחדל: אותו יום (יום אחד)
        setShowDatePicker(false);
        setViewMode('days-selection');
    };
    
    // יצירת אירוע יומי עם תאריך הסיום שנבחר
    const handleCreateAllDayWithDuration = () => {
        if (!selectedType || !endDate) return;
        // חישוב מספר הימים מתאריך ההתחלה עד תאריך הסיום (כולל)
        const durationDays = differenceInDays(endDate, pendingDate) + 1;
        onCreate({ 
            type: selectedType, 
            date: pendingDate,
            durationDays: durationDays 
        });
        onClose();
    };
    
    const handleCancelOrBack = async () => {
        if (viewMode === 'form') {
            if (hasValidReports()) await handleCloseAttempt();
            else {
                setViewMode('menu');
                setSelectedType(null);
                setAddedReports([]);
                setSearchTerm('');
            }
        } else if (viewMode === 'days-selection') {
            // חזרה לתפריט הראשי
            setViewMode('menu');
            setSelectedType(null);
            setEndDate(null);
            setShowDatePicker(false);
        } else {
            onClose();
        }
    };
    
    const handleCreate = () => {
        if (!selectedType) return;
        const { structureMode } = customSettings;
        
        if (selectedType === 'reports') {
            const validReports = addedReports.filter(r => r.hours && parseFloat(r.hours) > 0);
            if (validReports.length === 0) {
                alert('יש להוסיף לפחות פרויקט אחד עם שעות');
                return;
            }
            
            // בדיקת משימות - רק במצב TASKS
            if (structureMode === STRUCTURE_MODES.PROJECT_WITH_TASKS && 
                customSettings.taskColumnId) {
                const missingTasks = validReports.filter(r => r.isBillable && !r.taskId);
                if (missingTasks.length > 0) {
                    alert('יש לבחור משימה לכל דיווח שעות לחיוב');
                    return;
                }
            }
            
            // בדיקת סוגי לא לחיוב
            const missingNonBillableTypes = validReports.filter(r => !r.isBillable && !r.nonBillableType);
            if (missingNonBillableTypes.length > 0) {
                alert('יש לבחור סוג דיווח לא לחיוב לכל דיווח שאינו לחיוב');
                return;
            }
            
            // בדיקת סיווג - לפי structureMode
            if (customSettings.stageColumnId) {
                let missingStages = [];
                if (structureMode === STRUCTURE_MODES.PROJECT_WITH_STAGE) {
                    missingStages = validReports.filter(r => r.isBillable && !r.stageId);
                }
                if (missingStages.length > 0) {
                    alert('יש לבחור סיווג לכל דיווח שעות לחיוב');
                    return;
                }
            }
            
            const formattedReports = validReports.map(r => {
                let hours = r.hours;
                if (r.startTime && r.endTime) {
                    const calculatedHours = calculateHoursFromTimeRange(r.startTime, r.endTime);
                    if (calculatedHours) hours = calculatedHours;
                }
                const tasks = tasksByProject[r.projectId] || [];
                const task = tasks.find(t => t.id === r.taskId);
                const taskName = task?.name || 'ללא משימה';
                return {
                    projectId: r.projectId,
                    projectName: r.projectName,
                    hours: hours,
                    notes: r.notes,
                    taskId: r.taskId,
                    taskName: taskName,
                    stageId: r.stageId || null,
                    startTime: r.startTime || null,
                    endTime: r.endTime || null,
                    isBillable: r.isBillable,
                    nonBillableType: r.nonBillableType || null
                };
            });
            onCreate({ type: 'reports', date: pendingDate, reports: formattedReports });
        } else {
            onCreate({ type: selectedType, date: pendingDate });
        }
        setSelectedType(null);
        setViewMode('menu');
        setAddedReports([]);
        setSearchTerm('');
        setSelectedTasks({});
        setSelectedStages({});
        onClose();
    };
    
    const calculateTotalHours = () => {
        let totalMinutes = 0;
        addedReports.forEach(report => {
            if (report.startTime && report.endTime) {
                const duration = calculateDurationStr(report.startTime, report.endTime);
                totalMinutes += parseTime(duration);
            } else if (report.hours) totalMinutes += parseFloat(report.hours) * 60;
        });
        return formatTime(totalMinutes);
    };
    
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Enter' && selectedType && isOpen) {
                if (selectedType !== 'reports') handleCreate();
                else if (viewMode === 'form') {
                    const validReports = addedReports.filter(r => {
                        const hasDirectHours = r.hours && parseFloat(r.hours) > 0;
                        const hasTimeRange = r.startTime && r.endTime;
                        const calculatedHours = hasTimeRange ? calculateHoursFromTimeRange(r.startTime, r.endTime) : null;
                        return hasDirectHours || (calculatedHours && parseFloat(calculatedHours) > 0);
                    });
                    if (validReports.length > 0) handleCreate();
                }
            }
        };
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [selectedType, isOpen, addedReports, viewMode]);
    
    // סגירת לוח השנה בלחיצה מחוץ לאזור
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
                setShowDatePicker(false);
            }
        };
        
        if (showDatePicker) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showDatePicker]);
    
    if (!isOpen || !pendingDate) return null;
    
    const allDayItems = getLabelsByCategory(EVENT_CATEGORIES.ALL_DAY, customSettings.eventTypeMapping, customSettings.eventTypeLabelMeta);

    const renderMenu = () => (
        <div className={styles.menuContainer}>
            <div className={styles.menuTopRow}>
                {allDayItems.map(item => {
                    const color = item.color || '#579bfc';
                    return (
                        <button
                            key={item.index}
                            className={`${styles.menuButton} ${styles.btnAllDay} ${selectedType === item.index ? styles.selected : ''}`}
                            onClick={() => handleSingleTypeSelect(item.index)}
                        >
                            <span className={styles.colorDot} style={{ backgroundColor: color }} />
                            <span style={{ marginRight: '12px' }}>{item.label}</span>
                            {isEditMode && selectedType === item.index && <span style={{ marginRight: 'auto', color, fontWeight: 600 }}>✓ נבחר</span>}
                        </button>
                    );
                })}
            </div>
            {!isEditMode && (
                <button className={`${styles.menuButton} ${styles.btnMultiple}`} onClick={() => {
                    setSelectedType('reports');
                    setViewMode('form');
                }}>
                    <span className={styles.icon}><FileText size={20} color="#a25ddc" /></span>
                    <span style={{ marginRight: '12px' }}>דיווחים מרובים / שעות עבודה</span>
                </button>
            )}
        </div>
    );
    
    const renderSplitForm = () => {
        return (
            <div className={styles.splitView}>
                <div className={styles.mainForm}>
                    {addedReports.length === 0 && (
                        <div className={styles.emptyState}>
                            <FileText size={48} color="#d0d4e4" />
                            <div>בחר פרויקט מהרשימה בצד שמאל כדי להתחיל</div>
                        </div>
                    )}
                    {addedReports.map((report) => (
                            <div key={report.id} className={styles.reportRow}>
                                <button onClick={() => removeReportRow(report.id)} className={styles.deleteButtonTop} title="מחק שורה"><X size={18} strokeWidth={2} /></button>
                                <div className={styles.rowMainContent}>
                                    <div className={styles.selectorsGroup}>
                                        <div className={styles.projectName}>{report.projectName}</div>
                                        {report.isBillable ? (
                                        <>
                                            {/* משימה - רק במצב TASKS */}
                                            {customSettings.taskColumnId && 
                                             customSettings.structureMode === STRUCTURE_MODES.PROJECT_WITH_TASKS && (
                                                <div className={styles.taskField}>
                                                    <TaskSelect 
                                                        products={tasksByProject[report.projectId] || []}
                                                        selectedProduct={selectedTasks[report.id] || ''}
                                                        onSelectProduct={(taskId) => updateSelectedTask(report.id, taskId)}
                                                        onCreateNew={async (taskName) => await handleCreateTask(report.id, taskName)}
                                                        isLoading={false}
                                                        disabled={false}
                                                        isCreatingProduct={isCreatingTask[report.projectId] || false}
                                                        placeholder="בחר משימה..."
                                                    />
                                                </div>
                                            )}
                                            {/* סיווג - כפתורים במצב STAGE */}
                                            {customSettings.stageColumnId && 
                                             customSettings.structureMode === STRUCTURE_MODES.PROJECT_WITH_STAGE && (
                                                    <div className={styles.stageButtons}>
                                                        {loadingStages ? (
                                                            <span className={styles.loadingSmall}>טוען...</span>
                                                        ) : (
                                                            stageOptions.map(option => (
                                                                <button
                                                                    key={option.id}
                                                                    onClick={() => updateSelectedStage(report.id, option.label === selectedStages[report.id] ? '' : option.label)}
                                                                    className={`${styles.stageButton} ${selectedStages[report.id] === option.label ? styles.stageButtonSelected : ''}`}
                                                                >
                                                                    {option.label}
                                                                </button>
                                                            ))
                                                        )}
                                                    </div>
                                            )}
                                        </>
                                    ) : (
                                        customSettings.nonBillableStatusColumnId && (
                                            <div className={styles.stageButtons}>
                                                {loadingNonBillable ? (
                                                    <span className={styles.loadingSmall}>טוען...</span>
                                                ) : (
                                                    nonBillableOptions.map(option => (
                                                        <button
                                                            key={option.id}
                                                            onClick={() => updateReport(report.id, 'nonBillableType', option.label === report.nonBillableType ? '' : option.label)}
                                                            className={`${styles.stageButton} ${report.nonBillableType === option.label ? styles.stageButtonSelected : ''}`}
                                                        >
                                                            {option.label}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        )
                                    )}
                                </div>
                                <div className={styles.visualSeparator}></div>
                                <div className={styles.timeGridContainer}>
                                    <div className={styles.timeFieldWrapper}>
                                        <span className={styles.timeLabelSmall}>שעת התחלה</span>
                                        <TimeSelect
                                            times={timeOptions}
                                            selectedTime={report.startTime || ''}
                                            onSelectTime={(time) => updateReport(report.id, 'startTime', time)}
                                            isLoading={false}
                                            disabled={false}
                                            placeholder="שעה"
                                        />
                                    </div>
                                    <div className={styles.timeFieldWrapper}>
                                        <span className={styles.timeLabelSmall}>שעת סיום</span>
                                        <TimeSelect
                                            times={timeOptions}
                                            selectedTime={report.endTime || ''}
                                            onSelectTime={(time) => updateReport(report.id, 'endTime', time)}
                                            isLoading={false}
                                            disabled={false}
                                            placeholder="שעה"
                                        />
                                    </div>
                                    <div className={styles.durationWrapper}>
                                        <div className={styles.durationControl}>
                                            <button
                                                className={styles.durationBtn}
                                                onClick={() => {
                                                    const currentDuration = report.startTime && report.endTime 
                                                        ? calculateDurationStr(report.startTime, report.endTime)
                                                        : (report.hours ? formatTime(parseFloat(report.hours) * 60) : '01:00');
                                                    const currentMinutes = parseTime(currentDuration);
                                                    const newMinutes = Math.max(15, currentMinutes - 15);
                                                    const hours = (newMinutes / 60).toFixed(2);
                                                    updateReport(report.id, 'hours', hours);
                                                }}
                                                title="הפחת 15 דקות"
                                            >
                                                <Minus size={16} />
                                            </button>
                                            <span className={styles.durationValue}>
                                                {report.startTime && report.endTime 
                                                    ? calculateDurationStr(report.startTime, report.endTime)
                                                    : (report.hours ? formatTime(parseFloat(report.hours) * 60) : '01:00')}
                                            </span>
                                            <button
                                                className={styles.durationBtn}
                                                onClick={() => {
                                                    const currentDuration = report.startTime && report.endTime 
                                                        ? calculateDurationStr(report.startTime, report.endTime)
                                                        : (report.hours ? formatTime(parseFloat(report.hours) * 60) : '01:00');
                                                    const currentMinutes = parseTime(currentDuration);
                                                    const newMinutes = currentMinutes + 15;
                                                    const hours = (newMinutes / 60).toFixed(2);
                                                    updateReport(report.id, 'hours', hours);
                                                }}
                                                title="הוסף 15 דקות"
                                            >
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.visualSeparator}></div>
                                
                                {customSettings.enableNotes && (
                                    <div className={styles.notesWrapper}>
                                        <span className={styles.timeLabelSmall}>הערות / מלל חופשי</span>
                                        <textarea
                                            className={styles.notesInput}
                                            placeholder="הערות / מלל חופשי..."
                                            value={report.notes || ''}
                                            onChange={(e) => updateReport(report.id, 'notes', e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                <div className={styles.sidebar}>
                    {/* כפתור לא לחיוב */}
                    <div
                        className={styles.projectItem}
                        onClick={addNonBillableReportRow}
                        title="הוסף דיווח לא לחיוב"
                    >
                        <span>{nonBillableDisplayLabel}</span>
                        <Plus size={14} color="#0073ea" />
                    </div>
                    <input type="text" placeholder="חיפוש פרויקט..." className={styles.searchBox} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} autoFocus />
                    <div className={styles.projectList}>
                        {loadingProjects ? <div style={{ padding: '10px', color: '#999', fontSize: '0.8rem', textAlign: 'center' }}>טוען פרויקטים...</div> : filteredProjects.length > 0 ? (
                            filteredProjects.map(project => (
                                <div key={project.id} className={styles.projectItem} onClick={() => addReportRow(project)} title="לחץ להוספה">
                                    <span>{project.name}</span>
                                    <Plus size={14} color="#0073ea" />
                                </div>
                            ))
                        ) : <div style={{ padding: '10px', color: '#999', fontSize: '0.8rem', textAlign: 'center' }}>{searchTerm ? 'לא נמצאו פרויקטים' : 'אין פרויקטים זמינים'}</div>}
                    </div>
                </div>
            </div>
        );
    };
    
    // תצוגת בחירת תאריך סיום
    const renderDaysSelection = () => {
        const typeColor = getLabelColor(selectedType, customSettings.eventTypeLabelMeta) || '#579bfc';

        // חישוב מספר הימים לתצוגה
        const calculatedDays = endDate && pendingDate
            ? differenceInDays(endDate, pendingDate) + 1
            : 1;

        return (
            <div className={styles.daysSelectionContainer}>
                <div className={styles.daysSelectionHeader}>
                    <span className={styles.colorDotLarge} style={{ backgroundColor: typeColor }} />
                    <span style={{ marginRight: '10px', fontSize: '18px', fontWeight: 600 }}>
                        {getLabelText(selectedType, customSettings.eventTypeLabelMeta)}
                    </span>
                </div>
                
                {/* תאריך התחלה - לקריאה בלבד */}
                <div className={styles.dateRow}>
                    <label className={styles.daysLabel}>מתאריך:</label>
                    <div className={styles.dateDisplay}>
                        {pendingDate?.toLocaleDateString('he-IL')}
                    </div>
                </div>
                
                {/* תאריך סיום - עם בורר תאריך */}
                <div className={styles.dateRow}>
                    <label className={styles.daysLabel}>עד תאריך:</label>
                    <div className={styles.datePickerWrapper} ref={datePickerRef}>
                        <button 
                            className={styles.datePickerButton}
                            onClick={() => setShowDatePicker(!showDatePicker)}
                        >
                            <span>{endDate?.toLocaleDateString('he-IL') || 'בחר תאריך'}</span>
                            <Calendar size={18} color="#676879" />
                        </button>
                        {showDatePicker && (
                            <div className={styles.datePickerDropdown}>
                                <CustomDatePicker
                                    selectedDate={endDate}
                                    onDateSelect={(date) => {
                                        // וידוא שתאריך הסיום לא לפני תאריך ההתחלה
                                        if (date >= pendingDate) {
                                            setEndDate(date);
                                        } else {
                                            setEndDate(pendingDate);
                                        }
                                        setShowDatePicker(false);
                                    }}
                                    onClose={() => setShowDatePicker(false)}
                                />
                            </div>
                        )}
                    </div>
                </div>
                
                {/* תצוגת סיכום */}
                <div className={styles.daysSelectionPreview}>
                    <Clock size={16} color="#676879" />
                    <span>
                        {calculatedDays === 1 
                            ? 'יום אחד' 
                            : `${calculatedDays} ימים`}
                    </span>
                </div>
            </div>
        );
    };
    
    // חישוב כותרת לפי מצב התצוגה
    const getModalTitle = () => {
        if (viewMode === 'menu') return 'סוג דיווח ליום זה';
        if (viewMode === 'days-selection') {
            return `הגדרת ${getLabelText(selectedType, customSettings.eventTypeLabelMeta)}`;
        }
        return 'דיווח שעות מרוכז';
    };
    
    // חישוב תוכן לפי מצב התצוגה
    const getModalContent = () => {
        if (viewMode === 'menu') return renderMenu();
        if (viewMode === 'days-selection') return renderDaysSelection();
        return renderSplitForm();
    };
    
    return (
        <div className={styles.overlay} onClick={(e) => {
            if (showCloseConfirm || showDeleteConfirm) return;
            if (e.target === e.currentTarget) handleCloseAttempt();
        }}>
            <div className={`${styles.modal} ${viewMode === 'form' ? styles.modalWide : ''} ${viewMode === 'days-selection' ? styles.modalVisible : ''}`} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>{getModalTitle()}{pendingDate && ` - ${pendingDate.toLocaleDateString('he-IL')}`}</h2>
                    <button className={styles.closeButton} onClick={handleCloseAttempt}><X size={24} /></button>
                </div>
                <div className={`${styles.content} ${viewMode === 'days-selection' ? styles.contentVisible : ''} ${viewMode === 'form' ? styles.contentForm : ''}`}>{getModalContent()}</div>
                <div className={styles.footer}>
                    {isEditMode && onDelete && <button className={`${styles.button} ${styles.deleteBtn}`} onClick={() => setShowDeleteConfirm(true)}>מחק</button>}
                    {viewMode === 'form' && addedReports.length > 0 && (
                        <div className={styles.totalHours}>
                            <span className={styles.totalHoursLabel}>סה"כ שעות</span>
                            <span className={styles.totalHoursValue}>{calculateTotalHours()}</span>
                        </div>
                    )}
                    <button className={`${styles.button} ${styles.cancelBtn}`} onClick={handleCancelOrBack}>
                        {viewMode === 'menu' ? 'ביטול' : 'חזרה'}
                    </button>
                    {viewMode === 'form' && <button className={`${styles.button} ${styles.saveBtn}`} onClick={handleCreate}>שמור דיווחים</button>}
                    {viewMode === 'days-selection' && (
                        <button className={`${styles.button} ${styles.saveBtn}`} onClick={handleCreateAllDayWithDuration}>
                            צור אירוע
                        </button>
                    )}
                </div>
            </div>
            <ConfirmDialog isOpen={showCloseConfirm} onClose={() => setShowCloseConfirm(false)} onConfirm={() => { setShowCloseConfirm(false); handleCreate(); }} onCancel={() => { setShowCloseConfirm(false); onClose(); }} title="שמירת דיווחים" message="יש דיווחים שלא נשמרו. האם ברצונך לשמור את הדיווחים לפני סגירה?" confirmText="שמור דיווחים" cancelText="בטל" confirmButtonStyle="primary" />
            <ConfirmDialog isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} onConfirm={() => { setShowDeleteConfirm(false); if (onDelete) onDelete(); }} onCancel={() => setShowDeleteConfirm(false)} title="מחיקת אירוע" message="האם אתה בטוח שברצונך למחוק את האירוע?" confirmText="מחק" cancelText="ביטול" confirmButtonStyle="danger" />
        </div>
    );
}
