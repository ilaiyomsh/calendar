import React, { useState, useEffect } from 'react';
import styles from './ErrorDetailsModal.module.css';

/**
 * ErrorDetailsModal - מודל להצגת פרטי שגיאה מלאים
 */
const ErrorDetailsModal = ({ isOpen, onClose, errorDetails }) => {
    const [activeTab, setActiveTab] = useState('error');
    const [copied, setCopied] = useState(false);
    const [copiedQuery, setCopiedQuery] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setActiveTab('error');
            setCopied(false);
            setCopiedQuery(false);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen || !errorDetails) return null;

    const handleCopyAll = async () => {
        try {
            const errorJson = JSON.stringify(errorDetails, null, 2);
            await navigator.clipboard.writeText(errorJson);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy error details:', error);
        }
    };

    const handleCopyQuery = async () => {
        if (!errorDetails.apiRequest) return;
        
        try {
            let queryText = errorDetails.apiRequest.query || '';
            if (errorDetails.apiRequest.variables) {
                queryText += '\n\nVariables:\n' + JSON.stringify(errorDetails.apiRequest.variables, null, 2);
            }
            await navigator.clipboard.writeText(queryText);
            setCopiedQuery(true);
            setTimeout(() => setCopiedQuery(false), 2000);
        } catch (error) {
            console.error('Failed to copy query:', error);
        }
    };

    const formatJson = (obj) => {
        return JSON.stringify(obj, null, 2);
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h3>פרטי שגיאה</h3>
                    <button className={styles.closeButton} onClick={onClose} aria-label="סגור">
                        ×
                    </button>
                </div>

                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${activeTab === 'error' ? styles.active : ''}`}
                        onClick={() => setActiveTab('error')}
                    >
                        שגיאה
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'api' ? styles.active : ''}`}
                        onClick={() => setActiveTab('api')}
                    >
                        קריאת API
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'json' ? styles.active : ''}`}
                        onClick={() => setActiveTab('json')}
                    >
                        JSON מלא
                    </button>
                </div>

                <div className={styles.content}>
                    {activeTab === 'error' && (
                        <div className={styles.section}>
                            <div className={styles.field}>
                                <label>הודעה למשתמש:</label>
                                <div className={styles.value}>{errorDetails.userMessage || 'לא זמין'}</div>
                            </div>
                            <div className={styles.field}>
                                <label>קוד שגיאה:</label>
                                <div className={styles.value}>{errorDetails.errorCode || 'לא זמין'}</div>
                            </div>
                            {errorDetails.fullDetails?.errorMessage && (
                                <div className={styles.field}>
                                    <label>הודעה טכנית:</label>
                                    <div className={styles.value}>{errorDetails.fullDetails.errorMessage}</div>
                                </div>
                            )}
                            {errorDetails.fullDetails?.statusCode && (
                                <div className={styles.field}>
                                    <label>קוד סטטוס:</label>
                                    <div className={styles.value}>{errorDetails.fullDetails.statusCode}</div>
                                </div>
                            )}
                            {errorDetails.fullDetails?.requestId && (
                                <div className={styles.field}>
                                    <label>Request ID:</label>
                                    <div className={styles.value}>{errorDetails.fullDetails.requestId}</div>
                                </div>
                            )}
                            {errorDetails.fullDetails?.errorData && (
                                <div className={styles.field}>
                                    <label>נתוני שגיאה:</label>
                                    <pre className={styles.jsonValue}>{formatJson(errorDetails.fullDetails.errorData)}</pre>
                                </div>
                            )}
                            {errorDetails.fullDetails?.stackTrace && (
                                <div className={styles.field}>
                                    <label>Stack Trace:</label>
                                    <pre className={styles.stackTrace}>{errorDetails.fullDetails.stackTrace}</pre>
                                </div>
                            )}
                            {errorDetails.actionRequired && (
                                <div className={styles.field}>
                                    <label>פעולה נדרשת:</label>
                                    <div className={styles.value}>{errorDetails.actionRequired}</div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'api' && (
                        <div className={styles.section}>
                            {errorDetails.apiRequest ? (
                                <>
                                    <div className={styles.field}>
                                        <label>שם הפעולה:</label>
                                        <div className={styles.value}>{errorDetails.apiRequest.operationName || 'לא זמין'}</div>
                                    </div>
                                    <div className={styles.field}>
                                        <label>Query/Mutation:</label>
                                        <pre className={styles.queryValue}>{errorDetails.apiRequest.query || 'לא זמין'}</pre>
                                    </div>
                                    {errorDetails.apiRequest.variables && (
                                        <div className={styles.field}>
                                            <label>Variables:</label>
                                            <pre className={styles.jsonValue}>{formatJson(errorDetails.apiRequest.variables)}</pre>
                                        </div>
                                    )}
                                    <div className={styles.actions}>
                                        <button
                                            className={styles.copyButton}
                                            onClick={handleCopyQuery}
                                        >
                                            {copiedQuery ? '✓ הועתק!' : '📋 העתק שאילתה'}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className={styles.emptyState}>אין פרטי קריאת API זמינים</div>
                            )}
                        </div>
                    )}

                    {activeTab === 'json' && (
                        <div className={styles.section}>
                            <pre className={styles.fullJson}>{formatJson(errorDetails)}</pre>
                        </div>
                    )}
                </div>

                <div className={styles.footer}>
                    <button className={styles.copyAllButton} onClick={handleCopyAll}>
                        {copied ? '✓ הועתק!' : '📋 העתק הכל'}
                    </button>
                    <button className={styles.closeButtonFooter} onClick={onClose}>
                        סגור
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ErrorDetailsModal;

