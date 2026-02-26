/**
 * מערכת לוגים עם מצב debug
 * מאפשרת שליטה ברמת הלוגים והדפסת מידע מפורט לקריאות API
 * 
 * @overview
 * מערכת הלוגים מספקת שליטה מלאה על רמת הלוגים המוצגים בקונסול.
 * בפרודקשן מוצגות רק שגיאות קריטיות (ERROR), בעוד שבסביבת פיתוח מוצגים כל הלוגים (DEBUG).
 * 
 * @usage
 * ```javascript
 * import logger from './utils/logger';
 * 
 * // לוגים רגילים
 * logger.debug('ModuleName', 'Debug message', optionalData);
 * logger.info('ModuleName', 'Info message', optionalData);
 * logger.warn('ModuleName', 'Warning message', optionalData);
 * logger.error('ModuleName', 'Error message', errorObject);
 * 
 * // לוגים מיוחדים ל-API
 * logger.api('functionName', query, variables);
 * logger.apiResponse('functionName', response, duration);
 * logger.apiError('functionName', error);
 * 
 * // לוגים לפונקציות
 * logger.functionStart('functionName', params);
 * logger.functionEnd('functionName', result);
 * ```
 * 
 * @production
 * בפרודקשן (import.meta.env.PROD === true):
 * - מוצגות רק שגיאות קריטיות (ERROR)
 * - כל הלוגים האחרים (DEBUG, INFO, WARN) מושתקים
 * - apiError תמיד מוצג (שגיאות API הן קריטיות)
 * 
 * @development
 * בסביבת פיתוח (import.meta.env.PROD !== true):
 * - מוצגים כל הלוגים (DEBUG, INFO, WARN, ERROR)
 * - כולל מידע מפורט על קריאות API
 * - כולל לוגים של תחילת וסיום פונקציות
 * 
 * @note
 * - אין להשתמש ב-console.log/error/warn ישירות בקוד
 * - כל הלוגים צריכים לעבור דרך logger
 * - לוגים שצריך להשאיר בקוד (לצורך דיבוג עתידי) יש להעיר עם הערה
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

// רמת לוג נוכחית - ניתן לשנות ב-runtime
// בפרודקשן: רק שגיאות קריטיות (ERROR)
// בפיתוח: כל הלוגים (DEBUG)
// שימוש ב-import.meta.env.PROD עבור Vite (במקום process.env.NODE_ENV)
// עם fallback ל-process.env.NODE_ENV למקרה ש-Vite לא מוגדר
const isProduction = (typeof import.meta !== 'undefined' && import.meta.env?.PROD === true) ||
                     (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production');
let currentLevel = isProduction 
  ? LOG_LEVELS.ERROR 
  : LOG_LEVELS.DEBUG;

// צבעים לקונסול
const COLORS = {
  DEBUG: '#6c757d',
  INFO: '#0d6efd',
  WARN: '#ffc107',
  ERROR: '#dc3545',
  RESET: '#000000'
};

/**
 * פורמט הודעת לוג
 */
const formatMessage = (module, level, message) => {
  const timestamp = new Date().toLocaleTimeString('he-IL');
  const levelUpper = level.toUpperCase();
  return `[${timestamp}] [${levelUpper}] [${module}] ${message}`;
};

/**
 * הדפסת לוג עם צבע
 */
const logWithColor = (level, message, data = null) => {
  const color = COLORS[level.toUpperCase()] || COLORS.RESET;
  const formattedMessage = message;
  
  if (data !== null && data !== undefined) {
    console.log(`%c${formattedMessage}`, `color: ${color}; font-weight: bold`, data);
  } else {
    console.log(`%c${formattedMessage}`, `color: ${color}; font-weight: bold`);
  }
};

