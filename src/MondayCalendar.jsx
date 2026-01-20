import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { format, parse } from 'date-fns';
import { Calendar, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';

// ייבוא קבצי עיצוב
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import './styles/calendar/index.css';

// קבועים והגדרות
import { localizer, hebrewMessages, formats, roundToNearest15Minutes, WorkWeekView, CALENDAR_DEFAULTS } from './constants/calendarConfig';

// פונקציות עזר
import { fetchColumnSettings, createBoardItem, fetchEventsFromBoard, deleteItem, fetchItemById, fetchProjectById, fetchCurrentUser } from './utils/mondayApi';
import { getColumnIds, mapItemToEvent, buildColumnValues, buildFetchEventsQuery } from './utils/mondayColumns';
import { calculateEndDateFromDays, formatDurationForSave } from './utils/durationUtils';
import { validateSettings } from './utils/settingsValidator';
import logger from './utils/logger';

// רכיבים
import EventModal from './components/EventModal/EventModal';
import AllDayEventModal from './components/AllDayEventModal/AllDayEventModal';
import CalendarToolbar from './components/CalendarToolbar';
import CustomEvent from './components/CustomEvent';
import { ToastContainer } from './components/Toast';
import ErrorDetailsModal from './components/ErrorDetailsModal/ErrorDetailsModal';
import SettingsValidationDialog from './components/SettingsValidationDialog';
import SelectionActionBar from './components/SelectionActionBar';

// Context
import { useSettings, STRUCTURE_MODES } from './contexts/SettingsContext';

// Hooks
import { useMondayEvents } from './hooks/useMondayEvents';
import { useToast } from './hooks/useToast';
import { useProjects } from './hooks/useProjects';
import { useBoardOwner } from './hooks/useBoardOwner';
import { useIsraeliHolidays } from './hooks/useIsraeliHolidays';
import { useEventModals } from './hooks/useEventModals';
import { useMultiSelect } from './hooks/useMultiSelect';
import { useCalendarHandlers } from './hooks/useCalendarHandlers';

// עטיפת הלוח ברכיב Drag and Drop
const DnDCalendar = withDragAndDrop(Calendar);

// רכיב כותרת יום מותאם אישית - שם היום מעל מספר התאריך (תצוגה בלבד, ללא לחיצה)
const CustomDayHeader = ({ date, localizer }) => {
    const dayName = localizer.format(date, 'EEEE', 'he')
        .replace('Sunday', 'יום א\'')
        .replace('Monday', 'יום ב\'')
        .replace('Tuesday', 'יום ג\'')
        .replace('Wednesday', 'יום ד\'')
        .replace('Thursday', 'יום ה\'')
        .replace('Friday', 'יום ו\'')
        .replace('Saturday', 'יום ש\'');
    const dayNumber = localizer.format(date, 'd', 'he');

    return (
        <div className="rbc-custom-header">
            <div className="rbc-header-day">{dayName}</div>
            <div className="rbc-header-date">{dayNumber}</div>
        </div>
    );
};

export default function MondayCalendar({ monday, onOpenSettings }) {
    // גישה להגדרות מותאמות
    const { customSettings } = useSettings();
    
    // פונקציית עזר ליצירת תאריך עם שעה ספציפית על בסיס היום הנוכחי
    const getTodayWithTime = (hours, minutes = 0) => {
        const d = new Date();
        d.setHours(hours, minutes, 0, 0);
        return d;
    };

    // State - לוח שנה - שעות עבודה קבועות: 00:00 עד 23:59
    const minTime = useMemo(() => {
        return getTodayWithTime(0, 0);
    }, []);
    
    const maxTime = useMemo(() => {
        const d = new Date();
        d.setHours(23, 59, 59, 999);
        return d;
    }, []);

    // רפרנס לקונטיינר הלוח לגלילה ידנית
    const calendarContainerRef = useRef(null);

    // גלילה ידנית לשעה 8:00 - גרסה מבוססת טקסט (מדויקת יותר)
    useEffect(() => {
        const scrollToEight = () => {
            // 1. איתור הקונטיינר הנגלל
            const scrollContainer = document.querySelector('.rbc-time-content');
            if (!scrollContainer) return;

            // 2. חיפוש תווית השעה שמכילה את הטקסט "08:00"
            const labels = Array.from(document.querySelectorAll('.rbc-time-gutter .rbc-label'));
            const targetLabel = labels.find(label => label.textContent.includes('08:00'));

            if (targetLabel) {
                // 3. מציאת השורה (הקבוצה) שמכילה את התווית הזו
                const slotGroup = targetLabel.closest('.rbc-timeslot-group');
                
                if (slotGroup) {
                    // 4. ביצוע הגלילה למיקום המדויק של השורה (הוספת 14px בגלל מירכוז התוויות ב-CSS)
                    scrollContainer.scrollTop = slotGroup.offsetTop - 10;
                }
            }
        };
        
        // טיימרים להבטחת ביצוע לאחר הרינדור
        const timer1 = setTimeout(scrollToEight, 100);
        const timer2 = setTimeout(scrollToEight, 400);
        
        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, [minTime]);

    // State - Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [pendingSlot, setPendingSlot] = useState(null);
    const [newEventTitle, setNewEventTitle] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    
    // State - Edit mode
    const [eventToEdit, setEventToEdit] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isLoadingEventData, setIsLoadingEventData] = useState(false);
    
    // State - All-day events
    const [isAllDayModalOpen, setIsAllDayModalOpen] = useState(false);
    const [pendingAllDayDate, setPendingAllDayDate] = useState(null);
    const [allDayEventToEdit, setAllDayEventToEdit] = useState(null);
    const [isAllDayEditMode, setIsAllDayEditMode] = useState(false);
    
    // State - בחירה מרובה של אירועים
    const [selectedEventIds, setSelectedEventIds] = useState(new Set());
    const [isCtrlPressed, setIsCtrlPressed] = useState(false);
    const [isProcessingBulk, setIsProcessingBulk] = useState(false);

    // מעקב גלובלי אחר מקש CTRL/CMD לבחירה מרובה + ESC לביטול בחירה
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey || e.metaKey) {
                setIsCtrlPressed(true);
            }
            // ESC לביטול בחירה מרובה
            if (e.key === 'Escape' && selectedEventIds.size > 0) {
                setSelectedEventIds(new Set());
                logger.debug('Keyboard', 'ESC pressed - selection cleared');
            }
        };
        const handleKeyUp = (e) => {
            if (!e.ctrlKey && !e.metaKey) {
                setIsCtrlPressed(false);
            }
        };
        // גם כאשר החלון מאבד פוקוס - לאפס את המצב
        const handleBlur = () => {
            setIsCtrlPressed(false);
        };
        
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, [selectedEventIds.size]);
    
    // Hook לניהול פרויקטים
    const { projects, loading: isLoadingProjects } = useProjects();
    
    // Hook לבדיקת owner status
    const { isOwner, loading: ownerLoading } = useBoardOwner(monday);

    // Hook לניהול חגים ישראליים
    const { holidays, loadHolidays } = useIsraeliHolidays();
    
    // State - אימות הגדרות
    const [settingsValidation, setSettingsValidation] = useState(null);
    const [hasValidatedSettings, setHasValidatedSettings] = useState(false);
    const [showValidationDialog, setShowValidationDialog] = useState(false);
    
    // המרת פרויקטים לפורמט boardItems
    const boardItems = projects.map(project => ({
        value: project.id,
        label: project.name
    }));
    
    // State - Monday context
    const [context, setContext] = useState(null);
    const [settings, setSettings] = useState(null);
    const [columnIds, setColumnIds] = useState(null); // מזהי העמודות
    
    // Hook לניהול Toast
    const { 
        toasts, 
        showSuccess, 
        showError, 
        showWarning, 
        removeToast,
        showErrorWithDetails,
        errorDetailsModal,
        openErrorDetailsModal,
        closeErrorDetailsModal
    } = useToast();

    // Hook לניהול אירועים
    const { 
        events, 
        loading: eventsLoading, 
        error: eventsError,
        loadEvents,
        createEvent,
        updateEvent,
        deleteEvent,
        updateEventPosition,
        addEvent,
        fetchEmployeeHourlyRate
    } = useMondayEvents(monday, context);

    // שמירת טווח התצוגה הנוכחי לשימוש ברענון אירועים
    const [currentViewRange, setCurrentViewRange] = useState(null);

    // טעינת context מ-Monday
    useEffect(() => {
        const loadContext = async () => {
            try {
                const contextResponse = await monday.get("context");
                setContext(contextResponse.data);
                logger.info('MondayCalendar', 'Loaded context', contextResponse.data);
            } catch (error) {
                logger.error('MondayCalendar', 'Error loading context', error);
            }
        };

        loadContext();
    }, [monday]);

    // טעינת הגדרות מ-Monday
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const settingsResponse = await monday.get("settings");
                const settingsData = settingsResponse.data || {};
                setSettings(settingsData);
                logger.info('MondayCalendar', 'Loaded settings', settingsData);

                // חילוץ מזהי עמודות
                const ids = getColumnIds(settingsData);
                setColumnIds(ids);
                logger.debug('MondayCalendar', 'Column IDs', ids);
            } catch (error) {
                logger.error('MondayCalendar', 'Error loading settings', error);
            }
        };

        loadSettings();
    }, [monday]);

    // טעינת אירועים בפתיחה ראשונית ובעדכון הגדרות
    useEffect(() => {
        if (context?.boardId && customSettings?.dateColumnId) {
            // טעינת השבוע הנוכחי כברירת מחדל
            const now = new Date();
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 7);
            endOfWeek.setHours(23, 59, 59, 999);

            // שמירת טווח התצוגה הראשוני
            setCurrentViewRange({ start: startOfWeek, end: endOfWeek });
            loadEvents(startOfWeek, endOfWeek);
        }
    }, [context, customSettings, loadEvents]);

    // אימות הגדרות בעת עליית האפליקציה
    useEffect(() => {
        const runValidation = async () => {
            // מחכים שיהיה context ו-customSettings לפני שמבצעים אימות
            if (!context?.boardId || !customSettings || hasValidatedSettings) {
                return;
            }

            logger.info('MondayCalendar', 'Running settings validation...');
            
            try {
                const validationResult = await validateSettings(monday, customSettings, context.boardId);
                setSettingsValidation(validationResult);
                setHasValidatedSettings(true);
                
                if (!validationResult.isValid) {
                    logger.warn('MondayCalendar', 'Settings validation failed', validationResult);
                    
                    // הצגת תיבת דיאלוג עם פרטי הבעיות
                    setShowValidationDialog(true);
                } else {
                    logger.info('MondayCalendar', 'Settings validation passed');
                    
                    // הצגת אזהרות אם יש
                    if (validationResult.warnings.length > 0) {
                        validationResult.warnings.forEach(warning => {
                            logger.warn('MondayCalendar', warning);
                        });
                    }
                }
            } catch (error) {
                logger.error('MondayCalendar', 'Error during settings validation', error);
            }
        };

        runValidation();
    }, [context, customSettings, monday, hasValidatedSettings]);

    // --- Helper functions ---

    // --- Event handlers ---

    // מניעת גלילה בזמן גרירת אירוע יומי
    const scrollLockRef = useRef(null);
    
    const onDragStart = useCallback(({ event }) => {
        if (event?.allDay) {
            const timeContent = document.querySelector('.rbc-time-content');
            if (timeContent) {
                // שמירת מיקום הגלילה הנוכחי
                const savedScrollTop = timeContent.scrollTop;
                scrollLockRef.current = savedScrollTop;
                
                // נעילת הגלילה באמצעות requestAnimationFrame לביצועים טובים
                let isLocked = true;
                const lockScroll = () => {
                    if (isLocked && scrollLockRef.current !== null) {
                        timeContent.scrollTop = scrollLockRef.current;
                        requestAnimationFrame(lockScroll);
                    }
                };
                requestAnimationFrame(lockScroll);
                
                // שחרור הנעילה כשהגרירה מסתיימת
                const unlock = () => {
                    isLocked = false;
                    scrollLockRef.current = null;
                    document.removeEventListener('mouseup', unlock);
                    document.removeEventListener('touchend', unlock);
                };
                document.addEventListener('mouseup', unlock);
                document.addEventListener('touchend', unlock);
            }
        }
    }, []);

    // גרירת אירוע קיים (הזזה)
    const onEventDrop = useCallback(async ({ event, start, end, isAllDay }) => {
        try {
            // אירוע יומי שנשאר יומי - עדכון תאריכים בלבד (גרירה אופקית)
            if (event.allDay && isAllDay) {
                logger.debug('onEventDrop', 'All-day event moved horizontally', { 
                    eventId: event.id, 
                    from: event.start, 
                    to: start 
                });
                await updateEventPosition(event, start, end);
                showSuccess('האירוע עודכן בהצלחה');
                return;
            }
            
            // מניעת גרירת אירוע יומי לאזור השעתי
            if (event.allDay && !isAllDay) {
                showError('לא ניתן להעביר אירוע יומי לאזור השעתי');
                return;
            }
            
            // מניעת גרירת אירוע שעתי לאזור היומי
            if (!event.allDay && isAllDay) {
                showError('לא ניתן להעביר אירוע שעתי לאזור היומי');
                return;
            }
            
            // אירוע שעתי - בדיקה אם הזמן החדש הוא בעתיד
            const now = new Date();
            if (start > now) {
                showWarning('לא ניתן לדווח שעות על זמן עתידי');
                logger.debug('onEventDrop', 'Blocked moving event to future', { start, now });
                return;
            }
            
            // אירוע שעתי - המשך כרגיל
            await updateEventPosition(event, start, end);
            showSuccess('האירוע עודכן בהצלחה');
        } catch (error) {
            showErrorWithDetails(error, { functionName: 'onEventDrop' });
            logger.error('MondayCalendar', 'Error in onEventDrop', error);
        }
    }, [updateEventPosition, showSuccess, showError, showWarning, showErrorWithDetails]);

    // שינוי אורך אירוע (מתיחה) - אירועים שעתיים ויומיים
    const onEventResize = useCallback(async ({ event, start, end }) => {
        try {
            // לאירועים יומיים - חישוב מספר הימים החדש (הרחבה אופקית)
            if (event.allDay) {
                const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
                logger.debug('onEventResize', `All-day event resized to ${days} days`, {
                    eventId: event.id,
                    start,
                    end,
                    days
                });
            }
            
            await updateEventPosition(event, start, end);
            showSuccess('האירוע עודכן בהצלחה');
        } catch (error) {
            showErrorWithDetails(error, { functionName: 'onEventResize' });
            logger.error('MondayCalendar', 'Error in onEventResize', error);
        }
    }, [updateEventPosition, showSuccess, showErrorWithDetails]);

    // טעינת נתוני אירוע לעריכה
    const loadEventDataForEdit = useCallback(async (event) => {
        if (!context?.boardId || !event?.mondayItemId) return;
        
        try {
            logger.functionStart('loadEventDataForEdit', { eventId: event.mondayItemId });
            setIsLoadingEventData(true);

            // שימוש ב-query ממוקד לפי ID
            const item = await fetchItemById(monday, context.boardId, event.mondayItemId);
            
            if (!item) {
                logger.warn('loadEventDataForEdit', `Item not found: ${event.mondayItemId}`);
            return;
        }

            const updatedEvent = { ...event };

                // חילוץ פרויקט
                if (customSettings.projectColumnId) {
                    const projectColumn = item.column_values.find(col => col.id === customSettings.projectColumnId);
                    if (projectColumn) {
                        // שימוש ב-linked_items במקום value (עובד גם כש-value הוא null)
                        if (projectColumn.linked_items && projectColumn.linked_items.length > 0) {
                            const linkedItem = projectColumn.linked_items[0];
                            const projectId = linkedItem.id;
                            updatedEvent.projectId = projectId;
                            
                            // שימוש ישיר בנתונים מ-linked_items
                            setSelectedItem({ id: linkedItem.id, name: linkedItem.name });
                            logger.debug('loadEventDataForEdit', `Found project from linked_items: ${linkedItem.name} (${linkedItem.id})`);
                        } else if (projectColumn?.value) {
                            // Fallback למקרה הישן (אם אין linked_items)
                            try {
                                const parsedValue = typeof projectColumn.value === 'string' 
                                    ? JSON.parse(projectColumn.value) 
                                    : projectColumn.value;
                                
                                if (parsedValue?.item_ids && parsedValue.item_ids.length > 0) {
                                    const projectId = parsedValue.item_ids[0].toString();
                                    updatedEvent.projectId = projectId;

                                    // נטען את הפרויקט - שימוש ב-query ממוקד
                                    if (settings?.perent_item_board && context?.boardId) {
                                        try {
                                            const columnId = Object.keys(settings.perent_item_board)[0];
                                            if (columnId) {
                                                const columnSettings = await fetchColumnSettings(monday, context.boardId, columnId);
                                                
                                                if (columnSettings?.boardIds && columnSettings.boardIds.length > 0) {
                                                    const boardId = columnSettings.boardIds[0];
                                                    const project = await fetchProjectById(monday, boardId, projectId);
                                                    
                                                    if (project) {
                                                        setSelectedItem({ id: project.id, name: project.name });
                                                    }
                                                }
                                            }
                                        } catch (err) {
                                            logger.error('loadEventDataForEdit', 'Error loading project', err);
                                        }
                                    }
                                }
                            } catch (err) {
                                logger.error('loadEventDataForEdit', 'Error parsing project column value', err);
                            }
                        }
                    }
                }
                
                // חילוץ משימה
                if (customSettings.taskColumnId) {
                    const taskColumn = item.column_values.find(col => col.id === customSettings.taskColumnId);
                    if (taskColumn) {
                        // שימוש ב-linked_items במקום value
                        if (taskColumn.linked_items && taskColumn.linked_items.length > 0) {
                            const linkedItem = taskColumn.linked_items[0];
                            const taskId = linkedItem.id;
                            updatedEvent.taskId = taskId;
                            // שמירת נתוני המשימה הנבחרת להצגה מידית
                            updatedEvent.selectedTaskData = { id: linkedItem.id, name: linkedItem.name };
                            logger.debug('loadEventDataForEdit', `Found task from linked_items: ${linkedItem.name} (${linkedItem.id})`);
                        } else if (taskColumn?.value) {
                            // Fallback למקרה הישן
                            try {
                                const parsedValue = typeof taskColumn.value === 'string' 
                                    ? JSON.parse(taskColumn.value) 
                                    : taskColumn.value;
                                
                                if (parsedValue?.item_ids && parsedValue.item_ids.length > 0) {
                                    const taskId = parsedValue.item_ids[0].toString();
                                    updatedEvent.taskId = taskId;
                                }
                            } catch (err) {
                                logger.error('loadEventDataForEdit', 'Error parsing task column value', err);
                            }
                        }
                    }
                }
                
                // חילוץ הערות
                if (customSettings.notesColumnId) {
                    const notesColumn = item.column_values.find(col => col.id === customSettings.notesColumnId);
                    if (notesColumn?.text) {
                        updatedEvent.notes = notesColumn.text;
                    } else if (notesColumn?.value) {
                        // אם אין text, ננסה value
                        updatedEvent.notes = notesColumn.value;
                }
                }
                
                // חילוץ שלב
                if (customSettings.stageColumnId) {
                    const stageColumn = item.column_values.find(col => col.id === customSettings.stageColumnId);
                    if (stageColumn) {
                        if (stageColumn.label) {
                            updatedEvent.stageId = stageColumn.label;
                        } else if (stageColumn.value) {
                            try {
                                const parsed = typeof stageColumn.value === 'string' 
                                    ? JSON.parse(stageColumn.value) 
                                    : stageColumn.value;
                                if (parsed?.label) {
                                    updatedEvent.stageId = parsed.label;
                                } else if (typeof parsed === 'string') {
                                    updatedEvent.stageId = parsed;
                                }
                            } catch (err) {
                                // אם יש שגיאה בפענוח, ננסה את הערך הישיר
                                if (typeof stageColumn.value === 'string') {
                                    updatedEvent.stageId = stageColumn.value;
                                }
                            }
                        }
                    }
                }

                // חילוץ נתוני לחיוב / לא לחיוב
                if (customSettings.eventTypeStatusColumnId) {
                    const typeColumn = item.column_values.find(col => col.id === customSettings.eventTypeStatusColumnId);
                    const typeText = typeColumn?.text || typeColumn?.label || "";
                    updatedEvent.isBillable = typeText !== "לא לחיוב";
                }

                if (customSettings.nonBillableStatusColumnId) {
                    const nonBillableColumn = item.column_values.find(col => col.id === customSettings.nonBillableStatusColumnId);
                    if (nonBillableColumn) {
                        updatedEvent.nonBillableType = nonBillableColumn.text || nonBillableColumn.label || "";
                    }
                }
                
            setEventToEdit(updatedEvent);
            logger.functionEnd('loadEventDataForEdit', { eventId: event.mondayItemId });
        } catch (error) {
            logger.error('loadEventDataForEdit', 'Error loading event data for edit', error);
        } finally {
            setIsLoadingEventData(false);
        }
    }, [context, customSettings, monday, settings]);

    // לחיצה על אירוע קיים - פתיחת Modal לעריכה או בחירה מרובה
    const handleEventClick = useCallback(async (event) => {
        logger.functionStart('handleEventClick', { eventId: event.id, title: event.title, isCtrlPressed });

        // חגים הם read-only - לא ניתן ללחוץ עליהם
        if (event.isHoliday) {
            logger.debug('handleEventClick', 'Holiday clicked - ignored', { title: event.title });
            return;
        }

        // בחירה מרובה עם CTRL/CMD - רק לאירועים שעתיים (לא יומיים)
        const isAllDayEvent = event.allDay ||
            event.title === 'מחלה' ||
            event.title === 'חופשה' ||
            event.title === 'מילואים';

        if (isCtrlPressed && !isAllDayEvent) {
            setSelectedEventIds(prev => {
                const newSet = new Set(prev);
                if (newSet.has(event.id)) {
                    newSet.delete(event.id);
                    logger.debug('handleEventClick', 'Deselected event', { eventId: event.id });
                } else {
                    newSet.add(event.id);
                    logger.debug('handleEventClick', 'Selected event', { eventId: event.id });
                }
                return newSet;
            });
            return; // לא פותחים modal בבחירה מרובה
        }
        
        // לחיצה רגילה - ניקוי בחירה קודמת
        if (selectedEventIds.size > 0) {
            setSelectedEventIds(new Set());
        }
        
        if (isAllDayEvent) {
            // פתיחת AllDayEventModal במצב עריכה
            setIsAllDayEditMode(true);
            setAllDayEventToEdit(event);
            setPendingAllDayDate(event.start);
            setIsAllDayModalOpen(true);
            return;
        }
        
        // אירוע רגיל - פתיחת EventModal
        setIsEditMode(true);
        setEventToEdit(event);
        setPendingSlot({ start: event.start, end: event.end });
        setNewEventTitle(event.title || '');
        setSelectedItem(null);
        setIsModalOpen(true);
        
        // טעינת נתוני האירוע לעריכה ברקע
        loadEventDataForEdit(event);
    }, [loadEventDataForEdit, isCtrlPressed, selectedEventIds.size]);

    // לחיצה על סלוט ריק או גרירה - פתיחת Modal
    const onSelectSlot = useCallback(async ({ start, end, slots, allDay, action }) => {
        logger.functionStart('onSelectSlot', { start, end, allDay, action });
        
        // בדיקה אם זו לחיצה על all-day area - לוגיקה משופרת וגמישה יותר
        const isAllDayClick = allDay === true || 
            (start.getHours() === 0 && start.getMinutes() === 0 && 
             end.getHours() === 0 && end.getMinutes() === 0 &&
             Math.abs(end.getTime() - start.getTime() - 86400000) < 60000); // הפרש של בערך 24 שעות (סטייה של עד דקה)
        
        if (isAllDayClick) {
            logger.debug('onSelectSlot', 'All-day event clicked', { start });
            setPendingAllDayDate(start);
            setIsAllDayModalOpen(true);
            return;
        }
        
        // בדיקה אם זמן ההתחלה הוא בעתיד - רק לאירועים שעתיים
        const now = new Date();
        if (start > now) {
            showWarning('לא ניתן לדווח שעות על זמן עתידי');
            logger.debug('onSelectSlot', 'Blocked future time slot selection', { start, now });
            return;
        }
        
        // עיגול זמנים ל-15 דקות הקרוב
        const roundedStart = roundToNearest15Minutes(start);
        const roundedEnd = roundToNearest15Minutes(end);
        
        // הגדרת זמן מינימלי דינמי: שעה ללחיצה (משבצת אחת) וחצי שעה לגרירה (ריבוי משבצות)
        const isDrag = slots && slots.length > 1;
        const minDurationMinutes = isDrag ? 30 : 60;
        const minDurationMs = minDurationMinutes * 60 * 1000;
        
        const selectedDuration = roundedEnd.getTime() - roundedStart.getTime();
        
        // אם משך הזמן שנבחר קטן מהמינימום שהגדרנו, נרחיב אותו למינימום
        const finalEnd = selectedDuration < minDurationMs 
            ? new Date(roundedStart.getTime() + minDurationMs)
            : roundedEnd;
        
        setIsEditMode(false);
        setEventToEdit(null);
        setPendingSlot({ start: roundedStart, end: finalEnd });
        setIsModalOpen(true);
        setNewEventTitle('');
        setSelectedItem(null);

        // הפרויקטים נטענים אוטומטית דרך useProjects hook
    }, [monday, settings, context]);

    // --- Modal handlers ---

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setPendingSlot(null);
        setNewEventTitle('');
        setSelectedItem(null);
        setIsEditMode(false);
        setEventToEdit(null);
    };

    const handleCloseAllDayModal = () => {
        setIsAllDayModalOpen(false);
        setPendingAllDayDate(null);
        setAllDayEventToEdit(null);
        setIsAllDayEditMode(false);
    };


    const handleCreateEvent = async (eventData) => {
        if (!pendingSlot || !eventData?.title) {
            logger.warn('handleCreateEvent', 'Missing required data for event creation');
            showWarning('חסרים נתונים נדרשים ליצירת האירוע');
            return;
        }

        try {
            await createEvent(eventData, pendingSlot.start, pendingSlot.end);
            showSuccess('האירוע נוצר בהצלחה');
            handleCloseModal();
        } catch (error) {
            showErrorWithDetails(error, { functionName: 'handleCreateEvent' });
            logger.error('MondayCalendar', 'Error in handleCreateEvent', error);
        }
    };

    // עדכון אירוע קיים
    const handleUpdateEvent = async (eventData) => {
        if (!eventToEdit || !pendingSlot || !eventData?.title) {
            logger.warn('handleUpdateEvent', 'Missing required data for event update');
            showWarning('חסרים נתונים נדרשים לעדכון האירוע');
            return;
        }

        try {
            await updateEvent(eventToEdit.id, eventData, pendingSlot.start, pendingSlot.end);
            showSuccess('האירוע עודכן בהצלחה');
            handleCloseModal();
        } catch (error) {
            showErrorWithDetails(error, { functionName: 'handleUpdateEvent' });
            logger.error('MondayCalendar', 'Error in handleUpdateEvent', error);
        }
    };

    // מחיקת אירוע
    const handleDeleteEvent = async () => {
        if (!eventToEdit || !eventToEdit.mondayItemId) {
            logger.error('handleDeleteEvent', 'Missing event ID for deletion');
            showError('שגיאה: לא נמצא מזהה אירוע למחיקה');
             return;
        }

        try {
            await deleteEvent(eventToEdit.id);
            showSuccess('האירוע נמחק בהצלחה');
                handleCloseModal();
        } catch (error) {
            showErrorWithDetails(error, { functionName: 'handleDeleteEvent' });
            logger.error('MondayCalendar', 'Error in handleDeleteEvent', error);
        }
    };

    // עדכון אירוע יומי
    const handleUpdateAllDayEvent = async (newType) => {
        if (!allDayEventToEdit || !allDayEventToEdit.mondayItemId) {
            logger.error('handleUpdateAllDayEvent', 'Missing event ID for update');
            showError('שגיאה: לא נמצא מזהה אירוע לעדכון');
            return;
        }

        try {
            const typeNames = {
                sick: 'מחלה',
                vacation: 'חופשה',
                reserves: 'מילואים'
            };

            const typeName = typeNames[newType];
            if (!typeName) {
                showError('סוג אירוע לא תקין');
                return;
            }

            // שליפת שם המשתמש הנוכחי להוספה לשם האייטם
            const currentUser = await fetchCurrentUser(monday);
            const reporterName = currentUser?.name || 'לא ידוע';
            const itemName = `${typeName} - ${reporterName}`;

            // עדכון שם האייטם וסטטוס בלבד - ללא שינוי תאריך או שעות
            const columnValues = {};
            
            // הוספת סטטוס לפי סוג האירוע
            if (customSettings.eventTypeStatusColumnId) {
                columnValues[customSettings.eventTypeStatusColumnId] = {
                    label: typeName // "מחלה", "חופשה", או "מילואים"
                };
            }
            
            // עדכון שם האייטם בנפרד
            const updateMutation = `mutation {
                change_simple_column_value(
                    item_id: ${allDayEventToEdit.mondayItemId},
                    board_id: ${context.boardId},
                    column_id: "name",
                    value: "${itemName}"
                ) {
                    id
                }
            }`;
            
            await monday.api(updateMutation);
            
            // עדכון עמודות נוספות (סטטוס) אם יש
            if (Object.keys(columnValues).length > 0) {
                const updateColumnsMutation = `mutation {
                    change_multiple_column_values(
                        item_id: ${allDayEventToEdit.mondayItemId},
                        board_id: ${context.boardId},
                        column_values: ${JSON.stringify(JSON.stringify(columnValues))}
                    ) {
                        id
                    }
                }`;
                await monday.api(updateColumnsMutation);
            }
            
            // רענון האירועים מהשרת כדי לעדכן את ה-state
            if (currentViewRange) {
                loadEvents(currentViewRange.start, currentViewRange.end);
            }
            
            showSuccess('האירוע עודכן בהצלחה');
            handleCloseAllDayModal();
        } catch (error) {
            showErrorWithDetails(error, { functionName: 'handleUpdateAllDayEvent' });
            logger.error('MondayCalendar', 'Error in handleUpdateAllDayEvent', error);
        }
    };

    // מחיקת אירוע יומי
    const handleDeleteAllDayEvent = async () => {
        if (!allDayEventToEdit || !allDayEventToEdit.mondayItemId) {
            logger.error('handleDeleteAllDayEvent', 'Missing event ID for deletion');
            showError('שגיאה: לא נמצא מזהה אירוע למחיקה');
            return;
        }

        try {
            await deleteEvent(allDayEventToEdit.id);
            showSuccess('האירוע נמחק בהצלחה');
            handleCloseAllDayModal();
        } catch (error) {
            showErrorWithDetails(error, { functionName: 'handleDeleteAllDayEvent' });
            logger.error('MondayCalendar', 'Error in handleDeleteAllDayEvent', error);
        }
    };

    // --- Multi-select handlers ---
    
    // ניקוי בחירה מרובה
    const handleClearSelection = useCallback(() => {
        setSelectedEventIds(new Set());
        logger.debug('handleClearSelection', 'Selection cleared');
    }, []);

    // שכפול אירועים נבחרים
    const handleDuplicateSelected = useCallback(async () => {
        if (selectedEventIds.size === 0) return;
        
        setIsProcessingBulk(true);
        logger.functionStart('handleDuplicateSelected', { count: selectedEventIds.size });
        
        try {
            const selectedEvents = events.filter(e => selectedEventIds.has(e.id) && !e.allDay);
            let successCount = 0;
            
            for (const event of selectedEvents) {
                try {
                    const eventData = {
                        title: event.title,
                        itemId: event.projectId,
                        taskId: event.taskId,
                        notes: event.notes,
                        stageId: event.stageId,
                        isBillable: event.isBillable !== false,
                        nonBillableType: event.nonBillableType
                    };
                    
                    await createEvent(eventData, event.start, event.end);
                    successCount++;
                } catch (err) {
                    logger.error('handleDuplicateSelected', `Failed to duplicate event ${event.id}`, err);
                }
            }
            
            if (successCount > 0) {
                showSuccess(`${successCount} אירועים שוכפלו בהצלחה`);
            }
            
            // ניקוי הבחירה
            setSelectedEventIds(new Set());
            logger.functionEnd('handleDuplicateSelected', { successCount });
        } catch (error) {
            showErrorWithDetails(error, { functionName: 'handleDuplicateSelected' });
            logger.error('MondayCalendar', 'Error in handleDuplicateSelected', error);
        } finally {
            setIsProcessingBulk(false);
        }
    }, [selectedEventIds, events, createEvent, showSuccess, showErrorWithDetails]);

    // מחיקת אירועים נבחרים
    const handleDeleteSelected = useCallback(async () => {
        if (selectedEventIds.size === 0) return;
        
        setIsProcessingBulk(true);
        logger.functionStart('handleDeleteSelected', { count: selectedEventIds.size });
        
        try {
            const idsToDelete = Array.from(selectedEventIds);
            let successCount = 0;
            
            // מחיקה ב-batches של 5 לביצועים טובים
            for (let i = 0; i < idsToDelete.length; i += 5) {
                const batch = idsToDelete.slice(i, i + 5);
                const results = await Promise.allSettled(
                    batch.map(id => deleteEvent(id))
                );
                
                successCount += results.filter(r => r.status === 'fulfilled').length;
            }
            
            if (successCount > 0) {
                showSuccess(`${successCount} אירועים נמחקו בהצלחה`);
            }
            
            // ניקוי הבחירה
            setSelectedEventIds(new Set());
            logger.functionEnd('handleDeleteSelected', { successCount });
        } catch (error) {
            showErrorWithDetails(error, { functionName: 'handleDeleteSelected' });
            logger.error('MondayCalendar', 'Error in handleDeleteSelected', error);
        } finally {
            setIsProcessingBulk(false);
        }
    }, [selectedEventIds, deleteEvent, showSuccess, showErrorWithDetails]);

    // עדכון שעת התחלה
    const handleStartTimeChange = (option) => {
        if (!pendingSlot || !option) return;
        
        const [hours, minutes] = option.value.split(':').map(Number);
        const newStart = new Date(pendingSlot.start);
        newStart.setHours(hours, minutes, 0, 0);
        
        // עיגול ל-15 דקות
        const roundedStart = roundToNearest15Minutes(newStart);
        
        // וידוא שהמשך מינימלי הוא 60 דקות
        const minDuration = 60 * 60 * 1000; // 60 דקות במילישניות
        let newEnd = new Date(pendingSlot.end);
        
        if (roundedStart >= newEnd || (newEnd.getTime() - roundedStart.getTime()) < minDuration) {
            newEnd = new Date(roundedStart.getTime() + minDuration);
        }
        
        setPendingSlot({ ...pendingSlot, start: roundedStart, end: newEnd });
    };

    // עדכון שעת סיום
    const handleEndTimeChange = (option) => {
        if (!pendingSlot || !option) return;
        
        const [hours, minutes] = option.value.split(':').map(Number);
        const newEnd = new Date(pendingSlot.end);
        newEnd.setHours(hours, minutes, 0, 0);
        
        // עיגול ל-15 דקות
        const roundedEnd = roundToNearest15Minutes(newEnd);
        
        // וידוא שהמשך מינימלי הוא 60 דקות
        const minDuration = 60 * 60 * 1000; // 60 דקות במילישניות
        const duration = roundedEnd.getTime() - pendingSlot.start.getTime();
        const finalEnd = duration < minDuration 
            ? new Date(pendingSlot.start.getTime() + minDuration)
            : roundedEnd;
        
        setPendingSlot({ ...pendingSlot, end: finalEnd });
    };

    // עדכון תאריך
    const handleDateChange = (date) => {
        if (!pendingSlot || !date) return;
        
        const jsDate = date instanceof Date ? date : date.toDate?.() || date;
        
        const newStart = new Date(pendingSlot.start);
        newStart.setFullYear(jsDate.getFullYear(), jsDate.getMonth(), jsDate.getDate());
        
        const newEnd = new Date(pendingSlot.end);
        newEnd.setFullYear(jsDate.getFullYear(), jsDate.getMonth(), jsDate.getDate());
        
        setPendingSlot({ ...pendingSlot, start: newStart, end: newEnd });
    };

    // טיפול בשינוי טווח תאריכים (ניווט בלוח)
    const handleRangeChange = useCallback((range) => {
        logger.debug('handleRangeChange', 'Range changed', range);

        let start, end;

        if (Array.isArray(range)) {
            // במצב Week או Day - מערך של תאריכים
            start = range[0];
            end = range[range.length - 1];
        } else {
            // במצב Month - אובייקט עם start ו-end
            start = range.start;
            end = range.end;
        }

        if (start && end) {
            // שמירת טווח התצוגה הנוכחי לשימוש בלחיצה על all-day
            setCurrentViewRange({ start, end });
            loadEvents(start, end);

            // טעינת חגים לטווח התאריכים
            if (customSettings.showHolidays !== false) {
                loadHolidays(start, end);
            }
        }
    }, [loadEvents, loadHolidays, customSettings.showHolidays]);

    // Custom Toolbar עם גישה ל-props
    const CustomToolbarWithProps = useCallback((props) => {
        return (
            <CalendarToolbar
                {...props}
                onOpenSettings={onOpenSettings}
                monday={monday}
                customSettings={customSettings}
                columnIds={columnIds}
                events={events}
                isOwner={isOwner}
            />
        );
    }, [onOpenSettings, monday, customSettings, columnIds, events, isOwner]);

    // יצירת אירוע יומי
    const handleCreateAllDayEvent = async (allDayData) => {
        logger.functionStart('handleCreateAllDayEvent', { type: allDayData.type, date: allDayData.date });
        
        if (!context?.boardId || !customSettings.dateColumnId) {
            logger.error('handleCreateAllDayEvent', 'Missing board ID or date column ID');
            return;
        }
        
        try {
            const dateStr = format(allDayData.date, 'yyyy-MM-dd');
            
            // שליפת שם המשתמש
            const currentUser = await fetchCurrentUser(monday);
            const reporterName = currentUser?.name || 'לא ידוע';
            const reporterId = context?.user?.id || null;
            
            if (allDayData.type === 'reports') {
                // שליפת מחיר לשעה אם הפיצ'ר פעיל
                let hourlyRate = null;
                if (customSettings.useEmployeeCost && reporterId && customSettings.totalCostColumnId) {
                    logger.debug('handleCreateAllDayEvent', 'Fetching hourly rate', { reporterId });
                    hourlyRate = await fetchEmployeeHourlyRate(reporterId);
                    logger.debug('handleCreateAllDayEvent', 'Hourly rate result', { hourlyRate });
                }

                // יצירת שרשרת אירועים מ-8:00 בבוקר
                let currentStart = new Date(allDayData.date);
                currentStart.setHours(8, 0, 0, 0);
                
                for (const report of allDayData.reports) {
                    // חישוב זמן התחלה וסיום
                    let eventStart = new Date(currentStart);
                    let eventEnd;
                    
                    // אם יש שעות התחלה וסיום, משתמשים בהן
                    if (report.startTime && report.endTime) {
                        const [startHours, startMinutes] = report.startTime.split(':').map(Number);
                        const [endHours, endMinutes] = report.endTime.split(':').map(Number);
                        
                        eventStart.setHours(startHours, startMinutes, 0, 0);
                        eventEnd = new Date(eventStart);
                        eventEnd.setHours(endHours, endMinutes, 0, 0);
                        
                        // אם זמן סיום לפני זמן התחלה, מוסיפים יום
                        if (eventEnd <= eventStart) {
                            eventEnd.setDate(eventEnd.getDate() + 1);
                        }
                    } else {
                        // אחרת, משתמשים במשך הזמן
                        const durationMinutes = parseFloat(report.hours) * 60;
                        eventEnd = new Date(eventStart.getTime() + durationMinutes * 60000);
                    }
                    
                    // בדיקה אם זמן ההתחלה הוא בעתיד - רק לאירועים שעתיים
                    const isSpecialEventType = report.projectName === 'מחלה' || report.projectName === 'חופשה' || report.projectName === 'מילואים';
                    const now = new Date();
                    if (!isSpecialEventType && eventStart > now) {
                        showWarning(`לא ניתן לדווח שעות על זמן עתידי (${report.projectName || 'ללא פרויקט'})`);
                        logger.debug('handleCreateAllDayEvent', 'Skipped future report', { eventStart, now, projectName: report.projectName });
                        continue; // דילוג על דיווח זה והמשך לבא
                    }
                    
                    // בניית column values
                    const columnValues = {};
                    
                    columnValues[customSettings.dateColumnId] = {
                        date: format(eventStart, 'yyyy-MM-dd'),
                        time: format(eventStart, 'HH:mm:ss')
                    };
                    
                    // חישוב משך זמן בדקות
                    if (!isSpecialEventType) {
                        const durationMinutes = (eventEnd.getTime() - eventStart.getTime()) / 60000;
                        const durationHours = durationMinutes / 60;
                        columnValues[customSettings.durationColumnId] = durationHours.toFixed(2);

                        // חישוב עלות עובד
                        if (hourlyRate !== null && customSettings.totalCostColumnId) {
                            columnValues[customSettings.totalCostColumnId] = (hourlyRate * durationHours).toFixed(2);
                        }
                    }
                    
                    // הוספת פרויקט אם קיימת עמודה
                    if (report.projectId && customSettings.projectColumnId) {
                        columnValues[customSettings.projectColumnId] = {
                            item_ids: [parseInt(report.projectId)]
                        };
                    }
                    
                    // הוספת הערות אם יש
                    if (report.notes && customSettings.notesColumnId) {
                        columnValues[customSettings.notesColumnId] = report.notes;
                    }
                    
                    // הוספת משימה אם קיימת עמודה ו-task ID
                    if (report.taskId && customSettings.taskColumnId) {
                        columnValues[customSettings.taskColumnId] = {
                            item_ids: [parseInt(report.taskId)]
                        };
                    }
                    
                    // הוספת מדווח אם קיימת עמודה ומזהה משתמש
                    if (customSettings.reporterColumnId && reporterId) {
                        columnValues[customSettings.reporterColumnId] = {
                            personsAndTeams: [
                                { id: parseInt(reporterId), kind: "person" }
                            ]
                        };
                    }
                    
                    // הוספת סטטוס לפי סוג האירוע או "שעתי"/"לא לחיוב"
                    if (customSettings.eventTypeStatusColumnId) {
                        const isBillable = report.isBillable !== false;
                        columnValues[customSettings.eventTypeStatusColumnId] = {
                            label: report.projectName === 'מחלה' || report.projectName === 'חופשה' || report.projectName === 'מילואים' 
                                ? report.projectName 
                                : (isBillable ? "שעתי" : "לא לחיוב")
                        };

                        // אם זה לא לחיוב, נעדכן גם את עמודת הסטטוס של סוגי "לא לחיוב"
                        if (!isBillable && report.nonBillableType && customSettings.nonBillableStatusColumnId) {
                            columnValues[customSettings.nonBillableStatusColumnId] = {
                                label: report.nonBillableType
                            };
                        }
                    }
                    
                    // הוספת שלב (אם יש משימה ויש הגדרה לעמודה)
                    if (report.stageId && customSettings.stageColumnId) {
                        columnValues[customSettings.stageColumnId] = {
                            label: report.stageId
                        };
                    }
                    
                    const columnValuesJson = JSON.stringify(columnValues);
                    
                    // קביעת שם האייטם לפי מבנה הדיווח
                    const projectName = report.projectName;
                    const isBillableReport = report.isBillable !== false;
                    const { structureMode } = customSettings;
                    
                    let itemName;
                    if (isBillableReport) {
                        // לחיוב - לפי מבנה נבחר:
                        // PROJECT_ONLY: "שם הפרויקט"
                        // PROJECT_WITH_STAGE: "שם הפרויקט - סיווג"
                        // PROJECT_WITH_TASKS: "שם הפרויקט - שם המשימה"
                        if (structureMode === STRUCTURE_MODES.PROJECT_ONLY) {
                            itemName = projectName || 'ללא פרויקט';
                        } else if (structureMode === STRUCTURE_MODES.PROJECT_WITH_STAGE) {
                            const stageLabel = report.stageId || '';
                            itemName = stageLabel ? `${projectName} - ${stageLabel}` : projectName;
                        } else if (structureMode === STRUCTURE_MODES.PROJECT_WITH_TASKS) {
                            const taskName = report.taskName || 'ללא משימה';
                            itemName = projectName ? `${projectName} - ${taskName}` : taskName;
                        } else {
                            // ברירת מחדל
                            itemName = projectName || 'ללא פרויקט';
                        }
                    } else {
                        // לא לחיוב: "סוג לא לחיוב - שם המדווח"
                        const nonBillableLabel = report.nonBillableType || 'לא לחיוב';
                        itemName = `${nonBillableLabel} - ${reporterName}`;
                    }
                    
                    // יצירת אירוע
                    const createdItem = await createBoardItem(
                        monday,
                        context.boardId,
                        itemName,
                        columnValuesJson
                    );
                    
        if (createdItem) {
            // הוספה ל-state דרך ה-hook
            const newEvent = {
                id: createdItem.id,
                title: itemName, // שימוש ב-itemName המלא (פרויקט - משימה)
                start: eventStart,
                end: eventEnd,
                allDay: isSpecialEventType,
                notes: report.notes,
                mondayItemId: createdItem.id
            };
            addEvent(newEvent);
        }
                    
                    currentStart = eventEnd;
                }
                
                logger.functionEnd('handleCreateAllDayEvent', { type: 'reports', count: allDayData.reports.length });
                } else {
                // יצירת אירוע יומי אחד (מחלה/חופשה/מילואים)
                const typeNames = {
                    sick: 'מחלה',
                    vacation: 'חופשה',
                    reserves: 'מילואים'
                };
                
                const eventName = typeNames[allDayData.type];
                const itemName = `${eventName} - ${reporterName}`;
                
                // מספר הימים (ברירת מחדל: 1)
                const durationDays = allDayData.durationDays || 1;
                
                const columnValues = {};
                // לאירועים יומיים - תאריך בלבד ללא שעה
                columnValues[customSettings.dateColumnId] = {
                    date: dateStr
                };
                
                // משך בימים - Duration פולימורפי
                if (customSettings.durationColumnId) {
                    columnValues[customSettings.durationColumnId] = formatDurationForSave(durationDays, eventName);
                }
                
                if (customSettings.reporterColumnId && reporterId) {
                    columnValues[customSettings.reporterColumnId] = {
                        personsAndTeams: [
                            { id: parseInt(reporterId), kind: "person" }
                        ]
                    };
                }
                
                if (customSettings.eventTypeStatusColumnId) {
                    columnValues[customSettings.eventTypeStatusColumnId] = {
                        label: eventName
                    };
                }
                
                const columnValuesJson = JSON.stringify(columnValues);
                
                const createdItem = await createBoardItem(
                    monday,
                    context.boardId,
                    itemName,
                    columnValuesJson
                );
                
                if (createdItem) {
                    const eventDate = new Date(allDayData.date);
                    eventDate.setHours(0, 0, 0, 0);
                    
                    // חישוב תאריך סיום (Exclusive) לפי מספר הימים
                    const endDate = calculateEndDateFromDays(eventDate, durationDays);
                    
                    const newEvent = {
                        id: createdItem.id,
                        title: itemName, // שימוש ב-itemName הכולל את שם המדווח
                        start: eventDate,
                        end: endDate,
                        allDay: true,
                        mondayItemId: createdItem.id,
                        eventType: eventName,
                        durationDays: durationDays
                    };
                    addEvent(newEvent);
                    logger.functionEnd('handleCreateAllDayEvent', { type: allDayData.type, eventId: createdItem.id, durationDays });
                }
            }
            
            setIsAllDayModalOpen(false);
            setPendingAllDayDate(null);
            
        } catch (error) {
            logger.error('handleCreateAllDayEvent', 'Error creating all-day event', error);
        }
    };

    // פונקציה לקביעת עיצוב האירוע
    const eventStyleGetter = (event, start, end, isSelected) => {
        return {
            style: {
                backgroundColor: 'transparent',
                border: 'none',
                display: 'block'
            }
        };
    };

    // העשרת האירועים עם isSelected לשימוש ב-CustomEvent
    // מאחד אירועים רגילים עם חגים (אם מופעל)
    const enrichedEvents = useMemo(() => {
        const regularEvents = events.map(ev => ({
            ...ev,
            isSelected: selectedEventIds.has(ev.id)
        }));

        // הוספת חגים אם ההגדרה מאפשרת
        if (customSettings.showHolidays !== false && holidays.length > 0) {
            return [...regularEvents, ...holidays];
        }

        return regularEvents;
    }, [events, selectedEventIds, holidays, customSettings.showHolidays]);

    // פונקציה לקביעת גובה משבצות זמן (כדי לדרוס חישובי inline של BCR)
    const slotPropGetter = useCallback(() => ({
        style: {
            minHeight: '10px', // 40px לשעה / 4 משבצות של 15 דקות
        }
    }), []);

    // פונקציה לקביעת גובה עמודות יום
    const dayPropGetter = useCallback(() => ({
        style: {
            minHeight: '960px', // 24 שעות * 40px (גובה מינימלי לכל היום)
        }
    }), []);

    // Accessors לקביעה אילו אירועים ניתנים לגרירה ולשינוי גודל
    const draggableAccessor = useCallback((event) => {
        // חגים אינם ניתנים לגרירה
        if (event.isHoliday) return false;
        // כל שאר האירועים ניתנים לגרירה
        return true;
    }, []);

    const resizableAccessor = useCallback((event) => {
        // חגים אינם ניתנים לשינוי גודל
        if (event.isHoliday) return false;
        // כל שאר האירועים ניתנים לשינוי גודל:
        // - אירועים יומיים: הרחבה אופקית על פני מספר ימים
        // - אירועים שעתיים: הרחבה אנכית (שינוי משך)
        return true;
    }, []);

    // עדכון גובה דינמי לאזור all-day לפי מספר השורות בפועל
    // הספרייה react-big-calendar מסדרת את האירועים בשורות לפי חפיפות בתאריכים
    // לכן קוראים את מספר השורות מה-DOM
    useEffect(() => {
        const updateAllDayHeight = () => {
            const rowContent = document.querySelector('.rbc-allday-cell .rbc-row-content');
            if (!rowContent) return;
            
            // ספירת שורות (.rbc-row) בתוך ה-row-content שיש בהן אירועים
            const rows = Array.from(rowContent.querySelectorAll('.rbc-row'));
            const rowCountWithEvents = rows.filter(row => row.querySelector('.rbc-event')).length;
            
            // אם אין שורות עם אירועים, בודקים אם יש אירועים ישירות
            let actualRowCount = rowCountWithEvents;
            if (rowCountWithEvents === 0) {
                const directEvents = rowContent.querySelectorAll('.rbc-event');
                actualRowCount = directEvents.length > 0 ? 1 : 0;
            }
            
            // חישוב גובה לאזור all-day
            // כל שורה: 23px גובה אירוע + 2px הפרדה = 25px
            // + 25px ריק בתחתית ללחיצה
            const rowHeight = 25; // 23px אירוע + 2px margin
            let height;
            if (actualRowCount === 0) {
                height = rowHeight; // שורה ריקה
            } else if (actualRowCount === 1) {
                height = rowHeight + rowHeight; // שורה אחת + ריק
            } else {
                height = actualRowCount * rowHeight + rowHeight; // כל השורות + ריק
            }
            
            const allDayCells = document.querySelectorAll('.rbc-allday-cell');
            allDayCells.forEach(cell => {
                cell.style.height = `${height}px`;
            });
        };
        
        // עדכון אחרי שהספרייה מרנדרת (צריך לחכות לרינדור)
        const timer1 = setTimeout(updateAllDayHeight, 50);
        const timer2 = setTimeout(updateAllDayHeight, 200);
        const timer3 = setTimeout(updateAllDayHeight, 500);
        
        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
        };
    }, [events]);

    return (
        <div className="gcCalendarRoot" style={{ height: '100%', padding: '0 20px', direction: 'rtl', display: 'flex', flexDirection: 'column' }}>
                <DnDCalendar
                    localizer={localizer}
                    events={enrichedEvents}
                    startAccessor="start"
                    endAccessor="end"
                    allDayAccessor="allDay"
                    style={{ height: '100%' }}
                    culture='he'
                    rtl={true}
                    messages={hebrewMessages}
                    formats={formats}
                    defaultView="work_week"
                    views={{
                        month: true,
                        week: true,
                        work_week: WorkWeekView,
                        day: true
                    }}
                    min={minTime}
                    max={maxTime}
                    scrollToTime={CALENDAR_DEFAULTS.SCROLL_TO_TIME}
                    showMultiDayTimes={false}
                    onDragStart={onDragStart}
                    onEventDrop={onEventDrop}
                    onEventResize={onEventResize}
                    onSelectEvent={handleEventClick}
                    resizable
                    draggableAccessor={draggableAccessor}
                    resizableAccessor={resizableAccessor}
                    selectable
                    onSelectSlot={onSelectSlot}
                    onRangeChange={handleRangeChange}
                    step={15}
                    timeslots={4}
                    dayLayoutAlgorithm="overlap"
                    eventPropGetter={eventStyleGetter}
                    slotPropGetter={slotPropGetter}
                    dayPropGetter={dayPropGetter}
                    drilldownView={null}
                    components={{
                        toolbar: CustomToolbarWithProps,
                        event: CustomEvent,
                        header: CustomDayHeader
                    }}
                />

            <EventModal 
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                pendingSlot={pendingSlot}
                monday={monday}
                boardItems={boardItems}
                isLoadingItems={isLoadingProjects}
                newEventTitle={newEventTitle}
                setNewEventTitle={setNewEventTitle}
                selectedItem={selectedItem}
                setSelectedItem={setSelectedItem}
                onStartTimeChange={handleStartTimeChange}
                onEndTimeChange={handleEndTimeChange}
                onDateChange={handleDateChange}
                onCreate={handleCreateEvent}
                eventToEdit={eventToEdit}
                isEditMode={isEditMode}
                isLoadingEventData={isLoadingEventData}
                onUpdate={handleUpdateEvent}
                onDelete={handleDeleteEvent}
            />
            
            <AllDayEventModal 
                monday={monday} 
                isOpen={isAllDayModalOpen}
                onClose={handleCloseAllDayModal}
                pendingDate={pendingAllDayDate}
                onCreate={handleCreateAllDayEvent}
                eventToEdit={allDayEventToEdit}
                isEditMode={isAllDayEditMode}
                onUpdate={handleUpdateAllDayEvent}
                onDelete={handleDeleteAllDayEvent}
            />

            {/* Toast Notifications */}
            <ToastContainer 
                toasts={toasts} 
                onRemove={removeToast}
                onShowErrorDetails={openErrorDetailsModal}
            />
            
            {/* Error Details Modal */}
            <ErrorDetailsModal
                isOpen={!!errorDetailsModal}
                onClose={closeErrorDetailsModal}
                errorDetails={errorDetailsModal}
            />

            {/* Settings Validation Dialog */}
            <SettingsValidationDialog
                isOpen={showValidationDialog}
                onClose={() => setShowValidationDialog(false)}
                onOpenSettings={onOpenSettings}
                validationResult={settingsValidation}
            />

            {/* Selection Action Bar - תפריט פעולות לאירועים נבחרים */}
            <SelectionActionBar
                selectedCount={selectedEventIds.size}
                onDuplicate={handleDuplicateSelected}
                onDelete={handleDeleteSelected}
                onClear={handleClearSelection}
                isProcessing={isProcessingBulk}
            />
        </div>
    );
}
