import { useCallback, useMemo } from 'react';
import { useSettings, FIELD_MODES, DEFAULT_FIELD_CONFIG } from '../contexts/SettingsContext';
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
 * @param {Function} params.loadEvents - Load events function
 * @param {Function} params.addEvent - Add event to state
 * @param {Function} params.resolvePendingEvent - Replace skeleton with real event
 * @param {Function} params.removePendingEvent - Remove skeleton on error
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
    loadEvents,
    addEvent,
    resolvePendingEvent,
    removePendingEvent,
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
                    resolvePendingEvent,
                    removePendingEvent,
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
                    addEvent,
                    resolvePendingEvent,
                    removePendingEvent
                });
            }

            modals.closeAllDayModal();

        } catch (error) {
            logger.error('handleCreateAllDayEvent', 'Error creating all-day event', error);
        }
    }, [effectiveBoardId, context, customSettings, monday, modals, addEvent, resolvePendingEvent, removePendingEvent, showWarning, fetchEmployeeHourlyRate]);

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

    return {
        handleCreateAllDayEvent,
        handleUpdateAllDayEvent
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
    resolvePendingEvent,
    removePendingEvent,
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

    // שלב 1: חישוב מראש של start/end לכל דיווח + יצירת שלדים מיידית
    let currentStart = new Date(allDayData.date);
    currentStart.setHours(8, 0, 0, 0);

    const reportPlans = []; // { report, eventStart, eventEnd, tempId, itemName, skipped }
    const now = new Date();

    for (const report of allDayData.reports) {
        let eventStart = new Date(currentStart);
        let eventEnd;

        if (report.startTime && report.endTime) {
            const [startHours, startMinutes] = report.startTime.split(':').map(Number);
            const [endHours, endMinutes] = report.endTime.split(':').map(Number);

            eventStart.setHours(startHours, startMinutes, 0, 0);
            eventEnd = new Date(eventStart);
            eventEnd.setHours(endHours, endMinutes, 0, 0);

            if (eventEnd <= eventStart) {
                eventEnd.setDate(eventEnd.getDate() + 1);
            }
        } else {
            const durationMinutes = (parseFloat(report.hours) || 0) * 60;
            eventEnd = new Date(eventStart.getTime() + durationMinutes * 60000);
        }

        // בדיקת זמן עתידי
        if (eventStart > now) {
            showWarning(`לא ניתן לדווח שעות על זמן עתידי (${report.projectName || 'ללא פרויקט'})`);
            logger.debug('createMultipleReports', 'Skipped future report', { eventStart, now, projectName: report.projectName });
            currentStart = eventEnd;
            reportPlans.push({ report, eventStart, eventEnd, tempId: null, itemName: null, skipped: true });
            continue;
        }

        const itemName = buildItemName({ report, reporterName, customSettings }) || 'ללא שם';
        const isBillable = report.isBillable !== false;
        const typeIndex = getTimedEventIndex(isBillable, customSettings.eventTypeMapping);
        const tempId = `pending_report_${Date.now()}_${reportPlans.length}`;

        // הוספת שלד מיידית
        addEvent({
            id: tempId,
            title: itemName,
            start: new Date(eventStart),
            end: new Date(eventEnd),
            allDay: false,
            isLoading: true,
            notes: report.notes,
            projectId: report.projectId || null,
            eventType: getLabelText(typeIndex, customSettings.eventTypeLabelMeta),
            eventTypeIndex: typeIndex,
            isPending: !!customSettings.enableApproval
        });

        reportPlans.push({ report, eventStart, eventEnd, tempId, itemName, skipped: false });
        currentStart = eventEnd;
    }

    // שלב 2: קריאות API ברצף — החלפת שלדים באירועים אמיתיים
    for (const plan of reportPlans) {
        if (plan.skipped) continue;

        const { report, eventStart, eventEnd, tempId, itemName } = plan;

        const columnValues = buildReportColumnValues({
            eventStart,
            eventEnd,
            report,
            reporterId,
            hourlyRate,
            isSpecialEventType: false,
            customSettings
        });

        const columnValuesJson = JSON.stringify(columnValues);

        try {
            const createdItem = await createBoardItem(
                monday,
                effectiveBoardId,
                itemName,
                columnValuesJson
            );

            if (createdItem) {
                const isBillable = report.isBillable !== false;
                const typeIndex = getTimedEventIndex(isBillable, customSettings.eventTypeMapping);
                const newEvent = {
                    id: createdItem.id,
                    title: itemName,
                    start: eventStart,
                    end: eventEnd,
                    allDay: false,
                    notes: report.notes,
                    mondayItemId: createdItem.id,
                    projectId: report.projectId || null,
                    eventType: getLabelText(typeIndex, customSettings.eventTypeLabelMeta),
                    eventTypeIndex: typeIndex,
                    isPending: !!customSettings.enableApproval,
                    isApproved: false,
                    isApprovedBillable: false,
                    isApprovedUnbillable: false,
                    isRejected: false
                };
                resolvePendingEvent(tempId, newEvent);
            } else {
                removePendingEvent(tempId);
            }
        } catch (error) {
            removePendingEvent(tempId);
            logger.error('createMultipleReports', 'Error creating report item', { itemName, error });
            throw error;
        }
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
    addEvent,
    resolvePendingEvent,
    removePendingEvent
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

    // שלב 1: הוספת שלדים מיידית לכל הימים
    const tempIds = [];
    for (let i = 0; i < durationDays; i++) {
        const dayDate = new Date(allDayData.date);
        dayDate.setDate(dayDate.getDate() + i);
        dayDate.setHours(0, 0, 0, 0);
        const endDate = calculateEndDateFromDays(dayDate, 1);
        const tempId = `pending_allday_${Date.now()}_${i}`;
        tempIds.push(tempId);

        addEvent({
            id: tempId,
            title: itemName,
            start: new Date(dayDate),
            end: endDate,
            allDay: true,
            isLoading: true,
            eventType: eventName,
            eventTypeIndex: String(typeIndex),
            durationDays: 1,
            isPending: !!customSettings.enableApproval
        });
    }

    // שלב 2: יצירת אייטם נפרד לכל יום — החלפת השלד באירוע אמיתי
    for (let i = 0; i < durationDays; i++) {
        const dayDate = new Date(allDayData.date);
        dayDate.setDate(dayDate.getDate() + i);
        dayDate.setHours(0, 0, 0, 0);
        const dayDateStr = toLocalDateFormat(dayDate);

        const columnValues = {};
        // לאירועים יומיים - תאריך בלבד ללא שעה
        columnValues[customSettings.dateColumnId] = {
            date: dayDateStr
        };

        // משך תמיד 1 יום לכל אייטם
        if (customSettings.durationColumnId) {
            columnValues[customSettings.durationColumnId] = formatDurationForSave(1, typeIndex, customSettings.eventTypeMapping);
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

        try {
            const createdItem = await createBoardItem(
                monday,
                effectiveBoardId,
                itemName,
                columnValuesJson
            );

            if (createdItem) {
                const endDate = calculateEndDateFromDays(dayDate, 1);

                const newEvent = {
                    id: createdItem.id,
                    title: itemName,
                    start: new Date(dayDate),
                    end: endDate,
                    allDay: true,
                    mondayItemId: createdItem.id,
                    eventType: eventName,
                    eventTypeIndex: String(typeIndex),
                    durationDays: 1,
                    isPending: !!customSettings.enableApproval,
                    isApproved: false,
                    isRejected: false
                };
                resolvePendingEvent(tempIds[i], newEvent);
            } else {
                removePendingEvent(tempIds[i]);
            }
        } catch (error) {
            removePendingEvent(tempIds[i]);
            logger.error('createSingleAllDayEvent', 'Error creating day item', { day: i, error });
            throw error;
        }
    }

    logger.functionEnd('createSingleAllDayEvent', { type: allDayData.type, durationDays, itemsCreated: durationDays });
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

    // עמודת זמן סיום (אם מוגדרת)
    if (customSettings.endTimeColumnId) {
        columnValues[customSettings.endTimeColumnId] = {
            date: toLocalDateFormat(eventEnd),
            time: `${toLocalTimeFormat(eventEnd)}:00`
        };
    }

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

    // הוספת קישור להקצאה
    if (report.assignmentId && customSettings.assignmentColumnId) {
        columnValues[customSettings.assignmentColumnId] = {
            item_ids: [parseInt(report.assignmentId)]
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
    const fieldConfig = customSettings.fieldConfig || DEFAULT_FIELD_CONFIG;

    if (isBillableReport) {
        // בניית שם לפי שדות פעילים ב-fieldConfig
        if (fieldConfig.task !== FIELD_MODES.HIDDEN && report.taskName) {
            const taskName = report.taskName || 'ללא משימה';
            return projectName ? `${projectName} - ${taskName}` : taskName;
        } else if (fieldConfig.stage !== FIELD_MODES.HIDDEN && report.stageId) {
            const projectDisplay = projectName || 'ללא פרויקט';
            const stageLabel = report.stageId || '';
            return stageLabel ? `${projectDisplay} - ${stageLabel}` : projectDisplay;
        } else {
            return projectName || 'ללא פרויקט';
        }
    } else {
        const nonBillableLabel = report.nonBillableType || 'לא לחיוב';
        return `${nonBillableLabel} - ${reporterName}`;
    }
}

export default useAllDayEvents;
