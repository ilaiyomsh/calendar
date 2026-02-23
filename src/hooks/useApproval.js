import { useCallback, useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { getEffectiveBoardId } from '../utils/boardIdResolver';
import { getPendingIndex, getApprovedIndex, getRejectedIndex } from '../utils/approvalMapping';
import { updateItemColumnValues } from '../utils/mondayApi';
import logger from '../utils/logger';

/**
 * Hook מרכזי ללוגיקת אישור מנהל
 * @param {Object} params
 * @param {Object} params.monday - Monday SDK instance
 * @param {Object} params.context - Monday context
 * @returns {Object} approval state and actions
 */
export const useApproval = ({ monday, context }) => {
    const { customSettings } = useSettings();

    const effectiveBoardId = useMemo(() =>
        getEffectiveBoardId(customSettings, context),
        [customSettings, context]
    );

    // מצב הפיצ'ר
    const isApprovalEnabled = !!(
        customSettings.enableApproval &&
        customSettings.approvalStatusColumnId &&
        customSettings.approvalStatusMapping &&
        Object.keys(customSettings.approvalStatusMapping).length > 0
    );

    // בדיקת הרשאה
    const currentUserId = String(context?.user?.id || '');
    const isManager = isApprovalEnabled &&
        Array.isArray(customSettings.approvedManagerIds) &&
        customSettings.approvedManagerIds.includes(currentUserId);

    // עדכון סטטוס אישור של אירוע בודד
    const updateApprovalStatus = useCallback(async (itemId, statusIndex) => {
        if (!effectiveBoardId || !customSettings.approvalStatusColumnId || statusIndex == null) {
            return false;
        }

        try {
            const columnValues = {
                [customSettings.approvalStatusColumnId]: {
                    index: parseInt(statusIndex)
                }
            };

            await updateItemColumnValues(monday, effectiveBoardId, itemId, columnValues);
            return true;
        } catch (error) {
            logger.error('useApproval', `Failed to update approval status for item ${itemId}`, error);
            throw error;
        }
    }, [monday, effectiveBoardId, customSettings.approvalStatusColumnId]);

    // אישור אירוע בודד
    const approveEvent = useCallback(async (event) => {
        const approvedIdx = getApprovedIndex(customSettings.approvalStatusMapping);
        if (!approvedIdx) {
            logger.error('useApproval', 'No approved index configured');
            return false;
        }

        logger.functionStart('approveEvent', { itemId: event.mondayItemId });
        return updateApprovalStatus(event.mondayItemId, approvedIdx);
    }, [customSettings.approvalStatusMapping, updateApprovalStatus]);

    // דחיית אירוע בודד
    const rejectEvent = useCallback(async (event) => {
        const rejectedIdx = getRejectedIndex(customSettings.approvalStatusMapping);
        if (!rejectedIdx) {
            logger.error('useApproval', 'No rejected index configured');
            return false;
        }

        logger.functionStart('rejectEvent', { itemId: event.mondayItemId });
        return updateApprovalStatus(event.mondayItemId, rejectedIdx);
    }, [customSettings.approvalStatusMapping, updateApprovalStatus]);

    // אישור אירועים מרובים
    const approveMultiple = useCallback(async (events) => {
        const approvedIdx = getApprovedIndex(customSettings.approvalStatusMapping);
        if (!approvedIdx) return { succeeded: 0, failed: 0 };

        logger.functionStart('approveMultiple', { count: events.length });

        let succeeded = 0;
        let failed = 0;

        // ביצוע ב-batches של 5
        for (let i = 0; i < events.length; i += 5) {
            const batch = events.slice(i, i + 5);
            const results = await Promise.allSettled(
                batch.map(event => updateApprovalStatus(event.mondayItemId, approvedIdx))
            );

            succeeded += results.filter(r => r.status === 'fulfilled' && r.value).length;
            failed += results.filter(r => r.status === 'rejected' || !r.value).length;
        }

        logger.functionEnd('approveMultiple', { succeeded, failed });
        return { succeeded, failed };
    }, [customSettings.approvalStatusMapping, updateApprovalStatus]);

    // אישור כל הממתינים מתוך רשימת אירועים
    const approveAllPending = useCallback(async (events) => {
        const pendingEvents = events.filter(e => e.isPending && !e.isHoliday && !e.isTemporary);
        if (pendingEvents.length === 0) return { succeeded: 0, failed: 0 };

        return approveMultiple(pendingEvents);
    }, [approveMultiple]);

    return {
        isApprovalEnabled,
        isManager,
        approveEvent,
        rejectEvent,
        approveMultiple,
        approveAllPending
    };
};

export default useApproval;
