import React, { useCallback } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import styles from './ConfirmDialog.module.css';

export default function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    onCancel,
    title = "אישור",
    message = "האם אתה בטוח?",
    confirmText = "אישור",
    cancelText = "ביטול",
    confirmButtonStyle = "primary" // 'primary' | 'danger'
}) {
    const handleEscape = useCallback(() => {
        (onCancel || onClose)();
    }, [onCancel, onClose]);

    const dialogRef = useFocusTrap(isOpen, handleEscape);

    if (!isOpen) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.dialog} ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1}>
                <div className={styles.header}>
                    <h3>{title}</h3>
                    <button className={styles.closeButton} onClick={onCancel || onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div className={styles.content}>
                    <p>{message}</p>
                </div>
                <div className={styles.footer}>
                    <button 
                        className={`${styles.button} ${styles.cancelBtn}`}
                        onClick={onCancel || onClose}
                    >
                        {cancelText}
                    </button>
                    <button 
                        className={`${styles.button} ${confirmButtonStyle === 'danger' ? styles.dangerBtn : styles.confirmBtn}`}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

