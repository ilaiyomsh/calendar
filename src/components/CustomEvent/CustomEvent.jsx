import React from 'react';
import styles from './CustomEvent.module.css';

/**
 * רכיב מותאם אישית להצגת אירוע בלוח השנה
 */
const CustomEvent = ({ event }) => {
    // עיצוב שונה לאירועים יומיים
    const isAllDayEvent = event.allDay || (event.title === 'מחלה' || event.title === 'חופשה' || event.title === 'מילואים');
    
    return (
        <div className={`${styles.eventContainer} ${isAllDayEvent ? styles.allDay : ''}`}>
            <div className={styles.title}>
                {event.title}
            </div>
            {event.notes && (
                <div className={styles.notes}>
                    {event.notes}
                </div>
            )}
        </div>
    );
};

export default CustomEvent;

