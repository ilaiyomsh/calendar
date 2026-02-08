import React, { useState, useEffect, useMemo } from 'react';
import { Filter, Users, Briefcase, Info } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { fetchConnectedBoardsFromColumn, fetchUniquePeopleFromBoard } from '../../utils/mondayApi';
import logger from '../../utils/logger';
import styles from './MappingTab.module.css';

/**
 * טאב הגדרת מקורות נתונים לפילטרים
 * מאפשר לבחור מאיזה לוח למשוך פרויקטים ועובדים לפילטר
 */
const FiltersTab = ({
  settings,
  onChange,
  monday,
  boards,
  loadingBoards,
  showErrorWithDetails
}) => {
  // State - לוחות מקושרים לפרויקטים (במצב Assignments)
  const [connectedProjectBoards, setConnectedProjectBoards] = useState([]);
  const [loadingConnectedBoards, setLoadingConnectedBoards] = useState(false);

  // State - עמודות People בלוח העובדים
  const [employeesPeopleColumns, setEmployeesPeopleColumns] = useState([]);
  const [loadingEmployeesColumns, setLoadingEmployeesColumns] = useState(false);

  // בדיקה אם במצב Assignments
  const isAssignmentsMode = settings.useAssignmentsMode;

  // סנכרון אוטומטי: במצב Direct, filterProjectsBoardId = connectedBoardId
  useEffect(() => {
    if (!isAssignmentsMode && settings.connectedBoardId) {
      if (settings.filterProjectsBoardId !== settings.connectedBoardId) {
        onChange({ filterProjectsBoardId: settings.connectedBoardId });
      }
    }
  }, [isAssignmentsMode, settings.connectedBoardId, settings.filterProjectsBoardId, onChange]);

  // טעינת לוחות מקושרים מעמודת assignmentProjectLinkColumnId
  useEffect(() => {
    if (isAssignmentsMode && settings.assignmentsBoardId && settings.assignmentProjectLinkColumnId) {
      loadConnectedProjectBoards();
    }
  }, [isAssignmentsMode, settings.assignmentsBoardId, settings.assignmentProjectLinkColumnId]);

  // טעינת עמודות People מלוח העובדים
  useEffect(() => {
    if (settings.filterEmployeesBoardId) {
      loadEmployeesPeopleColumns(settings.filterEmployeesBoardId);
    }
  }, [settings.filterEmployeesBoardId]);

  const loadConnectedProjectBoards = async () => {
    if (!settings.assignmentsBoardId || !settings.assignmentProjectLinkColumnId) return;

    setLoadingConnectedBoards(true);
    try {
      const boards = await fetchConnectedBoardsFromColumn(
        monday,
        settings.assignmentsBoardId,
        settings.assignmentProjectLinkColumnId
      );
      setConnectedProjectBoards(boards);
      logger.debug('FiltersTab', 'Loaded connected project boards', { count: boards.length });
    } catch (error) {
      logger.error('FiltersTab', 'Error loading connected project boards', error);
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
      logger.error('FiltersTab', 'Error loading employees columns', error);
      setEmployeesPeopleColumns([]);
    } finally {
      setLoadingEmployeesColumns(false);
    }
  };

  // Handler לשינוי לוח עובדים
  const handleEmployeesBoardChange = (newBoardId) => {
    onChange({
      filterEmployeesBoardId: newBoardId,
      filterEmployeesColumnId: null // איפוס עמודה בעת שינוי לוח
    });
    setEmployeesPeopleColumns([]);
    if (newBoardId) {
      loadEmployeesPeopleColumns(newBoardId);
    }
  };

  // --- UI Components ---

  const InfoBox = ({ children }) => (
    <div className={styles.infoBox} style={{
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
    <div className={styles.fieldWrapper}>
      <label className={styles.fieldLabel}>
        {label} {required && <span className={styles.required}>*</span>}
      </label>
      {description && <p className={styles.fieldDescription}>{description}</p>}
      {children}
    </div>
  );

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

  return (
    <div className={styles.container}>
      {/* סקשן פילטר פרויקטים */}
      <div style={{ marginBottom: '32px' }}>
        <SectionHeader icon={Briefcase} title="מקור פרויקטים לפילטר" />

        {!isAssignmentsMode ? (
          // מצב Direct - לוח הפרויקטים נקבע אוטומטית
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
          // מצב Assignments - בחירת לוח מהלוחות המקושרים
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

      {/* סקשן פילטר עובדים */}
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
  );
};

export default FiltersTab;
