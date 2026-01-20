import { useState, useEffect, useCallback } from 'react';
import mondaySdk from 'monday-sdk-js';
import { useSettings } from '../contexts/SettingsContext';
import { fetchItemsStatus } from '../utils/mondayApi';
import logger from '../utils/logger';

const monday = mondaySdk();

/**
 * Hook לאחזור פרויקטים המשויכים למשתמש הנוכחי, כולל המשימות שלהם
 * תומך בסינון נוסף לפי עמודת סטטוס (אם מופעל)
 * @returns {Object} { projects, loading, error, refetch }
 */
export const useProjects = () => {
    const { customSettings } = useSettings();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchProjects = useCallback(async () => {
        if (!customSettings.connectedBoardId || !customSettings.peopleColumnIds || customSettings.peopleColumnIds.length === 0) {
            logger.warn('useProjects', 'Missing settings: connectedBoardId or peopleColumnIds');
            setError("חסרות הגדרות לוח");
            return;
        }

        // בדיקה אם פילטר סטטוס מופעל
        const statusFilterEnabled = customSettings.projectStatusFilterEnabled &&
            customSettings.projectStatusColumnId &&
            customSettings.projectActiveStatusValues?.length > 0;

        logger.functionStart('useProjects.fetchProjects', {
            boardId: customSettings.connectedBoardId,
            peopleColumnIds: customSettings.peopleColumnIds,
            statusFilterEnabled,
            statusColumnId: statusFilterEnabled ? customSettings.projectStatusColumnId : null,
            activeStatusValues: statusFilterEnabled ? customSettings.projectActiveStatusValues : null
        });

        setLoading(true);
        setError(null);

        try {
            // בניית rules לכל עמודת people
            const rules = customSettings.peopleColumnIds.map(columnId => ({
                column_id: columnId,
                compare_value: ["assigned_to_me"],
                operator: "any_of"
            }));

            const rulesString = rules.map(rule => 
                `{
                    column_id: "${rule.column_id}",
                    compare_value: ${JSON.stringify(rule.compare_value)},
                    operator: ${rule.operator}
                }`
            ).join(',\n');

            const query = `query {
                boards(ids: ${customSettings.connectedBoardId}) {
                    items_page(
                        query_params: {
                            operator: or,
                            rules: [${rulesString}]
                        }
                    ) {
                        items {
                            id
                            name
                        }
                    }
                }
            }`;

            logger.api('fetchProjects', query);

            const startTime = Date.now();
            const res = await monday.api(query);
            const duration = Date.now() - startTime;

            logger.apiResponse('fetchProjects', res, duration);

            if (res.data && res.data.boards && res.data.boards[0]) {
                let items = res.data.boards[0].items_page.items || [];
                
                // סינון לפי סטטוס (אם מופעל)
                if (statusFilterEnabled && items.length > 0) {
                    logger.debug('useProjects', 'Applying status filter', {
                        itemCount: items.length,
                        statusColumnId: customSettings.projectStatusColumnId,
                        activeValues: customSettings.projectActiveStatusValues
                    });
                    
                    const itemIds = items.map(item => item.id);
                    const statusMap = await fetchItemsStatus(
                        monday,
                        itemIds,
                        customSettings.projectStatusColumnId
                    );
                    
                    // סינון לפי ערכי הסטטוס הפעילים
                    items = items.filter(item => {
                        const itemStatus = statusMap.get(item.id.toString());
                        return customSettings.projectActiveStatusValues.includes(itemStatus);
                    });
                    
                    logger.debug('useProjects', 'Status filter applied', {
                        beforeCount: itemIds.length,
                        afterCount: items.length
                    });
                }
                
                // עיבוד הנתונים - רק פרויקטים, ללא משימות (משימות ייטענו מאוחר יותר)
                const processedProjects = items.map(item => ({
                    id: item.id,
                    name: item.name
                }));

                setProjects(processedProjects);
                logger.functionEnd('useProjects.fetchProjects', { 
                    count: processedProjects.length,
                    statusFilterApplied: statusFilterEnabled
                });
            } else {
                setProjects([]);
                logger.warn('useProjects', 'No data in response');
            }
        } catch (err) {
            logger.apiError('fetchProjects', err);
            logger.error('useProjects', 'Error fetching projects', err);
            setError("שגיאה בטעינת הנתונים");
            setProjects([]);
        } finally {
            setLoading(false);
        }
    }, [
        customSettings.connectedBoardId, 
        customSettings.peopleColumnIds,
        customSettings.projectStatusFilterEnabled,
        customSettings.projectStatusColumnId,
        customSettings.projectActiveStatusValues
    ]);

    useEffect(() => {
        if (customSettings.connectedBoardId && customSettings.peopleColumnIds && customSettings.peopleColumnIds.length > 0) {
            fetchProjects();
        }
    }, [fetchProjects]);

    return {
        projects,
        loading,
        error,
        refetch: fetchProjects
    };
};
