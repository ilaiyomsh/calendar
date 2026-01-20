/**
 * פונקציות עזר לולידציה של עמודת סוג אירוע (Event Type Status Column)
 * מוודא שהעמודה מכילה את כל הלייבלים הנדרשים לתפקוד תקין של האפליקציה
 */

import logger from './logger';

// === קבועים ===

/**
 * רשימת הלייבלים הנדרשים לעמודת סוג אירוע
 * כל לייבל חייב להיות קיים בעמודה כדי שהאפליקציה תעבוד נכון
 */
export const REQUIRED_EVENT_TYPE_LABELS = ['חופשה', 'מחלה', 'מילואים', 'שעתי', 'לא לחיוב'];

/**
 * שם ברירת המחדל לעמודה חדשה
 */
export const EVENT_TYPE_COLUMN_NAME = 'סוג דיווח';

/**
 * מיפוי צבעים לכל לייבל (צבעי Monday הרשמיים)
 * מותאם לצבעים ב-colorUtils.js
 */
export const EVENT_TYPE_LABEL_COLORS = {
    'חופשה': 'working_orange',  // #fdab3d - כתום
    'מחלה': 'stuck_red',        // #e2445c - אדום
    'מילואים': 'grass_green',   // #037f4c - ירוק כהה
    'שעתי': 'dark_blue',        // #0086c0 - כחול כהה
    'לא לחיוב': 'sunset'        // #ff7575 - sunset
};

// === פונקציות עזר ===

/**
 * מפרסר את הלייבלים מה-settings של עמודת Status
 * @param {Object|string} settings - ה-settings של העמודה (יכול להיות אובייקט או מחרוזת JSON)
 * @returns {Array<{label: string, color: string, index: number, id: number}>} - מערך הלייבלים
 */
export const parseStatusColumnLabels = (settings) => {
    try {
        // אם settings הוא מחרוזת, ננסה לפרסר אותו
        const settingsObj = typeof settings === 'string' ? JSON.parse(settings) : settings;
        
        if (!settingsObj || !settingsObj.labels) {
            logger.warn('parseStatusColumnLabels', 'No labels found in settings');
            return [];
        }
        
        // אם labels הוא מערך - נחזיר אותו
        if (Array.isArray(settingsObj.labels)) {
            return settingsObj.labels.map(label => ({
                label: label.label || '',
                color: label.color || '',
                index: label.index ?? 0,
                id: label.id ?? 0,
                is_deactivated: label.is_deactivated || false
            })).filter(label => !label.is_deactivated); // סינון לייבלים מושבתים
        }
        
        // אם labels הוא אובייקט (מבנה ישן של Monday) - נמיר אותו למערך
        if (typeof settingsObj.labels === 'object') {
            return Object.entries(settingsObj.labels).map(([index, label]) => ({
                label: label || '',
                color: '',
                index: parseInt(index, 10),
                id: parseInt(index, 10)
            }));
        }
        
        logger.warn('parseStatusColumnLabels', 'Unknown labels format', { labels: settingsObj.labels });
        return [];
    } catch (error) {
        logger.error('parseStatusColumnLabels', 'Error parsing settings', error);
        return [];
    }
};

/**
 * בודק אם עמודת Status מכילה את כל הלייבלים הנדרשים
 * @param {Object|string} settings - ה-settings של העמודה
 * @returns {{isValid: boolean, missingLabels: string[], existingLabels: string[]}} - תוצאת הולידציה
 */
export const validateEventTypeColumn = (settings) => {
    logger.functionStart('validateEventTypeColumn');
    
    const labels = parseStatusColumnLabels(settings);
    const existingLabels = labels.map(l => l.label);
    
    // בדיקה אילו לייבלים חסרים
    const missingLabels = REQUIRED_EVENT_TYPE_LABELS.filter(
        required => !existingLabels.includes(required)
    );
    
    const isValid = missingLabels.length === 0;
    
    logger.functionEnd('validateEventTypeColumn', { 
        isValid, 
        missingLabels, 
        existingLabels 
    });
    
    return {
        isValid,
        missingLabels,
        existingLabels
    };
};

/**
 * מחזיר את תצורת הלייבלים הנדרשים ליצירת עמודה חדשה
 * @returns {Array<{label: string, color: string, index: number}>}
 */
export const getRequiredLabelsConfig = () => {
    return REQUIRED_EVENT_TYPE_LABELS.map((label, index) => ({
        label,
        color: EVENT_TYPE_LABEL_COLORS[label],
        index
    }));
};

/**
 * יוצר הודעה למשתמש על לייבלים חסרים
 * @param {string[]} missingLabels - רשימת הלייבלים החסרים
 * @returns {string} - הודעה מפורמטת
 */
export const formatMissingLabelsMessage = (missingLabels) => {
    if (missingLabels.length === 0) return '';
    
    const labelsList = missingLabels.map(l => `"${l}"`).join(', ');
    return `העמודה שנבחרה לא מכילה את הלייבלים הנדרשים: ${labelsList}`;
};
