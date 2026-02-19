import React from 'react';
import { ArrowRight, Settings, Download } from 'lucide-react';
import styles from './Dashboard.module.css';

/**
 * סרגל כלים של הדשבורד
 */
const DashboardToolbar = ({ onSwitchToCalendar, isOwner, onOpenSettings, onExport, exportDisabled }) => {
    return (
        <div className={styles.toolbar}>
            <div className={styles.toolbarRight}>
                <button
                    type="button"
                    className={styles.backBtn}
                    onClick={onSwitchToCalendar}
                    aria-label="חזרה ללוח"
                >
                    <ArrowRight size={20} />
                    <span>חזרה ללוח</span>
                </button>
                <h2 className={styles.toolbarTitle}>דשבורד דיווחי שעות</h2>
            </div>

            <div className={styles.toolbarLeft}>
                <button
                    type="button"
                    className={styles.settingsBtn}
                    onClick={onExport}
                    disabled={exportDisabled}
                    aria-label="ייצוא CSV"
                    title="ייצוא לאקסל"
                >
                    <Download size={20} />
                </button>
                {isOwner ? (
                    <button
                        type="button"
                        className={styles.settingsBtn}
                        onClick={onOpenSettings}
                        aria-label="הגדרות"
                    >
                        <Settings size={20} />
                    </button>
                ) : null}
            </div>
        </div>
    );
};

export default DashboardToolbar;
