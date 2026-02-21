import React from 'react';
import styles from './Dashboard.module.css';

/**
 * כרטיסי KPI - סטטיסטיקות ראשיות
 * @param {{ stats: Object, billFilter: string }} props
 */
const DashboardStats = ({ stats, billFilter, projectFilterActive, compactMode }) => {
    const { totalHours, billableHours, nonBillableHours, billablePercent } = stats;

    const percentColor = billablePercent >= 70 ? '#0d7c3f' : '#d4a017';

    if (compactMode) {
        return (
            <div className={styles.statCard}>
                <h3 className={styles.chartTitle}>סה״כ שעות</h3>
                <span className={styles.statValueHero}>{totalHours}</span>
            </div>
        );
    }

    return (
        <div className={styles.statsGrid}>
            <div className={styles.statCard}>
                <h3 className={styles.chartTitle}>סה״כ שעות</h3>
                <span className={styles.statValue}>{totalHours}</span>
            </div>

            <div className={styles.statCard}>
                <h3 className={styles.chartTitle}>אחוז לחיוב</h3>
                <span className={styles.statValue} style={{ color: percentColor }}>{billablePercent}%</span>
            </div>

            <div className={styles.statCard}>
                <h3 className={styles.chartTitle}>שעות לחיוב</h3>
                <span className={`${styles.statValue} ${styles.statBillable}`}>{billableHours}</span>
            </div>

            <div className={styles.statCard}>
                <h3 className={styles.chartTitle}>שעות לא לחיוב</h3>
                <span className={`${styles.statValue} ${styles.statNonBillable}`}>{nonBillableHours}</span>
            </div>
        </div>
    );
};

export default React.memo(DashboardStats);
