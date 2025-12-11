import React from 'react';
import { Navigate } from 'react-big-calendar';
import { IconButton } from '@vibe/core';
import { Settings } from '@vibe/icons';
import { useSettings } from '../contexts/SettingsContext';

const CalendarToolbar = ({ 
  onNavigate, 
  onView, 
  label, 
  view, 
  views, 
  localizer,
  // Custom props passed via componentsProps or context
  onOpenSettings,
  monday,
  customSettings,
  columnIds,
  events,
  isOwner = false
}) => {
  return (
    <div className="rbc-toolbar">
      {/* צד ימין - כפתורי תצוגה + פעולות מותאמות */}
      <span className="rbc-btn-group">
        {/* כפתור הגדרות - מוצג רק ל-owners */}
        {isOwner && (
          <button 
            type="button" 
            onClick={onOpenSettings}
            title="הגדרות"
            style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <Settings size={20} />
          </button>
        )}

        {/* כפתורי תצוגה (חודש/שבוע/יום) */}
        {views.map(viewName => (
          <button
            key={viewName}
            type="button"
            className={view === viewName ? 'rbc-active' : ''}
            onClick={() => onView(viewName)}
          >
            {messages[viewName] || viewName}
          </button>
        ))}
      </span>

      {/* מרכז - כותרת התאריך */}
      <span className="rbc-toolbar-label">{label}</span>

      {/* צד שמאל - כפתורי ניווט */}
      <span className="rbc-btn-group">
        <button type="button" onClick={() => onNavigate(Navigate.NEXT)}>הבא</button>
        <button type="button" onClick={() => onNavigate(Navigate.PREVIOUS)}>קודם</button>
        <button type="button" onClick={() => onNavigate(Navigate.TODAY)}>היום</button>
      </span>
    </div>
  );
};

// הודעות בעברית לכפתורים
const messages = {
  month: 'חודש',
  week: 'שבוע',
  day: 'יום',
  agenda: 'סדר יום'
};

export default CalendarToolbar;

