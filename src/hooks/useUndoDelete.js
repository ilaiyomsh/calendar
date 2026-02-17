import { useState, useCallback, useEffect, useRef } from 'react';
import { deleteItem } from '../utils/mondayApi';
import logger from '../utils/logger';

const UNDO_DURATION = 4000; // 4 שניות
const BATCH_SIZE = 5;

/**
 * Hook לניהול מחיקה עם undo
 * מאפשר מחיקה בודדת ומרובה עם אפשרות ביטול למשך 4 שניות
 *
 * @param {Object} params
 * @param {Object} params.monday - Monday SDK instance
 * @param {Function} params.restoreEvents - החזרת אירועים ל-state
 * @param {Function} params.showError - הצגת הודעת שגיאה
 * @returns {Object} { isVisible, message, scheduleDelete, undoDelete }
 */
export const useUndoDelete = ({ monday, restoreEvents, showError }) => {
    const [pendingDelete, setPendingDelete] = useState(null);
    const timerRef = useRef(null);
    const pendingRef = useRef(null);

    // סנכרון ref עם state
    useEffect(() => {
        pendingRef.current = pendingDelete;
    }, [pendingDelete]);

    // מחיקה סופית מה-API
    const commitDelete = useCallback(async (eventsToDelete) => {
        if (!eventsToDelete || eventsToDelete.length === 0) return;

        logger.functionStart('useUndoDelete.commitDelete', { count: eventsToDelete.length });

        try {
            // מחיקה ב-batches של 5
            for (let i = 0; i < eventsToDelete.length; i += BATCH_SIZE) {
                const batch = eventsToDelete.slice(i, i + BATCH_SIZE);
                const results = await Promise.allSettled(
                    batch.map(ev => deleteItem(monday, ev.mondayItemId || ev.id))
                );

                const failed = results.filter(r => r.status === 'rejected');
                if (failed.length > 0) {
                    logger.error('useUndoDelete.commitDelete', 'Some deletions failed', { failed: failed.length });
                }
            }

            logger.functionEnd('useUndoDelete.commitDelete', { count: eventsToDelete.length });
        } catch (error) {
            // שגיאה — החזרת האירועים ל-state
            logger.error('useUndoDelete.commitDelete', 'Error deleting events', error);
            restoreEvents(eventsToDelete);
            showError('שגיאה במחיקת האירועים');
        }
    }, [monday, restoreEvents, showError]);

    // תזמון מחיקה עם undo
    const scheduleDelete = useCallback((events) => {
        if (!events || events.length === 0) return;

        // אם יש undo קודם — מבצעים אותו מיד
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
            if (pendingRef.current) {
                commitDelete(pendingRef.current.events);
            }
        }

        const message = events.length === 1
            ? 'האירוע נמחק'
            : `${events.length} אירועים נמחקו`;

        logger.info('useUndoDelete', 'Scheduling delete with undo', { count: events.length });

        setPendingDelete({ events, message });

        // טיימר למחיקה סופית
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            const current = pendingRef.current;
            setPendingDelete(null);
            if (current) {
                commitDelete(current.events);
            }
        }, UNDO_DURATION);
    }, [commitDelete]);

    // ביטול המחיקה — החזרת האירועים
    const undoDelete = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        const current = pendingRef.current;
        setPendingDelete(null);

        if (current) {
            logger.info('useUndoDelete', 'Undo delete', { count: current.events.length });
            restoreEvents(current.events);
        }
    }, [restoreEvents]);

    // Cleanup — ב-unmount, מבצעים את המחיקה מיד
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            if (pendingRef.current) {
                commitDelete(pendingRef.current.events);
            }
        };
    }, [commitDelete]);

    return {
        isVisible: !!pendingDelete,
        message: pendingDelete?.message || '',
        scheduleDelete,
        undoDelete
    };
};
