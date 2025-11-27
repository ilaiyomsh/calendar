/**
 * מערכת לוגים עם מצב debug
 * מאפשרת שליטה ברמת הלוגים והדפסת מידע מפורט לקריאות API
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

// רמת לוג נוכחית - ניתן לשנות ב-runtime
let currentLevel = process.env.NODE_ENV === 'development' 
  ? LOG_LEVELS.DEBUG 
  : LOG_LEVELS.WARN;

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
   */
  setLevel: (level) => {
    if (typeof level === 'string') {
      currentLevel = LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.WARN;
    } else {
      currentLevel = level;
    }
  },

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
   */
  apiError: (functionName, error) => {
    const formatted = formatMessage('API', 'ERROR', `❌ ${functionName} - Request failed`);
    console.group(`%c${formatted}`, `color: ${COLORS.ERROR}; font-weight: bold`);
    console.error('Error:', error);
    if (error?.message) {
      console.error('Error message:', error.message);
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

// ייצוא
export default logger;
export { LOG_LEVELS };

