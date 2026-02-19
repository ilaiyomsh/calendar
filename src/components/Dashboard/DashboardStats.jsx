import React from 'react';
import styles from './Dashboard.module.css';

/**
 * כרטיסי KPI - סטטיסטיקות ראשיות
 * @param {{ stats: Object, billFilter: string }} props
 */
const DashboardStats = ({ stats, billFilter, projectFilterActive }) => {
    const { totalHours, billableHours, nonBillableHours, billablePercent } = stats;

    const percentColor = billablePercent >= 70 ? '#0d7c3f' : '#d4a017';

    return (
        <div className={styles.statsGrid}>
            <div className={styles.statCard}>
                <span className={styles.statLabel}>סה״כ שעות</span>
                <span className={styles.statValue}>{totalHours}</span>
            </div>

            {!projectFilterActive && billFilter !== 'nonBillable' ? (
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>שעות לחיוב</span>
                    <span className={`${styles.statValue} ${styles.statBillable}`}>{billableHours}</span>
                </div>
            ) : null}

            {!projectFilterActive && billFilter !== 'billable' ? (
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>שעות לא לחיוב</span>
                    <span className={`${styles.statValue} ${styles.statNonBillable}`}>{nonBillableHours}</span>
                </div>
            ) : null}

            {!projectFilterActive && (
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>אחוז לחיוב</span>
                    <span className={styles.statValue} style={{ color: percentColor }}>{billablePercent}%</span>
                </div>
            )}
        </div>
    );
};

export default React.memo(DashboardStats);
