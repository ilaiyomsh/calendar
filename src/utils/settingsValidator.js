/**
 * Settings Validator - אימות הגדרות בעת עליית האפליקציה
 * בודק שכל ההגדרות מולאו ושכל העמודות קיימות בלוחות הרלוונטיים
 */

import logger from './logger';
import { STRUCTURE_MODES } from '../contexts/SettingsContext';

/**
 * בדיקה אם עמודות קיימות בלוח
 * @param {object} monday - Monday SDK instance
 * @param {string} boardId - מזהה הלוח
 * @param {string[]} columnIds - רשימת מזהי עמודות לבדיקה
 * @returns {Promise<{valid: boolean, missingColumns: string[]}>}
 */
async function checkColumnsExist(monday, boardId, columnIds) {
    if (!boardId || !columnIds || columnIds.length === 0) {
        return { valid: true, missingColumns: [] };
    }

    try {
        const query = `query {
            boards(ids: [${boardId}]) {
                columns {
                    id
                    title
                }
            }
        }`;

        const response = await monday.api(query);
        const board = response?.data?.boards?.[0];
        
        if (!board) {
            logger.warn('settingsValidator', `Board not found: ${boardId}`);
            return { valid: false, missingColumns: columnIds, boardNotFound: true };
        }

        const existingColumnIds = board.columns.map(col => col.id);
        const missingColumns = columnIds.filter(colId => colId && !existingColumnIds.includes(colId));

        return {
            valid: missingColumns.length === 0,
            missingColumns,
            existingColumns: board.columns
        };
    } catch (error) {
        logger.error('settingsValidator', 'Error checking columns', error);
        return { valid: false, missingColumns: columnIds, error };
    }
}

/**
 * בדיקה אם לוח קיים
 * @param {object} monday - Monday SDK instance
 * @param {string} boardId - מזהה הלוח
 * @returns {Promise<{valid: boolean, boardName?: string}>}
 */
async function checkBoardExists(monday, boardId) {
    if (!boardId) {
        return { valid: true };
    }

    try {
        const query = `query {
            boards(ids: [${boardId}]) {
                id
                name
            }
        }`;

        const response = await monday.api(query);
        const board = response?.data?.boards?.[0];

        return {
            valid: !!board,
            boardName: board?.name
        };
    } catch (error) {
        logger.error('settingsValidator', 'Error checking board', error);
        return { valid: false, error };
    }
}

/**
 * מחזיר את ההגדרות הנדרשות לפי מצב המבנה והאם משתמשים במצב Assignments
 * @param {string} structureMode - מצב מבנה הדיווח
 * @param {boolean} useAssignmentsMode - האם מצב Assignments מופעל
 * @returns {object} - רשימת ההגדרות הנדרשות
 */
function getRequiredSettings(structureMode, useAssignmentsMode = false) {
    // הגדרות בסיסיות שתמיד נדרשות
    const required = {
        boards: [], // לוחות מחוברים
        currentBoardColumns: ['dateColumnId', 'endTimeColumnId', 'durationColumnId', 'projectColumnId', 'reporterColumnId'],
        optional: ['eventTypeStatusColumnId', 'notesColumnId', 'nonBillableStatusColumnId']
    };

    // לוח פרויקטים נדרש רק אם לא במצב Assignments
    if (!useAssignmentsMode) {
        required.boards.push('connectedBoardId');
    }

    // הגדרות נדרשות לפי מצב מבנה
    switch (structureMode) {
        case STRUCTURE_MODES.PROJECT_WITH_TASKS:
            required.boards.push('tasksBoardId');
            required.currentBoardColumns.push('taskColumnId');
            required.connectedBoardColumns = ['tasksProjectColumnId'];
            break;

        case STRUCTURE_MODES.PROJECT_WITH_STAGE:
            required.currentBoardColumns.push('stageColumnId');
            break;

        case STRUCTURE_MODES.PROJECT_ONLY:
        default:
            // רק הגדרות בסיסיות
            break;
    }

    return required;
}

/**
 * מבצע אימות מלא של ההגדרות
 * @param {object} monday - Monday SDK instance
 * @param {object} customSettings - ההגדרות המותאמות
 * @param {string} currentBoardId - מזהה הלוח הנוכחי
 * @returns {Promise<object>} - תוצאת האימות
 */
