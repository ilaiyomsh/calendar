import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Calendar } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';

// ייבוא קבצי עיצוב
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import './styles/calendar/index.css';

// קבועים והגדרות
import { localizer, hebrewMessages, formats, roundToNearest15Minutes, WorkWeekView, ThreeDayView, CALENDAR_DEFAULTS } from './constants/calendarConfig';
import { useSwipeable } from 'react-swipeable';

// פונקציות עזר
import { getColumnIds } from './utils/mondayColumns';
import { validateSettings } from './utils/settingsValidator';
import { getEffectiveBoardId } from './utils/boardIdResolver';
import { isEventLocked } from './utils/editLockUtils';
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
import ApprovalActionBar from './components/ApprovalActionBar';

// Context
import { useSettings } from './contexts/SettingsContext';
import { useMobile } from './contexts/MobileContext';

// Event Type Mapping
import { createLegacyMapping } from './utils/eventTypeMapping';
import { parseStatusColumnLabels } from './utils/eventTypeValidation';
import { migrateApprovalMapping } from './utils/approvalMapping';

// Hooks
import { useMondayEvents } from './hooks/useMondayEvents';
import { useToast } from './hooks/useToast';
import { useProjects } from './hooks/useProjects';
import { useBoardOwner } from './hooks/useBoardOwner';
import { useIsraeliHolidays } from './hooks/useIsraeliHolidays';
import { useEventModals } from './hooks/useEventModals';
import { useMultiSelect } from './hooks/useMultiSelect';
import { useCalendarHandlers } from './hooks/useCalendarHandlers';
import { useAllDayEvents } from './hooks/useAllDayEvents';
import { useEventDataLoader } from './hooks/useEventDataLoader';
import { useCalendarFilter } from './hooks/useCalendarFilter';
import { useFilterOptions } from './hooks/useFilterOptions';
import { useApproval } from './hooks/useApproval';
import { useEventSelection } from './hooks/useEventSelection';

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
    const { customSettings, updateSettings } = useSettings();
    const isMobile = useMobile();

    // תצוגות לוח שנה - מותאמות למובייל/דסקטופ
    const calendarViews = useMemo(() =>
        isMobile
            ? { three_day: ThreeDayView, day: true, month: true }
            : { month: true, week: true, work_week: WorkWeekView, day: true },
        [isMobile]
    );
    const defaultView = isMobile ? 'three_day' : 'work_week';
    
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

    // State לניווט בלוח (נדרש לתמיכה בסווייפ)
    const [calendarDate, setCalendarDate] = useState(new Date());
    const [calendarView, setCalendarView] = useState(defaultView);

    // עדכון תצוגת ברירת מחדל כשמשתנה isMobile
    useEffect(() => {
        setCalendarView(defaultView);
    }, [defaultView]);

    // Swipe navigation למובייל
    const swipeHandlers = useSwipeable({
        onSwipedLeft: () => {
            if (isMobile) {
                // RTL: swipe left = navigate next
                const next = calendarView === 'three_day'
                    ? new Date(calendarDate.getTime() + 3 * 86400000)
                    : calendarView === 'day'
                        ? new Date(calendarDate.getTime() + 86400000)
                        : new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
                setCalendarDate(next);
            }
        },
        onSwipedRight: () => {
            if (isMobile) {
                // RTL: swipe right = navigate previous
                const prev = calendarView === 'three_day'
                    ? new Date(calendarDate.getTime() - 3 * 86400000)
                    : calendarView === 'day'
                        ? new Date(calendarDate.getTime() - 86400000)
                        : new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
                setCalendarDate(prev);
            }
        },
        delta: 80, // סף גבוה יותר למניעת קונפליקט עם לחיצות וגרירת אירועים
        preventScrollOnSwipe: false,
        trackTouch: true,
        trackMouse: false,
        swipeDuration: 500, // מגביל רק לתנועות סוויפ מהירות
    });

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

    // State - Monday context (חייב להיות לפני hooks שמשתמשים ב-context)
    const [context, setContext] = useState(null);
    const [settings, setSettings] = useState(null);
    const [columnIds, setColumnIds] = useState(null); // מזהי העמודות

    // Hook לניהול מצב המודלים
    const modals = useEventModals();

    // Hook לניהול בחירה מרובה של אירועים
    const multiSelect = useMultiSelect();

    // Hook לבחירה מרובה לאישור מנהל
    const approvalSelection = useEventSelection();

    // Hook לאישור מנהל
    const approval = useApproval({ monday, context });

    // State לעיבוד אישור מנהל
    const [isProcessingApproval, setIsProcessingApproval] = useState(false);

    // Hook לניהול פרויקטים
    const { projects, loading: isLoadingProjects } = useProjects();

    // Hook לבדיקת owner status
    const { isOwner, loading: ownerLoading } = useBoardOwner(monday);

    // Hook לניהול חגים ישראליים
    const { holidays, loadHolidays } = useIsraeliHolidays();

    // חישוב לוח דיווחים אפקטיבי (חייב להיות לפני hooks שמשתמשים ב-effectiveBoardId)
    const effectiveBoardId = useMemo(() =>
        getEffectiveBoardId(customSettings, context),
        [customSettings, context]
    );

    // Hook לניהול פילטר לוח השנה
    const calendarFilter = useCalendarFilter(customSettings, context);

    // Hook לאפשרויות פילטר (מדווחים ופרויקטים לפילטר)
    const {
        reporters,
        loadingReporters,
        filterProjects,
        loadingFilterProjects
    } = useFilterOptions(monday, effectiveBoardId, customSettings);

    // State - אימות הגדרות
    const [settingsValidation, setSettingsValidation] = useState(null);
    const [hasValidatedSettings, setHasValidatedSettings] = useState(false);
    const [showValidationDialog, setShowValidationDialog] = useState(false);

    // State - הצגת אירועים מתוכננים (Temporary)
    const [showTemporaryEvents, setShowTemporaryEvents] = useState(
        customSettings.showTemporaryEvents !== false
    );

    // המרת פרויקטים לפורמט boardItems
    const boardItems = projects.map(project => ({
        value: project.id,
        label: project.name
    }));

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
        if (effectiveBoardId && customSettings?.dateColumnId && calendarFilter.isInitialized) {
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
            loadEvents(startOfWeek, endOfWeek, calendarFilter.filterRules);
        }
    }, [effectiveBoardId, customSettings, calendarFilter.isInitialized]);

    // רענון אירועים כשהפילטר משתנה
    useEffect(() => {
        if (currentViewRange && calendarFilter.isInitialized) {
            loadEvents(currentViewRange.start, currentViewRange.end, calendarFilter.filterRules);
        }
    }, [calendarFilter.filterRules]);

    // אימות הגדרות בעת עליית האפליקציה
    useEffect(() => {
        const runValidation = async () => {
            // מחכים שיהיה effectiveBoardId ו-customSettings לפני שמבצעים אימות
            if (!effectiveBoardId || !customSettings || hasValidatedSettings) {
                return;
            }

            logger.info('MondayCalendar', 'Running settings validation...');

            try {
                const validationResult = await validateSettings(monday, customSettings, effectiveBoardId);
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
    }, [effectiveBoardId, customSettings, monday, hasValidatedSettings]);

    // מיגרציה אוטומטית של מיפוי סוגי דיווח
    useEffect(() => {
        const migrateEventTypeMapping = async () => {
            if (customSettings.eventTypeMapping || !customSettings.eventTypeStatusColumnId || !effectiveBoardId) return;

            try {
                logger.info('MondayCalendar', 'Attempting auto-migration of event type mapping...');

                // שליפת לייבלים מהעמודה
                const query = `query {
                    boards(ids: [${effectiveBoardId}]) {
                        columns(ids: ["${customSettings.eventTypeStatusColumnId}"]) {
                            settings_str
                        }
                    }
                }`;
                const res = await monday.api(query);
                const settingsStr = res?.data?.boards?.[0]?.columns?.[0]?.settings_str;

                if (!settingsStr) {
                    logger.warn('MondayCalendar', 'Could not fetch column settings for migration');
                    return;
                }

                const labels = parseStatusColumnLabels(settingsStr);
                if (labels.length === 0) return;

                const result = createLegacyMapping(labels);
                if (result) {
                    await updateSettings({
                        eventTypeMapping: result.mapping,
                        eventTypeLabelMeta: result.labelMeta
                    });
                    logger.info('MondayCalendar', 'Auto-migration completed successfully', result);
                } else {
                    logger.warn('MondayCalendar', 'Auto-migration could not create valid mapping from existing labels');
                }
            } catch (error) {
                logger.error('MondayCalendar', 'Error during event type mapping migration', error);
            }
        };

        migrateEventTypeMapping();
    }, [customSettings.eventTypeMapping, customSettings.eventTypeStatusColumnId, effectiveBoardId]);

    // מיגרציה אוטומטית של מיפוי אישור (3 קטגוריות → 4)
    useEffect(() => {
        if (!customSettings.approvalStatusMapping || !customSettings.enableApproval) return;

        const migratedMapping = migrateApprovalMapping(customSettings.approvalStatusMapping);
        if (migratedMapping) {
            logger.info('MondayCalendar', 'Migrating approval mapping from 3 to 4 categories');
            updateSettings({ approvalStatusMapping: migratedMapping });
        }
    }, [customSettings.approvalStatusMapping, customSettings.enableApproval]);

    // --- Helper functions ---

    // --- Event handlers ---

    // Hook לניהול handlers של גרירה ושינוי גודל
    const calendarHandlers = useCalendarHandlers({
        updateEventPosition,
        showSuccess,
        showError,
        showWarning,
        showErrorWithDetails
    });

    // Hook לטעינת נתוני אירוע לעריכה
    const { loadEventDataForEdit } = useEventDataLoader({
        monday,
        context,
        settings,
        modals
    });

    // Hook לניהול אירועים יומיים
    const allDayEvents = useAllDayEvents({
        monday,
        context,
        modals,
        showSuccess,
        showError,
        showWarning,
        showErrorWithDetails,
        deleteEvent,
        loadEvents,
        addEvent,
        fetchEmployeeHourlyRate,
        currentViewRange
    });

    // לחיצה על אירוע קיים - פתיחת Modal לעריכה, המרה, או בחירה מרובה
    const handleEventClick = useCallback(async (event) => {
        logger.functionStart('handleEventClick', { eventId: event.id, title: event.title, isCtrlPressed: multiSelect.isCtrlPressed, isTemporary: event.isTemporary });

        // חגים הם read-only - לא ניתן ללחוץ עליהם
        if (event.isHoliday) {
            logger.debug('handleEventClick', 'Holiday clicked - ignored', { title: event.title });
            return;
        }

        // מצב בחירה לאישור מנהל - בחירת אירועים ממתינים
        if (approvalSelection.isSelectionMode && event.isPending) {
            approvalSelection.toggleSelection(event.id);
            return;
        }

        // בחירה מרובה עם CTRL/CMD - רק לאירועים שעתיים (לא יומיים)
        const isAllDayEvent = event.allDay;

        if (multiSelect.isCtrlPressed && !isAllDayEvent) {
            multiSelect.toggleSelection(event.id);
            return; // לא פותחים modal בבחירה מרובה
        }

        // לחיצה רגילה - ניקוי בחירה קודמת
        if (multiSelect.hasSelection) {
            multiSelect.clearSelection();
        }

        if (isAllDayEvent) {
            // פתיחת AllDayEventModal במצב עריכה
            modals.openAllDayModalForEdit(event);
            return;
        }

        // אירוע מתוכנן (Temporary) - פתיחת EventModal במצב המרה
        if (event.isTemporary) {
            logger.debug('handleEventClick', 'Opening convert mode for temporary event', { eventId: event.id });
            modals.openEventModalForConvert(event);
            return;
        }

        // אירוע רגיל - פתיחת EventModal
        modals.openEventModalForEdit(event);

        // טעינת נתוני האירוע לעריכה ברקע
        loadEventDataForEdit(event);
    }, [loadEventDataForEdit, multiSelect, modals, approvalSelection]);

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
            modals.openAllDayModal(start);
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
        
        modals.openEventModal({ start: roundedStart, end: finalEnd });

        // הפרויקטים נטענים אוטומטית דרך useProjects hook
    }, [monday, settings, context, modals, showWarning]);

    // --- Modal handlers ---

    const handleCreateEvent = async (eventData) => {
        const pendingSlot = modals.eventModal.pendingSlot;
        if (!pendingSlot || !eventData?.title) {
            logger.warn('handleCreateEvent', 'Missing required data for event creation');
            showWarning('חסרים נתונים נדרשים ליצירת האירוע');
            return;
        }

        try {
            await createEvent(eventData, pendingSlot.start, pendingSlot.end);
            showSuccess('האירוע נוצר בהצלחה');
            modals.closeEventModal();
        } catch (error) {
            showErrorWithDetails(error, { functionName: 'handleCreateEvent' });
            logger.error('MondayCalendar', 'Error in handleCreateEvent', error);
        }
    };

    // עדכון אירוע קיים
    const handleUpdateEvent = async (eventData) => {
        const eventToEdit = modals.eventModal.eventToEdit;
        const pendingSlot = modals.eventModal.pendingSlot;
        if (!eventToEdit || !pendingSlot || !eventData?.title) {
            logger.warn('handleUpdateEvent', 'Missing required data for event update');
            showWarning('חסרים נתונים נדרשים לעדכון האירוע');
            return;
        }

        try {
            await updateEvent(eventToEdit.id, eventData, pendingSlot.start, pendingSlot.end);
            showSuccess('האירוע עודכן בהצלחה');
            modals.closeEventModal();
        } catch (error) {
            showErrorWithDetails(error, { functionName: 'handleUpdateEvent' });
            logger.error('MondayCalendar', 'Error in handleUpdateEvent', error);
        }
    };

    // מחיקת אירוע
    const handleDeleteEvent = async () => {
        const eventToEdit = modals.eventModal.eventToEdit;
        if (!eventToEdit || !eventToEdit.mondayItemId) {
            logger.error('handleDeleteEvent', 'Missing event ID for deletion');
            showError('שגיאה: לא נמצא מזהה אירוע למחיקה');
            return;
        }

        try {
            await deleteEvent(eventToEdit.id);
            showSuccess('האירוע נמחק בהצלחה');
            modals.closeEventModal();
        } catch (error) {
            showErrorWithDetails(error, { functionName: 'handleDeleteEvent' });
            logger.error('MondayCalendar', 'Error in handleDeleteEvent', error);
        }
    };

    // המרת אירוע מתוכנן (Temporary) לאירוע רגיל
    const handleConvertEvent = async (eventData) => {
        const eventToEdit = modals.eventModal.eventToEdit;
        const pendingSlot = modals.eventModal.pendingSlot;
        if (!eventToEdit || !pendingSlot || !eventData?.title) {
            logger.warn('handleConvertEvent', 'Missing required data for event conversion');
            showWarning('חסרים נתונים נדרשים להמרת האירוע');
            return;
        }

        try {
            logger.functionStart('handleConvertEvent', { eventId: eventToEdit.id, eventData });

            // עדכון האירוע הקיים - הסטטוס יעודכן בהתאם לבחירת המשתמש בטופס
            // (שעתי/לא לחיוב עם סיווג משני, או חופשה/מחלה/מילואים לאירועים יומיים)
            await updateEvent(eventToEdit.id, {
                ...eventData,
                isBillable: eventData.isBillable !== false
            }, pendingSlot.start, pendingSlot.end);

            showSuccess('האירוע הומר לדיווח שעות בהצלחה');
            modals.closeEventModal();
            logger.functionEnd('handleConvertEvent', { eventId: eventToEdit.id });
        } catch (error) {
            showErrorWithDetails(error, { functionName: 'handleConvertEvent' });
            logger.error('MondayCalendar', 'Error in handleConvertEvent', error);
        }
    };

    // --- Multi-select handlers ---
    
    // ניקוי בחירה מרובה
    // שכפול אירועים נבחרים
    const handleDuplicateSelected = useCallback(async () => {
        if (!multiSelect.hasSelection) return;
        
        multiSelect.setIsProcessingBulk(true);
        logger.functionStart('handleDuplicateSelected', { count: multiSelect.selectedCount });
        
        try {
            const selectedEvents = events.filter(e => multiSelect.isSelected(e.id) && !e.allDay);
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
            multiSelect.clearSelection();
            logger.functionEnd('handleDuplicateSelected', { successCount });
        } catch (error) {
            showErrorWithDetails(error, { functionName: 'handleDuplicateSelected' });
            logger.error('MondayCalendar', 'Error in handleDuplicateSelected', error);
        } finally {
            multiSelect.setIsProcessingBulk(false);
        }
    }, [multiSelect, events, createEvent, showSuccess, showErrorWithDetails]);

    // מחיקת אירועים נבחרים
    const handleDeleteSelected = useCallback(async () => {
        if (!multiSelect.hasSelection) return;
        
        multiSelect.setIsProcessingBulk(true);
        logger.functionStart('handleDeleteSelected', { count: multiSelect.selectedCount });
        
        try {
            const idsToDelete = multiSelect.getSelectedArray();
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
            multiSelect.clearSelection();
            logger.functionEnd('handleDeleteSelected', { successCount });
        } catch (error) {
            showErrorWithDetails(error, { functionName: 'handleDeleteSelected' });
            logger.error('MondayCalendar', 'Error in handleDeleteSelected', error);
        } finally {
            multiSelect.setIsProcessingBulk(false);
        }
    }, [multiSelect, deleteEvent, showSuccess, showErrorWithDetails]);

    // --- Approval handlers ---

    // אישור אירועים נבחרים
    // @param {string} billableType - 'billable' | 'unbillable'
    const handleApproveSelected = useCallback(async (billableType = 'billable') => {
        if (!approvalSelection.selectedCount) return;

        setIsProcessingApproval(true);
        try {
            const selectedEvents = events.filter(e => approvalSelection.isSelected(e.id));
            const result = await approval.approveMultiple(selectedEvents, billableType);

            if (result.succeeded > 0) {
                showSuccess(`${result.succeeded} דיווחים אושרו בהצלחה`);
                if (currentViewRange) {
                    loadEvents(currentViewRange.start, currentViewRange.end, calendarFilter.filterRules);
                }
            }
            if (result.failed > 0) {
                showError(`${result.failed} דיווחים נכשלו באישור`);
            }

            approvalSelection.clearSelection();
        } catch (error) {
            showErrorWithDetails(error, { functionName: 'handleApproveSelected' });
        } finally {
            setIsProcessingApproval(false);
        }
    }, [approvalSelection, events, approval, showSuccess, showError, showErrorWithDetails, currentViewRange, loadEvents, calendarFilter.filterRules]);

    // אישור כל הממתינים בתצוגה הנוכחית
    // @param {string} billableType - 'billable' | 'unbillable'
    const handleApproveAllInWeek = useCallback(async (billableType = 'billable') => {
        setIsProcessingApproval(true);
        try {
            const result = await approval.approveAllPending(events, billableType);

            if (result.succeeded > 0) {
                showSuccess(`${result.succeeded} דיווחים אושרו בהצלחה`);
                if (currentViewRange) {
                    loadEvents(currentViewRange.start, currentViewRange.end, calendarFilter.filterRules);
                }
            } else {
                showWarning('אין דיווחים ממתינים לאישור');
            }
            if (result.failed > 0) {
                showError(`${result.failed} דיווחים נכשלו באישור`);
            }

            approvalSelection.clearSelection();
        } catch (error) {
            showErrorWithDetails(error, { functionName: 'handleApproveAllInWeek' });
        } finally {
            setIsProcessingApproval(false);
        }
    }, [approval, events, showSuccess, showWarning, showError, showErrorWithDetails, currentViewRange, loadEvents, calendarFilter.filterRules, approvalSelection]);

    // אישור אירוע בודד מתוך מודל
    // @param {Object} event - האירוע לאישור
    // @param {string} billableType - 'billable' | 'unbillable'
    const handleApproveEvent = useCallback(async (event, billableType = 'billable') => {
        try {
            if (billableType === 'unbillable') {
                await approval.approveUnbillable(event);
            } else {
                await approval.approveBillable(event);
            }
            showSuccess('הדיווח אושר בהצלחה');
            if (currentViewRange) {
                loadEvents(currentViewRange.start, currentViewRange.end, calendarFilter.filterRules);
            }
        } catch (error) {
            showErrorWithDetails(error, { functionName: 'handleApproveEvent' });
        }
    }, [approval, showSuccess, showErrorWithDetails, currentViewRange, loadEvents, calendarFilter.filterRules]);

    // דחיית אירוע בודד מתוך מודל
    const handleRejectEvent = useCallback(async (event) => {
        try {
            await approval.rejectEvent(event);
            showSuccess('הדיווח נדחה');
            if (currentViewRange) {
                loadEvents(currentViewRange.start, currentViewRange.end, calendarFilter.filterRules);
            }
        } catch (error) {
            showErrorWithDetails(error, { functionName: 'handleRejectEvent' });
        }
    }, [approval, showSuccess, showErrorWithDetails, currentViewRange, loadEvents, calendarFilter.filterRules]);

    // עדכון שעת התחלה
    const handleStartTimeChange = (option) => {
        const pendingSlot = modals.eventModal.pendingSlot;
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
        
        modals.setPendingSlot({ ...pendingSlot, start: roundedStart, end: newEnd });
    };

    // עדכון שעת סיום
    const handleEndTimeChange = (option) => {
        const pendingSlot = modals.eventModal.pendingSlot;
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
        
        modals.setPendingSlot({ ...pendingSlot, end: finalEnd });
    };

    // עדכון תאריך
    const handleDateChange = (date) => {
        const pendingSlot = modals.eventModal.pendingSlot;
        if (!pendingSlot || !date) return;
        
        const jsDate = date instanceof Date ? date : date.toDate?.() || date;
        
        const newStart = new Date(pendingSlot.start);
        newStart.setFullYear(jsDate.getFullYear(), jsDate.getMonth(), jsDate.getDate());
        
        const newEnd = new Date(pendingSlot.end);
        newEnd.setFullYear(jsDate.getFullYear(), jsDate.getMonth(), jsDate.getDate());
        
        modals.setPendingSlot({ ...pendingSlot, start: newStart, end: newEnd });
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
            loadEvents(start, end, calendarFilter.filterRules);

            // טעינת חגים לטווח התאריכים
            if (customSettings.showHolidays !== false) {
                loadHolidays(start, end);
            }
        }
    }, [loadEvents, loadHolidays, customSettings.showHolidays, calendarFilter.filterRules]);

    // פיצ'ר אירועים זמניים זמין כאשר עמודת סוג דיווח מוגדרת (לייבל "זמני" הוא חובה)
    const hasTemporaryEventsFeature = !!customSettings.eventTypeStatusColumnId;

    // Toggle handler לאירועים מתוכננים
    const handleToggleTemporaryEvents = useCallback(() => {
        setShowTemporaryEvents(prev => !prev);
    }, []);

    // Ref לשמירת נתוני הפילטר - מאפשר גישה לערכים עדכניים בלי לשנות את ה-callback reference
    const filterDataRef = useRef({});
    filterDataRef.current = {
        reporters,
        filterProjects,
        calendarFilter,
        loadingReporters,
        loadingFilterProjects,
        onOpenSettings,
        monday,
        customSettings,
        columnIds,
        events,
        isOwner,
        showTemporaryEvents,
        handleToggleTemporaryEvents,
        hasTemporaryEventsFeature,
        approval,
        approvalSelection,
        handleApproveAllInWeek
    };

    // Custom Toolbar עם גישה ל-props
    // שימוש ב-ref כדי לשמור על reference יציב ולמנוע re-mount של FilterBar
    const CustomToolbarWithProps = useCallback((props) => {
        const data = filterDataRef.current;

        // הכנת props לפילטר
        const filterProps = {
            reporters: data.reporters,
            projects: data.filterProjects,
            selectedReporterIds: data.calendarFilter.selectedReporterIds,
            selectedProjectIds: data.calendarFilter.selectedProjectIds,
            onReporterChange: data.calendarFilter.setSelectedReporterIds,
            onProjectChange: data.calendarFilter.setSelectedProjectIds,
            onClear: data.calendarFilter.clearFilters,
            hasActiveFilter: data.calendarFilter.hasActiveFilter,
            isLoadingReporters: data.loadingReporters,
            isLoadingProjects: data.loadingFilterProjects
        };

        return (
            <CalendarToolbar
                {...props}
                onOpenSettings={data.onOpenSettings}
                monday={data.monday}
                customSettings={data.customSettings}
                columnIds={data.columnIds}
                events={data.events}
                isOwner={data.isOwner}
                filterProps={filterProps}
                showTemporaryEvents={data.showTemporaryEvents}
                onToggleTemporaryEvents={data.handleToggleTemporaryEvents}
                hasTemporaryEventsFeature={data.hasTemporaryEventsFeature}
                isManager={data.approval.isManager}
                isApprovalEnabled={data.approval.isApprovalEnabled}
                isSelectionMode={data.approvalSelection.isSelectionMode}
                onToggleSelectionMode={data.approvalSelection.toggleSelectionMode}
                onApproveAllInWeek={data.handleApproveAllInWeek}
            />
        );
    }, []); // ללא dependencies - reference יציב, מונע re-mount של FilterBar

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
    // מסנן אירועים מתוכננים אם הטוגל כבוי
    const enrichedEvents = useMemo(() => {
        // חישוב נעילה - מנהלים פטורים
        const lockMode = customSettings.editLockMode || 'none';
        const managerBypass = approval.isManager;

        let regularEvents = events.map(ev => {
            const lockResult = (!managerBypass && lockMode !== 'none')
                ? isEventLocked(ev, lockMode)
                : { locked: false, reason: '' };
            return {
                ...ev,
                isSelected: multiSelect.isSelected(ev.id),
                isInApprovalSelection: approvalSelection.isSelectionMode && ev.isPending,
                isApprovalSelected: approvalSelection.isSelected(ev.id),
                isLocked: lockResult.locked,
                lockReason: lockResult.reason
            };
        });

        // סינון אירועים מתוכננים אם הטוגל כבוי
        if (!showTemporaryEvents) {
            regularEvents = regularEvents.filter(ev => !ev.isTemporary);
        }

        // הוספת חגים אם ההגדרה מאפשרת
        if (customSettings.showHolidays !== false && holidays.length > 0) {
            return [...regularEvents, ...holidays];
        }

        return regularEvents;
    }, [events, multiSelect, approvalSelection, holidays, customSettings.showHolidays, customSettings.editLockMode, approval.isManager, showTemporaryEvents]);

    // פונקציה לקביעת גובה משבצות זמן (כדי לדרוס חישובי inline של BCR)
    const slotPropGetter = useCallback(() => ({
        style: {
            minHeight: '10px', // 40px לשעה / 4 משבצות של 15 דקות
        }
    }), []);

    // פונקציה לקביעת גובה עמודות יום
    const dayPropGetter = useCallback(() => ({
        style: {
            minHeight: isMobile ? '720px' : '960px',
        }
    }), [isMobile]);

    // Accessors לקביעה אילו אירועים ניתנים לגרירה ולשינוי גודל
    const draggableAccessor = useCallback((event) => {
        if (event.isHoliday) return false;
        if (event.isLocked) return false;
        return true;
    }, []);

    const resizableAccessor = useCallback((event) => {
        if (event.isHoliday) return false;
        if (event.isLocked) return false;
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
        <div className="gcCalendarRoot" style={{ height: '100%', padding: isMobile ? '0' : '0 20px', direction: 'rtl', display: 'flex', flexDirection: 'column' }} {...(isMobile ? swipeHandlers : {})}>
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
                    date={calendarDate}
                    onNavigate={setCalendarDate}
                    view={calendarView}
                    onView={setCalendarView}
                    defaultView={defaultView}
                    views={calendarViews}
                    touchDragDelay={isMobile ? 250 : 0}
                    min={minTime}
                    max={maxTime}
                    scrollToTime={CALENDAR_DEFAULTS.SCROLL_TO_TIME}
                    showMultiDayTimes={false}
                    onDragStart={calendarHandlers.onDragStart}
                    onEventDrop={calendarHandlers.onEventDrop}
                    onEventResize={calendarHandlers.onEventResize}
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
                    drilldownView={isMobile ? 'day' : null}
                    components={{
                        toolbar: CustomToolbarWithProps,
                        event: CustomEvent,
                        header: CustomDayHeader
                    }}
                />

            <EventModal
                isOpen={modals.eventModal.isOpen}
                onClose={modals.closeEventModal}
                pendingSlot={modals.eventModal.pendingSlot}
                monday={monday}
                context={context}
                boardItems={boardItems}
                isLoadingItems={isLoadingProjects}
                newEventTitle={modals.eventModal.newEventTitle}
                setNewEventTitle={modals.setNewEventTitle}
                selectedItem={modals.eventModal.selectedItem}
                setSelectedItem={modals.setSelectedItem}
                onStartTimeChange={handleStartTimeChange}
                onEndTimeChange={handleEndTimeChange}
                onDateChange={handleDateChange}
                onCreate={handleCreateEvent}
                eventToEdit={modals.eventModal.eventToEdit}
                isEditMode={modals.eventModal.isEditMode}
                isConvertMode={modals.eventModal.isConvertMode}
                isLoadingEventData={modals.eventModal.isLoading}
                onUpdate={handleUpdateEvent}
                onDelete={handleDeleteEvent}
                onConvert={handleConvertEvent}
                isManager={approval.isManager}
                isApprovalEnabled={approval.isApprovalEnabled}
                onApprove={handleApproveEvent}
                onReject={handleRejectEvent}
                isLocked={modals.eventModal.eventToEdit?.isLocked || false}
                lockReason={modals.eventModal.eventToEdit?.lockReason || ''}
            />

            <AllDayEventModal
                monday={monday}
                context={context}
                isOpen={modals.allDayModal.isOpen}
                onClose={modals.closeAllDayModal}
                pendingDate={modals.allDayModal.date}
                onCreate={allDayEvents.handleCreateAllDayEvent}
                eventToEdit={modals.allDayModal.eventToEdit}
                isEditMode={modals.allDayModal.isEditMode}
                onUpdate={allDayEvents.handleUpdateAllDayEvent}
                onDelete={allDayEvents.handleDeleteAllDayEvent}
                isManager={approval.isManager}
                isApprovalEnabled={approval.isApprovalEnabled}
                onApprove={handleApproveEvent}
                onReject={handleRejectEvent}
                isLocked={modals.allDayModal.eventToEdit?.isLocked || false}
                lockReason={modals.allDayModal.eventToEdit?.lockReason || ''}
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
                selectedCount={multiSelect.selectedCount}
                onDuplicate={handleDuplicateSelected}
                onDelete={handleDeleteSelected}
                onClear={multiSelect.clearSelection}
                isProcessing={multiSelect.isProcessingBulk}
            />

            {/* Approval Action Bar - סרגל אישור מנהל לאירועים נבחרים */}
            <ApprovalActionBar
                selectedCount={approvalSelection.selectedCount}
                onApproveBillable={() => handleApproveSelected('billable')}
                onApproveUnbillable={() => handleApproveSelected('unbillable')}
                onClear={approvalSelection.clearSelection}
                isProcessing={isProcessingApproval}
            />
        </div>
    );
}
