/**
 * פונקציות עזר לפורמוט תאריכים עבור Monday API
 * Monday API מצפה לפורמט UTC ספציפי
 */

/**
 * המרת Date לפורמט תאריך של Monday (YYYY-MM-DD)
 * @param {Date} date - תאריך להמרה
 * @returns {string} פורמט YYYY-MM-DD
 */
export const toMondayDateFormat = (date) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * המרת Date לפורמט שעה של Monday (HH:MM:SS)
 * @param {Date} date - תאריך/שעה להמרה
 * @returns {string} פורמט HH:MM:SS
 */
export const toMondayTimeFormat = (date) => {
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
};

/**
 * המרת Date לאובייקט עמודת תאריך של Monday
 * @param {Date} date - תאריך/שעה להמרה
 * @returns {{date: string, time: string}} אובייקט עם date ו-time
 */
export const toMondayDateTimeColumn = (date) => ({
    date: toMondayDateFormat(date),
    time: toMondayTimeFormat(date)
});

/**
 * המרת Date לפורמט תאריך מקומי (YYYY-MM-DD) בזמן מקומי
 * @param {Date} date - תאריך להמרה
 * @returns {string} פורמט YYYY-MM-DD
 */
export const toLocalDateFormat = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * המרת Date לפורמט שעה מקומי (HH:MM)
 * @param {Date} date - תאריך/שעה להמרה
 * @returns {string} פורמט HH:MM
 */
export const toLocalTimeFormat = (date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
};