export async function validateSettings(monday, customSettings, currentBoardId) {
    logger.functionStart('validateSettings', {
        structureMode: customSettings?.structureMode,
        useAssignmentsMode: customSettings?.useAssignmentsMode
    });

    const result = {
        isValid: true,
        errors: [],
        warnings: [],
        missingSettings: [],
        missingColumns: [],
        missingBoards: []
    };

    if (!customSettings) {
        result.isValid = false;
        result.errors.push('לא נמצאו הגדרות מותאמות');
        return result;
    }

    const requiredSettings = getRequiredSettings(
        customSettings.structureMode,
        customSettings.useAssignmentsMode
    );

    // === בדיקת הגדרות חסרות ===
    
    // בדיקת לוחות מחוברים
    for (const boardSetting of requiredSettings.boards) {
        if (!customSettings[boardSetting]) {
            result.missingSettings.push({
                key: boardSetting,
                label: getBoardSettingLabel(boardSetting)
            });
        }
    }

    // בדיקת עמודות בלוח הנוכחי
    for (const columnSetting of requiredSettings.currentBoardColumns) {
        if (!customSettings[columnSetting]) {
            result.missingSettings.push({
                key: columnSetting,
                label: getColumnSettingLabel(columnSetting)
            });
        }
    }

    // אם יש הגדרות חסרות, סימון שהאימות נכשל
    if (result.missingSettings.length > 0) {
        result.isValid = false;
        result.errors.push(`חסרות ${result.missingSettings.length} הגדרות נדרשות`);
    }

    // === בדיקה שהלוחות קיימים ===

    // בדיקת לוח פרויקטים
    if (customSettings.connectedBoardId) {
        const projectsBoardCheck = await checkBoardExists(monday, customSettings.connectedBoardId);
        if (!projectsBoardCheck.valid) {
            result.isValid = false;
            result.missingBoards.push({
                key: 'connectedBoardId',
                label: 'לוח פרויקטים',
                boardId: customSettings.connectedBoardId
            });
            result.errors.push('לוח הפרויקטים שהוגדר לא נמצא');
        }
    }

    // בדיקת לוח משימות (אם רלוונטי)
    if (customSettings.tasksBoardId && 
        customSettings.structureMode === STRUCTURE_MODES.PROJECT_WITH_TASKS) {
        const tasksBoardCheck = await checkBoardExists(monday, customSettings.tasksBoardId);
        if (!tasksBoardCheck.valid) {
            result.isValid = false;
            result.missingBoards.push({
                key: 'tasksBoardId',
                label: 'לוח משימות',
                boardId: customSettings.tasksBoardId
            });
            result.errors.push('לוח המשימות שהוגדר לא נמצא');
        }
    }

    // === בדיקה שהעמודות קיימות בלוח הנוכחי ===
    
    if (currentBoardId) {
        const columnsToCheck = [];
        
        // איסוף כל העמודות שהוגדרו
        const columnSettings = [
            'dateColumnId', 'endTimeColumnId', 'durationColumnId', 'projectColumnId',
            'taskColumnId', 'reporterColumnId', 'eventTypeStatusColumnId',
            'nonBillableStatusColumnId', 'stageColumnId', 'notesColumnId'
        ];

        for (const setting of columnSettings) {
            if (customSettings[setting]) {
                columnsToCheck.push(customSettings[setting]);
            }
        }

        if (columnsToCheck.length > 0) {
            const columnsCheck = await checkColumnsExist(monday, currentBoardId, columnsToCheck);
            
            if (!columnsCheck.valid) {
                if (columnsCheck.boardNotFound) {
                    result.isValid = false;
                    result.errors.push('הלוח הנוכחי לא נמצא');
                } else if (columnsCheck.missingColumns.length > 0) {
                    result.isValid = false;
                    
                    // מיפוי העמודות החסרות לשמות מובנים
                    for (const missingColId of columnsCheck.missingColumns) {
                        const settingKey = columnSettings.find(key => customSettings[key] === missingColId);
                        result.missingColumns.push({
                            columnId: missingColId,
                            settingKey,
                            label: getColumnSettingLabel(settingKey)
                        });
                    }
                    
                    result.errors.push(`נמצאו ${columnsCheck.missingColumns.length} עמודות חסרות בלוח`);
                }
            }
        }
    }

    // === אזהרות על הגדרות אופציונליות ===
    
    if (!customSettings.eventTypeStatusColumnId) {
        result.warnings.push('מומלץ להגדיר עמודת סוג דיווח לסינון אירועים');
    } else if (!customSettings.eventTypeMapping) {
        result.warnings.push('עמודת סוג דיווח נבחרה אך לא הוגדר מיפוי סוגי דיווח');
    }

    if (customSettings.enableNotes && !customSettings.notesColumnId) {
        result.warnings.push('אפשרות מלל חופשי מופעלת אך לא הוגדרה עמודה');
    }

    logger.functionEnd('validateSettings', { 
        isValid: result.isValid, 
        errorsCount: result.errors.length,
        warningsCount: result.warnings.length
    });

    return result;
}

/**
 * מחזיר תווית לשדה לוח
 */
function getBoardSettingLabel(key) {
    const labels = {
        connectedBoardId: 'לוח פרויקטים',
        tasksBoardId: 'לוח משימות'
    };
    return labels[key] || key;
}

/**
 * מחזיר תווית לשדה עמודה
 */
function getColumnSettingLabel(key) {
    const labels = {
        dateColumnId: 'עמודת תאריך התחלה',
        endTimeColumnId: 'עמודת תאריך סיום',
        durationColumnId: 'עמודת משך זמן',
        projectColumnId: 'עמודת פרויקט',
        taskColumnId: 'עמודת משימה',
        reporterColumnId: 'עמודת מדווח',
        eventTypeStatusColumnId: 'עמודת סוג דיווח',
        nonBillableStatusColumnId: 'עמודת לא לחיוב',
        stageColumnId: 'עמודת סיווג',
        notesColumnId: 'עמודת הערות',
        tasksProjectColumnId: 'עמודת קישור פרויקט-משימות'
    };
    return labels[key] || key;
}

/**
 * פורמט תוצאת האימות להודעה למשתמש
 */
export function formatValidationMessage(validationResult) {
    if (validationResult.isValid) {
        return null;
    }

    const lines = [];
    
    if (validationResult.missingSettings.length > 0) {
        lines.push('הגדרות חסרות:');
        validationResult.missingSettings.forEach(s => {
            lines.push(`  • ${s.label}`);
        });
    }

    if (validationResult.missingBoards.length > 0) {
        lines.push('לוחות לא נמצאו:');
        validationResult.missingBoards.forEach(b => {
            lines.push(`  • ${b.label}`);
        });
    }

    if (validationResult.missingColumns.length > 0) {
        lines.push('עמודות לא נמצאו בלוח:');
        validationResult.missingColumns.forEach(c => {
            lines.push(`  • ${c.label}`);
        });
    }

    return lines.join('\n');
}

export default {
    validateSettings,
    formatValidationMessage
};
