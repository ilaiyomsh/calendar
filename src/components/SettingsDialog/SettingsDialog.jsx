import React, { useState, useEffect, useMemo } from 'react';
import { X, Layout, Database, Filter, ChevronLeft, Save, AlertTriangle } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import StructureTab from './StructureTab';
import MappingTab from './MappingTab';
import FiltersTab from './FiltersTab';
import { useSettingsValidation } from './useSettingsValidation';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../Toast';
import ErrorDetailsModal from '../ErrorDetailsModal/ErrorDetailsModal';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import logger from '../../utils/logger';
import styles from './SettingsDialog.module.css';

// מיפוי מפתחות שגיאה לטאבים
const ERROR_KEY_TO_TAB = {
  // Structure tab
  connectedBoardId: 'structure',
  peopleColumnIds: 'structure',
  currentBoard: 'structure',
  timeReportingBoardId: 'structure',
  tasksBoardId: 'structure',
  tasksProjectColumnId: 'structure',
  projectStatusColumnId: 'structure',
  projectActiveStatusValues: 'structure',
  taskStatusColumnId: 'structure',
  taskActiveStatusValues: 'structure',
  assignmentsBoardId: 'structure',
  assignmentPersonColumnId: 'structure',
  assignmentStartDateColumnId: 'structure',
  assignmentEndDateColumnId: 'structure',
  assignmentProjectLinkColumnId: 'structure',
  // Mapping tab
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

/**
 * דיאלוג הגדרות ראשי
 * מחולק לשני טאבים: מבנה הדיווח ומיפוי נתונים
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
    const counts = { structure: 0, mapping: 0, filters: 0 };
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
    if (activeTab === 'structure') {
      setActiveTab('mapping');
    } else if (activeTab === 'mapping') {
      setActiveTab('filters');
    }
  };

  // חזרה לטאב הקודם
  const handlePrevTab = () => {
    if (activeTab === 'mapping') {
      setActiveTab('structure');
    } else if (activeTab === 'filters') {
      setActiveTab('mapping');
    }
  };

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
      <Icon size={18} />
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
            label="1. מבנה הדיווח"
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
            id="filters"
            label="3. מקורות פילטר"
            icon={Filter}
            isActive={activeTab === 'filters'}
            onClick={() => setActiveTab('filters')}
            errorCount={tabErrorCounts.filters}
          />
        </div>

        {/* Content */}
        <div className={styles.content}>
          {activeTab === 'structure' && (
            <StructureTab
              settings={tempSettings}
              onChange={handleSettingsChange}
              monday={monday}
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

          {activeTab === 'filters' && (
            <FiltersTab
              settings={tempSettings}
              onChange={handleSettingsChange}
              monday={monday}
              boards={boards}
              loadingBoards={loadingBoards}
              showErrorWithDetails={showErrorWithDetails}
            />
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {activeTab === 'structure' && (
            <>
              <button
                className={styles.buttonSecondary}
                onClick={onClose}
              >
                ביטול
              </button>
              <button
                className={styles.buttonPrimary}
                onClick={handleNextTab}
              >
                הבא: מיפוי נתונים
                <ChevronLeft size={18} />
              </button>
            </>
          )}

          {activeTab === 'mapping' && (
            <>
              <button
                className={styles.buttonSecondary}
                onClick={handlePrevTab}
              >
                חזרה למבנה
              </button>
              <button
                className={styles.buttonPrimary}
                onClick={handleNextTab}
              >
                הבא: מקורות פילטר
                <ChevronLeft size={18} />
              </button>
            </>
          )}

          {activeTab === 'filters' && (
            <>
              <button
                className={styles.buttonSecondary}
                onClick={handlePrevTab}
              >
                חזרה למיפוי
              </button>
              <button
                className={`${styles.buttonPrimary} ${styles.buttonSave}`}
                onClick={handleSave}
              >
                <Save size={18} />
                שמור הגדרות
              </button>
            </>
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
