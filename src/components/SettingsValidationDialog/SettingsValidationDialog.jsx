import React from 'react';
import { AlertTriangle, Settings, X } from 'lucide-react';
import styles from './SettingsValidationDialog.module.css';

export default function SettingsValidationDialog({
    isOpen,
    onClose,
    onOpenSettings,
    validationResult,
    isOwner = false
}) {
    if (!isOpen || !validationResult) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.dialog}>
                <div className={styles.header}>
                    <div className={styles.titleGroup}>
                        <AlertTriangle size={24} className={styles.warningIcon} />
                        <h3>נדרש עדכון הגדרות</h3>
                    </div>
                    <button className={styles.closeButton} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.content}>
                    <p className={styles.message}>
                        {isOwner
                            ? 'יש להשלים את הגדרות האפליקציה כדי להתחיל להשתמש ביומן דיווח השעות.'
                            : 'הגדרות האפליקציה טרם הושלמו. יש לפנות למנהל הלוח כדי להשלים את ההגדרות.'}
                    </p>
                </div>

                <div className={styles.footer}>
                    <button
                        className={`${styles.button} ${styles.cancelBtn}`}
                        onClick={onClose}
                    >
                        {isOwner ? 'אחר כך' : 'סגור'}
                    </button>
                    {isOwner && (
                        <button
                            className={`${styles.button} ${styles.settingsBtn}`}
                            onClick={() => {
                                onClose();
                                onOpenSettings();
                            }}
                        >
                            <Settings size={18} />
                            פתח הגדרות
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
