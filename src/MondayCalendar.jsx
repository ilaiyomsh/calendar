import React, { useState, useCallback, useEffect } from 'react';
import { format, parse } from 'date-fns';
import { Calendar, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';

// ייבוא קבצי עיצוב
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import './calendar-custom.css';

// קבועים והגדרות
import { localizer, hebrewMessages, formats } from './constants/calendarConfig';

// פונקציות עזר
import { fetchColumnSettings, fetchAllBoardItems as fetchBoardItems, createBoardItem, fetchEventsFromBoard, deleteItem, fetchItemById, fetchCustomerById } from './utils/mondayApi';
import { getColumnIds, mapItemToEvent, buildColumnValues, buildFetchEventsQuery } from './utils/mondayColumns';
import logger from './utils/logger';

// רכיבים
import EventModal from './components/EventModal/EventModal';
import AllDayEventModal from './components/AllDayEventModal/AllDayEventModal';
import CalendarToolbar from './components/CalendarToolbar';
import CustomEvent from './components/CustomEvent';
import { ToastContainer } from './components/Toast';

// Context
import { useSettings } from './contexts/SettingsContext';

// Hooks
import { useMondayEvents } from './hooks/useMondayEvents';
import { useToast } from './hooks/useToast';
import { useCustomers } from './hooks/useCustomers';
import { useBoardOwner } from './hooks/useBoardOwner';

// עטיפת הלוח ברכיב Drag and Drop
const DnDCalendar = withDragAndDrop(Calendar);

export default function MondayCalendar({ monday, onOpenSettings }) {
    // גישה להגדרות מותאמות
    const { customSettings } = useSettings();
    
    // State - לוח שנה - שעות עבודה גמישות
    const minTime = customSettings.workDayStart 
        ? parse(customSettings.workDayStart, 'HH:mm', new Date(1970, 1, 1))
        : new Date(1970, 1, 1, 6, 0, 0);  // ברירת מחדל: 06:00
    
    const maxTime = customSettings.workDayEnd 
        ? parse(customSettings.workDayEnd, 'HH:mm', new Date(1970, 1, 1))
        : new Date(1970, 1, 1, 20, 0, 0); // ברירת מחדל: 20:00

    // State - Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [pendingSlot, setPendingSlot] = useState(null);
    const [newEventTitle, setNewEventTitle] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    
    // State - Edit mode
    const [eventToEdit, setEventToEdit] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);
    
    // State - All-day events
    const [isAllDayModalOpen, setIsAllDayModalOpen] = useState(false);
    const [pendingAllDayDate, setPendingAllDayDate] = useState(null);
    
    // Hook לניהול לקוחות
    const { customers, loading: isLoadingItems } = useCustomers();
    
    // Hook לבדיקת owner status
    const { isOwner, loading: ownerLoading } = useBoardOwner(monday);
    
    // המרת לקוחות לפורמט boardItems
    const boardItems = customers.map(customer => ({
        value: customer.id,
        label: customer.name
    }));

    // State - UI
    const [isComboboxOpen, setIsComboboxOpen] = useState(false);
    const [isStartTimeMenuOpen, setIsStartTimeMenuOpen] = useState(false);
    const [isEndTimeMenuOpen, setIsEndTimeMenuOpen] = useState(false);

    // State - Monday context
    const [context, setContext] = useState(null);
    const [settings, setSettings] = useState(null);
    const [columnIds, setColumnIds] = useState(null); // מזהי העמודות

    // Hook לניהול Toast
    const { toasts, showSuccess, showError, showWarning, removeToast } = useToast();

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
        addEvent
    } = useMondayEvents(monday, context);

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

            loadEvents(startOfWeek, endOfWeek);
        }
    }, [context, customSettings, loadEvents]);

    // --- Helper functions ---

    // --- Event handlers ---

    // גרירת אירוע קיים (הזזה)
    const onEventDrop = useCallback(async ({ event, start, end }) => {
        try {
            await updateEventPosition(event, start, end);
            showSuccess('האירוע עודכן בהצלחה');
        } catch (error) {
            showError('שגיאה בעדכון מיקום האירוע. השינויים בוטלו.');
            logger.error('MondayCalendar', 'Error in onEventDrop', error);
        }
    }, [updateEventPosition, showSuccess, showError]);

    // שינוי אורך אירוע (מתיחה)
    const onEventResize = useCallback(async ({ event, start, end }) => {
        try {
            await updateEventPosition(event, start, end);
            showSuccess('האירוע עודכן בהצלחה');
        } catch (error) {
            showError('שגיאה בעדכון אורך האירוע. השינויים בוטלו.');
            logger.error('MondayCalendar', 'Error in onEventResize', error);
        }
    }, [updateEventPosition, showSuccess, showError]);

    // טעינת נתוני אירוע לעריכה
    const loadEventDataForEdit = useCallback(async (event) => {
        if (!context?.boardId || !event?.mondayItemId) return;
        
        try {
            logger.functionStart('loadEventDataForEdit', { eventId: event.mondayItemId });
            
            // שימוש ב-query ממוקד לפי ID
            const item = await fetchItemById(monday, context.boardId, event.mondayItemId);
            
            if (!item) {
                logger.warn('loadEventDataForEdit', `Item not found: ${event.mondayItemId}`);
            return;
        }

            const updatedEvent = { ...event };
                
                // חילוץ לקוח
                if (customSettings.projectColumnId) {
                    const projectColumn = item.column_values.find(col => col.id === customSettings.projectColumnId);
                    if (projectColumn?.value) {
                        try {
                            // BoardRelationValue מחזיר JSON string עם item_ids
                            const parsedValue = typeof projectColumn.value === 'string' 
                                ? JSON.parse(projectColumn.value) 
                                : projectColumn.value;
                            
                            if (parsedValue?.item_ids && parsedValue.item_ids.length > 0) {
                                const customerId = parsedValue.item_ids[0].toString();
                                updatedEvent.customerId = customerId;
                                
                                // נטען את הלקוח - שימוש ב-query ממוקד
                                if (settings?.perent_item_board && context?.boardId) {
                                    try {
                                        const columnId = Object.keys(settings.perent_item_board)[0];
                                        if (columnId) {
                                            const columnSettings = await fetchColumnSettings(monday, context.boardId, columnId);
                                            
                                            if (columnSettings?.boardIds && columnSettings.boardIds.length > 0) {
                                                const boardId = columnSettings.boardIds[0];
                                                const customer = await fetchCustomerById(monday, boardId, customerId);
                                                
                                                if (customer) {
                                                    setSelectedItem({ id: customer.id, name: customer.name });
                                                }
                                            }
                                        }
                                    } catch (err) {
                                        logger.error('loadEventDataForEdit', 'Error loading customer', err);
                                    }
                                }
                            }
                        } catch (err) {
                            logger.error('loadEventDataForEdit', 'Error parsing project column value', err);
                        }
                    }
                }
                
                // חילוץ מוצר
                if (customSettings.productColumnId) {
                    const productColumn = item.column_values.find(col => col.id === customSettings.productColumnId);
                    if (productColumn?.value) {
                        try {
                            const parsedValue = typeof productColumn.value === 'string' 
                                ? JSON.parse(productColumn.value) 
                                : productColumn.value;
                            
                            if (parsedValue?.item_ids && parsedValue.item_ids.length > 0) {
                                const productId = parsedValue.item_ids[0].toString();
                                updatedEvent.productId = productId;
                            }
                        } catch (err) {
                            logger.error('loadEventDataForEdit', 'Error parsing product column value', err);
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
                
            setEventToEdit(updatedEvent);
            logger.functionEnd('loadEventDataForEdit', { eventId: event.mondayItemId });
        } catch (error) {
            logger.error('loadEventDataForEdit', 'Error loading event data for edit', error);
        }
    }, [context, customSettings, monday, settings]);

    // לחיצה על אירוע קיים - פתיחת Modal לעריכה
    const handleEventClick = useCallback(async (event) => {
        logger.functionStart('handleEventClick', { eventId: event.id, title: event.title });
        
        // איפוס מצב יצירה
        setIsEditMode(true);
        setEventToEdit(event);
        setPendingSlot({ start: event.start, end: event.end });
        setNewEventTitle(event.title || '');
        setSelectedItem(null);
        
        // טעינת נתוני האירוע לעריכה
        await loadEventDataForEdit(event);
        
        setIsModalOpen(true);
    }, [loadEventDataForEdit]);

    // לחיצה על סלוט ריק - פתיחת Modal
    const onSelectSlot = useCallback(async ({ start, end, allDay }) => {
        logger.functionStart('onSelectSlot', { start, end, allDay });
        
        // בדיקה אם זו לחיצה על all-day area
        // all-day click: start ב-00:00, end ב-00:00 של היום הבא (24 שעות בדיוק)
        const isAllDayClick = allDay || 
            (start.getHours() === 0 && start.getMinutes() === 0 && 
             end.getHours() === 0 && end.getMinutes() === 0 &&
             (end.getTime() - start.getTime()) === 86400000); // 24 שעות בדיוק
        
        if (isAllDayClick) {
            logger.debug('onSelectSlot', 'All-day event clicked');
            setPendingAllDayDate(start);
            setIsAllDayModalOpen(true);
            return;
        }
        
        // קוד קיים לסלוט רגיל
        setIsEditMode(false);
        setEventToEdit(null);
        setPendingSlot({ start, end });
        setIsModalOpen(true);
        setNewEventTitle('');
        setSelectedItem(null);

        // הלקוחות נטענים אוטומטית דרך useCustomers hook
        // אין צורך בטעינה ידנית כאן
    }, [monday, settings, context]);

    // --- Modal handlers ---

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setPendingSlot(null);
        setNewEventTitle('');
        setSelectedItem(null);
        setIsComboboxOpen(false);
        setIsEditMode(false);
        setEventToEdit(null);
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
            showError('שגיאה ביצירת האירוע. נסה שוב.');
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
            showError('שגיאה בעדכון האירוע. השינויים בוטלו.');
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
            showError('שגיאה במחיקת האירוע. האירוע לא נמחק.');
            logger.error('MondayCalendar', 'Error in handleDeleteEvent', error);
        }
    };

    // עדכון שעת התחלה
    const handleStartTimeChange = (option) => {
        if (!pendingSlot || !option) return;
        
        const [hours, minutes] = option.value.split(':').map(Number);
        const newStart = new Date(pendingSlot.start);
        newStart.setHours(hours, minutes);
        
        let newEnd = new Date(pendingSlot.end);
        if (newStart >= newEnd) {
            newEnd = new Date(newStart.getTime() + 60 * 60 * 1000);
        }
        
        setPendingSlot({ ...pendingSlot, start: newStart, end: newEnd });
    };

    // עדכון שעת סיום
    const handleEndTimeChange = (option) => {
        if (!pendingSlot || !option) return;
        
        const [hours, minutes] = option.value.split(':').map(Number);
        const newEnd = new Date(pendingSlot.end);
        newEnd.setHours(hours, minutes);
        
        setPendingSlot({ ...pendingSlot, end: newEnd });
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
            loadEvents(start, end);
        }
    }, [loadEvents]);

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
            
            // שימוש ב-context.user.id במקום קריאת API
            const reporterId = context?.user?.id || null;
            
            if (allDayData.type === 'reports') {
                // יצירת שרשרת אירועים מ-8:00 בבוקר
                let currentStart = new Date(allDayData.date);
                currentStart.setHours(8, 0, 0, 0);
                
                for (const report of allDayData.reports) {
                    const durationMinutes = parseFloat(report.hours) * 60;
                    const end = new Date(currentStart.getTime() + durationMinutes * 60000);
                    
                    // בניית column values
                    const columnValues = {};
                    
                    columnValues[customSettings.dateColumnId] = {
                        date: format(currentStart, 'yyyy-MM-dd'),
                        time: format(currentStart, 'HH:mm:ss')
                    };
                    
                    const durationHours = durationMinutes / 60;
                    columnValues[customSettings.durationColumnId] = durationHours.toFixed(2);
                    
                    // הוספת הערות אם יש
                    if (report.notes && customSettings.notesColumnId) {
                        columnValues[customSettings.notesColumnId] = report.notes;
                    }
                    
                    // הוספת מוצר אם קיימת עמודה ו-product ID
                    if (report.productId && customSettings.productColumnId) {
                        columnValues[customSettings.productColumnId] = {
                            item_ids: [parseInt(report.productId)]
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
                    
                    const columnValuesJson = JSON.stringify(columnValues);
                    
                    // יצירת אירוע
                    const createdItem = await createBoardItem(
                        monday,
                        context.boardId,
                        report.projectName,
                        columnValuesJson
                    );
                    
                    if (createdItem) {
                        // הוספה ל-state דרך ה-hook
                        const newEvent = {
                            id: createdItem.id,
                            title: report.projectName,
                            start: currentStart,
                            end: end,
                            notes: report.notes,
                            mondayItemId: createdItem.id
                        };
                        addEvent(newEvent);
                    }
                    
                    // מעבר לאירוע הבא
                    currentStart = end;
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
                
                const columnValues = {};
                columnValues[customSettings.dateColumnId] = {
                    date: dateStr
                };
                columnValues[customSettings.durationColumnId] = "0.00";
                
                // הוספת מדווח אם קיימת עמודה ומזהה משתמש
                if (customSettings.reporterColumnId && reporterId) {
                    columnValues[customSettings.reporterColumnId] = {
                        personsAndTeams: [
                            { id: parseInt(reporterId), kind: "person" }
                        ]
                    };
                }
                
                const columnValuesJson = JSON.stringify(columnValues);
                
                const createdItem = await createBoardItem(
                    monday,
                    context.boardId,
                    eventName,
                    columnValuesJson
                );
                
                if (createdItem) {
                    // יצירת תאריך ללא שעה למען react-big-calendar
                    const eventDate = new Date(allDayData.date);
                    eventDate.setHours(0, 0, 0, 0);
                    
                    const newEvent = {
                        id: createdItem.id,
                        title: typeNames[allDayData.type],
                        start: eventDate,
                        end: eventDate,
                        allDay: true,
                        mondayItemId: createdItem.id
                    };
                    addEvent(newEvent);
                    logger.functionEnd('handleCreateAllDayEvent', { type: allDayData.type, eventId: createdItem.id });
                }
            }
            
            setIsAllDayModalOpen(false);
            setPendingAllDayDate(null);
            
        } catch (error) {
            logger.error('handleCreateAllDayEvent', 'Error creating all-day event', error);
        }
    };

    // פונקציה לקביעת עיצוב האירוע (צבע רקע מלא)
    const eventStyleGetter = (event, start, end, isSelected) => {
        let backgroundColor = '#3174ad'; // צבע ברירת מחדל (כחול)
        
        // עדיפות ראשונה: צבע הסטטוס מ-Monday (אם קיים)
        if (event.statusColor) {
            backgroundColor = event.statusColor;
        }
        // אחרת: לוגיקה לבחירת צבע לפי סוג האירוע או הכותרת
        else if (event.title === 'מחלה') {
            backgroundColor = '#e2445c'; // אדום
        } else if (event.title === 'חופשה') {
            backgroundColor = '#00c875'; // ירוק
        } else if (event.title === 'מילואים') {
            backgroundColor = '#579bfc'; // כחול בהיר
        }
        
        return {
            style: {
                backgroundColor: backgroundColor,
                borderRadius: '4px',
                        opacity: 0.9,
                color: 'white', // צבע הטקסט
                border: '0px',
                display: 'block'
            }
        };
    };

    return (
        <div style={{ height: '100%', padding: '20px', direction: 'rtl', display: 'flex', flexDirection: 'column' }}>
                <DnDCalendar
                    localizer={localizer}
                    events={events}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: '100%' }}
                    culture='he'
                    rtl={true}
                    messages={hebrewMessages}
                    formats={formats}
                    defaultView={Views.WEEK}
                    views={[Views.MONTH, Views.WEEK, Views.DAY]}
                    min={minTime}
                    max={maxTime}
                    onEventDrop={onEventDrop}
                    onEventResize={onEventResize}
                    onSelectEvent={handleEventClick}
                    resizable
                    selectable
                    onSelectSlot={onSelectSlot}
                    onRangeChange={handleRangeChange}
                    step={15}
                    timeslots={4}
                    eventPropGetter={eventStyleGetter}
                    components={{
                        toolbar: CustomToolbarWithProps,
                        event: CustomEvent
                    }}
                />

            <EventModal 
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                pendingSlot={pendingSlot}
                boardItems={boardItems}
                isLoadingItems={isLoadingItems}
                newEventTitle={newEventTitle}
                setNewEventTitle={setNewEventTitle}
                selectedItem={selectedItem}
                setSelectedItem={setSelectedItem}
                isComboboxOpen={isComboboxOpen}
                setIsComboboxOpen={setIsComboboxOpen}
                isStartTimeMenuOpen={isStartTimeMenuOpen}
                setIsStartTimeMenuOpen={setIsStartTimeMenuOpen}
                isEndTimeMenuOpen={isEndTimeMenuOpen}
                setIsEndTimeMenuOpen={setIsEndTimeMenuOpen}
                onStartTimeChange={handleStartTimeChange}
                onEndTimeChange={handleEndTimeChange}
                onDateChange={handleDateChange}
                onCreate={handleCreateEvent}
                eventToEdit={eventToEdit}
                isEditMode={isEditMode}
                onUpdate={handleUpdateEvent}
                onDelete={handleDeleteEvent}
            />
            
            <AllDayEventModal 
                isOpen={isAllDayModalOpen}
                onClose={() => { setIsAllDayModalOpen(false); setPendingAllDayDate(null); }}
                pendingDate={pendingAllDayDate}
                onCreate={handleCreateAllDayEvent}
            />

            {/* Toast Notifications */}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </div>
    );
}
