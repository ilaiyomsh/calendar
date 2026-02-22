import React, { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, Lock, Briefcase, Users, Info, X, AlertTriangle } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { parseStatusColumnLabels } from '../../utils/eventTypeValidation';
import { APPROVAL_CATEGORY_LABELS, APPROVAL_UNMAPPED, APPROVAL_UNMAPPED_LABEL, validateApprovalMapping, createAutoApprovalMapping } from '../../utils/approvalMapping';
import { EDIT_LOCK_MODES, EDIT_LOCK_LABELS } from '../../utils/editLockUtils';
import { getEffectiveBoardId } from '../../utils/boardIdResolver';
import { fetchConnectedBoardsFromColumn } from '../../utils/mondayApi';
import logger from '../../utils/logger';
import sStyles from './StructureTab.module.css';
import mStyles from './MappingTab.module.css';

/**
 * טאב הגדרות נוספות
 * אישור מנהל (כולל מיפוי), נעילת עריכה, פילטרים ומקורות
 */
const AdditionalTab = ({
  settings,
  onChange,
  monday,
  context,
  boards,
  loadingBoards,
  showErrorWithDetails
}) => {
  // === State - אישור מנהל: People Picker ===
  const [accountUsers, setAccountUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // === State - עמודות סטטוס מלוח הדיווחים (לאישור מנהל) ===
  const [statusColumns, setStatusColumns] = useState([]);
  const [statusColumnsWithSettings, setStatusColumnsWithSettings] = useState([]);
  const [loadingStatusColumns, setLoadingStatusColumns] = useState(false);

  // === State - מיפוי אישור מנהל ===
  const [approvalStatusLabels, setApprovalStatusLabels] = useState([]);
  const [approvalValidation, setApprovalValidation] = useState({ isValid: true, errors: [] });

  // === State - פילטרים ===
  const [connectedProjectBoards, setConnectedProjectBoards] = useState([]);
  const [loadingConnectedBoards, setLoadingConnectedBoards] = useState(false);
  const [employeesPeopleColumns, setEmployeesPeopleColumns] = useState([]);
  const [loadingEmployeesColumns, setLoadingEmployeesColumns] = useState(false);

  // חישוב לוח דיווחים אפקטיבי
  const effectiveBoardId = useMemo(() =>
    getEffectiveBoardId(settings, context),
    [settings, context]
  );

  const isAssignmentsMode = settings.useAssignmentsMode;

  // === Effects ===

  // טעינת משתמשים כש-approval מופעל
  useEffect(() => {
    if (settings.enableApproval && monday && accountUsers.length === 0) {
      fetchAccountUsers();
    }
  }, [settings.enableApproval, monday]);

  // טעינת עמודות סטטוס מלוח הדיווחים
  useEffect(() => {
    if (effectiveBoardId) {
      fetchStatusColumns(effectiveBoardId);
    }
  }, [effectiveBoardId]);

  // טעינת לייבלים של עמודת אישור
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

  // סנכרון אוטומטי של filterProjectsBoardId במצב Direct
  useEffect(() => {
    if (!isAssignmentsMode && settings.connectedBoardId) {
      if (settings.filterProjectsBoardId !== settings.connectedBoardId) {
        onChange({ filterProjectsBoardId: settings.connectedBoardId });
      }
    }
  }, [isAssignmentsMode, settings.connectedBoardId, settings.filterProjectsBoardId]);

  // טעינת לוחות מקושרים לפילטר פרויקטים (מצב Assignments)
  useEffect(() => {
    if (isAssignmentsMode && settings.assignmentsBoardId && settings.assignmentProjectLinkColumnId) {
      loadConnectedProjectBoards();
    }
  }, [isAssignmentsMode, settings.assignmentsBoardId, settings.assignmentProjectLinkColumnId]);

  // טעינת עמודות People מלוח עובדים
  useEffect(() => {
    if (settings.filterEmployeesBoardId) {
      loadEmployeesPeopleColumns(settings.filterEmployeesBoardId);
    }
  }, [settings.filterEmployeesBoardId]);

  // === API Functions ===

  const fetchAccountUsers = async () => {
    if (!monday) return;
    setLoadingUsers(true);
    try {
      const res = await monday.api(`query { users(kind: non_guests) { id name photo_thumb_small } }`);
      if (res.data?.users) {
        setAccountUsers(res.data.users.map(u => ({
          id: String(u.id),
          name: u.name,
          photo: u.photo_thumb_small
        })));
      }
    } catch (err) {
      logger.error('AdditionalTab', 'Error fetching account users', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchStatusColumns = async (boardId) => {
    if (!boardId) return;
    setLoadingStatusColumns(true);
    try {
      const query = `query { boards(ids: [${boardId}]) { columns { id title type settings_str } } }`;
      const res = await monday.api(query);
      if (res.data?.boards?.[0]) {
        const columns = res.data.boards[0].columns;
        const statusCols = columns
          .filter(col => col.type === 'status')
          .map(col => ({ id: col.id, name: col.title }));
        const statusColsWithSettings = columns
          .filter(col => col.type === 'status')
          .map(col => ({ id: col.id, name: col.title, settings_str: col.settings_str }));
        setStatusColumns(statusCols);
        setStatusColumnsWithSettings(statusColsWithSettings);
      }
    } catch (err) {
      logger.error('AdditionalTab', 'Error fetching status columns', err);
    } finally {
      setLoadingStatusColumns(false);
    }
  };

  const loadConnectedProjectBoards = async () => {
    if (!settings.assignmentsBoardId || !settings.assignmentProjectLinkColumnId) return;
    setLoadingConnectedBoards(true);
    try {
      const result = await fetchConnectedBoardsFromColumn(
        monday,
        settings.assignmentsBoardId,
        settings.assignmentProjectLinkColumnId
      );
      setConnectedProjectBoards(result);
    } catch (error) {
      logger.error('AdditionalTab', 'Error loading connected project boards', error);
      showErrorWithDetails(error, { functionName: 'loadConnectedProjectBoards' });
      setConnectedProjectBoards([]);
    } finally {
      setLoadingConnectedBoards(false);
    }
  };

  const loadEmployeesPeopleColumns = async (boardId) => {
    if (!boardId) return;
    setLoadingEmployeesColumns(true);
    try {
      const query = `query { boards(ids: [${boardId}]) { columns { id title type } } }`;
      const res = await monday.api(query);
      if (res.data?.boards?.[0]) {
        const cols = res.data.boards[0].columns
          .filter(col => col.type === 'people')
          .map(col => ({ id: col.id, name: col.title }));
        setEmployeesPeopleColumns(cols);
      }
    } catch (error) {
      logger.error('AdditionalTab', 'Error loading employees columns', error);
      setEmployeesPeopleColumns([]);
    } finally {
      setLoadingEmployeesColumns(false);
    }
  };

  // === Handlers - אישור מנהל ===

  const handleAddManager = (userId) => {
    const current = settings.approvedManagerIds || [];
    if (!current.includes(userId)) {
      onChange({ approvedManagerIds: [...current, userId] });
    }
    setUserSearchQuery('');
  };

  const handleRemoveManager = (userId) => {
    const current = settings.approvedManagerIds || [];
    onChange({ approvedManagerIds: current.filter(id => id !== userId) });
  };

  const filteredUsers = accountUsers.filter(u => {
    const managerIds = settings.approvedManagerIds || [];
    if (managerIds.includes(u.id)) return false;
    if (!userSearchQuery) return true;
    return u.name.toLowerCase().includes(userSearchQuery.toLowerCase());
  });

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
    return Object.values(settings.approvalStatusMapping).filter(c => c === category).length >= 1;
  };

  // === Handler - פילטר עובדים ===

  const handleEmployeesBoardChange = (newBoardId) => {
    onChange({
      filterEmployeesBoardId: newBoardId,
      filterEmployeesColumnId: null
    });
    setEmployeesPeopleColumns([]);
    if (newBoardId) {
      loadEmployeesPeopleColumns(newBoardId);
    }
  };

  // === UI Components ===

  const SectionHeader = ({ icon: Icon, title }) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '16px',
      paddingBottom: '12px',
      borderBottom: '1px solid #e6e9ef'
    }}>
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '8px',
        backgroundColor: '#f0f7ff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Icon size={20} style={{ color: '#0073ea' }} />
      </div>
      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#323338' }}>{title}</h3>
    </div>
  );

  const InfoBox = ({ children }) => (
    <div style={{
      backgroundColor: '#f0f7ff',
      border: '1px solid #d0e3ff',
      borderRadius: '8px',
      padding: '12px 16px',
      marginBottom: '16px',
      display: 'flex',
      gap: '10px',
      alignItems: 'flex-start'
    }}>
      <Info size={18} style={{ color: '#0073ea', flexShrink: 0, marginTop: '2px' }} />
      <div style={{ fontSize: '0.9rem', color: '#333' }}>{children}</div>
    </div>
  );

  const FieldWrapper = ({ label, required, description, children }) => (
    <div className={mStyles.fieldWrapper}>
      <label className={mStyles.fieldLabel}>
        {label} {required && <span className={mStyles.required}>*</span>}
      </label>
      {description && <p className={mStyles.fieldDescription}>{description}</p>}
      {children}
    </div>
  );

  return (
    <div className={mStyles.container}>
      {/* === סקשן 1: אישור מנהל === */}
      <div style={{ marginBottom: '32px' }}>
        <SectionHeader icon={ShieldCheck} title="אישור מנהל" />

        <label className={sStyles.notesToggle} style={{ marginTop: 0 }}>
          <div className={sStyles.notesCheckbox}>
            <input
              type="checkbox"
              checked={settings.enableApproval || false}
              onChange={() => onChange({ enableApproval: !settings.enableApproval })}
            />
          </div>
          <div className={sStyles.notesContent}>
            <span className={sStyles.notesTitle}>
              אישור מנהל על דיווחים
            </span>
            <span className={sStyles.notesDescription}>
              כשפעיל, דיווחים ידרשו אישור מנהל מורשה
            </span>
          </div>
        </label>

        {settings.enableApproval && (
          <>
            {/* בוחר מנהלים */}
            <div className={sStyles.approvalManagersSection}>
              <label className={sStyles.approvalLabel}>מנהלים מורשים לאישור</label>

              {(settings.approvedManagerIds || []).length > 0 && (
                <div className={sStyles.managersList}>
                  {(settings.approvedManagerIds || []).map(managerId => {
                    const user = accountUsers.find(u => u.id === managerId);
                    return (
                      <div key={managerId} className={sStyles.managerChip}>
                        {user?.photo && <img src={user.photo} alt="" className={sStyles.managerAvatar} />}
                        <span>{user?.name || `משתמש ${managerId}`}</span>
                        <button
                          className={sStyles.managerRemoveBtn}
                          onClick={() => handleRemoveManager(managerId)}
                          type="button"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className={sStyles.managerSearchWrapper}>
                <input
                  type="text"
                  className={sStyles.managerSearchInput}
                  placeholder={loadingUsers ? 'טוען משתמשים...' : 'חפש משתמש להוספה...'}
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (accountUsers.length === 0 && !loadingUsers) {
                      fetchAccountUsers();
                    }
                  }}
                  disabled={loadingUsers}
                />
                {userSearchQuery && filteredUsers.length > 0 && (
                  <div className={sStyles.managerDropdown}>
                    {filteredUsers.slice(0, 10).map(user => (
                      <button
                        key={user.id}
                        className={sStyles.managerDropdownItem}
                        onClick={() => handleAddManager(user.id)}
                        type="button"
                      >
                        {user.photo && <img src={user.photo} alt="" className={sStyles.managerAvatar} />}
                        <span>{user.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* עמודת סטטוס אישור + מיפוי */}
            <div style={{ marginTop: '16px' }}>
              <FieldWrapper label="עמודת סטטוס אישור" required>
                <div className={!effectiveBoardId ? mStyles.disabled : ''}>
                  <SearchableSelect
                    options={statusColumns}
                    value={settings.approvalStatusColumnId}
                    onChange={handleApprovalColumnChange}
                    placeholder="בחר עמודת סטטוס אישור..."
                    isLoading={loadingStatusColumns}
                    showSearch={false}
                  />
                </div>
                {!effectiveBoardId && (
                  <p className={mStyles.fieldDescription} style={{ color: '#f59e0b', marginTop: '6px' }}>
                    יש להגדיר תחילה לוח דיווחי שעות בטאב "מיפוי נתונים"
                  </p>
                )}
                {/* מיפוי סטטוסי אישור */}
                {settings.approvalStatusColumnId && approvalStatusLabels.length > 0 && (
                  <div className={mStyles.mappingSection}>
                    <div className={mStyles.mappingSectionTitle}>מיפוי סטטוסי אישור</div>
                    <small className={mStyles.mappingSectionDesc}>שייך כל לייבל לקטגוריה</small>
                    {approvalStatusLabels.map(labelObj => {
                      const currentCategory = (settings.approvalStatusMapping || {})[labelObj.id] || APPROVAL_UNMAPPED;
                      return (
                        <div key={labelObj.id} className={mStyles.mappingRow}>
                          <span className={mStyles.mappingColorDot} style={{ backgroundColor: labelObj.color || '#ccc' }} />
                          <span className={mStyles.mappingLabelText}>{labelObj.name}</span>
                          <select
                            className={mStyles.mappingSelect}
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
                      <div className={mStyles.mappingValid}>&#10003; מיפוי תקין</div>
                    ) : (
                      <div className={mStyles.mappingErrors}>
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
            </div>
          </>
        )}
      </div>

      {/* === סקשן 2: נעילת עריכה === */}
      <div style={{ marginBottom: '32px' }}>
        <SectionHeader icon={Lock} title="נעילת עריכת דיווחים" />

        <div className={sStyles.editLockOptions}>
          {Object.entries(EDIT_LOCK_LABELS).map(([mode, label]) => (
            <label key={mode} className={sStyles.editLockOption}>
              <input
                type="radio"
                name="editLockMode"
                value={mode}
                checked={(settings.editLockMode || EDIT_LOCK_MODES.NONE) === mode}
                onChange={() => onChange({ editLockMode: mode })}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        {/* נעילה לאחר אישור מנהל */}
        {settings.enableApproval && (
          <label className={sStyles.notesToggle} style={{ marginTop: '12px' }}>
            <div className={sStyles.notesCheckbox}>
              <input
                type="checkbox"
                checked={settings.lockAfterApproval || false}
                onChange={() => onChange({ lockAfterApproval: !settings.lockAfterApproval })}
              />
            </div>
            <div className={sStyles.notesContent}>
              <span className={sStyles.notesTitle}>
                נעילה לאחר אישור מנהל
              </span>
              <span className={sStyles.notesDescription}>
                אירועים שאושרו ע"י מנהל יינעלו לעריכה
              </span>
            </div>
          </label>
        )}

        {settings.enableApproval && (settings.editLockMode || 'none') !== 'none' && (
          <div className={sStyles.editLockNote}>
            מנהלים מורשים פטורים מנעילת עריכה
          </div>
        )}
      </div>

      {/* === סקשן 3: פילטרים ומקורות === */}
      <div>
        {/* מקור פרויקטים */}
        <div style={{ marginBottom: '24px' }}>
          <SectionHeader icon={Briefcase} title="מקור פרויקטים לפילטר" />

          {!isAssignmentsMode ? (
            <InfoBox>
              <div>
                <strong>מצב ישיר:</strong> רשימת הפרויקטים לפילטר נלקחת אוטומטית מלוח הפרויקטים שהוגדר.
                {settings.connectedBoardId && (
                  <div style={{ marginTop: '8px', color: '#666' }}>
                    לוח נוכחי: <strong>{boards.find(b => b.id === settings.connectedBoardId)?.name || settings.connectedBoardId}</strong>
                  </div>
                )}
              </div>
            </InfoBox>
          ) : (
            <>
              <InfoBox>
                <div>
                  <strong>מצב הקצאות:</strong> בחר את הלוח שממנו יימשכו הפרויקטים לפילטר.
                  הלוחות המוצגים הם אלה המקושרים דרך עמודת קישור הפרויקט בלוח ההקצאות.
                </div>
              </InfoBox>

              {!settings.assignmentProjectLinkColumnId ? (
                <div style={{
                  backgroundColor: '#fff8e6',
                  border: '1px solid #ffd666',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  color: '#915900',
                  fontSize: '0.9rem'
                }}>
                  יש להגדיר תחילה את עמודת קישור הפרויקט בלוח ההקצאות (בטאב "מיפוי נתונים")
                </div>
              ) : (
                <FieldWrapper
                  label="לוח פרויקטים לפילטר"
                  required
                  description="בחר את הלוח שממנו יימשכו כל הפרויקטים להצגה בפילטר"
                >
                  <SearchableSelect
                    options={connectedProjectBoards}
                    value={settings.filterProjectsBoardId}
                    onChange={(id) => onChange({ filterProjectsBoardId: id })}
                    placeholder="בחר לוח פרויקטים..."
                    isLoading={loadingConnectedBoards}
                    showSearch={false}
                  />
                </FieldWrapper>
              )}
            </>
          )}
        </div>

        {/* מקור עובדים */}
        <div>
          <SectionHeader icon={Users} title="מקור עובדים לפילטר" />

          <InfoBox>
            <div>
              בחר לוח ועמודת אנשים שמכילים את רשימת העובדים המלאה.
              לרוב זהו לוח HR/עובדים או לוח ההקצאות.
            </div>
          </InfoBox>

          <FieldWrapper
            label="לוח עובדים/HR"
            description="הלוח שמכיל את רשימת העובדים"
          >
            <SearchableSelect
              options={boards}
              value={settings.filterEmployeesBoardId}
              onChange={handleEmployeesBoardChange}
              placeholder="בחר לוח עובדים..."
              isLoading={loadingBoards}
            />
          </FieldWrapper>

          {settings.filterEmployeesBoardId && (
            <FieldWrapper
              label="עמודת עובדים (People)"
              required
              description="עמודת ה-People שמכילה את רשימת העובדים"
            >
              <SearchableSelect
                options={employeesPeopleColumns}
                value={settings.filterEmployeesColumnId}
                onChange={(id) => onChange({ filterEmployeesColumnId: id })}
                placeholder="בחר עמודת אנשים..."
                isLoading={loadingEmployeesColumns}
                showSearch={false}
              />
            </FieldWrapper>
          )}

          {!settings.filterEmployeesBoardId && (
            <div style={{
              backgroundColor: '#f5f6f8',
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center',
              color: '#676879',
              fontSize: '0.9rem'
            }}>
              אם לא יוגדר לוח עובדים, הפילטר יציג רק את המדווחים שכבר דיווחו שעות בלוח הדיווחים
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdditionalTab;
