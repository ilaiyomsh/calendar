import React, { useEffect, useState, useCallback } from 'react';
import styles from './Toast.module.css';
import ErrorToast from '../ErrorToast/ErrorToast';

/**
 * Toast notification component
 * מציג הודעות למשתמש (הצלחה, שגיאה, אזהרה, מידע)
 */
const Toast = ({ message, type = 'info', duration = 5000, errorDetails = null, onClose, onShowDetails }) => {
    const [isExiting, setIsExiting] = useState(false);

    const startExit = useCallback(() => {
        if (isExiting) return;
        setIsExiting(true);
        setTimeout(() => {
            onClose?.();
        }, 300);
    }, [isExiting, onClose]);

    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(startExit, duration);
            return () => clearTimeout(timer);
        }
    }, [duration, startExit]);

    // אם זו שגיאה עם errorDetails, נציג ErrorToast
    if (type === 'error' && errorDetails) {
        return (
            <ErrorToast
                message={message}
                errorDetails={errorDetails}
                onShowDetails={onShowDetails}
                duration={duration}
                onClose={startExit}
            />
        );
    }

    // אחרת, נציג Toast רגיל
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    return (
        <div className={`${styles.toast} ${styles[type]} ${isExiting ? styles.exiting : ''}`}>
            <span className={styles.icon}>{icons[type] || icons.info}</span>
            <span className={styles.message}>{message}</span>
            <button
                className={styles.closeButton}
                onClick={startExit}
                aria-label="סגור"
            >
                ×
            </button>
        </div>
    );
};

/**
 * Toast Container - מנהל רשימת הודעות
 */
export const ToastContainer = ({ toasts, onRemove, onShowErrorDetails }) => {
    return (
        <div className={styles.toastContainer} aria-live="polite" aria-relevant="additions removals">
            {toasts.map((toast) => (
                <Toast
                    key={toast.id}
                    message={toast.message}
                    type={toast.type}
                    duration={toast.duration}
                    errorDetails={toast.errorDetails || null}
                    onClose={() => onRemove(toast.id)}
                    onShowDetails={toast.errorDetails && onShowErrorDetails ? () => onShowErrorDetails(toast.errorDetails) : null}
                />
            ))}
        </div>
    );
};

export default Toast;

