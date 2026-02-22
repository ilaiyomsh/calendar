import React, { useState, useEffect, useMemo } from 'react';
import { X, Layout, Database, Settings, Calendar, ChevronLeft, Save, AlertTriangle } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import StructureTab from './StructureTab';
import MappingTab from './MappingTab';
import AdditionalTab from './AdditionalTab';
import CalendarTab from './CalendarTab';
import { useSettingsValidation } from './useSettingsValidation';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../Toast';
import ErrorDetailsModal from '../ErrorDetailsModal/ErrorDetailsModal';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import logger from '../../utils/logger';
import styles from './SettingsDialog.module.css';

// מיפוי מפתחות שגיאה לטאבים
const ERROR_KEY_TO_TAB = {
  // Mapping tab - לוחות ועמודות
  connectedBoardId: 'mapping',
  peopleColumnIds: 'mapping',
  currentBoard: 'mapping',
  timeReportingBoardId: 'mapping',
  tasksBoardId: 'mapping',
  tasksProjectColumnId: 'mapping',
  projectStatusColumnId: 'mapping',
  projectActiveStatusValues: 'mapping',
  taskStatusColumnId: 'mapping',
  taskActiveStatusValues: 'mapping',
  assignmentsBoardId: 'mapping',
  assignmentPersonColumnId: 'mapping',
  assignmentStartDateColumnId: 'mapping',
  assignmentEndDateColumnId: 'mapping',
  assignmentProjectLinkColumnId: 'mapping',
  dateColumnId: 'mapping',
  endTimeColumnId: 'mapping',
  durationColumnId: 'mapping',
  projectColumnId: 'mapping',
  taskColumnId: 'mapping',
  reporterColumnId: 'mapping',
  eventTypeStatusColumnId: 'mapping',
  nonBillableStatusColumnId: 'mapping',
  stageColumnId: 'mapping',
  eventTypeMapping: 'mapping',
  assignmentColumnId: 'mapping',
};

// סדר הטאבים לניווט
const TAB_ORDER = ['structure', 'mapping', 'additional', 'calendar'];

/**
 * דיאלוג הגדרות ראשי
 * מחולק ל-4 טאבים: מבנה דיווח, מיפוי נתונים, הגדרות נוספות, הגדרות יומן
 */
