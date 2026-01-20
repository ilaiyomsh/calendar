import React, { useState } from 'react';
import styles from './ErrorToast.module.css';

/**
 * ErrorToast - רכיב Toast מותאם לשגיאות עם אפשרות להעתיק פרטים ולצפות בפרטים מלאים
 */
const ErrorToast = ({ 
    message, 
    errorDetails, 
    onShowDetails, 
    duration = 0, // 0 = לא נסגר אוטומטית
    onClose 
}) => {
    const [copied, setCopied] = useState(false);

    const handleCopyDetails = async () => {
        if (!errorDetails) return;

        try {
            // המרת כל אובייקט השגיאה ל-JSON
            const errorJson = JSON.stringify(errorDetails, null, 2);
            await navigator.clipboard.writeText(errorJson);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy error details:', error);
        }
    };

    const handleShowDetails = () => {
        if (onShowDetails) {
            onShowDetails();
        }
    };

    return (
        <div className={styles.errorToast}>
            <span className={styles.message}>{message}</span>
            <div className={styles.actions}>
                <button
                    className={styles.actionButton}
                    onClick={handleCopyDetails}
                    aria-label="העתק פרטים"
                    title="העתק פרטים"
                >
                    {copied ? '✓' : '📋'}
                </button>
                {onShowDetails && (
                    <button
                        className={styles.actionButton}
                        onClick={handleShowDetails}
                        aria-label="פרטים"
                        title="פרטים"
                    >
                        ℹ️
                    </button>
                )}
                <button
                    className={styles.closeButton}
                    onClick={onClose}
                    aria-label="סגור"
                    title="סגור"
                >
                    ×
                </button>
            </div>
            {copied && (
                <span className={styles.copiedIndicator}>הועתק!</span>
            )}
        </div>
    );
};

export default ErrorToast;

