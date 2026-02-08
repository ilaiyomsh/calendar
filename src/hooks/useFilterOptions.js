import { useState, useCallback, useEffect, useRef } from 'react';
import logger from '../utils/logger';

/**
 * Hook לשליפת אפשרויות פילטר (מדווחים ופרויקטים)
 * @param {Object} monday - Monday SDK instance
 * @param {string} effectiveBoardId - לוח הדיווחים האפקטיבי
 * @param {Object} customSettings - הגדרות מותאמות
 * @returns {Object} - מדווחים זמינים ופונקציות רענון
 */
export const useFilterOptions = (monday, effectiveBoardId, customSettings) => {
    const [reporters, setReporters] = useState([]);
    const [loadingReporters, setLoadingReporters] = useState(false);
    const [reportersError, setReportersError] = useState(null);

    // שמירת המצב האחרון למניעת קריאות כפולות
    const lastFetchParams = useRef({ boardId: null, columnId: null });

    /**
     * שליפת מדווחים ייחודיים
     * אם מוגדר לוח עובדים ייעודי - ישתמש בו
     * אחרת - ישתמש בלוח הדיווחים
     */
    const fetchReporters = useCallback(async () => {
        // בדיקה אם יש הגדרת לוח עובדים ייעודי
        const useEmployeesBoard = customSettings?.filterEmployeesBoardId && customSettings?.filterEmployeesColumnId;

        // קביעת לוח ועמודה לפי ההגדרות
        const targetBoardId = useEmployeesBoard
            ? customSettings.filterEmployeesBoardId
            : effectiveBoardId;
        const targetColumnId = useEmployeesBoard
            ? customSettings.filterEmployeesColumnId
            : customSettings?.reporterColumnId;

        if (!targetBoardId || !targetColumnId || !monday) {
            logger.debug('useFilterOptions', 'Missing required params for fetching reporters', {
                targetBoardId,
                targetColumnId,
                useEmployeesBoard
            });
            return;
        }

        // מניעת קריאות כפולות עם אותם פרמטרים
        const currentParams = {
            boardId: targetBoardId,
            columnId: targetColumnId
        };
        if (JSON.stringify(currentParams) === JSON.stringify(lastFetchParams.current)) {
            return;
        }
        lastFetchParams.current = currentParams;

        setLoadingReporters(true);
        setReportersError(null);

        try {
            logger.functionStart('useFilterOptions.fetchReporters', {
                targetBoardId,
                targetColumnId,
                useEmployeesBoard
            });

            // שליפה מלוח העובדים - שם הפריט הוא שם העובד, ועמודת People מכילה את ה-ID
            const query = `query {
                boards(ids: [${targetBoardId}]) {
                    items_page(limit: 500) {
                        cursor
                        items {
                            id
                            name
                            column_values(ids: ["${targetColumnId}"]) {
                                ... on PeopleValue {
                                    persons_and_teams {
                                        id
                                        kind
                                    }
                                }
                            }
                        }
                    }
                }
            }`;

            const response = await monday.api(query);
            const items = response.data?.boards?.[0]?.items_page?.items || [];

            // מיפוי עובדים - שם הפריט כשם התצוגה, ID מעמודת People
            const reportersMap = new Map();
            items.forEach(item => {
                const personColumn = item.column_values?.[0];
                const persons = personColumn?.persons_and_teams || [];
                persons.forEach(person => {
                    if (person.kind === 'person' && !reportersMap.has(person.id)) {
                        reportersMap.set(person.id, {
                            id: person.id,
                            name: item.name, // שם הפריט = שם העובד
                            photo: null
                        });
                    }
                });
            });

            if (reportersMap.size === 0) {
                logger.debug('useFilterOptions', 'No reporters found in board');
                setReporters([]);
                return;
            }

            const reportersList = Array.from(reportersMap.values());
            setReporters(reportersList);
            logger.functionEnd('useFilterOptions.fetchReporters', { count: reportersList.length });

        } catch (error) {
            logger.error('useFilterOptions', 'Error fetching reporters', error);
            setReportersError('שגיאה בטעינת מדווחים');
        } finally {
            setLoadingReporters(false);
        }
    }, [monday, effectiveBoardId, customSettings?.reporterColumnId, customSettings?.filterEmployeesBoardId, customSettings?.filterEmployeesColumnId]);

    // טעינה ראשונית
    useEffect(() => {
        fetchReporters();
    }, [fetchReporters]);

    /**
     * רענון ידני של המדווחים
     */
    const refetchReporters = useCallback(() => {
        lastFetchParams.current = { boardId: null, columnId: null };
        fetchReporters();
    }, [fetchReporters]);

    // --- שליפת פרויקטים לפילטר ---
    const [filterProjects, setFilterProjects] = useState([]);
    const [loadingFilterProjects, setLoadingFilterProjects] = useState(false);
    const lastProjectsFetchParams = useRef({ boardId: null });

    /**
     * שליפת כל הפרויקטים לפילטר
     * אם מוגדר filterProjectsBoardId - ימשוך מהלוח הזה
     * אחרת - ישתמש ב-connectedBoardId
     */
    const fetchFilterProjects = useCallback(async () => {
        const targetBoardId = customSettings?.filterProjectsBoardId || customSettings?.connectedBoardId;

        if (!targetBoardId || !monday) {
            logger.debug('useFilterOptions', 'Missing board ID for fetching filter projects');
            return;
        }

        // מניעת קריאות כפולות
        if (lastProjectsFetchParams.current.boardId === targetBoardId) {
            return;
        }
        lastProjectsFetchParams.current = { boardId: targetBoardId };

        setLoadingFilterProjects(true);

        try {
            logger.functionStart('useFilterOptions.fetchFilterProjects', { targetBoardId });

            let allItems = [];
            let cursor = null;

            do {
                const cursorParam = cursor ? `, cursor: "${cursor}"` : '';
                const query = `query {
                    boards(ids: [${targetBoardId}]) {
                        items_page(limit: 500${cursorParam}) {
                            cursor
                            items {
                                id
                                name
                            }
                        }
                    }
                }`;

                const response = await monday.api(query);
                const page = response.data?.boards?.[0]?.items_page;

                if (page?.items) {
                    allItems = [...allItems, ...page.items];
                }

                cursor = page?.cursor || null;
            } while (cursor);

            const projectsList = allItems.map(item => ({
                id: item.id,
                name: item.name
            }));

            setFilterProjects(projectsList);
            logger.functionEnd('useFilterOptions.fetchFilterProjects', { count: projectsList.length });

        } catch (error) {
            logger.error('useFilterOptions', 'Error fetching filter projects', error);
        } finally {
            setLoadingFilterProjects(false);
        }
    }, [monday, customSettings?.filterProjectsBoardId, customSettings?.connectedBoardId]);

    // טעינה ראשונית של פרויקטים לפילטר
    useEffect(() => {
        fetchFilterProjects();
    }, [fetchFilterProjects]);

    /**
     * רענון ידני של הפרויקטים
     */
    const refetchFilterProjects = useCallback(() => {
        lastProjectsFetchParams.current = { boardId: null };
        fetchFilterProjects();
    }, [fetchFilterProjects]);

    return {
        reporters,
        loadingReporters,
        reportersError,
        refetchReporters,
        // פרויקטים לפילטר
        filterProjects,
        loadingFilterProjects,
        refetchFilterProjects
    };
};

export default useFilterOptions;
