import { useCallback, useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { fetchItemById, fetchColumnSettings, fetchProjectById } from '../utils/mondayApi';
import { getEffectiveBoardId } from '../utils/boardIdResolver';
import { isBillableIndex } from '../utils/eventTypeMapping';
import { isPendingIndex, isApprovedIndex, isRejectedIndex } from '../utils/approvalMapping';
import logger from '../utils/logger';

/**
 * Hook לטעינת נתוני אירוע לעריכה
 * מחלץ את כל המידע הנדרש מה-item ב-Monday לצורך עריכה
 * @param {Object} params - פרמטרים
 * @param {Object} params.monday - Monday SDK instance
 * @param {Object} params.context - Monday context
 * @param {Object} params.settings - Monday settings
 * @param {Object} params.modals - Modal state from useEventModals
 * @returns {Object} loadEventDataForEdit function
 */
export const useEventDataLoader = ({
    monday,
    context,
    settings,
    modals
}) => {
    const { customSettings } = useSettings();

    // חישוב לוח דיווחים אפקטיבי
    const effectiveBoardId = useMemo(() =>
        getEffectiveBoardId(customSettings, context),
        [customSettings, context]
    );

    /**
     * טעינת נתוני אירוע לעריכה
     * @param {Object} event - האירוע לטעינה
     */
    const loadEventDataForEdit = useCallback(async (event) => {
        if (!effectiveBoardId || !event?.mondayItemId) return;

        try {
            logger.functionStart('loadEventDataForEdit', { eventId: event.mondayItemId });
            modals.setIsLoadingEventData(true);

            // שימוש ב-query ממוקד לפי ID
            const item = await fetchItemById(monday, effectiveBoardId, event.mondayItemId);

            if (!item) {
                logger.warn('loadEventDataForEdit', `Item not found: ${event.mondayItemId}`);
                return;
            }

            const updatedEvent = { ...event };

            // חילוץ פרויקט
            await extractProjectData(updatedEvent, item, customSettings, settings, effectiveBoardId, monday, modals);

            // חילוץ משימה
            extractTaskData(updatedEvent, item, customSettings);

            // חילוץ הערות
            extractNotesData(updatedEvent, item, customSettings);

            // חילוץ שלב
            extractStageData(updatedEvent, item, customSettings);

            // חילוץ נתוני לחיוב / לא לחיוב
            extractBillingData(updatedEvent, item, customSettings);

            // חילוץ נתוני אישור מנהל
            extractApprovalData(updatedEvent, item, customSettings);

            modals.setEventToEdit(updatedEvent);
            logger.functionEnd('loadEventDataForEdit', { eventId: event.mondayItemId });
        } catch (error) {
            logger.error('loadEventDataForEdit', 'Error loading event data for edit', error);
        } finally {
            modals.setIsLoadingEventData(false);
        }
    }, [effectiveBoardId, customSettings, monday, settings, modals]);

    return { loadEventDataForEdit };
};

// --- Helper functions ---

/**
 * חילוץ נתוני פרויקט מהאירוע
 */
async function extractProjectData(updatedEvent, item, customSettings, settings, effectiveBoardId, monday, modals) {
    if (!customSettings.projectColumnId) return;

    const projectColumn = item.column_values.find(col => col.id === customSettings.projectColumnId);
    if (!projectColumn) return;

    // שימוש ב-linked_items במקום value (עובד גם כש-value הוא null)
    if (projectColumn.linked_items && projectColumn.linked_items.length > 0) {
        const linkedItem = projectColumn.linked_items[0];
        updatedEvent.projectId = linkedItem.id;

        // שימוש ישיר בנתונים מ-linked_items
        modals.setSelectedItem({ id: linkedItem.id, name: linkedItem.name });
        logger.debug('extractProjectData', `Found project from linked_items: ${linkedItem.name} (${linkedItem.id})`);
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
                if (settings?.perent_item_board && effectiveBoardId) {
                    try {
                        const columnId = Object.keys(settings.perent_item_board)[0];
                        if (columnId) {
                            const columnSettings = await fetchColumnSettings(monday, effectiveBoardId, columnId);

                            if (columnSettings?.boardIds && columnSettings.boardIds.length > 0) {
                                const boardId = columnSettings.boardIds[0];
                                const project = await fetchProjectById(monday, boardId, projectId);

                                if (project) {
                                    modals.setSelectedItem({ id: project.id, name: project.name });
                                }
                            }
                        }
                    } catch (err) {
                        logger.error('extractProjectData', 'Error loading project', err);
                    }
                }
            }
        } catch (err) {
            logger.error('extractProjectData', 'Error parsing project column value', err);
        }
    }
}

