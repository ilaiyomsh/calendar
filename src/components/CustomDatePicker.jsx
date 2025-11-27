import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isSameMonth } from 'date-fns';
import { he } from 'date-fns/locale';

export default function CustomDatePicker({ selectedDate, onDateSelect, onClose }) {
    const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date());

    // חישוב הימים להצגה (כולל ימים מהחודש הקודם/הבא למילוי השבוע)
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { locale: he });
    const endDate = endOfWeek(monthEnd, { locale: he });
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    // שמות הימים בשבוע
    const weekDays = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

    const handleDateClick = (day) => {
        onDateSelect(day);
        if (onClose) {
            onClose();
        }
    };

    const handlePrevMonth = () => {
        setCurrentMonth(subMonths(currentMonth, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(addMonths(currentMonth, 1));
    };

    return (
        <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            minWidth: '280px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            direction: 'rtl'
        }}>
            {/* כותרת עם חודש ושנה וכפתורי ניווט */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                paddingBottom: '12px',
                borderBottom: '1px solid #e4e6eb'
            }}>
                <button
                    onClick={handlePrevMonth}
                    style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '18px',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        color: '#323338'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#e4e6eb'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                >
                    ‹
                </button>
                
                <div style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#323338'
                }}>
                    {format(currentMonth, 'MMMM yyyy', { locale: he })}
                </div>
                
                <button
                    onClick={handleNextMonth}
                    style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '18px',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        color: '#323338'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#e4e6eb'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                >
                    ›
                </button>
            </div>

            {/* שורת ימי השבוע */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '4px',
                marginBottom: '8px'
            }}>
                {weekDays.map((day) => (
                    <div
                        key={day}
                        style={{
                            textAlign: 'center',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#676879',
                            padding: '4px'
                        }}
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Grid של הימים */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '4px'
            }}>
                {days.map((day, index) => {
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isToday = isSameDay(day, new Date());

                    return (
                        <button
                            key={index}
                            onClick={() => handleDateClick(day)}
                            style={{
                                padding: '8px',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                backgroundColor: isSelected ? '#0073ea' : isToday ? '#e4e6eb' : 'transparent',
                                color: isSelected ? 'white' : !isCurrentMonth ? '#c5c7d0' : '#323338',
                                fontWeight: isSelected || isToday ? '600' : '400',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                if (!isSelected) {
                                    e.target.style.backgroundColor = '#e4e6eb';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isSelected) {
                                    e.target.style.backgroundColor = isToday ? '#e4e6eb' : 'transparent';
                                }
                            }}
                        >
                            {format(day, 'd')}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

