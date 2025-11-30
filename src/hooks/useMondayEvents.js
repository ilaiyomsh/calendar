import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { createBoardItem, deleteItem, updateItemColumnValues } from '../utils/mondayApi';
import logger from '../utils/logger';

/**
 * Hook לניהול אירועים ב-Monday Calendar
 * מטפל בכל הפעולות CRUD על אירועים
 */
export const useMondayEvents = (monday, context) => {
    const { customSettings } = useSettings();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    /**
     * טעינת אירועים מ-Monday בטווח תאריכים
     */
    const loadEvents = useCallback(async (startDate, endDate) => {
        if (!context?.boardId || !customSettings?.dateColumnId || !customSettings?.durationColumnId) {
            logger.warn('useMondayEvents.loadEvents', 'Missing context or settings for fetching events');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            logger.functionStart('useMondayEvents.loadEvents', { startDate, endDate });
            
            const fromDateStr = format(startDate, 'yyyy-MM-dd');
            const toDateStr = format(endDate, 'yyyy-MM-dd');

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
                                ... on StatusValue {
                                    id
                                    index
                                    label
                                    text
                                    is_done
                                    label_style {
                                        color
                                    }
                                }
                            }
                        }
                    }
                }
            }`;

            const res = await monday.api(query);
            
            if (!res.data?.boards?.[0]?.items_page?.items) {
                logger.warn('useMondayEvents.loadEvents', 'No items found in response');
                setEvents([]);
                return;
            }

            const rawItems = res.data.boards[0].items_page.items;

            // מיפוי וחישוב לתצוגה
            const mappedEvents = rawItems.map(item => {
                const dateColumn = item.column_values.find(col => col.id === customSettings.dateColumnId);
                const durationColumn = item.column_values.find(col => col.id === customSettings.durationColumnId);
                const notesColumn = item.column_values.find(col => col.id === customSettings.notesColumnId);
                const statusColumn = customSettings.statusColumnId 
                    ? item.column_values.find(col => col.id === customSettings.statusColumnId)
                    : null;

                // חילוץ התחלה
                let start = null;
                if (dateColumn?.date) {
                    const [year, month, day] = dateColumn.date.split('-').map(Number);
                    
                    let hours = 0, minutes = 0, seconds = 0;
                    if (dateColumn.time) {
                        [hours, minutes, seconds] = dateColumn.time.split(':').map(Number);
                    }

                    start = new Date(year, month - 1, day, hours, minutes, seconds || 0);
                }

                if (!start || isNaN(start.getTime())) return null;

                // חילוץ משך
                let durationMinutes = 60;
                if (durationColumn?.value) {
                    try {
                        let durationHours = 0;
                        
                        if (typeof durationColumn.value === 'string') {
                            try {
                                const parsed = JSON.parse(durationColumn.value);
                                if (typeof parsed === 'number') {
                                    durationHours = parsed;
                                } else if (parsed && typeof parsed === 'object') {
                                    durationHours = parseFloat(parsed.value || parsed.number) || 0;
                                } else {
                                    durationHours = parseFloat(parsed) || 0;
                                }
                            } catch {
                                durationHours = parseFloat(durationColumn.value) || 0;
                            }
                        } else if (typeof durationColumn.value === 'number') {
                            durationHours = durationColumn.value;
                        }
                        
                        if (!isNaN(durationHours)) {
                            if (durationHours === 0) {
                                durationMinutes = 0;
                            } else {
                                durationMinutes = Math.round(durationHours * 60);
                            }
                        } else {
                            logger.warn('useMondayEvents.loadEvents', `Invalid duration hours: ${durationHours} for item: ${item.name}`);
                            return null;
                        }
                    } catch (e) {
                        logger.error('useMondayEvents.loadEvents', 'Error parsing duration', e);
                    }
                } else {
                    logger.warn('useMondayEvents.loadEvents', `No duration column value for item: ${item.name}`);
                }

                // חילוץ הערות
                let notes = '';
                if (notesColumn?.value) {
                    try {
                        notes = notesColumn.value || '';
                    } catch (e) {
                        logger.error('useMondayEvents.loadEvents', 'Error parsing notes', e);
                    }
                }

                // חילוץ צבע הסטטוס
                let statusColor = null;
                if (statusColumn?.label_style?.color) {
                    statusColor = statusColumn.label_style.color;
                }

                // חישוב סיום
                let end;
                let isAllDay = false;
                
                if (durationMinutes === 0) {
                    end = new Date(start);
                    isAllDay = true;
                } else {
                    end = new Date(start.getTime() + durationMinutes * 60000);
                }

                return {
                    id: item.id,
                    title: item.name,
                    start: start,
                    end: end,
                    allDay: isAllDay,
                    mondayItemId: item.id,
                    notes: notes,
                    statusColor: statusColor
                };
            }).filter(Boolean);

            setEvents(mappedEvents);
            logger.functionEnd('useMondayEvents.loadEvents', { count: mappedEvents.length });

        } catch (error) {
            logger.error('useMondayEvents.loadEvents', 'Error loading events', error);
            setError('שגיאה בטעינת האירועים');
        } finally {
            setLoading(false);
        }
    }, [context, customSettings, monday]);

    /**
     * בניית column values ליצירה/עדכון
     */
    const buildColumnValues = useCallback((eventData, startTime, endTime, currentUser) => {
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
    }, [customSettings]);

    /**
     * יצירת אירוע חדש
     */
    const createEvent = useCallback(async (eventData, startTime, endTime) => {
        if (!context?.boardId || !customSettings?.dateColumnId || !customSettings?.durationColumnId) {
            logger.error('useMondayEvents.createEvent', 'Missing required settings');
            setError('חסרות הגדרות נדרשות');
            return null;
        }

        try {
            logger.functionStart('useMondayEvents.createEvent', { eventData, startTime, endTime });

            const itemName = eventData.title;
            const currentUserId = context?.user?.id;

            const columnValues = buildColumnValues(eventData, startTime, endTime, currentUserId ? { id: currentUserId } : null);
            const columnValuesJson = JSON.stringify(columnValues);

            const createdItem = await createBoardItem(
                monday,
                context.boardId,
                itemName,
                columnValuesJson
            );

            if (createdItem) {
                const newEvent = {
                    id: createdItem.id,
                    title: itemName,
                    start: startTime,
                    end: endTime,
                    mondayItemId: createdItem.id,
                    notes: eventData.notes
                };

                setEvents(prev => [...prev, newEvent]);
                logger.functionEnd('useMondayEvents.createEvent', { eventId: newEvent.id });
                return newEvent;
            }

            return null;
        } catch (error) {
            logger.error('useMondayEvents.createEvent', 'Error creating event', error);
            setError('שגיאה ביצירת האירוע');
            throw error;
        }
    }, [context, customSettings, monday, buildColumnValues]);

    /**
     * עדכון אירוע קיים
     */
    const updateEvent = useCallback(async (eventId, eventData, startTime, endTime) => {
        if (!context?.boardId || !customSettings?.dateColumnId || !customSettings?.durationColumnId) {
            logger.error('useMondayEvents.updateEvent', 'Missing required settings');
            setError('חסרות הגדרות נדרשות');
            return false;
        }

        // שמירת מצב קודם ל-Rollback
        const previousEvents = [...events];

        try {
            logger.functionStart('useMondayEvents.updateEvent', { eventId, eventData, startTime, endTime });

            const itemName = eventData.title;
            const currentUserId = context?.user?.id;

            // Optimistic update
            setEvents(prev => prev.map(ev => 
                ev.id === eventId 
                    ? { 
                        ...ev, 
                        title: itemName,
                        start: startTime,
                        end: endTime,
                        notes: eventData.notes
                    }
                    : ev
            ));

            const columnValues = buildColumnValues(eventData, startTime, endTime, currentUserId ? { id: currentUserId } : null);

            await updateItemColumnValues(monday, context.boardId, eventId, columnValues);
            
            // עדכון שם האייטם אם השתנה
            const event = events.find(e => e.id === eventId);
            if (event && itemName !== event.title) {
                const updateNameMutation = `mutation {
                    change_simple_column_value(
                        item_id: ${eventId},
                        column_id: "name",
                        value: "${itemName}"
                    ) {
                        id
                    }
                }`;
                await monday.api(updateNameMutation);
            }

            logger.functionEnd('useMondayEvents.updateEvent', { eventId });
            return true;
        } catch (error) {
            // Rollback
            setEvents(previousEvents);
            logger.error('useMondayEvents.updateEvent', 'Error updating event', error);
            setError('שגיאה בעדכון האירוע');
            throw error;
        }
    }, [context, customSettings, monday, events, buildColumnValues]);

    /**
     * מחיקת אירוע
     */
    const deleteEvent = useCallback(async (eventId) => {
        if (!eventId) {
            logger.error('useMondayEvents.deleteEvent', 'Missing event ID');
            return false;
        }

        // שמירת מצב קודם ל-Rollback
        const previousEvents = [...events];

        try {
            logger.functionStart('useMondayEvents.deleteEvent', { eventId });

            // Optimistic update
            setEvents(prev => prev.filter(ev => ev.id !== eventId));

            await deleteItem(monday, eventId);

            logger.functionEnd('useMondayEvents.deleteEvent', { eventId });
            return true;
        } catch (error) {
            // Rollback
            setEvents(previousEvents);
            logger.error('useMondayEvents.deleteEvent', 'Error deleting event', error);
            setError('שגיאה במחיקת האירוע');
            throw error;
        }
    }, [monday, events]);

    /**
     * עדכון אירוע (גרירה או שינוי גודל)
     */
    const updateEventPosition = useCallback(async (event, newStart, newEnd) => {
        if (!context?.boardId || !customSettings?.dateColumnId || !customSettings?.durationColumnId) {
            logger.error('useMondayEvents.updateEventPosition', 'Missing settings for update');
            return false;
        }

        // שמירת מצב קודם ל-Rollback
        const previousEvents = [...events];

        try {
            logger.functionStart('useMondayEvents.updateEventPosition', { id: event.mondayItemId, newStart, newEnd });

            // Optimistic update
            setEvents(prev => {
                const filtered = prev.filter(ev => ev.id !== event.id);
                return [...filtered, { ...event, start: newStart, end: newEnd }];
            });

            // חישובים
            const durationMinutes = Math.round((newEnd - newStart) / 60000);

            // המרת הזמן המקומי ל-UTC
            const utcYear = newStart.getUTCFullYear();
            const utcMonth = newStart.getUTCMonth() + 1;
            const utcDay = newStart.getUTCDate();
            const utcHours = newStart.getUTCHours();
            const utcMinutes = newStart.getUTCMinutes();
            const utcSeconds = newStart.getUTCSeconds();

            const dateStr = `${utcYear}-${String(utcMonth).padStart(2, '0')}-${String(utcDay).padStart(2, '0')}`;
            const timeStr = `${String(utcHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}:${String(utcSeconds).padStart(2, '0')}`;

            const columnValues = {};
            columnValues[customSettings.dateColumnId] = {
                date: dateStr,
                time: timeStr
            };

            const durationHours = durationMinutes / 60;
            columnValues[customSettings.durationColumnId] = durationHours.toFixed(2);

            await updateItemColumnValues(monday, context.boardId, event.mondayItemId, columnValues);

            logger.functionEnd('useMondayEvents.updateEventPosition', { id: event.mondayItemId });
            return true;
        } catch (error) {
            // Rollback
            setEvents(previousEvents);
            logger.error('useMondayEvents.updateEventPosition', 'Error updating event position', error);
            setError('שגיאה בעדכון מיקום האירוע');
            throw error;
        }
    }, [context, customSettings, monday, events]);

    /**
     * הוספת אירוע ל-state (לשימוש באירועים יומיים)
     */
    const addEvent = useCallback((event) => {
        setEvents(prev => [...prev, event]);
    }, []);

    return {
        events,
        loading,
        error,
        loadEvents,
        createEvent,
        updateEvent,
        deleteEvent,
        updateEventPosition,
        addEvent
    };
};

