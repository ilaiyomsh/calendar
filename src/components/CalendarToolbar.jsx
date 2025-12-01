import React from 'react';
import { Navigate } from 'react-big-calendar';
import { IconButton } from '@vibe/core';
import { Settings, Bug } from '@vibe/icons';
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
  
  // פונקציית דיבאג
  const handleDebug = async () => {
    const ctx = await monday.get("context");
    const stg = await monday.get("settings");
    const filter = await monday.get("filter");
    const itemIds = await monday.get("itemIds");

    console.log("🐛 Debug Info:");
    console.log("Context:", ctx);
    console.log("Settings:", stg);
    console.log("Filter:", filter);
    console.log("Item IDs:", itemIds);
    console.log("================================================");
    console.log("Custom Settings:", customSettings);
    console.log("Column IDs:", columnIds);
    console.log("Current Events:", events);
    
  };

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

        {/* כפתור דיבאג */}
        <button
          type="button"
          onClick={handleDebug}
          title="Debug"
          style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <Bug size={20} />
        </button>

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

