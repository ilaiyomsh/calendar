/**
 * Global Error Handler
 * תופס כל השגיאות שלא טופלו ומציג אותן עם showErrorWithDetails
 */

let globalShowErrorWithDetails = null;

/**
 * הגדרת פונקציה להצגת שגיאות
 */
export const setGlobalErrorHandler = (showErrorWithDetailsFn) => {
    globalShowErrorWithDetails = showErrorWithDetailsFn;
};

/**
 * טיפול בשגיאה גלובלית
 */
export const handleGlobalError = (error, context = {}) => {
    if (!globalShowErrorWithDetails) {
        // אם אין handler, נדפיס לקונסול
        console.error('Global error (no handler set):', error);
        return;
    }

    try {
        globalShowErrorWithDetails(error, {
            functionName: context.functionName || 'GlobalErrorHandler',
            ...context
        });
    } catch (handlerError) {
        // אם יש שגיאה ב-handler עצמו, נדפיס לקונסול
        console.error('Error in global error handler:', handlerError);
        console.error('Original error:', error);
    }
};

/**
 * טיפול ב-unhandled promise rejections
 */
export const setupGlobalErrorHandlers = () => {
    // טיפול ב-unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        const error = event.reason;
        
        // בדיקה אם זו שגיאת Monday API
        if (error && typeof error === 'object') {
            // אם יש response עם errors, זו שגיאת Monday API
            if (error.response && error.response.errors) {
                handleGlobalError(error, { 
                    functionName: 'UnhandledPromiseRejection',
                    source: 'unhandledrejection'
                });
                event.preventDefault(); // מונע הדפסה לקונסול
                return;
            }
            
            // אם יש message שמכיל "Graphql" או "monday", זו כנראה שגיאת Monday API
            if (error.message && (
                error.message.includes('Graphql') || 
                error.message.includes('graphql') ||
                error.message.includes('monday') ||
                error.message.includes('Monday')
            )) {
                handleGlobalError(error, { 
                    functionName: 'UnhandledPromiseRejection',
                    source: 'unhandledrejection'
                });
                event.preventDefault();
                return;
            }
        }
        
        // שגיאות אחרות - נדפיס לקונסול (אבל לא נמנע את ההדפסה הרגילה)
        console.error('Unhandled promise rejection:', error);
    });

    // טיפול ב-uncaught errors
    window.addEventListener('error', (event) => {
        const error = event.error;
        
        // בדיקה אם זו שגיאת Monday API
        if (error && typeof error === 'object') {
            // אם יש response עם errors, זו שגיאת Monday API
            if (error.response && error.response.errors) {
                handleGlobalError(error, { 
                    functionName: 'UncaughtError',
                    source: 'error'
                });
                event.preventDefault();
                return;
            }
            
            // אם יש message שמכיל "Graphql" או "monday", זו כנראה שגיאת Monday API
            if (error.message && (
                error.message.includes('Graphql') || 
                error.message.includes('graphql') ||
                error.message.includes('monday') ||
                error.message.includes('Monday')
            )) {
                handleGlobalError(error, { 
                    functionName: 'UncaughtError',
                    source: 'error'
                });
                event.preventDefault();
                return;
            }
        }
        
        // שגיאות אחרות - נדפיס לקונסול (אבל לא נמנע את ההדפסה הרגילה)
        console.error('Uncaught error:', error);
    });
};

export default {
    setGlobalErrorHandler,
    handleGlobalError,
    setupGlobalErrorHandlers
};

