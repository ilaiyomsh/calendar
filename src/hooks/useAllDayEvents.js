import { useCallback, useMemo } from 'react';
import { useSettings, STRUCTURE_MODES } from '../contexts/SettingsContext';
import { createBoardItem, fetchCurrentUser } from '../utils/mondayApi';
import { calculateEndDateFromDays, formatDurationForSave } from '../utils/durationUtils';
import { toLocalDateFormat, toLocalTimeFormat } from '../utils/dateFormatters';
import { getEffectiveBoardId } from '../utils/boardIdResolver';
import { getTimedEventIndex, getLabelText } from '../utils/eventTypeMapping';
import { getPendingIndex } from '../utils/approvalMapping';
import logger from '../utils/logger';

/**
 * Hook לניהול אירועים יומיים (חופשה/מחלה/מילואים ודיווחים מרובים)
 * @param {Object} params - פרמטרים
 * @param {Object} params.monday - Monday SDK instance
 * @param {Object} params.context - Monday context
 * @param {Object} params.modals - Modal state from useEventModals
 * @param {Function} params.showSuccess - Toast success
 * @param {Function} params.showError - Toast error
 * @param {Function} params.showWarning - Toast warning
 * @param {Function} params.showErrorWithDetails - Toast error with details
 * @param {Function} params.deleteEvent - Delete event function
 * @param {Function} params.loadEvents - Load events function
 * @param {Function} params.addEvent - Add event to state
 * @param {Function} params.fetchEmployeeHourlyRate - Fetch hourly rate
 * @param {Object} params.currentViewRange - Current view date range
 * @returns {Object} All-day event handlers
 */
