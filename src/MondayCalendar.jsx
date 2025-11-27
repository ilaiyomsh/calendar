import React, { useState, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';

// ייבוא קבצי עיצוב
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import './calendar-custom.css';

// קבועים והגדרות
import { localizer, hebrewMessages, formats } from './constants/calendarConfig';

// פונקציות עזר
import { fetchColumnSettings, fetchAllBoardItems as fetchBoardItems, createBoardItem, fetchEventsFromBoard, deleteItem } from './utils/mondayApi';
import { getColumnIds, mapItemToEvent, buildColumnValues, buildFetchEventsQuery } from './utils/mondayColumns';
import logger from './utils/logger';

// רכיבים
import EventModal from './components/EventModal';
import AllDayEventModal from './components/AllDayEventModal';
import CalendarToolbar from './components/CalendarToolbar';
import CustomEvent from './components/CustomEvent';

// Context
import { useSettings } from './contexts/SettingsContext';

// עטיפת הלוח ברכיב Drag and Drop
const DnDCalendar = withDragAndDrop(Calendar);

export default function MondayCalendar({ monday, onOpenSettings }) {
    // גישה להגדרות מותאמות
    const { customSettings } = useSettings();
    
    // State - אירועים ולוח שנה
    const [events, setEvents] = useState([]);
    const minTime = new Date(1970, 1, 1, 6, 0, 0);  // 06:00 קבוע
    const maxTime = new Date(1970, 1, 1, 20, 0, 0); // 20:00 קבוע

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
    
    // State - אייטמים מהלוח
    const [parentBoardId, setParentBoardId] = useState(null);
    const [boardItems, setBoardItems] = useState([]);
    const [isLoadingItems, setIsLoadingItems] = useState(false);

    // State - UI
    const [isComboboxOpen, setIsComboboxOpen] = useState(false);
    const [isStartTimeMenuOpen, setIsStartTimeMenuOpen] = useState(false);
    const [isEndTimeMenuOpen, setIsEndTimeMenuOpen] = useState(false);

    // State - Monday context
    const [context, setContext] = useState(null);
    const [settings, setSettings] = useState(null);
    const [columnIds, setColumnIds] = useState(null); // מזהי העמודות

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

    // פונקציה לטעינת אירועים מ-Monday
    const loadEventsFromMonday = useCallback(async (startDate, endDate) => {
        // וידוא שיש לנו את כל ההגדרות הנדרשות
        if (!context?.boardId || !customSettings?.dateColumnId || !customSettings?.durationColumnId) {
            logger.warn('loadEventsFromMonday', 'Missing context or settings for fetching events');
            return;
        }

        try {
            logger.functionStart('loadEventsFromMonday', { startDate, endDate });
            
            const fromDateStr = format(startDate, 'yyyy-MM-dd');
            const toDateStr = format(endDate, 'yyyy-MM-dd');

            // 1. בניית השאילתה לפי המפרט
            const query = `query {
                boards (ids: [${context.boardId}]) {
                    items_page (
                        limit: 500,
                        query_params: {
                            rules: [
                                {
                                    column_id: "${customSettings.dateColumnId}",
                                    compare_value: ["${fromDateStr}", "${toDateStr}"],
                                    operator: between
                                }
                            ]
                        }
                    ) {
                        items {
                            id
                            name
                            column_values {
                                id
                                value
                                ... on DateValue {
                                    date
                                    time
                                }
                                ... on PeopleValue {
                                    text
                                    persons_and_teams {
                                        id
                                        kind
                                    }
                                    updated_at
                                }
                            }
                        }
                    }
                }
            }`;

            const res = await monday.api(query);
            
            if (!res.data?.boards?.[0]?.items_page?.items) {
                logger.warn('loadEventsFromMonday', 'No items found in response');
                setEvents([]);
                return;
            }

            const rawItems = res.data.boards[0].items_page.items;

            // 2. מיפוי וחישוב לתצוגה
            const mappedEvents = rawItems.map(item => {
                // מציאת העמודה הרלוונטית
                const dateColumn = item.column_values.find(col => col.id === customSettings.dateColumnId);
                const durationColumn = item.column_values.find(col => col.id === customSettings.durationColumnId);
                const notesColumn = item.column_values.find(col => col.id === customSettings.notesColumnId);

                // א. חילוץ התחלה מהשדות date ו-time (כבר מותאמים לזמן מקומי)
                let start = null;
                if (dateColumn?.date) {
                    const [year, month, day] = dateColumn.date.split('-').map(Number);
                    
                    let hours = 0, minutes = 0, seconds = 0;
                    if (dateColumn.time) {
                        [hours, minutes, seconds] = dateColumn.time.split(':').map(Number);
                    }

                    // יצירת תאריך מקומי - time כבר מותאם למשתמש לפי Monday
                    start = new Date(year, month - 1, day, hours, minutes, seconds || 0);
                }

                if (!start || isNaN(start.getTime())) return null; // דילוג אם אין תאריך תקין

                // ב. חילוץ משך (ברירת מחדל: 60 דקות)
                let durationMinutes = 60;
                if (durationColumn?.value) {
                    try {
                        let durationHours = 0;
                        
                        // עמודת numbers מחזירה מחרוזת JSON של מספר
                        if (typeof durationColumn.value === 'string') {
                            // ניסיון לפענח כ-JSON תחילה
                            try {
                                const parsed = JSON.parse(durationColumn.value);
                                // JSON.parse מחזיר את המספר ישירות
                                if (typeof parsed === 'number') {
                                    durationHours = parsed;
                                } else if (parsed && typeof parsed === 'object') {
                                    // אם זה אובייקט, נחפש שדה מספרי
                                    durationHours = parseFloat(parsed.value || parsed.number) || 0;
                                } else {
                                    // ניסיון אחרון - המרה ישירה למספר
                                    durationHours = parseFloat(parsed) || 0;
                                }
                            } catch {
                                // אם זה לא JSON, זה כנראה מחרוזת מספרית רגילה
                                durationHours = parseFloat(durationColumn.value) || 0;
                            }
                        } else if (typeof durationColumn.value === 'number') {
                            durationHours = durationColumn.value;
                        }
                        
                        if (!isNaN(durationHours)) {
                            if (durationHours === 0) {
                                // אירוע יומי (מחלה/חופשה/מילואים)
                                durationMinutes = 0;
                            } else {
                                durationMinutes = Math.round(durationHours * 60);
                            }
                        } else {
                            logger.warn('loadEventsFromMonday', `Invalid duration hours: ${durationHours} for item: ${item.name}`);
                            return null;
                        }
                    } catch (e) {
                        logger.error('loadEventsFromMonday', 'Error parsing duration', e);
                    }
                } else {
                    logger.warn('loadEventsFromMonday', `No duration column value for item: ${item.name}`);
                }

                // ג. חילוץ הערות
                let notes = '';
                if (notesColumn?.value) {
                    try {
                        notes = notesColumn.value || '';
                    } catch (e) {
                        logger.error('loadEventsFromMonday', 'Error parsing notes', e);
                    }
                }

                // ד. חישוב סיום
                let end;
                let isAllDay = false;
                
                if (durationMinutes === 0) {
                    // אירוע יומי - end = start (all-day event)
                    end = new Date(start);
                    isAllDay = true;
                } else {
                    end = new Date(start.getTime() + durationMinutes * 60000);
                }

                // ו. יצירת האובייקט
                return {
                    id: item.id,
                    title: item.name,
                    start: start,
                    end: end,
                    allDay: isAllDay,
                    mondayItemId: item.id,
                    notes: notes
                };
            }).filter(Boolean); // סינון nulls

            setEvents(mappedEvents);
            logger.functionEnd('loadEventsFromMonday', { count: mappedEvents.length });

        } catch (error) {
            logger.error('loadEventsFromMonday', 'Error loading events', error);
        }
    }, [context, customSettings, monday]);

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

            loadEventsFromMonday(startOfWeek, endOfWeek);
        }
    }, [context, customSettings, loadEventsFromMonday]);

    // --- Helper functions ---

    // --- Event handlers ---

    // פונקציה מרכזית לעדכון אירוע (גרירה או שינוי גודל)
    const handleEventUpdate = async (event, newStart, newEnd) => {
        // 1. עדכון אופטימי ב-UI
        setEvents((prev) => {
            const filtered = prev.filter((ev) => ev.id !== event.id);
            return [...filtered, { ...event, start: newStart, end: newEnd }];
        });

        // 2. בדיקת תקינות להגדרות
        if (!context?.boardId || !customSettings?.dateColumnId || !customSettings?.durationColumnId) {
            logger.error('handleEventUpdate', 'Missing settings for update');
            return;
        }

        try {
            logger.functionStart('handleEventUpdate', { id: event.mondayItemId, newStart, newEnd });

            // 3. חישובים
            const durationMinutes = Math.round((newEnd - newStart) / 60000);
            const hours = Math.floor(durationMinutes / 60);
            const minutes = durationMinutes % 60;

            // 4. המרת הזמן המקומי ל-UTC (Monday מצפה ל-UTC)
            const utcYear = newStart.getUTCFullYear();
            const utcMonth = newStart.getUTCMonth() + 1;
            const utcDay = newStart.getUTCDate();
            const utcHours = newStart.getUTCHours();
            const utcMinutes = newStart.getUTCMinutes();
            const utcSeconds = newStart.getUTCSeconds();

            const dateStr = `${utcYear}-${String(utcMonth).padStart(2, '0')}-${String(utcDay).padStart(2, '0')}`;
            const timeStr = `${String(utcHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}:${String(utcSeconds).padStart(2, '0')}`;

            // 5. בניית ערכים לעדכון
            const columnValues = {};
            
            columnValues[customSettings.dateColumnId] = {
                date: dateStr,
                time: timeStr
            };

            // המרה לשעות עשרוניות
            const durationHours = durationMinutes / 60;
            columnValues[customSettings.durationColumnId] = durationHours.toFixed(2);

            // 5. שליחת Mutation
            const mutation = `mutation {
                change_multiple_column_values(
                    item_id: ${event.mondayItemId}, 
                    board_id: ${context.boardId}, 
                    column_values: ${JSON.stringify(JSON.stringify(columnValues))}
                ) {
                    id
                }
            }`;

            await monday.api(mutation);
            console.log("✅ Event updated successfully in Monday");

        } catch (error) {
            console.error("❌ Error updating event:", error);
            // במקרה של שגיאה, כדאי להחזיר את האירוע למצבו הקודם (לא מיושם כאן לפשטות)
            // רענון הנתונים מהשרת יכול לתקן את המצב
            loadEventsFromMonday(newStart, newEnd); // רענון פשוט כ-fallback
        }
    };

    // גרירת אירוע קיים (הזזה)
    const onEventDrop = useCallback(({ event, start, end }) => {
        handleEventUpdate(event, start, end);
    }, [context, customSettings, monday]); // תלויות

    // שינוי אורך אירוע (מתיחה)
    const onEventResize = useCallback(({ event, start, end }) => {
        handleEventUpdate(event, start, end);
    }, [context, customSettings, monday]); // תלויות

    // טעינת נתוני אירוע לעריכה
    const loadEventDataForEdit = useCallback(async (event) => {
        if (!context?.boardId || !event?.mondayItemId) return;
        
        try {
            logger.functionStart('loadEventDataForEdit', { eventId: event.mondayItemId });
            
            // שימוש ב-items_by_column_values לחיפוש לפי ID
            // Monday.com API תומך ב-items_by_column_values שמאפשר לשאול אייטמים לפי ערך של עמודה
            // אבל כדי לשאול לפי ID, נשתמש ב-items_page עם limit גבוה ונסנן
            // או נשתמש ב-items_by_column_values עם עמודת name או עמודה אחרת
            // למעשה, הדרך הכי פשוטה היא לשאול את כל האייטמים ולסנן לפי ID
            const query = `query {
                boards(ids: [${context.boardId}]) {
                    items_page(limit: 500) {
                        items {
                            id
                            name
                            column_values {
                                id
                                value
                                type
                                ... on DateValue {
                                    date
                                    time
                                }
                                ... on BoardRelationValue {
                                    value
                                }
                                ... on TextValue {
                                    text
                                }
                            }
                        }
                    }
                }
            }`;
            
            const res = await monday.api(query);
            
            if (res.data?.boards?.[0]?.items_page?.items) {
                // סינון האייטם לפי ID
                const item = res.data.boards[0].items_page.items.find(i => i.id === event.mondayItemId.toString());
                
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
                                
                                // נטען את הלקוח - צריך לטעון את boardItems קודם
                                if (settings?.perent_item_board && context?.boardId) {
                                    try {
                                        const columnId = Object.keys(settings.perent_item_board)[0];
                                        if (columnId) {
                                            const { fetchColumnSettings, fetchAllBoardItems } = await import('./utils/mondayApi');
                                            const columnSettings = await fetchColumnSettings(monday, context.boardId, columnId);
                                            
                                            if (columnSettings?.boardIds && columnSettings.boardIds.length > 0) {
                                                const boardId = columnSettings.boardIds[0];
                                                const items = await fetchAllBoardItems(monday, boardId);
                                                setBoardItems(items);
                                                
                                                const customerItem = items.find(item => item.value === customerId);
                                                if (customerItem) {
                                                    setSelectedItem({ id: customerItem.value, name: customerItem.label });
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
            }
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

        // אחזור אייטמים מהלוח המקור - רק אם יש הגדרות
        if (settings?.perent_item_board && context?.boardId) {
            try {
                const columnId = Object.keys(settings.perent_item_board)[0];
                if (!columnId) {
                    logger.warn('onSelectSlot', 'No column ID found');
                    return;
                }

                const columnSettings = await fetchColumnSettings(monday, context.boardId, columnId);
                
                if (columnSettings?.boardIds && columnSettings.boardIds.length > 0) {
                    const boardId = columnSettings.boardIds[0];
                    setParentBoardId(boardId);
                    
                    setIsLoadingItems(true);
                    const items = await fetchBoardItems(monday, boardId);
                    setBoardItems(items);
                    setIsLoadingItems(false);
                }
            } catch (error) {
                logger.error('onSelectSlot', 'Error fetching board items', error);
                setIsLoadingItems(false);
            }
        } else {
            logger.warn('onSelectSlot', 'Settings not configured yet');
        }
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

    // בניית column values משותפת ליצירה ועדכון
    const buildColumnValues = (eventData, startTime, endTime, currentUser) => {
        const durationMinutes = Math.round((endTime - startTime) / 60000);
        const durationHours = durationMinutes / 60;

        // המרת הזמן המקומי ל-UTC (Monday מצפה ל-UTC)
        const utcYear = startTime.getUTCFullYear();
        const utcMonth = startTime.getUTCMonth() + 1;
        const utcDay = startTime.getUTCDate();
        const utcHours = startTime.getUTCHours();
        const utcMinutes = startTime.getUTCMinutes();
        const utcSeconds = startTime.getUTCSeconds();

        const dateStr = `${utcYear}-${String(utcMonth).padStart(2, '0')}-${String(utcDay).padStart(2, '0')}`;
        const timeStr = `${String(utcHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}:${String(utcSeconds).padStart(2, '0')}`;

        const columnValues = {};

        // עמודת תאריך
        columnValues[customSettings.dateColumnId] = {
            date: dateStr,
            time: timeStr
        };

        // עמודת משך זמן - המרה לשעות עשרוניות
        columnValues[customSettings.durationColumnId] = durationHours.toFixed(2);

        // עמודת קישור לפרויקט (אם נבחר פרויקט ויש הגדרה לעמודה)
        if (eventData.itemId && customSettings.projectColumnId) {
            columnValues[customSettings.projectColumnId] = {
                item_ids: [parseInt(eventData.itemId)]
            };
        }
        
        // עמודת קישור למוצר (אם נבחר מוצר ויש הגדרה לעמודה)
        if (eventData.productId && customSettings.productColumnId) {
            columnValues[customSettings.productColumnId] = {
                item_ids: [parseInt(eventData.productId)]
            };
        }
        
        // עמודת הערות (אם יש הערות ויש הגדרה לעמודה)
        if (eventData.notes && customSettings.notesColumnId) {
            columnValues[customSettings.notesColumnId] = eventData.notes;
        }
        
        // עמודת מדווח - המשתמש שיצר את הדיווח (אם יש הגדרה לעמודה)
        if (currentUser && customSettings.reporterColumnId) {
            columnValues[customSettings.reporterColumnId] = {
                personsAndTeams: [{ id: parseInt(currentUser.id), kind: "person" }]
            };
        }

        return columnValues;
    };

    const handleCreateEvent = async (eventData) => {
        // eventData מגיע מ-EventModal: { title, itemId, notes, productId }
        
        if (!pendingSlot || !eventData?.title) {
            logger.warn('handleCreateEvent', 'Missing required data for event creation');
            return;
        }

        if (!context?.boardId) {
            logger.error('handleCreateEvent', 'Missing board ID');
            return;
        }

        // בדיקת הגדרות חובה
        if (!customSettings.dateColumnId || !customSettings.durationColumnId) {
             logger.error('handleCreateEvent', 'Missing column settings (date or duration)');
             return;
        }

        try {
            const itemName = eventData.title;
            const currentUserId = context?.user?.id;
            
            logger.functionStart('handleCreateEvent', {
                itemName: itemName,
                itemId: eventData.itemId,
                notes: eventData.notes,
                productId: eventData.productId,
                start: pendingSlot.start,
                end: pendingSlot.end
            });

            const columnValues = buildColumnValues(eventData, pendingSlot.start, pendingSlot.end, currentUserId ? { id: currentUserId } : null);
            const columnValuesJson = JSON.stringify(columnValues);

            // יצירת אייטם ב-Monday
            const createdItem = await createBoardItem(
                monday,
                context.boardId,
                itemName,
                columnValuesJson
            );

            if (createdItem) {
                // הוספת האירוע ל-state (Optimistic UI)
                const newEvent = {
                    id: createdItem.id,
                    title: itemName,
                    start: pendingSlot.start,
                    end: pendingSlot.end,
                    mondayItemId: createdItem.id,
                    notes: eventData.notes
                };

                setEvents([...events, newEvent]);
                logger.functionEnd('handleCreateEvent', { eventId: newEvent.id });

                handleCloseModal();
            }
        } catch (error) {
            logger.error('handleCreateEvent', 'Error creating event', error);
        }
    };

    // עדכון אירוע קיים
    const handleUpdateEvent = async (eventData) => {
        if (!eventToEdit || !pendingSlot || !eventData?.title) {
            logger.warn('handleUpdateEvent', 'Missing required data for event update');
            return;
        }

        if (!context?.boardId || !eventToEdit.mondayItemId) {
            logger.error('handleUpdateEvent', 'Missing board ID or event ID');
            return;
        }

        // בדיקת הגדרות חובה
        if (!customSettings.dateColumnId || !customSettings.durationColumnId) {
             logger.error('handleUpdateEvent', 'Missing column settings (date or duration)');
             return;
        }

        try {
            const itemName = eventData.title;
            const currentUserId = context?.user?.id;
            
            logger.functionStart('handleUpdateEvent', {
                itemId: eventToEdit.mondayItemId,
                itemName: itemName,
                itemId: eventData.itemId,
                notes: eventData.notes,
                productId: eventData.productId,
                start: pendingSlot.start,
                end: pendingSlot.end
            });

            const columnValues = buildColumnValues(eventData, pendingSlot.start, pendingSlot.end, currentUserId ? { id: currentUserId } : null);
            const columnValuesJson = JSON.stringify(columnValues);

            // עדכון אייטם ב-Monday
            const mutation = `mutation {
                change_multiple_column_values(
                    item_id: ${eventToEdit.mondayItemId}, 
                    board_id: ${context.boardId}, 
                    column_values: ${JSON.stringify(JSON.stringify(columnValues))}
                ) {
                    id
                }
            }`;

            await monday.api(mutation);
            
            // עדכון שם האייטם אם השתנה
            if (itemName !== eventToEdit.title) {
                const updateNameMutation = `mutation {
                    change_simple_column_value(
                        item_id: ${eventToEdit.mondayItemId},
                        column_id: "name",
                        value: "${itemName}"
                    ) {
                        id
                    }
                }`;
                await monday.api(updateNameMutation);
            }

            // עדכון ה-state (Optimistic UI)
            setEvents((prev) => {
                return prev.map(ev => 
                    ev.id === eventToEdit.id 
                        ? { 
                            ...ev, 
                            title: itemName,
                            start: pendingSlot.start,
                            end: pendingSlot.end,
                            notes: eventData.notes
                        }
                        : ev
                );
            });

            logger.functionEnd('handleUpdateEvent', { eventId: eventToEdit.mondayItemId });
            handleCloseModal();
        } catch (error) {
            logger.error('handleUpdateEvent', 'Error updating event', error);
        }
    };

    // מחיקת אירוע
    const handleDeleteEvent = async () => {
        if (!eventToEdit || !eventToEdit.mondayItemId) {
            logger.error('handleDeleteEvent', 'Missing event ID for deletion');
            return;
        }

        try {
            logger.functionStart('handleDeleteEvent', { eventId: eventToEdit.mondayItemId });

            await deleteItem(monday, eventToEdit.mondayItemId);

            // הסרת האירוע מה-state
            setEvents((prev) => prev.filter(ev => ev.id !== eventToEdit.id));

            logger.functionEnd('handleDeleteEvent', { eventId: eventToEdit.mondayItemId });
        } catch (error) {
            logger.error('handleDeleteEvent', 'Error deleting event', error);
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
            loadEventsFromMonday(start, end);
        }
    }, [loadEventsFromMonday]);

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
            />
        );
    }, [onOpenSettings, monday, customSettings, columnIds, events]);

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
                        // הוספה ל-state (Optimistic UI)
                        const newEvent = {
                            id: createdItem.id,
                            title: report.projectName,
                            start: currentStart,
                            end: end,
                            notes: report.notes,
                            mondayItemId: createdItem.id
                        };
                        setEvents(prev => [...prev, newEvent]);
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
                    setEvents(prev => [...prev, newEvent]);
                    logger.functionEnd('handleCreateAllDayEvent', { type: allDayData.type, eventId: createdItem.id });
                }
            }
            
            setIsAllDayModalOpen(false);
            setPendingAllDayDate(null);
            
        } catch (error) {
            logger.error('handleCreateAllDayEvent', 'Error creating all-day event', error);
        }
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
        </div>
    );
}
