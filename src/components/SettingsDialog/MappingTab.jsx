import React, { useState, useEffect } from 'react';
import { Briefcase, ListTodo, Table, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import MultiSelect from './MultiSelect';
import { STRUCTURE_MODES } from '../../contexts/SettingsContext';
import { fetchStatusColumnsFromBoard, parseStatusLabels, createEventTypeStatusColumn } from '../../utils/mondayApi';
import { validateEventTypeColumn, REQUIRED_EVENT_TYPE_LABELS } from '../../utils/eventTypeValidation';
import logger from '../../utils/logger';
import styles from './MappingTab.module.css';

/**
 * טאב מיפוי נתונים
 * מציג אקורדיונים דינמיים לפי structureMode
 */
const MappingTab = ({ 
  settings, 
  onChange, 
  monday, 
  context,
  boards,
  loadingBoards,
  showErrorWithDetails
}) => {
  const { structureMode } = settings;
  
  // State - סקשנים פתוחים
  const [openSection, setOpenSection] = useState('projects');
  
  // State - עמודות לוח פרויקטים
  const [peopleColumns, setPeopleColumns] = useState([]);
  const [tasksProjectColumns, setTasksProjectColumns] = useState([]);
  const [projectStatusColumns, setProjectStatusColumns] = useState([]);
  const [projectStatusLabels, setProjectStatusLabels] = useState([]);
  const [loadingPeopleColumns, setLoadingPeopleColumns] = useState(false);
  const [loadingTasksColumns, setLoadingTasksColumns] = useState(false);
  const [loadingProjectStatusColumns, setLoadingProjectStatusColumns] = useState(false);
  
  // State - לוחות ועמודות משימות
  const [taskBoards, setTaskBoards] = useState([]);
  const [taskStatusColumns, setTaskStatusColumns] = useState([]);
  const [taskStatusLabels, setTaskStatusLabels] = useState([]);
  const [loadingTaskStatusColumns, setLoadingTaskStatusColumns] = useState(false);
  
  // State - עמודות לוח דיווחים נוכחי
  const [dateColumns, setDateColumns] = useState([]);
  const [durationColumns, setDurationColumns] = useState([]);
  const [projectColumns, setProjectColumns] = useState([]);
  const [taskColumns, setTaskColumns] = useState([]);
  const [reporterColumns, setReporterColumns] = useState([]);
  const [statusColumns, setStatusColumns] = useState([]);
  const [statusColumnsWithSettings, setStatusColumnsWithSettings] = useState([]);
  const [stageColumns, setStageColumns] = useState([]);
  const [textColumns, setTextColumns] = useState([]);
  const [loadingCurrentBoardColumns, setLoadingCurrentBoardColumns] = useState(false);
  
  // State - ולידציה של עמודת סוג דיווח
  const [eventTypeValidation, setEventTypeValidation] = useState({ isValid: true, missingLabels: [] });
  const [isCreatingEventTypeColumn, setIsCreatingEventTypeColumn] = useState(false);
  
  // בדיקה אם מצב כולל משימות
  const hasTasks = structureMode === STRUCTURE_MODES.PROJECT_WITH_TASKS;
  
  // בדיקה אם מצב כולל סיווג
  const hasStage = structureMode === STRUCTURE_MODES.PROJECT_WITH_STAGE;

  // טעינת עמודות לוח פרויקטים בעת שינוי
  useEffect(() => {
    if (settings.connectedBoardId) {
      fetchPeopleColumns(settings.connectedBoardId);
      fetchProjectTasksColumns(settings.connectedBoardId);
      if (settings.projectStatusFilterEnabled) {
        fetchProjectStatusColumns(settings.connectedBoardId, settings.projectStatusColumnId);
      }
    }
  }, [settings.connectedBoardId]);

  // טעינת עמודות לוח נוכחי
  useEffect(() => {
    if (context?.boardId) {
      fetchCurrentBoardColumns(context.boardId, settings.connectedBoardId, settings.tasksBoardId);
    }
  }, [context?.boardId, settings.connectedBoardId, settings.tasksBoardId]);

  // טעינת לוחות משימות מעמודת Connect Boards
  useEffect(() => {
    if (settings.tasksProjectColumnId && settings.connectedBoardId) {
      extractTaskBoardsFromColumn(settings.tasksProjectColumnId, settings.connectedBoardId);
    }
  }, [settings.tasksProjectColumnId, settings.connectedBoardId]);

  // טעינת עמודות סטטוס משימות
  useEffect(() => {
    if (settings.tasksBoardId && settings.taskStatusFilterEnabled) {
      fetchTaskStatusColumns(settings.tasksBoardId, settings.taskStatusColumnId);
    }
  }, [settings.tasksBoardId, settings.taskStatusFilterEnabled]);

  // --- API Functions ---
  
  const fetchPeopleColumns = async (boardId) => {
    if (!boardId) return;
    setLoadingPeopleColumns(true);
    try {
      const query = `query { boards(ids: [${boardId}]) { columns { id title type } } }`;
      const res = await monday.api(query);
      if (res.data?.boards?.[0]) {
        const cols = res.data.boards[0].columns
          .filter(col => col.type === 'people')
          .map(col => ({ id: col.id, name: col.title }));
        setPeopleColumns(cols);
      }
    } catch (err) {
      logger.error('MappingTab', 'Error fetching people columns', err);
      showErrorWithDetails(err, { functionName: 'fetchPeopleColumns' });
    } finally {
      setLoadingPeopleColumns(false);
    }
  };

  const fetchProjectTasksColumns = async (boardId) => {
    if (!boardId) {
      setTasksProjectColumns([]);
      return;
    }
    setLoadingTasksColumns(true);
    try {
      const query = `query { boards(ids: [${boardId}]) { columns { id title type settings_str } } }`;
      const res = await monday.api(query);
      if (res.data?.boards?.[0]) {
        const cols = res.data.boards[0].columns
          .filter(col => col.type === 'board_relation')
          .map(col => ({ id: col.id, name: col.title, settings_str: col.settings_str }));
        setTasksProjectColumns(cols);
      }
    } catch (err) {
      logger.error('MappingTab', 'Error fetching project tasks columns', err);
      setTasksProjectColumns([]);
    } finally {
      setLoadingTasksColumns(false);
    }
  };

  const extractTaskBoardsFromColumn = async (columnId, boardId) => {
    if (!columnId || !boardId) return;
    try {
      const query = `query { boards(ids: [${boardId}]) { columns(ids: ["${columnId}"]) { settings_str } } }`;
      const res = await monday.api(query);
      if (res.data?.boards?.[0]?.columns?.[0]) {
        const settings = JSON.parse(res.data.boards[0].columns[0].settings_str || '{}');
        const boardIds = settings.boardIds || [];
        if (boardIds.length > 0) {
          const boardsQuery = `query { boards(ids: [${boardIds.join(',')}]) { id name } }`;
          const boardsRes = await monday.api(boardsQuery);
          if (boardsRes.data?.boards) {
            setTaskBoards(boardsRes.data.boards.map(b => ({ id: b.id, name: b.name })));
          }
        } else {
          setTaskBoards([]);
        }
      }
    } catch (err) {
      logger.error('MappingTab', 'Error extracting task boards', err);
      setTaskBoards([]);
    }
  };

  const fetchCurrentBoardColumns = async (boardId, filterByConnectedBoard = null, filterByTaskBoard = null) => {
    if (!boardId) return;
    setLoadingCurrentBoardColumns(true);
    try {
      const query = `query { boards(ids: [${boardId}]) { columns { id title type settings_str } } }`;
      const res = await monday.api(query);
      if (res.data?.boards?.[0]) {
        const columns = res.data.boards[0].columns;
        
        setDateColumns(columns.filter(col => col.type === 'date').map(col => ({ id: col.id, name: col.title })));
        setDurationColumns(columns.filter(col => col.type === 'numbers').map(col => ({ id: col.id, name: col.title })));
        setReporterColumns(columns.filter(col => col.type === 'people').map(col => ({ id: col.id, name: col.title })));
        setStatusColumns(columns.filter(col => col.type === 'status').map(col => ({ id: col.id, name: col.title })));
        // שמירת עמודות סטטוס עם ה-settings לצורך ולידציה
        setStatusColumnsWithSettings(columns.filter(col => col.type === 'status').map(col => ({ 
          id: col.id, 
          name: col.title,
          settings_str: col.settings_str 
        })));
        setStageColumns(columns.filter(col => col.type === 'status' || col.type === 'dropdown').map(col => ({ id: col.id, name: col.title })));
        setTextColumns(columns.filter(col => col.type === 'text' || col.type === 'long_text').map(col => ({ id: col.id, name: col.title })));
        
        // עמודות קישור לפרויקט - מסוננות לפי לוח פרויקטים
        setProjectColumns(columns.filter(col => {
          if (col.type !== 'board_relation') return false;
          if (filterByConnectedBoard) {
            try {
              const columnSettings = JSON.parse(col.settings_str || '{}');
              return columnSettings.boardIds?.includes(parseInt(filterByConnectedBoard));
            } catch { return false; }
          }
          return true;
        }).map(col => ({ id: col.id, name: col.title })));
        
        // עמודות קישור למשימה - מסוננות לפי לוח משימות
        setTaskColumns(columns.filter(col => {
          if (col.type !== 'board_relation') return false;
          if (filterByTaskBoard) {
            try {
              const columnSettings = JSON.parse(col.settings_str || '{}');
              return columnSettings.boardIds?.includes(parseInt(filterByTaskBoard));
            } catch { return false; }
          }
          return true;
        }).map(col => ({ id: col.id, name: col.title })));
        
        // ולידציה של עמודת סוג דיווח אם כבר נבחרה
        if (settings.eventTypeStatusColumnId) {
          const selectedCol = columns.find(col => col.id === settings.eventTypeStatusColumnId);
          if (selectedCol?.settings_str) {
            const validation = validateEventTypeColumn(selectedCol.settings_str);
            setEventTypeValidation(validation);
          }
        }
      }
    } catch (err) {
      logger.error('MappingTab', 'Error fetching current board columns', err);
    } finally {
      setLoadingCurrentBoardColumns(false);
    }
  };

  const fetchProjectStatusColumns = async (boardId, selectedColumnId = null) => {
    if (!boardId) {
      setProjectStatusColumns([]);
      setProjectStatusLabels([]);
      return;
    }
    setLoadingProjectStatusColumns(true);
    try {
      const statusCols = await fetchStatusColumnsFromBoard(monday, boardId);
      setProjectStatusColumns(statusCols.map(col => ({ id: col.id, name: col.title, settings_str: col.settings_str })));
      
      if (selectedColumnId) {
        const selectedCol = statusCols.find(col => col.id === selectedColumnId);
        if (selectedCol) {
          const labels = parseStatusLabels(selectedCol.settings_str);
          setProjectStatusLabels(labels.map(l => ({ id: l.label, name: l.label })));
        }
      }
    } catch (err) {
      logger.error('MappingTab', 'Error fetching project status columns', err);
      setProjectStatusColumns([]);
    } finally {
      setLoadingProjectStatusColumns(false);
    }
  };

  const fetchTaskStatusColumns = async (boardId, selectedColumnId = null) => {
    if (!boardId) {
      setTaskStatusColumns([]);
      setTaskStatusLabels([]);
      return;
    }
    setLoadingTaskStatusColumns(true);
    try {
      const statusCols = await fetchStatusColumnsFromBoard(monday, boardId);
      setTaskStatusColumns(statusCols.map(col => ({ id: col.id, name: col.title, settings_str: col.settings_str })));
      
      if (selectedColumnId) {
        const selectedCol = statusCols.find(col => col.id === selectedColumnId);
        if (selectedCol) {
          const labels = parseStatusLabels(selectedCol.settings_str);
          setTaskStatusLabels(labels.map(l => ({ id: l.label, name: l.label })));
        }
      }
    } catch (err) {
      logger.error('MappingTab', 'Error fetching task status columns', err);
      setTaskStatusColumns([]);
    } finally {
      setLoadingTaskStatusColumns(false);
    }
  };

  const fetchProjectStatusLabels = (columnId) => {
    if (!columnId) {
      setProjectStatusLabels([]);
      return;
    }
    const selectedCol = projectStatusColumns.find(col => col.id === columnId);
    if (selectedCol?.settings_str) {
      const labels = parseStatusLabels(selectedCol.settings_str);
      setProjectStatusLabels(labels.map(l => ({ id: l.label, name: l.label })));
    } else {
      setProjectStatusLabels([]);
    }
  };

  const fetchTaskStatusLabels = (columnId) => {
    if (!columnId) {
      setTaskStatusLabels([]);
      return;
    }
    const selectedCol = taskStatusColumns.find(col => col.id === columnId);
    if (selectedCol?.settings_str) {
      const labels = parseStatusLabels(selectedCol.settings_str);
      setTaskStatusLabels(labels.map(l => ({ id: l.label, name: l.label })));
    } else {
      setTaskStatusLabels([]);
    }
  };

  // --- Handlers ---

  const handleConnectedBoardChange = (newBoardId) => {
    onChange({
      connectedBoardId: newBoardId,
      peopleColumnIds: [],
      tasksProjectColumnId: '',
      tasksBoardId: '',
      projectStatusColumnId: '',
      projectActiveStatusValues: []
    });
    setPeopleColumns([]);
    setTasksProjectColumns([]);
    setTaskBoards([]);
    setProjectStatusColumns([]);
    setProjectStatusLabels([]);
    
    if (newBoardId) {
      fetchPeopleColumns(newBoardId);
      fetchProjectTasksColumns(newBoardId);
    }
  };

  const handleTasksProjectColumnChange = (newColumnId) => {
    onChange({
      tasksProjectColumnId: newColumnId,
      tasksBoardId: '',
      taskColumnId: ''
    });
    setTaskBoards([]);
    if (newColumnId) {
      extractTaskBoardsFromColumn(newColumnId, settings.connectedBoardId);
    }
  };

  const handleTasksBoardChange = (newBoardId) => {
    onChange({
      tasksBoardId: newBoardId,
      taskColumnId: '',
      taskStatusColumnId: '',
      taskActiveStatusValues: []
    });
    if (newBoardId && context?.boardId) {
      fetchCurrentBoardColumns(context.boardId, settings.connectedBoardId, newBoardId);
    }
  };

  const handleProjectStatusFilterToggle = () => {
    const enabled = !settings.projectStatusFilterEnabled;
    onChange({
      projectStatusFilterEnabled: enabled,
      projectStatusColumnId: enabled ? settings.projectStatusColumnId : '',
      projectActiveStatusValues: enabled ? settings.projectActiveStatusValues : []
    });
    if (enabled && settings.connectedBoardId) {
      fetchProjectStatusColumns(settings.connectedBoardId);
    }
  };

  const handleProjectStatusColumnChange = (newColumnId) => {
    onChange({
      projectStatusColumnId: newColumnId,
      projectActiveStatusValues: []
    });
    fetchProjectStatusLabels(newColumnId);
  };

  const handleTaskStatusFilterToggle = () => {
    const enabled = !settings.taskStatusFilterEnabled;
    onChange({
      taskStatusFilterEnabled: enabled,
      taskStatusColumnId: enabled ? settings.taskStatusColumnId : '',
      taskActiveStatusValues: enabled ? settings.taskActiveStatusValues : []
    });
    if (enabled && settings.tasksBoardId) {
      fetchTaskStatusColumns(settings.tasksBoardId);
    }
  };

  const handleTaskStatusColumnChange = (newColumnId) => {
    onChange({
      taskStatusColumnId: newColumnId,
      taskActiveStatusValues: []
    });
    fetchTaskStatusLabels(newColumnId);
  };

  // ולידציה של עמודת סוג דיווח
  const handleEventTypeColumnChange = (newColumnId) => {
    onChange({ eventTypeStatusColumnId: newColumnId });
    
    if (newColumnId) {
      const selectedCol = statusColumnsWithSettings.find(col => col.id === newColumnId);
      if (selectedCol?.settings_str) {
        const validation = validateEventTypeColumn(selectedCol.settings_str);
        setEventTypeValidation(validation);
      } else {
        setEventTypeValidation({ isValid: true, missingLabels: [] });
      }
    } else {
      setEventTypeValidation({ isValid: true, missingLabels: [] });
    }
  };

  // יצירת עמודת סוג דיווח חדשה
  const handleCreateEventTypeColumn = async () => {
    if (!context?.boardId) return;
    
    setIsCreatingEventTypeColumn(true);
    try {
      const newColumnId = await createEventTypeStatusColumn(monday, context.boardId);
      if (newColumnId) {
        // רענון רשימת העמודות
        await fetchCurrentBoardColumns(context.boardId, settings.connectedBoardId, settings.tasksBoardId);
        // בחירת העמודה החדשה
        onChange({ eventTypeStatusColumnId: newColumnId });
        setEventTypeValidation({ isValid: true, missingLabels: [] });
        logger.info('MappingTab', 'Created new event type column', { newColumnId });
      }
    } catch (err) {
      logger.error('MappingTab', 'Error creating event type column', err);
      showErrorWithDetails(err, { functionName: 'handleCreateEventTypeColumn' });
    } finally {
      setIsCreatingEventTypeColumn(false);
    }
  };

  // --- Accordion Component ---
  const AccordionSection = ({ id, title, icon: Icon, children, isVisible = true }) => {
    if (!isVisible) return null;
    const isOpen = openSection === id;
    // Note: errorCount functionality not yet implemented
    const errorCount = 0;
    
    return (
      <div className={`${styles.accordion} ${isOpen ? styles.accordionOpen : ''}`}>
        <button 
          className={styles.accordionHeader}
          onClick={() => setOpenSection(isOpen ? null : id)}
        >
          <div className={styles.accordionTitle}>
            <div className={`${styles.accordionIcon} ${isOpen ? styles.accordionIconActive : ''}`}>
              <Icon size={20} />
            </div>
            <span className={styles.accordionTitleText}>{title}</span>
            {errorCount > 0 && (
              <span className={styles.accordionBadge}>
                <AlertTriangle size={14} />
                {errorCount}
              </span>
            )}
          </div>
          {isOpen ? <ChevronUp size={20} className={styles.chevron} /> : <ChevronDown size={20} className={styles.chevron} />}
        </button>
        
        {isOpen && (
          <div className={styles.accordionContent}>
            {children}
          </div>
        )}
      </div>
    );
  };

  // --- Field Wrapper Component ---
  const FieldWrapper = ({ label, required, description, error, children }) => (
    <div className={styles.fieldWrapper}>
      <label className={styles.fieldLabel}>
        {label} {required && <span className={styles.required}>*</span>}
      </label>
      {description && <p className={styles.fieldDescription}>{description}</p>}
      {children}
      {error && <p className={styles.fieldError}>{error}</p>}
    </div>
  );

  // --- Toggle Component ---
  const ToggleRow = ({ label, description, checked, onChange, disabled }) => (
    <div className={styles.toggleRow}>
      <div className={styles.toggleInfo}>
        <label className={styles.fieldLabel}>{label}</label>
        {description && <p className={styles.fieldDescription}>{description}</p>}
      </div>
      <button 
        className={`${styles.toggle} ${checked ? styles.toggleOn : ''} ${disabled ? styles.toggleDisabled : ''}`}
        onClick={() => !disabled && onChange()}
        disabled={disabled}
      >
        <span className={styles.toggleKnob} />
      </button>
    </div>
  );

  return (
    <div className={styles.container}>
      {/* סקשן 1: לוח פרויקטים */}
      <AccordionSection id="projects" title="לוח פרויקטים" icon={Briefcase}>
        <FieldWrapper label="בחר את לוח הפרויקטים" required>
          <SearchableSelect 
            options={boards} 
            value={settings.connectedBoardId} 
            onChange={handleConnectedBoardChange} 
            placeholder="בחר לוח..." 
            isLoading={loadingBoards} 
          />
        </FieldWrapper>

        <FieldWrapper label="עמודות לשיוך (אנשים)" required>
          <div className={!settings.connectedBoardId ? styles.disabled : ''}>
            <MultiSelect 
              options={peopleColumns} 
              value={settings.peopleColumnIds} 
              onChange={(ids) => onChange({ peopleColumnIds: ids })} 
              placeholder="בחר עמודות אנשים..." 
              isLoading={loadingPeopleColumns} 
              disabled={!settings.connectedBoardId} 
            />
          </div>
        </FieldWrapper>

        <ToggleRow
          label="סינון פרויקטים לפי סטטוס"
          checked={settings.projectStatusFilterEnabled}
          onChange={handleProjectStatusFilterToggle}
          disabled={!settings.connectedBoardId}
        />

        {settings.projectStatusFilterEnabled && (
          <>
            <FieldWrapper label="עמודת סטטוס" required>
              <SearchableSelect 
                options={projectStatusColumns} 
                value={settings.projectStatusColumnId} 
                onChange={handleProjectStatusColumnChange} 
                placeholder="בחר עמודת סטטוס..." 
                isLoading={loadingProjectStatusColumns}
                showSearch={false}
              />
            </FieldWrapper>

            {settings.projectStatusColumnId && (
              <FieldWrapper label="ערכי סטטוס פעילים" required>
                <MultiSelect 
                  options={projectStatusLabels} 
                  value={settings.projectActiveStatusValues} 
                  onChange={(values) => onChange({ projectActiveStatusValues: values })} 
                  placeholder="בחר ערכי סטטוס..." 
                />
              </FieldWrapper>
            )}
          </>
        )}
      </AccordionSection>

      {/* סקשן 2: לוח משימות (מותנה) */}
      <AccordionSection 
        id="tasks" 
        title="לוח משימות" 
        icon={ListTodo}
        isVisible={hasTasks}
      >
        <FieldWrapper label="עמודת משימות בלוח פרויקטים" required>
          <div className={!settings.connectedBoardId ? styles.disabled : ''}>
            <SearchableSelect 
              options={tasksProjectColumns} 
              value={settings.tasksProjectColumnId} 
              onChange={handleTasksProjectColumnChange} 
              placeholder="בחר עמודת משימות..." 
              isLoading={loadingTasksColumns}
              disabled={!settings.connectedBoardId}
              showSearch={false}
            />
          </div>
        </FieldWrapper>

        {settings.tasksProjectColumnId && (
          <FieldWrapper label="לוח משימות" required>
            <SearchableSelect 
              options={taskBoards} 
              value={settings.tasksBoardId} 
              onChange={handleTasksBoardChange} 
              placeholder="בחר לוח משימות..." 
              showSearch={false}
            />
          </FieldWrapper>
        )}

        {settings.tasksBoardId && (
          <>
            <ToggleRow
              label="סינון משימות לפי סטטוס"
              checked={settings.taskStatusFilterEnabled}
              onChange={handleTaskStatusFilterToggle}
            />

            {settings.taskStatusFilterEnabled && (
              <>
                <FieldWrapper
                  label="עמודת סטטוס במשימות"
                  required
                >
                  <SearchableSelect 
                    options={taskStatusColumns} 
                    value={settings.taskStatusColumnId} 
                    onChange={handleTaskStatusColumnChange} 
                    placeholder="בחר עמודת סטטוס..." 
                    isLoading={loadingTaskStatusColumns}
                    showSearch={false}
                  />
                </FieldWrapper>

                {settings.taskStatusColumnId && (
                  <FieldWrapper label="ערכי סטטוס פעילים" required>
                    <MultiSelect 
                      options={taskStatusLabels} 
                      value={settings.taskActiveStatusValues} 
                      onChange={(values) => onChange({ taskActiveStatusValues: values })} 
                      placeholder="בחר ערכי סטטוס..." 
                    />
                  </FieldWrapper>
                )}
              </>
            )}
          </>
        )}
      </AccordionSection>

      {/* סקשן 3: לוח דיווחי שעות */}
      <AccordionSection id="timesheet" title="לוח דיווחי שעות (נוכחי)" icon={Table}>
        {!context?.boardId && (
          <p className={styles.warning}>לא נמצא לוח נוכחי - אנא פתח את האפליקציה מתוך לוח</p>
        )}

        <FieldWrapper label="עמודת קישור לפרויקט" required>
          <div className={!context?.boardId ? styles.disabled : ''}>
            <SearchableSelect 
              options={projectColumns} 
              value={settings.projectColumnId} 
              onChange={(id) => onChange({ projectColumnId: id })} 
              placeholder="בחר עמודת קישור..." 
              isLoading={loadingCurrentBoardColumns}
              showSearch={false}
            />
          </div>
        </FieldWrapper>

        {hasTasks && settings.tasksBoardId && (
          <FieldWrapper label="עמודת קישור למשימה" required>
            <div className={!context?.boardId ? styles.disabled : ''}>
              <SearchableSelect 
                options={taskColumns} 
                value={settings.taskColumnId} 
                onChange={(id) => onChange({ taskColumnId: id })} 
                placeholder="בחר עמודת קישור למשימה..." 
                isLoading={loadingCurrentBoardColumns}
                showSearch={false}
              />
            </div>
          </FieldWrapper>
        )}

        <FieldWrapper label="עמודת תאריך" required>
          <div className={!context?.boardId ? styles.disabled : ''}>
            <SearchableSelect 
              options={dateColumns} 
              value={settings.dateColumnId} 
              onChange={(id) => onChange({ dateColumnId: id })} 
              placeholder="בחר עמודת תאריך..." 
              isLoading={loadingCurrentBoardColumns}
              showSearch={false}
            />
          </div>
        </FieldWrapper>

        <FieldWrapper label="עמודת משך זמן" required>
          <div className={!context?.boardId ? styles.disabled : ''}>
            <SearchableSelect 
              options={durationColumns} 
              value={settings.durationColumnId} 
              onChange={(id) => onChange({ durationColumnId: id })} 
              placeholder="בחר עמודת משך זמן..." 
              isLoading={loadingCurrentBoardColumns}
              showSearch={false}
            />
          </div>
        </FieldWrapper>

        <FieldWrapper label="עמודת מדווח" required>
          <div className={!context?.boardId ? styles.disabled : ''}>
            <SearchableSelect 
              options={reporterColumns} 
              value={settings.reporterColumnId} 
              onChange={(id) => onChange({ reporterColumnId: id })} 
              placeholder="בחר עמודת מדווח..." 
              isLoading={loadingCurrentBoardColumns}
              showSearch={false}
            />
          </div>
        </FieldWrapper>

        <FieldWrapper label="עמודת סוג דיווח" required>
          <div className={!context?.boardId ? styles.disabled : ''}>
            <SearchableSelect 
              options={statusColumns} 
              value={settings.eventTypeStatusColumnId} 
              onChange={handleEventTypeColumnChange} 
              placeholder="בחר עמודת סוג דיווח..." 
              isLoading={loadingCurrentBoardColumns}
              showSearch={false}
            />
          </div>
          {settings.eventTypeStatusColumnId && !eventTypeValidation.isValid && (
            <div className={styles.validationWarning}>
              <AlertTriangle size={16} />
              <div>
                <strong>העמודה חסרה לייבלים נדרשים:</strong>
                <div className={styles.missingLabels}>
                  {eventTypeValidation.missingLabels.map(label => (
                    <span key={label} className={styles.missingLabel}>{label}</span>
                  ))}
                </div>
                <small>הלייבלים הנדרשים: {REQUIRED_EVENT_TYPE_LABELS.join(', ')}</small>
                <button 
                  className={styles.createColumnButton}
                  onClick={handleCreateEventTypeColumn}
                  disabled={isCreatingEventTypeColumn}
                >
                  {isCreatingEventTypeColumn ? 'יוצר עמודה...' : 'צור עמודה חדשה עם הלייבלים הנדרשים'}
                </button>
              </div>
            </div>
          )}
          {!settings.eventTypeStatusColumnId && context?.boardId && (
            <button 
              className={styles.createColumnButtonAlt}
              onClick={handleCreateEventTypeColumn}
              disabled={isCreatingEventTypeColumn}
            >
              {isCreatingEventTypeColumn ? 'יוצר עמודה...' : 'או צור עמודה חדשה "סוג דיווח"'}
            </button>
          )}
        </FieldWrapper>

        <FieldWrapper label="עמודת סיווג - לא לחיוב" required>
          <div className={!context?.boardId ? styles.disabled : ''}>
            <SearchableSelect 
              options={statusColumns} 
              value={settings.nonBillableStatusColumnId} 
              onChange={(id) => onChange({ nonBillableStatusColumnId: id })} 
              placeholder="בחר עמודת סטטוס..." 
              isLoading={loadingCurrentBoardColumns}
              showSearch={false}
            />
          </div>
        </FieldWrapper>

        {hasStage && (
          <FieldWrapper label="עמודת סיווג - לחיוב" required>
            <div className={!context?.boardId ? styles.disabled : ''}>
              <SearchableSelect 
                options={stageColumns} 
                value={settings.stageColumnId} 
                onChange={(id) => onChange({ stageColumnId: id })} 
                placeholder="בחר עמודת סיווג..." 
                isLoading={loadingCurrentBoardColumns}
                showSearch={false}
              />
            </div>
          </FieldWrapper>
        )}

        {settings.enableNotes && (
          <FieldWrapper label="עמודת הערות">
            <div className={!context?.boardId ? styles.disabled : ''}>
              <SearchableSelect 
                options={textColumns} 
                value={settings.notesColumnId} 
                onChange={(id) => onChange({ notesColumnId: id })} 
                placeholder="בחר עמודת הערות..." 
                isLoading={loadingCurrentBoardColumns}
                showSearch={false}
              />
            </div>
          </FieldWrapper>
        )}
      </AccordionSection>
    </div>
  );
};

export default MappingTab;
