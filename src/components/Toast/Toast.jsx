import React, { useEffect, useState } from 'react';
import styles from './Toast.module.css';

/**
 * Toast notification component
 * מציג הודעות למשתמש (הצלחה, שגיאה, אזהרה, מידע)
 */
const Toast = ({ message, type = 'info', duration = 5000, onClose }) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(() => {
                    onClose?.();
                }, 300); // זמן לאנימציית יציאה
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [duration, onClose]);

    if (!isVisible) return null;

    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    return (
        <div className={`${styles.toast} ${styles[type]}`}>
            <span className={styles.icon}>{icons[type] || icons.info}</span>
            <span className={styles.message}>{message}</span>
            <button 
                className={styles.closeButton}
                onClick={() => {
                    setIsVisible(false);
                    setTimeout(() => {
                        onClose?.();
                    }, 300);
                }}
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
export const ToastContainer = ({ toasts, onRemove }) => {
    return (
        <div className={styles.toastContainer}>
            {toasts.map((toast) => (
                <Toast
                    key={toast.id}
                    message={toast.message}
                    type={toast.type}
                    duration={toast.duration}
                    onClose={() => onRemove(toast.id)}
                />
            ))}
        </div>
    );
};

export default Toast;

