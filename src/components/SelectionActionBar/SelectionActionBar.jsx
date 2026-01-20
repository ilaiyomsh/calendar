import React from 'react';
import { Copy, Trash2, X, Loader2 } from 'lucide-react';
import styles from './SelectionActionBar.module.css';

/**
 * סרגל פעולות לאירועים נבחרים
 * מוצג כ-floating bar בתחתית המסך כאשר יש אירועים נבחרים
 */
const SelectionActionBar = ({ 
    selectedCount, 
    onDuplicate, 
    onDelete, 
    onClear,
    isProcessing 
}) => {
    // לא להציג אם אין אירועים נבחרים
    if (selectedCount === 0) return null;
    
    return (
        <div className={styles.actionBar}>
            <div className={styles.content}>
                {/* מונה אירועים נבחרים */}
                <span className={styles.count}>
                    {selectedCount === 1 
                        ? 'אירוע אחד נבחר' 
                        : `${selectedCount} אירועים נבחרו`}
                </span>
                
                {/* כפתורי פעולות */}
                <div className={styles.actions}>
                    <button 
                        onClick={onDuplicate} 
                        disabled={isProcessing}
                        className={styles.actionBtn}
                        title="שכפל אירועים נבחרים"
                    >
                        {isProcessing ? (
                            <Loader2 size={18} className={styles.spinner} />
                        ) : (
                            <Copy size={18} />
                        )}
                        <span>שכפל</span>
                    </button>
                    
                    <button 
                        onClick={onDelete} 
                        disabled={isProcessing}
                        className={`${styles.actionBtn} ${styles.deleteBtn}`}
                        title="מחק אירועים נבחרים"
                    >
                        {isProcessing ? (
                            <Loader2 size={18} className={styles.spinner} />
                        ) : (
                            <Trash2 size={18} />
                        )}
                        <span>מחק</span>
                    </button>
                    
                    {/* כפתור ביטול בחירה */}
                    <button 
                        onClick={onClear} 
                        className={styles.clearBtn}
                        title="בטל בחירה"
                        disabled={isProcessing}
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SelectionActionBar;
