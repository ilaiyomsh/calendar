import React from 'react';
import { X, Loader2 } from 'lucide-react';
import styles from './ApprovalActionBar.module.css';

/**
 * סרגל פעולות אישור מנהל לאירועים נבחרים
 * מוצג כ-floating bar בתחתית המסך כאשר יש אירועים נבחרים לאישור
 */
const ApprovalActionBar = ({
    selectedCount,
    onApproveBillable,
    onApproveUnbillable,
    onClear,
    isProcessing
}) => {
    if (selectedCount === 0) return null;

    return (
        <div className={styles.actionBar}>
            <div className={styles.content}>
                <span className={styles.count}>
                    {selectedCount === 1
                        ? 'דיווח אחד נבחר לאישור'
                        : `${selectedCount} דיווחים נבחרו לאישור`}
                </span>

                <div className={styles.actions}>
                    <button
                        onClick={onApproveBillable}
                        disabled={isProcessing}
                        className={styles.approveBtn}
                        title="אשר נבחרים - לחיוב"
                    >
                        {isProcessing ? (
                            <Loader2 size={18} className={styles.spinner} />
                        ) : null}
                        <span>{isProcessing ? 'מאשר...' : 'אשר - לחיוב'}</span>
                    </button>

                    <button
                        onClick={onApproveUnbillable}
                        disabled={isProcessing}
                        className={styles.approveUnbillableBtn}
                        title="אשר נבחרים - לא לחיוב"
                    >
                        <span>אשר - לא לחיוב</span>
                    </button>

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

export default ApprovalActionBar;
