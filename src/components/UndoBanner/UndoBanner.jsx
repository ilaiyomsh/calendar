import React, { useState, useEffect, useCallback } from 'react';
import { Undo2 } from 'lucide-react';
import styles from './UndoBanner.module.css';

/**
 * באנר Undo למחיקת אירועים
 * מוצג בתחתית המסך למשך מספר שניות עם אפשרות ביטול
 */
const UndoBanner = ({ isVisible, message, onUndo }) => {
    const [exiting, setExiting] = useState(false);

    // אנימציית יציאה כשהבאנר נעלם
    useEffect(() => {
        if (!isVisible && exiting) {
            setExiting(false);
        }
    }, [isVisible, exiting]);

    const handleUndo = useCallback(() => {
        setExiting(true);
        // המתנה לסיום אנימציית היציאה
        setTimeout(() => {
            onUndo();
        }, 200);
    }, [onUndo]);

    if (!isVisible) return null;

    return (
        <div className={`${styles.banner} ${exiting ? styles.exiting : ''}`}>
            <span className={styles.message}>{message}</span>
            <button className={styles.undoButton} onClick={handleUndo}>
                <Undo2 size={16} />
                <span>ביטול</span>
            </button>
        </div>
    );
};

export default UndoBanner;
