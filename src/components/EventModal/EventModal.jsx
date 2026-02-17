import React, { useEffect, useState } from 'react';
import { useSettings, STRUCTURE_MODES } from '../../contexts/SettingsContext';
import { useMobile } from '../../contexts/MondayContext';
import { useProjects } from '../../hooks/useProjects';
import { useTasks } from '../../hooks/useTasks';
import { useStageOptions } from '../../hooks/useStageOptions';
import { useNonBillableOptions } from '../../hooks/useNonBillableOptions';
import { getEffectiveBoardId } from '../../utils/boardIdResolver';
import { getNonBillableIndexes, getLabelText } from '../../utils/eventTypeMapping';
import TaskSelect from '../TaskSelect';
import ConfirmDialog from '../ConfirmDialog';
import styles from './EventModal.module.css';

export default function EventModal({
    isOpen,
    onClose,
    pendingSlot,
    onCreate,
    eventToEdit = null,
    isEditMode = false,
    isConvertMode = false,
    isLoadingEventData = false,
    onUpdate = null,
    onDelete = null,
    onConvert = null,
    selectedItem: propSelectedItem = null,
    setSelectedItem: setPropSelectedItem = null,
    monday,
    context = null,
    // Approval props
    isManager = false,
    isApprovalEnabled = false,
    onApprove = null,
    onReject = null,
    // Lock props
    isLocked = false,
    lockReason = ''
}) {
    const { customSettings } = useSettings();
    const isMobile = useMobile();
    const { projects, loading: loadingProjects, error: projectsError, refetch: refetchProjects } = useProjects();
    const { createTask, fetchForProject, tasks, loading: loadingTasks } = useTasks();

    // Body scroll lock on mobile
    useEffect(() => {
        if (isOpen && isMobile) {
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = ''; };
        }
    }, [isOpen, isMobile]);
    
    // State - משתמש ב-prop אם קיים, אחרת state פנימי
    const [internalSelectedItem, setInternalSelectedItem] = useState(null);
    const [localProjects, setLocalProjects] = useState(projects);
    
    // עדכון localProjects כש-projects משתנה
    useEffect(() => {
        setLocalProjects(projects);
    }, [projects]);
    
    // מציאת selectedItem מה-localProjects
    const selectedItem = propSelectedItem !== null 
        ? (localProjects.find(p => p.id === propSelectedItem.id) || propSelectedItem)
        : internalSelectedItem;
    const setSelectedItem = setPropSelectedItem || setInternalSelectedItem;
    
    const [notes, setNotes] = useState("");
    const [selectedTask, setSelectedTask] = useState(null);
    const [selectedStage, setSelectedStage] = useState(null);
    const [isBillable, setIsBillable] = useState(true);
    const [selectedNonBillableType, setSelectedNonBillableType] = useState(null);
    const [isCreatingTask, setIsCreatingTask] = useState(false);
    // State נפרד למשימות של הפרויקט הנבחר
    const [selectedItemTasks, setSelectedItemTasks] = useState([]);
    
    // State - תיבת אישור למחיקה
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    
    // טעינת שם המשתמש
    const [reporterName, setReporterName] = useState('');
    useEffect(() => {
        if (monday) {
            // שליפת שם המשתמש הנוכחי
            monday.api(`query { me { name } }`).then(res => {
                setReporterName(res.data?.me?.name || '');
            });
        }
    }, [monday]);

    // חישוב לוח דיווחים אפקטיבי - העמודות נמצאות בלוח הזה
    const boardId = getEffectiveBoardId(customSettings, context);

    const { stageOptions, loading: loadingStages } = useStageOptions(
        monday,
        customSettings.stageColumnId && boardId ? boardId : null,
        customSettings.stageColumnId
    );

    const { nonBillableOptions, loading: loadingNonBillable } = useNonBillableOptions(
        monday,
        customSettings.nonBillableStatusColumnId && boardId ? boardId : null,
        customSettings.nonBillableStatusColumnId
    );
    
    // Reset state when dialog opens
    useEffect(() => {
        if (isOpen) {
            if (isConvertMode && eventToEdit) {
                // מצב המרה - איפוס שדות מלבד הערות
                // המשתמש חייב לבחור פרויקט/משימה/סיווג מחדש
                setSelectedItem(null);
                setSelectedItemTasks([]);
                setSelectedTask(null);
                setSelectedStage(null);
                setIsBillable(true);
                setSelectedNonBillableType(null);
                setIsCreatingTask(false);
                // ההערות כוללות את הכותרת המקורית
                setNotes(eventToEdit.notes || "");
            } else if (isEditMode && eventToEdit) {
                // מצב עריכה רגיל - טעינת נתונים קיימים
                setNotes(eventToEdit.notes || "");
                setSelectedTask(eventToEdit.taskId || null);
                setSelectedStage(eventToEdit.stageId || null);
                setIsBillable(eventToEdit.isBillable !== false);
                setSelectedNonBillableType(eventToEdit.nonBillableType || null);

                // שימוש בנתונים ראשוניים אם קיימים באירוע
                if (eventToEdit.selectedProjectData) {
                    setSelectedItem(eventToEdit.selectedProjectData);
                }
                if (eventToEdit.selectedTaskData) {
                    setSelectedItemTasks([eventToEdit.selectedTaskData]);
                    setSelectedTask(eventToEdit.selectedTaskData.id);
                }

                // מציאת הפרויקט המלא מהרשימה
                if (eventToEdit.projectId) {
                    const project = localProjects.find(p => p.id === eventToEdit.projectId);
                    if (project) {
                        setSelectedItem(project);
                        if (customSettings.tasksProjectColumnId) {
                            fetchForProject(project.id);
                        }
                    } else if (eventToEdit.projectId) {
                        if (customSettings.tasksProjectColumnId) {
                            fetchForProject(eventToEdit.projectId);
                        }
                    }
                }
            } else {
                // מצב יצירה - איפוס
                setSelectedItem(null);
                setSelectedItemTasks([]);
                setNotes("");
                setSelectedTask(null);
                setSelectedStage(null);
                setIsBillable(true);
                setSelectedNonBillableType(null);
                setIsCreatingTask(false);
            }
        }
    }, [isOpen, isEditMode, isConvertMode, eventToEdit, localProjects, setSelectedItem, customSettings.tasksProjectColumnId, fetchForProject]);

    // טעינת משימות כשמשתמש בוחר פרויקט
    useEffect(() => {
        if (selectedItem && !isCreatingTask && customSettings.tasksProjectColumnId) {
            // טעינת משימות במצב יצירה או במצב המרה (שבו המשתמש בוחר פרויקט מחדש)
            if (!isEditMode || isConvertMode) {
                setSelectedItemTasks([]);
                setSelectedTask(null);
                setSelectedStage(null);
                fetchForProject(selectedItem.id);
            }
        } else if (!selectedItem) {
            setSelectedItemTasks([]);
        }
    }, [selectedItem, isCreatingTask, customSettings.tasksProjectColumnId, fetchForProject, isEditMode, isConvertMode]);
    
    useEffect(() => {
        if (!selectedTask && customSettings.stageColumnId) {
            setSelectedStage(null);
        }
    }, [selectedTask, customSettings.stageColumnId]);
    
    useEffect(() => {
        if (tasks && tasks.length > 0 && selectedItem) {
            setSelectedItemTasks(tasks);
            // במצב עריכה רגיל (לא המרה) - בחירת המשימה הקיימת
            if (isEditMode && !isConvertMode && eventToEdit?.taskId) {
                const taskExists = tasks.some(t => t.id === eventToEdit.taskId);
                if (taskExists) {
                    setSelectedTask(eventToEdit.taskId);
                }
            }
        } else if (tasks && tasks.length === 0 && selectedItem) {
            if (!isEditMode || isConvertMode || !eventToEdit?.selectedTaskData) {
                setSelectedItemTasks([]);
            }
        }
    }, [tasks, selectedItem, isEditMode, isConvertMode, eventToEdit]);

    const handleCreateTask = async (taskName) => {
        if (!selectedItem) return;
        setIsCreatingTask(true);
        try {
            const newTask = await createTask(selectedItem.id, taskName);
            if (newTask) {
                setSelectedItemTasks(prev => [...prev, newTask]);
                setSelectedTask(newTask.id);
            }
        } finally {
            setIsCreatingTask(false);
        }
    };

    const handleCreate = async () => {
        const { structureMode } = customSettings;
        
        // לא לחיוב - נדרש רק סוג דיווח
        if (!isBillable) {
            if (!selectedNonBillableType) {
                alert('יש לבחור סוג דיווח לא לחיוב');
                return;
            }
        }
        
        // לחיוב
        if (isBillable) {
            // פרויקט חובה תמיד
            if (!selectedItem) {
                alert('יש לבחור פרויקט');
                return;
            }
            
            // במצב TASKS - משימה חובה
            if (structureMode === STRUCTURE_MODES.PROJECT_WITH_TASKS && 
                customSettings.taskColumnId && !selectedTask) {
                alert('יש לבחור משימה');
                return;
            }
            
            // במצב PROJECT_WITH_STAGE - סיווג חובה
            if (structureMode === STRUCTURE_MODES.PROJECT_WITH_STAGE && 
                customSettings.stageColumnId && !selectedStage) {
                alert('יש לבחור סיווג');
                return;
            }
        }

        const task = selectedItemTasks.find(t => t.id === selectedTask);
        const taskName = task?.name || 'ללא משימה';
        const projectName = selectedItem?.name;
        
        // קביעת כותרת האירוע לפי מבנה הדיווח (structureMode כבר מוגדר למעלה)
        let eventTitle;
        if (isBillable) {
            // לחיוב - לפי מבנה נבחר:
            // PROJECT_ONLY: "שם הפרויקט"
            // PROJECT_WITH_STAGE: "שם הפרויקט - סיווג"
            // PROJECT_WITH_TASKS: "שם הפרויקט - שם המשימה"
            if (structureMode === STRUCTURE_MODES.PROJECT_ONLY) {
                eventTitle = projectName || 'ללא פרויקט';
            } else if (structureMode === STRUCTURE_MODES.PROJECT_WITH_STAGE) {
                eventTitle = selectedStage ? `${projectName} - ${selectedStage}` : projectName;
            } else if (structureMode === STRUCTURE_MODES.PROJECT_WITH_TASKS) {
                eventTitle = projectName ? `${projectName} - ${taskName}` : taskName;
            } else {
                // ברירת מחדל
                eventTitle = projectName || 'ללא פרויקט';
            }
        } else {
            // לא לחיוב: "סוג לא לחיוב - שם המדווח"
            const nbIndexes = getNonBillableIndexes(customSettings.eventTypeMapping);
            const defaultNbLabel = nbIndexes.length > 0 ? getLabelText(nbIndexes[0], customSettings.eventTypeLabelMeta) : 'לא לחיוב';
            const nonBillableLabel = nonBillableOptions.find(opt => opt.label === selectedNonBillableType)?.label || selectedNonBillableType || defaultNbLabel;
            eventTitle = reporterName ? `${nonBillableLabel} - ${reporterName}` : nonBillableLabel;
        }
        
        const eventData = {
            title: eventTitle,
            itemId: selectedItem?.id,
            assignmentId: selectedItem?.assignmentId,  // מזהה ההקצאה (אם קיים)
            notes: notes,
            taskId: selectedTask,
            stageId: selectedStage,
            isBillable: isBillable,
            nonBillableType: isBillable ? null : selectedNonBillableType
        };

        if (isConvertMode && onConvert) {
            // מצב המרה - המרת אירוע מתוכנן לאירוע רגיל
            onConvert(eventData);
        } else if (isEditMode && onUpdate) {
            onUpdate(eventData);
        } else {
            onCreate(eventData);
        }
        onClose();
    };

    if (!pendingSlot || !isOpen) return null;

    const dateStr = pendingSlot?.start 
        ? pendingSlot.start.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }) 
        : '';

    // בדיקה אם זה אירוע עתידי (במצב המרה - חוסם שמירה)
    const isFutureEvent = isConvertMode && pendingSlot?.end && pendingSlot.end > new Date();

    const isFormValid = () => {
        // במצב המרה - אירוע עתידי חוסם שמירה
        if (isFutureEvent) {
            return false;
        }

        // לא לחיוב - נדרש רק סוג אירוע
        if (!isBillable) {
            return !!selectedNonBillableType;
        }
        // לחיוב - פרויקט חובה תמיד
        if (!selectedItem) return false;

        const { structureMode } = customSettings;

        // במצב TASKS - משימה חובה
        if (structureMode === STRUCTURE_MODES.PROJECT_WITH_TASKS &&
            customSettings.taskColumnId && !selectedTask) {
            return false;
        }

        // במצב STAGE - סיווג חובה
        if (structureMode === STRUCTURE_MODES.PROJECT_WITH_STAGE &&
            customSettings.stageColumnId && !selectedStage) {
            return false;
        }

        return true;
    };

    const formIsValid = isFormValid();

    // האם להציג את שדה המלל החופשי (Notes)
    const showNotesField = customSettings.enableNotes && (
        !isBillable ? !!selectedNonBillableType : (
            selectedItem && (
                customSettings.structureMode === STRUCTURE_MODES.PROJECT_ONLY ||
                (customSettings.structureMode === STRUCTURE_MODES.PROJECT_WITH_TASKS && selectedTask) ||
                (customSettings.structureMode === STRUCTURE_MODES.PROJECT_WITH_STAGE && selectedStage)
            )
        )
    );

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && formIsValid && !e.shiftKey && !e.ctrlKey && !e.metaKey && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            handleCreate();
        }
    };

    return (
        <div className={styles.overlay} onClick={(e) => {
            if (showDeleteConfirm) return;
            if (e.target === e.currentTarget) onClose();
        }}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown} tabIndex={-1}>
                <div className={styles.header}>
                    <div className={styles.titleGroup}>
                        <h2 className={styles.title}>
                            {isConvertMode ? 'המרת אירוע מתוכנן' : 'דיווח שעות'}
                        </h2>
                        <span className={styles.subtitle}>{dateStr}</span>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="סגור">{isMobile ? '→' : '✕'}</button>
                </div>

                {/* הודעת נעילה בראש המודל */}
                {isEditMode && !isConvertMode && isLocked && (
                    <div className={styles.lockBanner}>{lockReason}</div>
                )}

                <div className={styles.content} style={{ position: 'relative' }}>
                    {isLoadingEventData && (
                        <div className={styles.loadingOverlay}>
                            <div className={styles.spinner}></div>
                        </div>
                    )}

                    {/* הודעות מצב המרה */}
                    {isConvertMode && (
                        <div className={styles.convertModeInfo}>
                            {eventToEdit?.originalTitle && (
                                <div className={styles.originalEventInfo}>
                                    <span className={styles.originalEventLabel}>אירוע מקורי:</span>
                                    <span className={styles.originalEventTitle}>{eventToEdit.originalTitle}</span>
                                </div>
                            )}
                            {isFutureEvent && (
                                <div className={styles.futureEventWarning}>
                                    ⚠️ לא ניתן לערוך אירוע עתידי
                                </div>
                            )}
                            {!isFutureEvent && (
                                <div className={styles.convertModeHint}>
                                    בחר פרויקט להמרת האירוע המתוכנן לדיווח שעות
                                </div>
                            )}
                        </div>
                    )}

                    {/* כל שדות הטופס מוסתרים באירוע עתידי */}
                    {!isFutureEvent && (<>
                    {/* בחירת מצב דיווח - לחיוב / לא לחיוב */}
                    <div className={`${styles.modeSelector} ${styles.fixedSection}`}>
                        <button
                            className={`${styles.modeButton} ${isBillable ? styles.modeButtonActive : ''}`}
                            onClick={() => setIsBillable(true)}
                        >
                            לחיוב
                        </button>
                        <button
                            className={`${styles.modeButton} ${!isBillable ? styles.modeButtonActive : ''}`}
                            onClick={() => setIsBillable(false)}
                        >
                            לא לחיוב
                        </button>
                    </div>

                    {!isBillable && customSettings.nonBillableStatusColumnId && (
                        <div className={`${styles.formGroup} ${styles.fixedSection}`}>
                            <label className={styles.label}>סוג דיווח לא לחיוב <span className={styles.required}>*</span></label>
                            {loadingNonBillable ? (
                                <div className={styles.loading}>טוען...</div>
                            ) : (
                                <div className={styles.grid}>
                                    {nonBillableOptions.map(option => (
                                        <button
                                            key={option.id}
                                            onClick={() => setSelectedNonBillableType(option.label === selectedNonBillableType ? null : option.label)}
                                            className={`${styles.itemButton} ${selectedNonBillableType === option.label ? styles.selected : ''}`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* פרויקט - רק לדיווח לחיוב */}
                    {isBillable && (
                        <div className={styles.scrollableSection}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>
                                    פרויקט <span className={styles.required}>*</span>
                                </label>
                                {isEditMode && !isConvertMode ? (
                                    <div className={styles.readOnlyField}>
                                        {selectedItem ? selectedItem.name : (isLoadingEventData ? 'טוען...' : 'לא נבחר פרויקט')}
                                    </div>
                                ) : (
                                    <div className={styles.grid}>
                                        {loadingProjects ? (
                                            <div className={styles.loading}>טוען...</div>
                                        ) : projectsError ? (
                                            <div className={styles.loading}>{projectsError}</div>
                                        ) : localProjects
                                            .slice()
                                            .sort((a, b) => a.name.localeCompare(b.name, 'he'))
                                            .map(item => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => setSelectedItem(item.id === selectedItem?.id ? null : item)}
                                                    className={`${styles.itemButton} ${selectedItem?.id === item.id ? styles.selected : ''}`}
                                                >
                                                    {item.name}
                                                </button>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* משימה - מוצג רק במצב TASKS */}
                    {isBillable && customSettings.taskColumnId && selectedItem &&
                     customSettings.structureMode === STRUCTURE_MODES.PROJECT_WITH_TASKS && (
                        <div className={`${styles.formGroup} ${styles.fixedSection}`}>
                            <label className={styles.label}>משימה <span className={styles.required}>*</span></label>
                            <div className={styles.productSection}>
                                <TaskSelect
                                    products={selectedItemTasks}
                                    selectedProduct={selectedTask}
                                    onSelectProduct={setSelectedTask}
                                    onCreateNew={async (taskName) => await handleCreateTask(taskName)}
                                    isLoading={false}
                                    disabled={false}
                                    isCreatingProduct={isCreatingTask}
                                    placeholder="בחר משימה..."
                                />
                            </div>
                        </div>
                    )}

                    {/* סיווג - מוצג רק במצב STAGE */}
                    {isBillable && customSettings.stageColumnId && selectedItem &&
                     customSettings.structureMode === STRUCTURE_MODES.PROJECT_WITH_STAGE && (
                        <div className={`${styles.formGroup} ${styles.fixedSection}`}>
                            <label className={styles.label}>סיווג</label>
                            {loadingStages ? (
                                <div className={styles.loading}>טוען...</div>
                            ) : (
                                <div className={styles.grid}>
                                    {stageOptions.map(option => (
                                        <button
                                            key={option.id}
                                            onClick={() => setSelectedStage(option.label === selectedStage ? null : option.label)}
                                            className={`${styles.itemButton} ${selectedStage === option.label ? styles.selected : ''}`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* הערות/מלל חופשי - מוצג רק אם מופעל בהגדרות ורק אחרי בחירות רלוונטיות */}
                    {showNotesField && (
                        <div className={`${styles.formGroup} ${styles.fixedSection}`}>
                            <label className={styles.label}>מלל חופשי</label>
                            <input
                                type="text"
                                className={styles.input}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="הוסף הערות כאן..."
                                autoComplete="off"
                            />
                        </div>
                    )}
                    </>)}
                </div>

                <div className={styles.footer}>
                    {isEditMode && !isConvertMode && !isLocked && onDelete && (
                        <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setShowDeleteConfirm(true)}>מחק</button>
                    )}
                    {/* כפתורי אישור/דחייה מנהל */}
                    {isEditMode && !isConvertMode && isManager && isApprovalEnabled && eventToEdit?.isPending && (
                        <>
                            <button
                                className={`${styles.btn} ${styles.btnApprove}`}
                                onClick={() => { if (onApprove) onApprove(eventToEdit, 'billable'); onClose(); }}
                            >
                                אשר - לחיוב
                            </button>
                            <button
                                className={`${styles.btn} ${styles.btnApproveUnbillable}`}
                                onClick={() => { if (onApprove) onApprove(eventToEdit, 'unbillable'); onClose(); }}
                            >
                                אשר - לא לחיוב
                            </button>
                            <button
                                className={`${styles.btn} ${styles.btnReject}`}
                                onClick={() => { if (onReject) onReject(eventToEdit); onClose(); }}
                            >
                                דחה
                            </button>
                        </>
                    )}
                    <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onClose}>{isEditMode && isLocked || isFutureEvent ? 'סגור' : 'ביטול'}</button>
                    {!(isEditMode && isLocked) && !isFutureEvent && (
                    <button
                        className={`${styles.btn} ${formIsValid && !isLoadingEventData ? styles.btnPrimaryActive : styles.btnPrimary}`}
                        onClick={handleCreate}
                        disabled={!formIsValid || isLoadingEventData}
                    >
                        {isConvertMode
                            ? 'המר לדיווח'
                            : isEditMode
                                ? (isLoadingEventData ? 'טוען...' : 'עדכן')
                                : 'שמור'
                        }
                    </button>
                    )}
                </div>
            </div>
            
            <ConfirmDialog
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={() => {
                    setShowDeleteConfirm(false);
                    if (onDelete) onDelete();
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
