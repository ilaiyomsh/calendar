import React, { useState, useEffect, useMemo } from 'react';
import { Briefcase, ListTodo, Table, ChevronDown, ChevronUp, AlertTriangle, CalendarCheck, Filter, Clock, ShieldCheck } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import MultiSelect from './MultiSelect';
import { FIELD_MODES, TOGGLE_MODES, DEFAULT_FIELD_CONFIG } from '../../contexts/SettingsContext';
import { fetchStatusColumnsFromBoard, parseStatusLabels, createEventTypeStatusColumn } from '../../utils/mondayApi';
import { parseStatusColumnLabels } from '../../utils/eventTypeValidation';
import { EVENT_CATEGORIES, CATEGORY_LABELS, UNMAPPED, UNMAPPED_LABEL, validateMapping, createLegacyMapping } from '../../utils/eventTypeMapping';
import { APPROVAL_CATEGORIES, APPROVAL_CATEGORY_LABELS, APPROVAL_UNMAPPED, APPROVAL_UNMAPPED_LABEL, validateApprovalMapping, createAutoApprovalMapping } from '../../utils/approvalMapping';
import { getEffectiveBoardId } from '../../utils/boardIdResolver';
import logger from '../../utils/logger';
import styles from './MappingTab.module.css';

/**
 * טאב מיפוי נתונים
 * מציג אקורדיונים דינמיים לפי fieldConfig
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
  const fieldConfig = settings.fieldConfig || DEFAULT_FIELD_CONFIG;

  // State - סקשנים פתוחים
  const [openSection, setOpenSection] = useState(''); // כל הסעיפים סגורים בברירת מחדל
  
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

  // State - עמודות לוח הקצאות (Assignments)
  const [assignmentPersonColumns, setAssignmentPersonColumns] = useState([]);
  const [assignmentDateColumns, setAssignmentDateColumns] = useState([]);
  const [assignmentBoardRelationColumns, setAssignmentBoardRelationColumns] = useState([]);
  const [loadingAssignmentColumns, setLoadingAssignmentColumns] = useState(false);
  
  // State - עמודות לוח דיווחים נוכחי
  const [dateColumns, setDateColumns] = useState([]);
  const [durationColumns, setDurationColumns] = useState([]);
  const [projectColumns, setProjectColumns] = useState([]);
  const [taskColumns, setTaskColumns] = useState([]);
  const [assignmentColumns, setAssignmentColumns] = useState([]);
  const [reporterColumns, setReporterColumns] = useState([]);
  const [statusColumns, setStatusColumns] = useState([]);
  const [statusColumnsWithSettings, setStatusColumnsWithSettings] = useState([]);
  const [stageColumns, setStageColumns] = useState([]);
  const [textColumns, setTextColumns] = useState([]);
  const [loadingCurrentBoardColumns, setLoadingCurrentBoardColumns] = useState(false);
  
  // State - ולידציה של עמודת סוג דיווח
  const [eventTypeValidation, setEventTypeValidation] = useState({ isValid: true, missingLabels: [] });
  const [isCreatingEventTypeColumn, setIsCreatingEventTypeColumn] = useState(false);

  // State - לייבלים של עמודת סוג דיווח (לשימוש ב-Planned vs Actual)
  const [eventTypeStatusLabels, setEventTypeStatusLabels] = useState([]);

  // State - עמודת סטטוס אישור מנהל
  const [approvalStatusLabels, setApprovalStatusLabels] = useState([]);
  const [approvalValidation, setApprovalValidation] = useState({ isValid: true, errors: [] });

  // בדיקה אם שדות פעילים לפי fieldConfig
  const hasTasks = fieldConfig.task !== FIELD_MODES.HIDDEN;
  const hasStage = fieldConfig.stage !== FIELD_MODES.HIDDEN;
  const hasNotes = fieldConfig.notes !== FIELD_MODES.HIDDEN;
  const hasBillableToggle = fieldConfig.billableToggle === TOGGLE_MODES.VISIBLE;
  const hasNonBillableType = hasBillableToggle && fieldConfig.nonBillableType !== FIELD_MODES.HIDDEN;

  // חישוב לוח דיווחים אפקטיבי
  const effectiveBoardId = useMemo(() =>
    getEffectiveBoardId(settings, context),
    [settings, context]
  );

  // האם יש context.boardId זמין
  const hasContextBoard = !!context?.boardId;

  // טעינה ראשונית כשה-component נטען
  useEffect(() => {
    // טעינת עמודות לוח פרויקטים
    if (settings.connectedBoardId) {
      fetchPeopleColumns(settings.connectedBoardId);
      fetchProjectTasksColumns(settings.connectedBoardId);
      if (settings.projectStatusFilterEnabled) {
        fetchProjectStatusColumns(settings.connectedBoardId, settings.projectStatusColumnId);
      }
    }
    
    // טעינת עמודות לוח דיווחים
    if (effectiveBoardId) {
      fetchCurrentBoardColumns(effectiveBoardId, settings.connectedBoardId, settings.tasksBoardId);
    }
    
    // טעינת עמודות לוח הקצאות
    if (settings.assignmentsBoardId) {
      fetchAssignmentBoardColumns(settings.assignmentsBoardId);
    }
  }, []); // ריק - מופעל רק פעם אחת בטעינה

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

  // טעינת עמודות לוח דיווחים (הלוח האפקטיבי)
  useEffect(() => {
    if (effectiveBoardId) {
      fetchCurrentBoardColumns(effectiveBoardId, settings.connectedBoardId, settings.tasksBoardId);
    }
  }, [effectiveBoardId, settings.connectedBoardId, settings.tasksBoardId]);

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

  // טעינת עמודות לוח הקצאות
  useEffect(() => {
    if (settings.assignmentsBoardId) {
      fetchAssignmentBoardColumns(settings.assignmentsBoardId);
    }
  }, [settings.assignmentsBoardId]);

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
        
        // עמודות קישור להקצאה - כל עמודות board_relation (ללא סינון)
        setAssignmentColumns(columns.filter(col => {
          return col.type === 'board_relation';
        }).map(col => ({ id: col.id, name: col.title })));
        
        // טעינת לייבלים של עמודת סוג דיווח אם כבר נבחרה
        if (settings.eventTypeStatusColumnId) {
          const selectedCol = columns.find(col => col.id === settings.eventTypeStatusColumnId);
          if (selectedCol?.settings_str) {
            const labels = parseStatusColumnLabels(selectedCol.settings_str);
            setEventTypeStatusLabels(labels.map(l => ({ id: String(l.index), name: l.label, color: l.color || '' })));
            // ולידציה של המיפוי הנוכחי
            if (settings.eventTypeMapping) {
              const validation = validateMapping(settings.eventTypeMapping);
              setEventTypeValidation({ isValid: validation.isValid, missingLabels: validation.errors });
            }
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

  // טעינת עמודות לוח הקצאות
  const fetchAssignmentBoardColumns = async (boardId) => {
    if (!boardId) {
      setAssignmentPersonColumns([]);
      setAssignmentDateColumns([]);
      setAssignmentBoardRelationColumns([]);
      return;
    }
    setLoadingAssignmentColumns(true);
    try {
      const query = `query { boards(ids: [${boardId}]) { columns { id title type settings_str } } }`;
      const res = await monday.api(query);
      if (res.data?.boards?.[0]) {
        const columns = res.data.boards[0].columns;
        setAssignmentPersonColumns(columns.filter(col => col.type === 'people').map(col => ({ id: col.id, name: col.title })));
        setAssignmentDateColumns(columns.filter(col => col.type === 'date').map(col => ({ id: col.id, name: col.title })));
        setAssignmentBoardRelationColumns(columns.filter(col => col.type === 'board_relation').map(col => ({ id: col.id, name: col.title })));
      }
    } catch (err) {
      logger.error('MappingTab', 'Error fetching assignment board columns', err);
      setAssignmentPersonColumns([]);
      setAssignmentDateColumns([]);
      setAssignmentBoardRelationColumns([]);
    } finally {
      setLoadingAssignmentColumns(false);
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
    if (newBoardId && effectiveBoardId) {
      fetchCurrentBoardColumns(effectiveBoardId, settings.connectedBoardId, newBoardId);
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

  // שינוי לוח הקצאות - איפוס כל העמודות
  const handleAssignmentsBoardChange = (newBoardId) => {
    onChange({
      assignmentsBoardId: newBoardId,
      assignmentPersonColumnId: '',
      assignmentStartDateColumnId: '',
      assignmentEndDateColumnId: '',
      assignmentProjectLinkColumnId: ''
    });
    setAssignmentPersonColumns([]);
    setAssignmentDateColumns([]);
    setAssignmentBoardRelationColumns([]);

    if (newBoardId) {
      fetchAssignmentBoardColumns(newBoardId);
    }
  };

  // ולידציה של עמודת סוג דיווח + חילוץ לייבלים + ניסיון מיגרציה אוטומטית
  const handleEventTypeColumnChange = (newColumnId) => {
    onChange({ eventTypeStatusColumnId: newColumnId });

    if (newColumnId) {
      const selectedCol = statusColumnsWithSettings.find(col => col.id === newColumnId);
      if (selectedCol?.settings_str) {
        // חילוץ לייבלים כולל צבעים
        const labels = parseStatusColumnLabels(selectedCol.settings_str);
        setEventTypeStatusLabels(labels.map(l => ({ id: String(l.index), name: l.label, color: l.color || '' })));

        // ניסיון מיגרציה אוטומטית אם אין מיפוי קיים
        if (!settings.eventTypeMapping) {
          const result = createLegacyMapping(labels);
          if (result) {
            onChange({
              eventTypeStatusColumnId: newColumnId,
              eventTypeMapping: result.mapping,
              eventTypeLabelMeta: result.labelMeta
            });
            const validation = validateMapping(result.mapping);
            setEventTypeValidation({ isValid: validation.isValid, missingLabels: validation.errors });
            return;
          }
        }

        // ולידציה של המיפוי הנוכחי
        if (settings.eventTypeMapping) {
          const validation = validateMapping(settings.eventTypeMapping);
          setEventTypeValidation({ isValid: validation.isValid, missingLabels: validation.errors });
        } else {
          setEventTypeValidation({ isValid: false, missingLabels: ['יש להגדיר מיפוי סוגי דיווח'] });
        }
      } else {
        setEventTypeValidation({ isValid: true, missingLabels: [] });
        setEventTypeStatusLabels([]);
      }
    } else {
      setEventTypeValidation({ isValid: true, missingLabels: [] });
      setEventTypeStatusLabels([]);
      onChange({ eventTypeStatusColumnId: null, eventTypeMapping: null, eventTypeLabelMeta: null });
    }
  };

  // טעינת לייבלים של עמודת סוג דיווח בעת טעינה ראשונית
  useEffect(() => {
    if (settings.eventTypeStatusColumnId && statusColumnsWithSettings.length > 0) {
      const selectedCol = statusColumnsWithSettings.find(col => col.id === settings.eventTypeStatusColumnId);
      if (selectedCol?.settings_str) {
        const labels = parseStatusColumnLabels(selectedCol.settings_str);
        setEventTypeStatusLabels(labels.map(l => ({ id: String(l.index), name: l.label, color: l.color || '' })));
      }
    }
  }, [settings.eventTypeStatusColumnId, statusColumnsWithSettings]);

  // יצירת עמודת סוג דיווח חדשה
  const handleCreateEventTypeColumn = async () => {
    if (!effectiveBoardId) return;

    setIsCreatingEventTypeColumn(true);
    try {
      const newColumnId = await createEventTypeStatusColumn(monday, effectiveBoardId);
      if (newColumnId) {
        // רענון רשימת העמודות
        await fetchCurrentBoardColumns(effectiveBoardId, settings.connectedBoardId, settings.tasksBoardId);
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

  // טיפול בשינוי מיפוי של לייבל בודד
  const handleMappingLabelChange = (labelIndex, category) => {
    const currentMapping = { ...(settings.eventTypeMapping || {}) };
    const currentMeta = { ...(settings.eventTypeLabelMeta || {}) };

    if (category === UNMAPPED) {
      delete currentMapping[labelIndex];
      delete currentMeta[labelIndex];
    } else {
      currentMapping[labelIndex] = category;
      // עדכון מטא-דאטה
      const labelObj = eventTypeStatusLabels.find(l => l.id === labelIndex);
      if (labelObj) {
        currentMeta[labelIndex] = { label: labelObj.name, color: labelObj.color || '' };
      }
    }

    onChange({ eventTypeMapping: currentMapping, eventTypeLabelMeta: currentMeta });

    // ולידציה
    const validation = validateMapping(currentMapping);
    setEventTypeValidation({ isValid: validation.isValid, missingLabels: validation.errors });
  };

  // === Approval Status Column Handlers ===

  const handleApprovalColumnChange = (newColumnId) => {
    onChange({ approvalStatusColumnId: newColumnId });

    if (newColumnId) {
      const selectedCol = statusColumnsWithSettings.find(col => col.id === newColumnId);
      if (selectedCol?.settings_str) {
        const labels = parseStatusColumnLabels(selectedCol.settings_str);
        setApprovalStatusLabels(labels.map(l => ({ id: String(l.index), name: l.label, color: l.color || '' })));

        // ניסיון מיגרציה אוטומטית אם אין מיפוי
        if (!settings.approvalStatusMapping) {
          const result = createAutoApprovalMapping(labels);
          if (result) {
            onChange({
              approvalStatusColumnId: newColumnId,
              approvalStatusMapping: result.mapping,
              approvalStatusLabelMeta: result.labelMeta
            });
            setApprovalValidation(validateApprovalMapping(result.mapping));
            return;
          }
        }

        if (settings.approvalStatusMapping) {
          setApprovalValidation(validateApprovalMapping(settings.approvalStatusMapping));
        } else {
          setApprovalValidation({ isValid: false, errors: ['יש להגדיר מיפוי סטטוס אישור'] });
        }
      } else {
        setApprovalStatusLabels([]);
        setApprovalValidation({ isValid: true, errors: [] });
      }
    } else {
      setApprovalStatusLabels([]);
      setApprovalValidation({ isValid: true, errors: [] });
      onChange({ approvalStatusColumnId: null, approvalStatusMapping: null, approvalStatusLabelMeta: null });
    }
  };

  const handleApprovalMappingLabelChange = (labelIndex, category) => {
    const currentMapping = { ...(settings.approvalStatusMapping || {}) };
    const currentMeta = { ...(settings.approvalStatusLabelMeta || {}) };

    if (category === APPROVAL_UNMAPPED) {
      delete currentMapping[labelIndex];
      delete currentMeta[labelIndex];
    } else {
      currentMapping[labelIndex] = category;
      const labelObj = approvalStatusLabels.find(l => l.id === labelIndex);
      if (labelObj) {
        currentMeta[labelIndex] = { label: labelObj.name, color: labelObj.color || '' };
      }
    }

    onChange({ approvalStatusMapping: currentMapping, approvalStatusLabelMeta: currentMeta });
    setApprovalValidation(validateApprovalMapping(currentMapping));
  };

  const isApprovalCategoryTaken = (category) => {
    if (!settings.approvalStatusMapping) return false;
    // כל הקטגוריות הן חד-פעמיות
    return Object.values(settings.approvalStatusMapping).filter(c => c === category).length >= 1;
  };

  // טעינת לייבלים של עמודת אישור בעת טעינה ראשונית
  useEffect(() => {
    if (settings.approvalStatusColumnId && statusColumnsWithSettings.length > 0) {
      const selectedCol = statusColumnsWithSettings.find(col => col.id === settings.approvalStatusColumnId);
      if (selectedCol?.settings_str) {
        const labels = parseStatusColumnLabels(selectedCol.settings_str);
        setApprovalStatusLabels(labels.map(l => ({ id: String(l.index), name: l.label, color: l.color || '' })));
        if (settings.approvalStatusMapping) {
          setApprovalValidation(validateApprovalMapping(settings.approvalStatusMapping));
        }
      }
    }
  }, [settings.approvalStatusColumnId, statusColumnsWithSettings]);

  // בדיקה אם קטגוריה חד-פעמית כבר תפוסה
  const isCategoryTaken = (category) => {
    if (!settings.eventTypeMapping) return false;
    if (category !== EVENT_CATEGORIES.BILLABLE && category !== EVENT_CATEGORIES.TEMPORARY) return false;
    return Object.values(settings.eventTypeMapping).filter(c => c === category).length >= 1;
  };

  // שינוי טוגל שימוש בלוח נוכחי
  const handleUseCurrentBoardToggle = () => {
    const newValue = !settings.useCurrentBoardForReporting;
    onChange({
      useCurrentBoardForReporting: newValue,
      // אם עוברים ללוח נוכחי, מאפסים את לוח הדיווחים
      timeReportingBoardId: newValue ? null : settings.timeReportingBoardId
    });
  };

  // שינוי לוח דיווחים
  const handleTimeReportingBoardChange = (newBoardId) => {
    onChange({
      timeReportingBoardId: newBoardId,
      // איפוס כל העמודות של לוח הדיווחים
      dateColumnId: '',
      endTimeColumnId: '',
      durationColumnId: '',
      projectColumnId: '',
      taskColumnId: '',
      assignmentColumnId: '',
      reporterColumnId: '',
      eventTypeStatusColumnId: '',
      nonBillableStatusColumnId: '',
      stageColumnId: '',
      notesColumnId: ''
    });

    // טעינת עמודות הלוח החדש
    if (newBoardId) {
      fetchCurrentBoardColumns(newBoardId, settings.connectedBoardId, settings.tasksBoardId);
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
      {/* טוגל בחירה בין לוח פרויקטים ללוח הקצאות */}
      <div style={{ marginBottom: '24px' }}>
        <ToggleRow
          label="השתמש בלוח הקצאות למשיכת פרויקטים"
          description="כאשר פעיל, הפרויקטים יימשכו מלוח ההקצאות לפי המשתמש והתאריך הנוכחי. אחרת, יימשכו מלוח הפרויקטים."
          checked={settings.useAssignmentsMode}
          onChange={() => onChange({ useAssignmentsMode: !settings.useAssignmentsMode })}
        />
      </div>

      {/* סקשן 1: לוח פרויקטים */}
      <AccordionSection id="projects" title="לוח פרויקטים" icon={Briefcase}>
        <div className={settings.useAssignmentsMode ? styles.disabled : ''}>
          <FieldWrapper label="בחר את לוח הפרויקטים" required={!settings.useAssignmentsMode}>
            <SearchableSelect 
              options={boards} 
              value={settings.connectedBoardId} 
              onChange={handleConnectedBoardChange} 
              placeholder="בחר לוח..." 
              isLoading={loadingBoards} 
              disabled={settings.useAssignmentsMode}
            />
          </FieldWrapper>

          <FieldWrapper label="עמודות לשיוך (אנשים)" required={!settings.useAssignmentsMode}>
            <div className={(!settings.connectedBoardId || settings.useAssignmentsMode) ? styles.disabled : ''}>
              <MultiSelect 
                options={peopleColumns} 
                value={settings.peopleColumnIds} 
                onChange={(ids) => onChange({ peopleColumnIds: ids })} 
                placeholder="בחר עמודות אנשים..." 
                isLoading={loadingPeopleColumns} 
                disabled={!settings.connectedBoardId || settings.useAssignmentsMode} 
              />
            </div>
          </FieldWrapper>
        </div>

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

      {/* סקשן 2: לוח הקצאות */}
      <AccordionSection id="assignments" title="לוח הקצאות" icon={CalendarCheck}>
        <div className={!settings.useAssignmentsMode ? styles.disabled : ''}>
          <p className={styles.fieldDescription} style={{ marginBottom: '16px' }}>
            הקצאות מאפשרות סינון פרויקטים לפי טווח תאריכים. אם לא מוגדר, ייעשה שימוש בעמודות אנשים מלוח הפרויקטים.
          </p>

          <FieldWrapper label="לוח הקצאות" required={settings.useAssignmentsMode}>
            <SearchableSelect
              options={boards}
              value={settings.assignmentsBoardId}
              onChange={handleAssignmentsBoardChange}
              placeholder="בחר לוח הקצאות..."
              isLoading={loadingBoards}
              disabled={!settings.useAssignmentsMode}
            />
          </FieldWrapper>

          {settings.assignmentsBoardId && (
            <>
              <FieldWrapper label="עמודת אנשים" required={settings.useAssignmentsMode}>
                <SearchableSelect
                  options={assignmentPersonColumns}
                  value={settings.assignmentPersonColumnId}
                  onChange={(id) => onChange({ assignmentPersonColumnId: id })}
                  placeholder="בחר עמודת אנשים..."
                  isLoading={loadingAssignmentColumns}
                  showSearch={false}
                  disabled={!settings.useAssignmentsMode}
                />
              </FieldWrapper>

              <FieldWrapper label="עמודת תאריך התחלה" required={settings.useAssignmentsMode}>
                <SearchableSelect
                  options={assignmentDateColumns}
                  value={settings.assignmentStartDateColumnId}
                  onChange={(id) => onChange({ assignmentStartDateColumnId: id })}
                  placeholder="בחר עמודת תאריך התחלה..."
                  isLoading={loadingAssignmentColumns}
                  showSearch={false}
                  disabled={!settings.useAssignmentsMode}
                />
              </FieldWrapper>

              <FieldWrapper label="עמודת תאריך סיום" required={settings.useAssignmentsMode}>
                <SearchableSelect
                  options={assignmentDateColumns}
                  value={settings.assignmentEndDateColumnId}
                  onChange={(id) => onChange({ assignmentEndDateColumnId: id })}
                  placeholder="בחר עמודת תאריך סיום..."
                  isLoading={loadingAssignmentColumns}
                  showSearch={false}
                  disabled={!settings.useAssignmentsMode}
                />
              </FieldWrapper>

              <FieldWrapper label="עמודת קישור לפרויקט" required={settings.useAssignmentsMode}>
                <SearchableSelect
                  options={assignmentBoardRelationColumns}
                  value={settings.assignmentProjectLinkColumnId}
                  onChange={(id) => onChange({ assignmentProjectLinkColumnId: id })}
                  placeholder="בחר עמודת קישור לפרויקט..."
                  isLoading={loadingAssignmentColumns}
                  showSearch={false}
                  disabled={!settings.useAssignmentsMode}
                />
              </FieldWrapper>
            </>
          )}
        </div>
      </AccordionSection>

      {/* סקשן 3: לוח משימות (מותנה) */}
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

      {/* סקשן 4: לוח דיווחי שעות */}
      <AccordionSection id="timesheet" title="לוח דיווחי שעות" icon={Table}>
        <ToggleRow
          label="שימוש בלוח הנוכחי"
          description="כאשר פעיל, הדיווחים יישמרו בלוח שבו האפליקציה מותקנת"
          checked={settings.useCurrentBoardForReporting}
          onChange={handleUseCurrentBoardToggle}
          disabled={!hasContextBoard}
        />

        {(!settings.useCurrentBoardForReporting || !hasContextBoard) && (
          <FieldWrapper
            label="בחר לוח דיווחי שעות"
            required
            description={!hasContextBoard ? "האפליקציה רצה כ-Custom Object - יש לבחור לוח דיווחים" : undefined}
          >
            <SearchableSelect
              options={boards}
              value={settings.timeReportingBoardId}
              onChange={handleTimeReportingBoardChange}
              placeholder="בחר לוח דיווחי שעות..."
              isLoading={loadingBoards}
            />
          </FieldWrapper>
        )}

        {!effectiveBoardId && (
          <p className={styles.warning}>לא נבחר לוח דיווחים - יש לבחור לוח או להפעיל את האפליקציה מתוך לוח</p>
        )}

        <FieldWrapper label="עמודת קישור לפרויקט" required>
          <div className={!effectiveBoardId ? styles.disabled : ''}>
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
            <div className={!effectiveBoardId ? styles.disabled : ''}>
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

        {settings.useAssignmentsMode && settings.assignmentsBoardId && (
          <FieldWrapper label="עמודת קישור להקצאה" required>
            <div className={!effectiveBoardId ? styles.disabled : ''}>
              <SearchableSelect
                options={assignmentColumns}
                value={settings.assignmentColumnId}
                onChange={(id) => onChange({ assignmentColumnId: id })}
                placeholder="בחר עמודת קישור להקצאה..."
                isLoading={loadingCurrentBoardColumns}
                showSearch={false}
              />
            </div>
          </FieldWrapper>
        )}

        <FieldWrapper label="עמודת תאריך (התחלה)" required>
          <div className={!effectiveBoardId ? styles.disabled : ''}>
            <SearchableSelect
              options={dateColumns}
              value={settings.dateColumnId}
              onChange={(id) => onChange({ dateColumnId: id })}
              placeholder="בחר עמודת תאריך התחלה..."
              isLoading={loadingCurrentBoardColumns}
              showSearch={false}
            />
          </div>
        </FieldWrapper>

        <FieldWrapper label="עמודת תאריך סיום" required>
          <div className={!effectiveBoardId ? styles.disabled : ''}>
            <SearchableSelect
              options={dateColumns}
              value={settings.endTimeColumnId}
              onChange={(id) => onChange({ endTimeColumnId: id })}
              placeholder="בחר עמודת תאריך סיום..."
              isLoading={loadingCurrentBoardColumns}
              showSearch={false}
            />
          </div>
          <p className={styles.fieldDescription}>זמן הסיום של האירוע (נדרש לקריאת אירועים זמניים)</p>
        </FieldWrapper>

        <FieldWrapper label="עמודת משך זמן" required>
          <div className={!effectiveBoardId ? styles.disabled : ''}>
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
          <div className={!effectiveBoardId ? styles.disabled : ''}>
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
          <div className={!effectiveBoardId ? styles.disabled : ''}>
            <SearchableSelect
              options={statusColumns}
              value={settings.eventTypeStatusColumnId}
              onChange={handleEventTypeColumnChange}
              placeholder="בחר עמודת סוג דיווח..."
              isLoading={loadingCurrentBoardColumns}
              showSearch={false}
            />
          </div>
          {/* מיפוי סוגי דיווח */}
          {settings.eventTypeStatusColumnId && eventTypeStatusLabels.length > 0 && (
            <div className={styles.mappingSection}>
              <div className={styles.mappingSectionTitle}>מיפוי סוגי דיווח</div>
              <small className={styles.mappingSectionDesc}>שייך כל לייבל לקטגוריה</small>
              {eventTypeStatusLabels.map(labelObj => {
                const currentCategory = (settings.eventTypeMapping || {})[labelObj.id] || UNMAPPED;
                return (
                  <div key={labelObj.id} className={styles.mappingRow}>
                    <span className={styles.mappingColorDot} style={{ backgroundColor: labelObj.color || '#ccc' }} />
                    <span className={styles.mappingLabelText}>{labelObj.name}</span>
                    <select
                      className={styles.mappingSelect}
                      value={currentCategory}
                      onChange={(e) => handleMappingLabelChange(labelObj.id, e.target.value)}
                    >
                      <option value={UNMAPPED}>{UNMAPPED_LABEL}</option>
                      {Object.entries(CATEGORY_LABELS).map(([cat, catLabel]) => (
                        <option
                          key={cat}
                          value={cat}
                          disabled={isCategoryTaken(cat) && currentCategory !== cat}
                        >
                          {catLabel}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
              {/* ולידציה */}
              {eventTypeValidation.isValid ? (
                <div className={styles.mappingValid}>✓ מיפוי תקין</div>
              ) : (
                <div className={styles.mappingErrors}>
                  <AlertTriangle size={14} />
                  <div>
                    {eventTypeValidation.missingLabels.map((err, i) => (
                      <div key={i}>{err}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {!settings.eventTypeStatusColumnId && effectiveBoardId && (
            <button
              className={styles.createColumnButtonAlt}
              onClick={handleCreateEventTypeColumn}
              disabled={isCreatingEventTypeColumn}
            >
              {isCreatingEventTypeColumn ? 'יוצר עמודה...' : 'או צור עמודה חדשה "סוג דיווח"'}
            </button>
          )}
        </FieldWrapper>

        {hasNonBillableType && (
          <FieldWrapper label="עמודת סיווג - לא לחיוב" required>
            <div className={!effectiveBoardId ? styles.disabled : ''}>
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
        )}

        {hasStage && (
          <FieldWrapper label="עמודת סיווג - לחיוב" required>
            <div className={!effectiveBoardId ? styles.disabled : ''}>
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

        {hasNotes && (
          <FieldWrapper label="עמודת הערות">
            <div className={!effectiveBoardId ? styles.disabled : ''}>
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

      {/* סקשן 5: אישור מנהל (מותנה) */}
      {settings.enableApproval && (
        <AccordionSection id="approval" title="סטטוס אישור מנהל" icon={ShieldCheck}>
          <FieldWrapper label="עמודת סטטוס אישור" required>
            <div className={!effectiveBoardId ? styles.disabled : ''}>
              <SearchableSelect
                options={statusColumns}
                value={settings.approvalStatusColumnId}
                onChange={handleApprovalColumnChange}
                placeholder="בחר עמודת סטטוס אישור..."
                isLoading={loadingCurrentBoardColumns}
                showSearch={false}
              />
            </div>
            {/* מיפוי סטטוסי אישור */}
            {settings.approvalStatusColumnId && approvalStatusLabels.length > 0 && (
              <div className={styles.mappingSection}>
                <div className={styles.mappingSectionTitle}>מיפוי סטטוסי אישור</div>
                <small className={styles.mappingSectionDesc}>שייך כל לייבל לקטגוריה</small>
                {approvalStatusLabels.map(labelObj => {
                  const currentCategory = (settings.approvalStatusMapping || {})[labelObj.id] || APPROVAL_UNMAPPED;
                  return (
                    <div key={labelObj.id} className={styles.mappingRow}>
                      <span className={styles.mappingColorDot} style={{ backgroundColor: labelObj.color || '#ccc' }} />
                      <span className={styles.mappingLabelText}>{labelObj.name}</span>
                      <select
                        className={styles.mappingSelect}
                        value={currentCategory}
                        onChange={(e) => handleApprovalMappingLabelChange(labelObj.id, e.target.value)}
                      >
                        <option value={APPROVAL_UNMAPPED}>{APPROVAL_UNMAPPED_LABEL}</option>
                        {Object.entries(APPROVAL_CATEGORY_LABELS).map(([cat, catLabel]) => (
                          <option
                            key={cat}
                            value={cat}
                            disabled={isApprovalCategoryTaken(cat) && currentCategory !== cat}
                          >
                            {catLabel}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
                {approvalValidation.isValid ? (
                  <div className={styles.mappingValid}>&#10003; מיפוי תקין</div>
                ) : (
                  <div className={styles.mappingErrors}>
                    <AlertTriangle size={14} />
                    <div>
                      {approvalValidation.errors.map((err, i) => (
                        <div key={i}>{err}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </FieldWrapper>
        </AccordionSection>
      )}

      {/* סקשן 6: אירועים זמניים */}
      <AccordionSection id="plannedVsActual" title="אירועים זמניים" icon={Clock}>
        <p className={styles.fieldDescription} style={{ marginBottom: '16px' }}>
          אירועים עם סטטוס <strong>"זמני"</strong> יוצגו בעיצוב חלול (hollow).
          לחיצה עליהם תפתח טופס המרה בו המשתמש יבחר את סוג האירוע (שעתי/חופשה/מחלה/מילואים) ואת הסיווג (לחיוב/לא לחיוב).
        </p>

        <ToggleRow
          label="הצג אירועים זמניים בלוח"
          description="כאשר פעיל, אירועים זמניים יוצגו בלוח השנה בעיצוב חלול"
          checked={settings.showTemporaryEvents !== false}
          onChange={() => onChange({ showTemporaryEvents: !(settings.showTemporaryEvents !== false) })}
        />
      </AccordionSection>
    </div>
  );
};

export default MappingTab;
