import React, { useState, useRef, useEffect } from 'react';
import { Navigate } from 'react-big-calendar';
import { Settings } from 'lucide-react';
import { NavigationChevronLeft, NavigationChevronRight, DropdownChevronDown } from "@vibe/icons";
import logger from '../utils/logger';

const CalendarToolbar = ({ 
  onNavigate, 
  onView, 
  label, 
  view, 
  views, 
  localizer,
  onOpenSettings,
  isOwner = false
}) => {
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsViewMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleViewChange = (newView) => {
    onView(newView);
    setIsViewMenuOpen(false);
  };

  return (
    <div className="rbc-toolbar">
      {/* צד ימין - ניווט וכותרת */}
      <div className="rbc-toolbar-section rbc-toolbar-nav">
        <button 
          type="button" 
          className="rbc-today-btn" 
          onClick={() => onNavigate(Navigate.TODAY)}
        >
          היום
        </button>
        
        <div className="rbc-nav-arrows">
          <button type="button" className="rbc-nav-btn" onClick={() => onNavigate(Navigate.PREVIOUS)} title="קודם">
            <NavigationChevronRight size="20" />
          </button>
          <button type="button" className="rbc-nav-btn" onClick={() => onNavigate(Navigate.NEXT)} title="הבא">
            <NavigationChevronLeft size="20" />
          </button>
        </div>
        
        <span className="rbc-toolbar-label">{label}</span>
      </div>

      {/* צד שמאל - תצוגות והגדרות */}
      <div className="rbc-toolbar-section rbc-toolbar-actions">
        {/* Dropdown תצוגות */}
        <div className="rbc-view-dropdown" ref={dropdownRef}>
          <button 
            type="button" 
            className="rbc-view-select-button"
            onClick={() => setIsViewMenuOpen(!isViewMenuOpen)}
          >
            <span>{messages[view] || view}</span>
            <DropdownChevronDown size="20" />
          </button>
          
          {isViewMenuOpen && (
            <div className="rbc-view-menu">
              {views.map(viewName => (
                <button
                  key={viewName}
                  type="button"
                  className={view === viewName ? 'active' : ''}
                  onClick={() => handleViewChange(viewName)}
                >
                  {messages[viewName] || viewName}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* כפתור הגדרות */}
        {isOwner && (
          <button 
            type="button" 
            className="rbc-settings-btn"
            onClick={onOpenSettings}
            title="הגדרות"
          >
            <Settings size={20} />
          </button>
        )}
      </div>
    </div>
  );
};

// הודעות בעברית לכפתורים
const messages = {
  month: 'חודש',
  week: 'שבוע',
  work_week: 'שבוע עבודה',
  day: 'יום',
  agenda: 'סדר יום'
};

export default CalendarToolbar;