const logger = {
  /**
   * הגדרת רמת לוג
   * @param {string|number} level - 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'NONE'
   */
  setLevel: (level) => {
    if (typeof level === 'string') {
      currentLevel = LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.WARN;
    } else {
      currentLevel = level;
    }
    console.log(`%c🔧 Log level changed to: ${Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === currentLevel)}`, 
                'color: #9c27b0; font-weight: bold');
  },

  /**
   * קבלת רמת הלוג הנוכחית
   * @returns {string} שם רמת הלוג הנוכחית
   */
  getLevel: () => Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === currentLevel),

  /**
   * בדיקה אם מצב debug פעיל
   */
  isDebug: () => currentLevel <= LOG_LEVELS.DEBUG,

  /**
   * לוג debug - מידע מפורט לפיתוח
   */
  debug: (module, message, data = null) => {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
      const formatted = formatMessage(module, 'DEBUG', message);
      logWithColor('DEBUG', formatted, data);
    }
  },

  /**
   * לוג info - מידע כללי
   */
  info: (module, message, data = null) => {
    if (currentLevel <= LOG_LEVELS.INFO) {
      const formatted = formatMessage(module, 'INFO', message);
      logWithColor('INFO', formatted, data);
    }
  },

  /**
   * לוג warning - אזהרות
   */
  warn: (module, message, data = null) => {
    if (currentLevel <= LOG_LEVELS.WARN) {
      const formatted = formatMessage(module, 'WARN', message);
      logWithColor('WARN', formatted, data);
    }
  },

  /**
   * לוג error - שגיאות
   */
  error: (module, message, error = null) => {
    if (currentLevel <= LOG_LEVELS.ERROR) {
      const formatted = formatMessage(module, 'ERROR', message);
      logWithColor('ERROR', formatted, error);
      
      // הדפסת stack trace אם קיים
      if (error && error.stack) {
        console.error('Stack trace:', error.stack);
      }
    }
  },

  /**
   * לוג מיוחד לקריאות API - לפני הקריאה
   */
  api: (functionName, query, variables = null) => {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
      const formatted = formatMessage('API', 'DEBUG', `📤 ${functionName} - Sending request`);
      console.group(`%c${formatted}`, `color: ${COLORS.DEBUG}; font-weight: bold`);
      console.log('Query:', query);
      if (variables) {
        console.log('Variables:', variables);
      }
      console.groupEnd();
    }
  },

  /**
   * לוג מיוחד לקריאות API - אחרי התשובה
   */
  apiResponse: (functionName, response, duration = null) => {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
      const formatted = formatMessage('API', 'DEBUG', `📥 ${functionName} - Response received`);
      console.group(`%c${formatted}`, `color: ${COLORS.INFO}; font-weight: bold`);
      console.log('Response:', response);
      if (duration !== null) {
        console.log(`⏱️ Duration: ${duration}ms`);
      }
      console.groupEnd();
    }
  },

  /**
   * לוג מיוחד לקריאות API - שגיאה
   * @param {string} functionName - שם הפונקציה
   * @param {Error} error - אובייקט השגיאה
   * @param {Object} [context] - מידע דיאגנוסטי נוסף
   * @param {string} [context.query] - השאילתה שנשלחה
   * @param {Object} [context.rawResponse] - התשובה הגולמית מה-API
   * @param {string[]} [context.queryWarnings] - אזהרות ולידציה על השאילתה
   */
  apiError: (functionName, error, context = null) => {
    const formatted = formatMessage('API', 'ERROR', `❌ ${functionName} - Request failed`);
    console.group(`%c${formatted}`, `color: ${COLORS.ERROR}; font-weight: bold`);
    console.error('Error:', error);
    if (error?.message) {
      console.error('Error message:', error.message);
    }
    if (context?.query) {
      console.error('Query sent:', context.query);
    }
    if (context?.rawResponse) {
      console.error('Raw response:', context.rawResponse);
    }
    if (context?.queryWarnings?.length > 0) {
      console.error('Query warnings:', context.queryWarnings);
    }
    if (error?.stack) {
      console.error('Stack trace:', error.stack);
    }
    console.groupEnd();
  },

  /**
   * לוג פונקציה - תחילת ביצוע
   */
  functionStart: (functionName, params = null) => {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
      const formatted = formatMessage('FUNCTION', 'DEBUG', `▶️ ${functionName} - Started`);
      if (params) {
        logWithColor('DEBUG', formatted, params);
      } else {
        logWithColor('DEBUG', formatted);
      }
    }
  },

  /**
   * לוג פונקציה - סיום ביצוע
   */
  functionEnd: (functionName, result = null) => {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
      const formatted = formatMessage('FUNCTION', 'DEBUG', `✅ ${functionName} - Completed`);
      if (result !== null && result !== undefined) {
        logWithColor('DEBUG', formatted, result);
      } else {
        logWithColor('DEBUG', formatted);
      }
    }
  }
};

// ============================================
// פקודות גלובליות לדיבאג בפרודקשן
// הקלד בקונסול את הפקודות הבאות:
// - enableDebugLogs()  - הפעלת לוגים מלאים
// - disableDebugLogs() - השבתת לוגים (חזרה לפרודקשן)
// - getLogLevel()      - הצגת רמת הלוג הנוכחית
// - setLogLevel('INFO') - הגדרת רמה ספציפית
// ============================================

if (typeof window !== 'undefined') {
  /**
   * הפעלת לוגים מלאים בפרודקשן
   * הקלד בקונסול: enableDebugLogs()
   */
  window.enableDebugLogs = () => {
    logger.setLevel('DEBUG');
    console.log('%c🐛 Debug logs ENABLED - All logs will now be displayed', 
                'color: #4caf50; font-weight: bold; font-size: 14px');
    console.log('%c💡 To disable: disableDebugLogs()', 'color: #9e9e9e');
  };

  /**
   * השבתת לוגים (חזרה למצב פרודקשן)
   * הקלד בקונסול: disableDebugLogs()
   */
  window.disableDebugLogs = () => {
    logger.setLevel('ERROR');
    console.log('%c🔇 Debug logs DISABLED - Only errors will be displayed', 
                'color: #f44336; font-weight: bold; font-size: 14px');
  };

  /**
   * הצגת רמת הלוג הנוכחית
   * הקלד בקונסול: getLogLevel()
   */
  window.getLogLevel = () => {
    const level = logger.getLevel();
    console.log(`%c📊 Current log level: ${level}`, 'color: #2196f3; font-weight: bold');
    return level;
  };

  /**
   * הגדרת רמת לוג ספציפית
   * הקלד בקונסול: setLogLevel('INFO')
   * @param {string} level - 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'NONE'
   */
  window.setLogLevel = (level) => {
    logger.setLevel(level);
  };
}

// ייצוא
export default logger;
export { LOG_LEVELS };

