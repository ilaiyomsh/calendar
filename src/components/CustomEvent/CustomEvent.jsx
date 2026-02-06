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

    // בדיקה אם זה אירוע מתוכנן (Temporary/Planned)
    const isTemporary = event.isTemporary || false;

    // זיהוי אירוע קצר (30 דקות או פחות) - להציג כותרת ושעה באותה שורה
    const isShortEvent = !isAllDayEvent && event.start && event.end
        && differenceInMinutes(event.end, event.start) <= 30;

    // צבע הרקע לפי סוג האירוע או מזהה הפרויקט
    // חגים מקבלים צבע לפי סוג החג
    // אירועים מתוכננים מקבלים רקע שקוף (hollow)
    const eventColor = isHoliday
        ? getHolidayColor(event.holidayType)
        : getEventColor(event.eventType, event.projectId, event.eventTypeColor);

    // אירועים מתוכננים - שקופים עם גבול צבעוני
    const backgroundColor = isTemporary ? 'transparent' : eventColor;

    // פרמוט זמן - הצבת שעת הסיום לפני שעת ההתחלה בקוד, כדי שבממשק RTL זה יוצג נכון:
    // שעת התחלה מימין, שעת סיום משמאל.
    const timeRange = !isAllDayEvent && event.start && event.end
        ? `${format(event.end, 'HH:mm')} - ${format(event.start, 'HH:mm')}`
        : '';

    // טקסט לבן על רקע צבעוני, או צבע האירוע על רקע שקוף (מתוכנן)
    const textColor = isTemporary ? eventColor : '#ffffff';

    // בניית class names
    const wrapperClasses = [
        'gc-event-wrapper',
        isAllDayEvent ? 'gc-event-allday' : '',
        isShortEvent ? 'gc-event-short' : '',
        isSelected ? 'gc-event-selected' : '',
        isHoliday ? 'gc-event-holiday' : '',
        isTemporary ? 'gc-event-temporary' : ''
    ].filter(Boolean).join(' ');
    
    // סגנון מותאם - אירועים מתוכננים מקבלים גבול צבעוני במקום רקע
    const wrapperStyle = isTemporary
        ? { backgroundColor, color: textColor, '--event-color': eventColor, borderColor: eventColor }
        : { backgroundColor, color: textColor };

    return (
        <div
            className={wrapperClasses}
            style={wrapperStyle}
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
