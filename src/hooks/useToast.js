import { useState, useCallback } from 'react';
import { parseMondayError, createFullErrorObject } from '../utils/errorHandler';
import { MondayApiError } from '../utils/mondayApi';

/**
 * Hook לניהול Toast notifications
 */
export const useToast = () => {
    const [toasts, setToasts] = useState([]);
    const [errorDetailsModal, setErrorDetailsModal] = useState(null);

    const showToast = useCallback((message, type = 'info', duration = 1500, errorDetails = null) => {
        const id = Date.now() + Math.random();
        const newToast = { id, message, type, duration, errorDetails };
        
        setToasts(prev => [...prev, newToast]);
        
        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const showSuccess = useCallback((message, duration = 1500) => {
        return showToast(message, 'success', duration);
    }, [showToast]);

    const showError = useCallback((message, duration) => {
        return showToast(message, 'error', duration);
    }, [showToast]);

    const showWarning = useCallback((message, duration) => {
        return showToast(message, 'warning', duration);
    }, [showToast]);

    const showInfo = useCallback((message, duration) => {
        return showToast(message, 'info', duration);
    }, [showToast]);

    /**
     * הצגת שגיאה עם פרטים מלאים
     * @param {Error|MondayApiError|Object} error - שגיאה או response עם errors
     * @param {Object} options - אפשרויות נוספות
     * @param {Object} options.apiRequest - פרטי השאילתה (אם לא קיים ב-error)
     * @param {string} options.functionName - שם הפונקציה שביצעה את הקריאה
     * @param {number} options.duration - משך זמן הצגת ה-Toast (0 = לא נסגר אוטומטית)
     */
    const showErrorWithDetails = useCallback((error, options = {}) => {
        let parsedError;
        let fullErrorObject;

        // אם זו MondayApiError, נחלץ את הפרטים ממנה
        if (error instanceof MondayApiError) {
            parsedError = parseMondayError(
                error,
                error.response,
                error.apiRequest || options.apiRequest
            );
            
            fullErrorObject = createFullErrorObject(
                parsedError,
                error.functionName || options.functionName,
                error.timestamp,
                error.duration
            );
        }
        // אם יש response עם errors
        else if (error && typeof error === 'object' && error.response) {
            parsedError = parseMondayError(
                error,
                error.response,
                options.apiRequest || (error.apiRequest ? { query: error.apiRequest.query, variables: error.apiRequest.variables } : null)
            );
            
            fullErrorObject = createFullErrorObject(
                parsedError,
                options.functionName,
                Date.now(),
                null
            );
        }
        // אחרת, ננסה לפרש את השגיאה
        else {
            parsedError = parseMondayError(
                error,
                null,
                options.apiRequest
            );
            
            fullErrorObject = createFullErrorObject(
                parsedError,
                options.functionName,
                Date.now(),
                null
            );
        }

        // הוספת כל הפרטים ל-fullErrorObject
        fullErrorObject = {
            ...fullErrorObject,
            ...parsedError
        };

        const id = showToast(
            parsedError.userMessage,
            'error',
            options.duration !== undefined ? options.duration : 0, // 0 = לא נסגר אוטומטית
            fullErrorObject
        );

        return id;
    }, [showToast]);

    const openErrorDetailsModal = useCallback((errorDetails) => {
        setErrorDetailsModal(errorDetails);
    }, []);

    const closeErrorDetailsModal = useCallback(() => {
        setErrorDetailsModal(null);
    }, []);

    return {
        toasts,
        errorDetailsModal,
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        showErrorWithDetails,
        removeToast,
        openErrorDetailsModal,
        closeErrorDetailsModal
    };
};