/**
 * חילוץ נתוני משימה מהאירוע
 */
function extractTaskData(updatedEvent, item, customSettings) {
    if (!customSettings.taskColumnId) return;

    const taskColumn = item.column_values.find(col => col.id === customSettings.taskColumnId);
    if (!taskColumn) return;

    // שימוש ב-linked_items במקום value
    if (taskColumn.linked_items && taskColumn.linked_items.length > 0) {
        const linkedItem = taskColumn.linked_items[0];
        updatedEvent.taskId = linkedItem.id;
        // שמירת נתוני המשימה הנבחרת להצגה מידית
        updatedEvent.selectedTaskData = { id: linkedItem.id, name: linkedItem.name };
        logger.debug('extractTaskData', `Found task from linked_items: ${linkedItem.name} (${linkedItem.id})`);
    } else if (taskColumn?.value) {
        // Fallback למקרה הישן
        try {
            const parsedValue = typeof taskColumn.value === 'string'
                ? JSON.parse(taskColumn.value)
                : taskColumn.value;

            if (parsedValue?.item_ids && parsedValue.item_ids.length > 0) {
                updatedEvent.taskId = parsedValue.item_ids[0].toString();
            }
        } catch (err) {
            logger.error('extractTaskData', 'Error parsing task column value', err);
        }
    }
}

/**
 * חילוץ הערות מהאירוע
 */
function extractNotesData(updatedEvent, item, customSettings) {
    if (!customSettings.notesColumnId) return;

    const notesColumn = item.column_values.find(col => col.id === customSettings.notesColumnId);
    if (notesColumn?.text) {
        updatedEvent.notes = notesColumn.text;
    } else if (notesColumn?.value) {
        // אם אין text, ננסה value
        updatedEvent.notes = notesColumn.value;
    }
}

/**
 * חילוץ שלב מהאירוע
 */
function extractStageData(updatedEvent, item, customSettings) {
    if (!customSettings.stageColumnId) return;

    const stageColumn = item.column_values.find(col => col.id === customSettings.stageColumnId);
    if (!stageColumn) return;

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

/**
 * חילוץ נתוני לחיוב/לא לחיוב מהאירוע
 */
function extractBillingData(updatedEvent, item, customSettings) {
    if (customSettings.eventTypeStatusColumnId) {
        const typeColumn = item.column_values.find(col => col.id === customSettings.eventTypeStatusColumnId);
        const typeIndex = typeColumn?.index ?? null;
        // בדיקה מבוססת אינדקס: isBillable = האינדקס שייך לקטגוריית billable
        updatedEvent.isBillable = isBillableIndex(typeIndex, customSettings.eventTypeMapping);
    }

    if (customSettings.nonBillableStatusColumnId) {
        const nonBillableColumn = item.column_values.find(col => col.id === customSettings.nonBillableStatusColumnId);
        if (nonBillableColumn) {
            updatedEvent.nonBillableType = nonBillableColumn.text || nonBillableColumn.label || "";
        }
    }
}

/**
 * חילוץ נתוני אישור מנהל מהאירוע
 */
function extractApprovalData(updatedEvent, item, customSettings) {
    if (customSettings.enableApproval && customSettings.approvalStatusColumnId) {
        const approvalCol = item.column_values.find(col => col.id === customSettings.approvalStatusColumnId);
        const approvalIdx = approvalCol?.index ?? null;
        updatedEvent.approvalStatusIndex = approvalIdx;
        updatedEvent.isPending = isPendingIndex(approvalIdx, customSettings.approvalStatusMapping);
        updatedEvent.isApproved = isApprovedIndex(approvalIdx, customSettings.approvalStatusMapping);
        updatedEvent.isRejected = isRejectedIndex(approvalIdx, customSettings.approvalStatusMapping);
    }
}

export default useEventDataLoader;
