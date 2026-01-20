import { useCallback, useRef } from 'react';
import logger from '../utils/logger';

/**
 * Hook לניהול handlers של לוח השנה
 * @param {Object} params - פרמטרים
 * @param {Function} params.updateEventPosition - עדכון מיקום אירוע
 * @param {Function} params.showSuccess - הצגת הודעת הצלחה
 * @param {Function} params.showError - הצגת הודעת שגיאה
 * @param {Function} params.showWarning - הצגת הודעת אזהרה
 * @param {Function} params.showErrorWithDetails - הצגת שגיאה עם פרטים
 * @returns {Object} handlers לשימוש בלוח השנה
 */
export const useCalendarHandlers = ({
    updateEventPosition,
    showSuccess,
    showError,
    showWarning,
    showErrorWithDetails
}) => {
    // מניעת גלילה בזמן גרירת אירוע יומי
    const scrollLockRef = useRef(null);

    /**
     * התחלת גרירה - נועל גלילה לאירועי allDay
     */
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

    /**
     * גרירת אירוע קיים (הזזה)
     */
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
            logger.error('useCalendarHandlers', 'Error in onEventDrop', error);
        }
    }, [updateEventPosition, showSuccess, showError, showWarning, showErrorWithDetails]);

    /**
     * שינוי אורך אירוע (מתיחה) - אירועים שעתיים ויומיים
     */
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
            logger.error('useCalendarHandlers', 'Error in onEventResize', error);
        }
    }, [updateEventPosition, showSuccess, showErrorWithDetails]);

    return {
        onDragStart,
        onEventDrop,
        onEventResize,
        scrollLockRef
    };
};

export default useCalendarHandlers;