export default function SettingsDialog({ monday, onClose, context }) {
  const { customSettings, updateSettings } = useSettings();
  const { showErrorWithDetails, showSuccess, toasts, removeToast, errorDetailsModal, openErrorDetailsModal, closeErrorDetailsModal } = useToast();

  // State - טאב נוכחי
  const [activeTab, setActiveTab] = useState('structure');

  // State - הגדרות זמניות (עד לשמירה)
  const [tempSettings, setTempSettings] = useState({ ...customSettings });

  // State - רשימת לוחות
  const [boards, setBoards] = useState([]);
  const [loadingBoards, setLoadingBoards] = useState(false);

  // State - דיאלוג אישור שמירה חלקית
  const [partialSaveDialog, setPartialSaveDialog] = useState({
    isOpen: false,
    message: ''
  });

  // Validation
  const {
    errors,
    isValid,
    getMissingFieldsMessage
  } = useSettingsValidation(tempSettings, context);

  // חישוב מספר שגיאות לכל טאב
  const tabErrorCounts = useMemo(() => {
    const counts = { structure: 0, mapping: 0, additional: 0, calendar: 0 };
    for (const key of Object.keys(errors)) {
      const tab = ERROR_KEY_TO_TAB[key];
      if (tab) counts[tab]++;
    }
    return counts;
  }, [errors]);

  // טעינת רשימת לוחות בעלייה
  useEffect(() => {
    fetchBoards();
  }, []);

  // איפוס הגדרות זמניות בפתיחת הדיאלוג
  useEffect(() => {
    setTempSettings({ ...customSettings });
    setActiveTab('structure');
  }, [customSettings]);

  // שליפת רשימת לוחות
  const fetchBoards = async () => {
    setLoadingBoards(true);
    try {
      const query = `query { boards(limit: 500) { id name type } }`;
      const res = await monday.api(query);
      if (res.data?.boards) {
        const filteredBoards = res.data.boards
          .filter(board => board.type === 'board')
          .map(b => ({ id: b.id, name: b.name }));
        setBoards(filteredBoards);
      }
    } catch (err) {
      logger.error('SettingsDialog', 'Error fetching boards', err);
      showErrorWithDetails(err, { functionName: 'fetchBoards' });
    } finally {
      setLoadingBoards(false);
    }
  };

  // עדכון הגדרות זמניות
  const handleSettingsChange = (changes) => {
    setTempSettings(prev => ({ ...prev, ...changes }));
  };

  // מעבר לטאב הבא
  const handleNextTab = () => {
    const currentIndex = TAB_ORDER.indexOf(activeTab);
    if (currentIndex < TAB_ORDER.length - 1) {
      setActiveTab(TAB_ORDER[currentIndex + 1]);
    }
  };

  // חזרה לטאב הקודם
  const handlePrevTab = () => {
    const currentIndex = TAB_ORDER.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(TAB_ORDER[currentIndex - 1]);
    }
  };

  const currentTabIndex = TAB_ORDER.indexOf(activeTab);
  const isFirstTab = currentTabIndex === 0;
  const isLastTab = currentTabIndex === TAB_ORDER.length - 1;

  // שמות הטאבים לניווט
  const TAB_LABELS = {
    structure: 'מבנה דיווח',
    mapping: 'מיפוי נתונים',
    additional: 'הגדרות נוספות',
    calendar: 'הגדרות יומן'
  };

  const nextTabLabel = !isLastTab ? TAB_LABELS[TAB_ORDER[currentTabIndex + 1]] : null;
  const prevTabLabel = !isFirstTab ? TAB_LABELS[TAB_ORDER[currentTabIndex - 1]] : null;

  // שמירה סופית
  const handleSave = async () => {
    // אם יש שגיאות, נציג דיאלוג אישור
    if (!isValid) {
      const message = getMissingFieldsMessage();
      setPartialSaveDialog({
        isOpen: true,
        message
      });
      return;
    }

    await performSave();
  };

  // ביצוע השמירה בפועל
  const performSave = async () => {
    logger.functionStart('SettingsDialog.performSave', { tempSettings });

    const success = await updateSettings(tempSettings);

    if (success) {
      showSuccess('ההגדרות נשמרו בהצלחה');
      onClose();
    } else {
      showErrorWithDetails(new Error('שגיאה בשמירת ההגדרות'), { functionName: 'handleSave' });
    }

    setPartialSaveDialog({ isOpen: false, message: '' });
  };

  // אישור שמירה חלקית
  const handlePartialSaveConfirm = async () => {
    await performSave();
  };

  // ביטול שמירה חלקית
  const handlePartialSaveCancel = () => {
    setPartialSaveDialog({ isOpen: false, message: '' });
  };

  // Tab Header Component
  const TabHeader = ({ id, label, icon: Icon, isActive, onClick, errorCount }) => (
    <button
      className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
      onClick={onClick}
    >
      <Icon size={16} />
      {label}
      {errorCount > 0 && (
        <span className={styles.tabBadge}>{errorCount}</span>
      )}
    </button>
  );

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <button
            className={styles.closeButton}
            onClick={onClose}
          >
            <X size={24} />
          </button>
          <div className={styles.headerText}>
            <h2 className={styles.title}>הגדרות דיווח</h2>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <TabHeader
            id="structure"
            label="1. מבנה דיווח"
            icon={Layout}
            isActive={activeTab === 'structure'}
            onClick={() => setActiveTab('structure')}
            errorCount={tabErrorCounts.structure}
          />
          <TabHeader
            id="mapping"
            label="2. מיפוי נתונים"
            icon={Database}
            isActive={activeTab === 'mapping'}
            onClick={() => setActiveTab('mapping')}
            errorCount={tabErrorCounts.mapping}
          />
          <TabHeader
            id="additional"
            label="3. הגדרות נוספות"
            icon={Settings}
            isActive={activeTab === 'additional'}
            onClick={() => setActiveTab('additional')}
            errorCount={tabErrorCounts.additional}
          />
          <TabHeader
            id="calendar"
            label="4. הגדרות יומן"
            icon={Calendar}
            isActive={activeTab === 'calendar'}
            onClick={() => setActiveTab('calendar')}
            errorCount={tabErrorCounts.calendar}
          />
        </div>

        {/* Content */}
        <div className={styles.content}>
          {activeTab === 'structure' && (
            <StructureTab
              settings={tempSettings}
              onChange={handleSettingsChange}
            />
          )}

          {activeTab === 'mapping' && (
            <MappingTab
              settings={tempSettings}
              onChange={handleSettingsChange}
              monday={monday}
              context={context}
              boards={boards}
              loadingBoards={loadingBoards}
              showErrorWithDetails={showErrorWithDetails}
            />
          )}

          {activeTab === 'additional' && (
            <AdditionalTab
              settings={tempSettings}
              onChange={handleSettingsChange}
              monday={monday}
              context={context}
              boards={boards}
              loadingBoards={loadingBoards}
              showErrorWithDetails={showErrorWithDetails}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarTab
              settings={tempSettings}
              onChange={handleSettingsChange}
            />
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {isFirstTab ? (
            <button
              className={styles.buttonSecondary}
              onClick={onClose}
            >
              ביטול
            </button>
          ) : (
            <button
              className={styles.buttonSecondary}
              onClick={handlePrevTab}
            >
              חזרה: {prevTabLabel}
            </button>
          )}

          {isLastTab ? (
            <button
              className={`${styles.buttonPrimary} ${styles.buttonSave}`}
              onClick={handleSave}
            >
              <Save size={18} />
              שמור הגדרות
            </button>
          ) : (
            <button
              className={styles.buttonPrimary}
              onClick={handleNextTab}
            >
              הבא: {nextTabLabel}
              <ChevronLeft size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} onShowErrorDetails={openErrorDetailsModal} />

      {/* Error Details Modal */}
      <ErrorDetailsModal isOpen={!!errorDetailsModal} onClose={closeErrorDetailsModal} errorDetails={errorDetailsModal} />

      {/* Partial Save Confirmation Dialog */}
      <ConfirmDialog
        isOpen={partialSaveDialog.isOpen}
        onClose={handlePartialSaveCancel}
        onConfirm={handlePartialSaveConfirm}
        onCancel={handlePartialSaveCancel}
        title="שמירה חלקית"
        message={partialSaveDialog.message + '\n\nהאם לשמור בכל זאת?'}
        confirmText="שמור בכל זאת"
        cancelText="חזרה לעריכה"
        confirmButtonStyle="primary"
      />
    </div>
  );
}
