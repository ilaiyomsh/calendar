import React from 'react';
import { format, differenceInMinutes } from 'date-fns';
import { getEventColor, getHolidayColor } from '../../utils/colorUtils';

/**
 * רכיב מותאם אישית להצגת אירוע בלוח השנה
 */
const CustomEvent = ({ event }) => {
    // עיצוב שונה לאירועים יומיים
    const isAllDayEvent = event.allDay;

    // בדיקה אם זה חג
    const isHoliday = event.isHoliday || false;

    // בדיקה אם האירוע נבחר (מועבר דרך enrichedEvents)
    const isSelected = event.isSelected || false;

    // זיהוי אירוע קצר (30 דקות או פחות) - להציג כותרת ושעה באותה שורה
    const isShortEvent = !isAllDayEvent && event.start && event.end
        && differenceInMinutes(event.end, event.start) <= 30;

    // צבע הרקע לפי סוג האירוע או מזהה הפרויקט
    // חגים מקבלים צבע לפי סוג החג
    const backgroundColor = isHoliday
        ? getHolidayColor(event.holidayType)
        : getEventColor(event.eventType, event.projectId);

    // פרמוט זמן - הצבת שעת הסיום לפני שעת ההתחלה בקוד, כדי שבממשק RTL זה יוצג נכון:
    // שעת התחלה מימין, שעת סיום משמאל.
    const timeRange = !isAllDayEvent && event.start && event.end
        ? `${format(event.end, 'HH:mm')} - ${format(event.start, 'HH:mm')}`
        : '';

    // טקסט לבן על רקע צבעוני בינוני (עמודה אמצעית של Monday)
    const textColor = '#ffffff';

    // בניית class names
    const wrapperClasses = [
        'gc-event-wrapper',
        isAllDayEvent ? 'gc-event-allday' : '',
        isShortEvent ? 'gc-event-short' : '',
        isSelected ? 'gc-event-selected' : '',
        isHoliday ? 'gc-event-holiday' : ''
    ].filter(Boolean).join(' ');
    
    return (
        <div 
            className={wrapperClasses}
            style={{ backgroundColor, color: textColor }}
        >
            <div className="gc-event-title">
                {event.title}
            </div>
            {timeRange && (
                <div className="gc-event-time">
                    {timeRange}
                </div>
            )}
            {event.notes && !isAllDayEvent && (
                <div className="gc-event-notes">
                    {event.notes}
                </div>
            )}
        </div>
    );
};

export default CustomEvent;
