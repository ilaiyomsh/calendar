import React, { useState, useRef, useEffect } from 'react';
import { Navigate } from 'react-big-calendar';
import { Settings, Clock, Filter } from 'lucide-react';
import { NavigationChevronLeft, NavigationChevronRight, DropdownChevronDown } from "@vibe/icons";
import { useMobile } from '../contexts/MobileContext';
import FilterBar from './FilterBar';
import logger from '../utils/logger';

const CalendarToolbar = ({
  onNavigate,
  onView,
  label,
  view,
  views,
  localizer,
  onOpenSettings,
  isOwner = false,
  // Filter props
  filterProps = null,
  // Temporary events toggle props
  showTemporaryEvents = true,
  onToggleTemporaryEvents = null,
  hasTemporaryEventsFeature = false,
  // Approval props
  isManager = false,
  isApprovalEnabled = false,
  isSelectionMode = false,
  onToggleSelectionMode = null,
  onApproveAllInWeek = null
}) => {
  const isMobile = useMobile();
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const dropdownRef = useRef(null);
  const mobileFilterRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsViewMenuOpen(false);
      }
      if (mobileFilterRef.current && !mobileFilterRef.current.contains(event.target)) {
        setIsMobileFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleViewChange = (newView) => {
    onView(newView);
    setIsViewMenuOpen(false);
  };

  const filterCount = filterProps
    ? (filterProps.selectedReporterIds?.length || 0) + (filterProps.selectedProjectIds?.length || 0)
    : 0;

  // Mobile toolbar - single compact row
  if (isMobile) {
    return (
      <div className="rbc-toolbar rbc-toolbar-mobile">
        {/* ניווט */}
        <div className="rbc-nav-arrows">
          <button type="button" className="rbc-nav-btn" onClick={() => onNavigate(Navigate.PREVIOUS)} aria-label="קודם">
            <NavigationChevronRight size="20" />
          </button>
          <button type="button" className="rbc-nav-btn" onClick={() => onNavigate(Navigate.NEXT)} aria-label="הבא">
            <NavigationChevronLeft size="20" />
          </button>
        </div>

        <button
          type="button"
          className="rbc-today-btn"
          onClick={() => onNavigate(Navigate.TODAY)}
        >
          היום
        </button>

        <span className="rbc-toolbar-label">{label}</span>

        {/* פילטר - אייקון עם badge */}
        {filterProps ? (
          <div className="rbc-mobile-filter-wrapper" ref={mobileFilterRef}>
            <button
              type="button"
              className={`rbc-mobile-filter-btn ${filterCount > 0 ? 'active' : ''}`}
              onClick={() => setIsMobileFilterOpen(prev => !prev)}
              aria-label="סינון"
            >
              <Filter size={18} />
              {filterCount > 0 ? (
                <span className="rbc-mobile-filter-badge">{filterCount}</span>
              ) : null}
            </button>
            {isMobileFilterOpen ? (
              <>
                <div className="rbc-mobile-backdrop" onClick={() => setIsMobileFilterOpen(false)} />
                <div className="rbc-mobile-filter-dropdown">
                  <FilterBar {...filterProps} />
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {/* כפתורי אישור מנהל - מובייל */}
        {isManager && isApprovalEnabled && onToggleSelectionMode ? (
          <button
            type="button"
            className={`rbc-approval-btn-mobile ${isSelectionMode ? 'active' : ''}`}
            onClick={onToggleSelectionMode}
            aria-label={isSelectionMode ? 'בטל בחירה' : 'בחירת דיווחים'}
          >
            {isSelectionMode ? '✕' : '✓'}
          </button>
        ) : null}

        {/* טוגל מתוכננים - אייקון בלבד */}
        {hasTemporaryEventsFeature && onToggleTemporaryEvents ? (
          <button
            type="button"
            className={`rbc-temporary-toggle-btn ${showTemporaryEvents ? 'active' : ''}`}
            onClick={onToggleTemporaryEvents}
            aria-label={showTemporaryEvents ? 'הסתר מתוכננים' : 'הצג מתוכננים'}
          >
            <Clock size={18} />
          </button>
        ) : null}

        {/* בחירת תצוגה */}
        <div className="rbc-view-dropdown" ref={dropdownRef}>
          <button
            type="button"
            className="rbc-view-select-button"
            onClick={() => setIsViewMenuOpen(!isViewMenuOpen)}
            aria-haspopup="listbox"
            aria-expanded={isViewMenuOpen}
          >
            <span>{messages[view] || view}</span>
            <DropdownChevronDown size="16" />
          </button>

          {isViewMenuOpen ? (
            <>
              <div className="rbc-mobile-backdrop" onClick={() => setIsViewMenuOpen(false)} />
              <div className="rbc-view-menu" role="listbox">
                {views.map(viewName => (
                  <button
                    key={viewName}
                    type="button"
                    role="option"
                    aria-selected={view === viewName}
                    className={view === viewName ? 'active' : ''}
                    onClick={() => handleViewChange(viewName)}
                  >
                    {messages[viewName] || viewName}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  // Desktop toolbar
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
          <button type="button" className="rbc-nav-btn" onClick={() => onNavigate(Navigate.PREVIOUS)} aria-label="קודם">
            <NavigationChevronRight size="20" />
          </button>
          <button type="button" className="rbc-nav-btn" onClick={() => onNavigate(Navigate.NEXT)} aria-label="הבא">
            <NavigationChevronLeft size="20" />
          </button>
        </div>

        <span className="rbc-toolbar-label">{label}</span>
      </div>

      {/* אמצע - פילטרים */}
      {filterProps ? (
        <div className="rbc-toolbar-section rbc-toolbar-filters">
          <FilterBar {...filterProps} />
        </div>
      ) : null}

      {/* צד שמאל - תצוגות והגדרות */}
      <div className="rbc-toolbar-section rbc-toolbar-actions">
        {/* כפתורי אישור מנהל */}
        {isManager && isApprovalEnabled && onToggleSelectionMode ? (
          <>
            <button
              type="button"
              className={`rbc-approval-btn ${isSelectionMode ? 'active' : ''}`}
              onClick={onToggleSelectionMode}
              title={isSelectionMode ? 'בטל בחירה' : 'בחירת דיווחים לאישור'}
            >
              <span>{isSelectionMode ? 'בטל בחירה' : 'בחירת דיווחים'}</span>
            </button>
            <button
              type="button"
              className="rbc-approval-btn rbc-approve-all-btn"
              onClick={onApproveAllInWeek}
              title="אשר את כל הדיווחים הממתינים בתצוגה"
            >
              <span>אשר הכל</span>
            </button>
          </>
        ) : null}

        {/* Dropdown תצוגות */}
        <div className="rbc-view-dropdown" ref={dropdownRef}>
          <button
            type="button"
            className="rbc-view-select-button"
            onClick={() => setIsViewMenuOpen(!isViewMenuOpen)}
            aria-haspopup="listbox"
            aria-expanded={isViewMenuOpen}
          >
            <span>{messages[view] || view}</span>
            <DropdownChevronDown size="20" />
          </button>

          {isViewMenuOpen ? (
            <div className="rbc-view-menu" role="listbox">
              {views.map(viewName => (
                <button
                  key={viewName}
                  type="button"
                  role="option"
                  aria-selected={view === viewName}
                  className={view === viewName ? 'active' : ''}
                  onClick={() => handleViewChange(viewName)}
                >
                  {messages[viewName] || viewName}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* טוגל הצגת אירועים מתוכננים */}
        {hasTemporaryEventsFeature && onToggleTemporaryEvents ? (
          <button
            type="button"
            className={`rbc-temporary-toggle-btn ${showTemporaryEvents ? 'active' : ''}`}
            onClick={onToggleTemporaryEvents}
            title={showTemporaryEvents ? 'הסתר מתוכננים' : 'הצג מתוכננים'}
          >
            <Clock size={18} />
            <span className="rbc-temporary-toggle-label">מתוכננים</span>
          </button>
        ) : null}

        {/* כפתור הגדרות - מוסתר במובייל */}
        {isOwner ? (
          <button
            type="button"
            className="rbc-settings-btn"
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

// הודעות בעברית לכפתורים
const messages = {
  month: 'חודש',
  week: 'שבוע',
  work_week: 'שבוע עבודה',
  three_day: '3 ימים',
  day: 'יום',
  agenda: 'סדר יום'
};

export default CalendarToolbar;