export const useAllDayEvents = ({
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
}) => {
    const { customSettings } = useSettings();

    // חישוב לוח דיווחים אפקטיבי
    const effectiveBoardId = useMemo(() =>
        getEffectiveBoardId(customSettings, context),
        [customSettings, context]
    );

    /**
     * יצירת אירוע יומי (מחלה/חופשה/מילואים) או דיווחים מרובים
     */
    const handleCreateAllDayEvent = useCallback(async (allDayData) => {
        logger.functionStart('handleCreateAllDayEvent', { type: allDayData.type, date: allDayData.date });

        if (!effectiveBoardId || !customSettings.dateColumnId) {
            logger.error('handleCreateAllDayEvent', 'Missing board ID or date column ID');
            return;
        }

        try {
            const dateStr = toLocalDateFormat(allDayData.date);

            // שליפת שם המשתמש
            const currentUser = await fetchCurrentUser(monday);
            const reporterName = currentUser?.name || 'לא ידוע';
            const reporterId = context?.user?.id || null;

            if (allDayData.type === 'reports') {
                await createMultipleReports({
                    allDayData,
                    reporterName,
                    reporterId,
                    customSettings,
                    monday,
                    effectiveBoardId,
                    addEvent,
                    showWarning,
                    fetchEmployeeHourlyRate
                });
            } else {
                await createSingleAllDayEvent({
                    allDayData,
                    dateStr,
                    reporterName,
                    reporterId,
                    customSettings,
                    monday,
                    effectiveBoardId,
                    addEvent
                });
            }

            modals.closeAllDayModal();

        } catch (error) {
            logger.error('handleCreateAllDayEvent', 'Error creating all-day event', error);
        }
    }, [effectiveBoardId, context, customSettings, monday, modals, addEvent, showWarning, fetchEmployeeHourlyRate]);

    /**
     * עדכון אירוע יומי (שינוי סוג)
     */
    const handleUpdateAllDayEvent = useCallback(async (newType) => {
        const allDayEventToEdit = modals.allDayModal.eventToEdit;
        if (!allDayEventToEdit || !allDayEventToEdit.mondayItemId) {
            logger.error('handleUpdateAllDayEvent', 'Missing event ID for update');
            showError('שגיאה: לא נמצא מזהה אירוע לעדכון');
            return;
        }

        try {
            // newType הוא כעת אינדקס הלייבל
            const typeIndex = newType;
            const typeName = getLabelText(typeIndex, customSettings.eventTypeLabelMeta);
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

            // הוספת סטטוס לפי אינדקס
            if (customSettings.eventTypeStatusColumnId && typeIndex != null) {
                columnValues[customSettings.eventTypeStatusColumnId] = {
                    index: parseInt(typeIndex, 10)
                };
            }

            // עדכון שם האייטם בנפרד
            const updateMutation = `mutation {
                change_simple_column_value(
                    item_id: ${allDayEventToEdit.mondayItemId},
                    board_id: ${effectiveBoardId},
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
                        board_id: ${effectiveBoardId},
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
            modals.closeAllDayModal();
        } catch (error) {
            showErrorWithDetails(error, { functionName: 'handleUpdateAllDayEvent' });
            logger.error('useAllDayEvents', 'Error in handleUpdateAllDayEvent', error);
        }
    }, [effectiveBoardId, customSettings, monday, modals, showSuccess, showError, showErrorWithDetails, loadEvents, currentViewRange]);

    /**
     * מחיקת אירוע יומי
     */
    const handleDeleteAllDayEvent = useCallback(async () => {
        const allDayEventToEdit = modals.allDayModal.eventToEdit;
        if (!allDayEventToEdit || !allDayEventToEdit.mondayItemId) {
            logger.error('handleDeleteAllDayEvent', 'Missing event ID for deletion');
            showError('שגיאה: לא נמצא מזהה אירוע למחיקה');
            return;
        }

        try {
            await deleteEvent(allDayEventToEdit.id);
            showSuccess('האירוע נמחק בהצלחה');
            modals.closeAllDayModal();
        } catch (error) {
            showErrorWithDetails(error, { functionName: 'handleDeleteAllDayEvent' });
            logger.error('useAllDayEvents', 'Error in handleDeleteAllDayEvent', error);
        }
    }, [modals, deleteEvent, showSuccess, showError, showErrorWithDetails]);

    return {
        handleCreateAllDayEvent,
        handleUpdateAllDayEvent,
        handleDeleteAllDayEvent
    };
};

// --- Helper functions ---

/**
 * יצירת דיווחים מרובים (reports)
 */
async function createMultipleReports({
    allDayData,
    reporterName,
    reporterId,
    customSettings,
    monday,
    effectiveBoardId,
    addEvent,
    showWarning,
    fetchEmployeeHourlyRate
}) {
    // שליפת מחיר לשעה אם הפיצ'ר פעיל
    let hourlyRate = null;
    if (customSettings.useEmployeeCost && reporterId && customSettings.totalCostColumnId) {
        logger.debug('createMultipleReports', 'Fetching hourly rate', { reporterId });
        hourlyRate = await fetchEmployeeHourlyRate(reporterId);
        logger.debug('createMultipleReports', 'Hourly rate result', { hourlyRate });
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
            const durationMinutes = (parseFloat(report.hours) || 0) * 60;
            eventEnd = new Date(eventStart.getTime() + durationMinutes * 60000);
        }

        // בדיקה אם זמן ההתחלה הוא בעתיד - דיווחים מרובים הם תמיד אירועים שעתיים
        const isSpecialEventType = false;
        const now = new Date();
        if (!isSpecialEventType && eventStart > now) {
            showWarning(`לא ניתן לדווח שעות על זמן עתידי (${report.projectName || 'ללא פרויקט'})`);
            logger.debug('createMultipleReports', 'Skipped future report', { eventStart, now, projectName: report.projectName });
            continue;
        }

        // בניית column values
        const columnValues = buildReportColumnValues({
            eventStart,
            eventEnd,
            report,
            reporterId,
            hourlyRate,
            isSpecialEventType,
            customSettings
        });

        const columnValuesJson = JSON.stringify(columnValues);

        // קביעת שם האייטם
        const itemName = buildItemName({
            report,
            reporterName,
            customSettings
        }) || 'ללא שם';

        // יצירת אירוע
        const createdItem = await createBoardItem(
            monday,
            effectiveBoardId,
            itemName,
            columnValuesJson
        );

        if (createdItem) {
            const newEvent = {
                id: createdItem.id,
                title: itemName,
                start: eventStart,
                end: eventEnd,
                allDay: isSpecialEventType,
                notes: report.notes,
                mondayItemId: createdItem.id,
                isPending: !!customSettings.enableApproval,
                isApproved: false,
                isRejected: false
            };
            addEvent(newEvent);
        }

        currentStart = eventEnd;
    }

    logger.functionEnd('createMultipleReports', { type: 'reports', count: allDayData.reports.length });
}

/**
 * יצירת אירוע יומי בודד (מחלה/חופשה/מילואים)
 */
async function createSingleAllDayEvent({
    allDayData,
    dateStr,
    reporterName,
    reporterId,
    customSettings,
    monday,
    effectiveBoardId,
    addEvent
}) {
    // allDayData.type הוא כעת אינדקס הלייבל
    const typeIndex = allDayData.type;
    const eventName = getLabelText(typeIndex, customSettings.eventTypeLabelMeta);
    if (!eventName) {
        logger.error('createSingleAllDayEvent', 'Missing label text for type index', { typeIndex });
        return;
    }
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
        columnValues[customSettings.durationColumnId] = formatDurationForSave(durationDays, typeIndex, customSettings.eventTypeMapping);
    }

    if (customSettings.reporterColumnId && reporterId) {
        columnValues[customSettings.reporterColumnId] = {
            personsAndTeams: [
                { id: parseInt(reporterId), kind: "person" }
            ]
        };
    }

    if (customSettings.eventTypeStatusColumnId && typeIndex != null) {
        columnValues[customSettings.eventTypeStatusColumnId] = {
            index: parseInt(typeIndex, 10)
        };
    }

    // סטטוס אישור - כתיבת "ממתין" ביצירת אירוע חדש
    if (customSettings.enableApproval && customSettings.approvalStatusColumnId) {
        const pendingIdx = getPendingIndex(customSettings.approvalStatusMapping);
        if (pendingIdx != null) {
            columnValues[customSettings.approvalStatusColumnId] = {
                index: parseInt(pendingIdx)
            };
        }
    }

    const columnValuesJson = JSON.stringify(columnValues);

    const createdItem = await createBoardItem(
        monday,
        effectiveBoardId,
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
            title: itemName,
            start: eventDate,
            end: endDate,
            allDay: true,
            mondayItemId: createdItem.id,
            eventType: eventName,
            eventTypeIndex: String(typeIndex),
            durationDays: durationDays,
            isPending: !!customSettings.enableApproval,
            isApproved: false,
            isRejected: false
        };
        addEvent(newEvent);
        logger.functionEnd('createSingleAllDayEvent', { type: allDayData.type, eventId: createdItem.id, durationDays });
    }
}

/**
 * בניית column values לדיווח
 */
function buildReportColumnValues({
    eventStart,
    eventEnd,
    report,
    reporterId,
    hourlyRate,
    isSpecialEventType,
    customSettings
}) {
    const columnValues = {};

    columnValues[customSettings.dateColumnId] = {
        date: toLocalDateFormat(eventStart),
        time: `${toLocalTimeFormat(eventStart)}:00`
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

    // הוספת פרויקט
    if (report.projectId && customSettings.projectColumnId) {
        columnValues[customSettings.projectColumnId] = {
            item_ids: [parseInt(report.projectId)]
        };
    }

    // הוספת הערות
    if (report.notes && customSettings.notesColumnId) {
        columnValues[customSettings.notesColumnId] = report.notes;
    }

    // הוספת משימה
    if (report.taskId && customSettings.taskColumnId) {
        columnValues[customSettings.taskColumnId] = {
            item_ids: [parseInt(report.taskId)]
        };
    }

    // הוספת מדווח
    if (customSettings.reporterColumnId && reporterId) {
        columnValues[customSettings.reporterColumnId] = {
            personsAndTeams: [
                { id: parseInt(reporterId), kind: "person" }
            ]
        };
    }

    // הוספת סטטוס לפי אינדקס
    if (customSettings.eventTypeStatusColumnId) {
        const isBillable = report.isBillable !== false;
        const typeIndex = getTimedEventIndex(isBillable, customSettings.eventTypeMapping);

        if (typeIndex != null) {
            columnValues[customSettings.eventTypeStatusColumnId] = {
                index: parseInt(typeIndex, 10)
            };
        }

        // אם זה לא לחיוב
        if (!isBillable && report.nonBillableType && customSettings.nonBillableStatusColumnId) {
            columnValues[customSettings.nonBillableStatusColumnId] = {
                label: report.nonBillableType
            };
        }
    }

    // הוספת שלב
    if (report.stageId && customSettings.stageColumnId) {
        columnValues[customSettings.stageColumnId] = {
            label: report.stageId
        };
    }

    // סטטוס אישור - כתיבת "ממתין" ביצירת דיווח חדש
    if (customSettings.enableApproval && customSettings.approvalStatusColumnId) {
        const pendingIdx = getPendingIndex(customSettings.approvalStatusMapping);
        if (pendingIdx != null) {
            columnValues[customSettings.approvalStatusColumnId] = {
                index: parseInt(pendingIdx)
            };
        }
    }

    return columnValues;
}

/**
 * בניית שם האייטם לפי מבנה הדיווח
 */
function buildItemName({ report, reporterName, customSettings }) {
    const projectName = report.projectName;
    const isBillableReport = report.isBillable !== false;
    const { structureMode } = customSettings;

    if (isBillableReport) {
        if (structureMode === STRUCTURE_MODES.PROJECT_ONLY) {
            return projectName || 'ללא פרויקט';
        } else if (structureMode === STRUCTURE_MODES.PROJECT_WITH_STAGE) {
            const projectDisplay = projectName || 'ללא פרויקט';
            const stageLabel = report.stageId || '';
            return stageLabel ? `${projectDisplay} - ${stageLabel}` : projectDisplay;
        } else if (structureMode === STRUCTURE_MODES.PROJECT_WITH_TASKS) {
            const taskName = report.taskName || 'ללא משימה';
            return projectName ? `${projectName} - ${taskName}` : taskName;
        } else {
            return projectName || 'ללא פרויקט';
        }
    } else {
        const nonBillableLabel = report.nonBillableType || 'לא לחיוב';
        return `${nonBillableLabel} - ${reporterName}`;
    }
}

export default useAllDayEvents;
