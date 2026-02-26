import { useState, useCallback, useRef } from 'react';
import mondaySdk from 'monday-sdk-js';
import { useSettings } from '../contexts/SettingsContext';
import { fetchItemsStatus, safeApi } from '../utils/mondayApi';
import logger from '../utils/logger';

const monday = mondaySdk();

/**
 * Hook לניהול משימות - אחזור ויצירה
 * תומך בסינון לפי עמודת סטטוס (אם מופעל)
 * @returns {Object} { tasks, loading, fetchForProject, createTask }
 */
export const useTasks = () => {
    const { customSettings } = useSettings();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(false);
    // ref למניעת קריאות כפולות (לא גורם ל-re-render)
    const loadingRef = useRef(false);

    /**
     * אחזור משימות לפי פרויקט
     * משתמש ב-tasksProjectColumnId ישירות מההגדרות
     * תומך בסינון נוסף לפי סטטוס
     */
    const fetchForProject = useCallback(async (projectId) => {
        if (!customSettings.tasksProjectColumnId || !projectId) {
            logger.warn('useTasks', 'Missing tasksProjectColumnId or projectId for fetching tasks');
            setTasks([]);
            return;
        }
        
        // מניעת קריאות כפולות (שימוש ב-ref לבדיקה מדויקת)
        if (loadingRef.current) {
            logger.debug('useTasks', 'Already loading tasks, skipping duplicate call');
            return;
        }

        // בדיקה אם פילטר סטטוס מופעל
        const statusFilterEnabled = customSettings.taskStatusFilterEnabled &&
            customSettings.taskStatusColumnId &&
            customSettings.taskActiveStatusValues?.length > 0;

        logger.functionStart('useTasks.fetchForProject', { 
            projectId,
            statusFilterEnabled,
            statusColumnId: statusFilterEnabled ? customSettings.taskStatusColumnId : null
        });

        loadingRef.current = true;
        setLoading(true);

        try {
            // שאילתה ישירה - לוקחים את הפרויקט ובודקים מה יש לו בעמודת המשימות
            const query = `query {
                items(ids: [${projectId}]) {
                    name
                    column_values(ids: ["${customSettings.tasksProjectColumnId}"]) {
                        ...on BoardRelationValue {
                            linked_items {
                                id
                                name
                            }
                        }
                    }
                }
            }`;

            const res = await safeApi(monday, 'useTasks.fetchForProject', query);

            if (res.data?.items?.[0]?.column_values?.[0]?.linked_items) {
                let items = res.data.items[0].column_values[0].linked_items;
                
                // סינון לפי סטטוס (אם מופעל)
                if (statusFilterEnabled && items.length > 0) {
                    logger.debug('useTasks', 'Applying status filter', {
                        itemCount: items.length,
                        statusColumnId: customSettings.taskStatusColumnId,
                        activeValues: customSettings.taskActiveStatusValues
                    });
                    
                    const itemIds = items.map(item => item.id);
                    const statusMap = await fetchItemsStatus(
                        monday,
                        itemIds,
                        customSettings.taskStatusColumnId
                    );
                    
                    // סינון לפי ערכי הסטטוס הפעילים
                    items = items.filter(item => {
                        const itemStatus = statusMap.get(item.id.toString());
                        return customSettings.taskActiveStatusValues.includes(itemStatus);
                    });
                    
                    logger.debug('useTasks', 'Status filter applied', {
                        beforeCount: itemIds.length,
                        afterCount: items.length
                    });
                }
                
                setTasks(items);
                logger.functionEnd('useTasks.fetchForProject', { 
                    count: items.length,
                    statusFilterApplied: statusFilterEnabled
                });
            } else {
                setTasks([]);
                logger.debug('useTasks', 'No tasks found for project');
            }
        } catch (err) {
            logger.apiError('fetchTasksForProject (direct)', err);
            logger.error('useTasks', 'Error fetching tasks', err);
            setTasks([]);
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    }, [
        customSettings.tasksProjectColumnId,
        customSettings.taskStatusFilterEnabled,
        customSettings.taskStatusColumnId,
        customSettings.taskActiveStatusValues
    ]);

    /**
     * יצירת משימה חדשה
     * שלבים:
     * 1. יצירת המשימה בלוח המשימות
     * 2. שליפת המשימות הקיימות מ-API (לא מ-state) - מונע דריסת קישורים קיימים
     * 3. עדכון הפרויקט עם כל המשימות (קיימות + חדשה)
     */
    const createTask = useCallback(async (projectId, taskName) => {
        if (!customSettings.tasksBoardId || !customSettings.connectedBoardId || !taskName?.trim() || !projectId) {
            logger.warn('useTasks', 'Missing settings or data for creating task');
            return null;
        }

        // בדיקה שיש tasksProjectColumnId
        if (!customSettings.tasksProjectColumnId) {
            logger.warn('useTasks', 'tasksProjectColumnId is required but not set');
            return null;
        }

        logger.functionStart('useTasks.createTask', { projectId, taskName });

        try {
            // שלב 1: יצירת המשימה בלי קישור
            const createMutation = `mutation {
                create_item(
                    board_id: ${customSettings.tasksBoardId},
                    item_name: "${taskName}"
                ) {
                    id
                    name
                }
            }`;

            const createRes = await safeApi(monday, 'useTasks.createTask:createItem', createMutation);

            if (!createRes.data?.create_item) {
                logger.warn('useTasks', 'No task created in response');
                return null;
            }

            const newTask = createRes.data.create_item;
            logger.debug('useTasks', 'Task created successfully', { taskId: newTask.id });

            // שלב 2: שליפת המשימות הקיימות ישירות מ-API (לא מ-state!)
            // זה מונע דריסת קישורים קיימים אם ה-state לא מעודכן
            const fetchExistingQuery = `query {
                items(ids: [${projectId}]) {
                    column_values(ids: ["${customSettings.tasksProjectColumnId}"]) {
                        ...on BoardRelationValue {
                            linked_items {
                                id
                            }
                        }
                    }
                }
            }`;

            const fetchRes = await safeApi(monday, 'useTasks.createTask:fetchExisting', fetchExistingQuery);

            // חילוץ ה-IDs של המשימות הקיימות
            const existingLinkedItems = fetchRes.data?.items?.[0]?.column_values?.[0]?.linked_items || [];
            const existingTaskIds = existingLinkedItems.map(item => item.id);
            const allTaskIds = [...existingTaskIds, newTask.id];

            logger.debug('useTasks', 'Updating project with tasks', { 
                existingCount: existingTaskIds.length, 
                newTaskId: newTask.id,
                totalCount: allTaskIds.length 
            });

            // שלב 3: עדכון הפרויקט עם כל המשימות (קיימות + חדשה)
            const columnValues = {
                [customSettings.tasksProjectColumnId]: {
                    item_ids: allTaskIds.map(id => parseInt(id))
                }
            };

            const updateMutation = `mutation {
                change_multiple_column_values(
                    item_id: ${projectId},
                    board_id: ${customSettings.connectedBoardId},
                    column_values: ${JSON.stringify(JSON.stringify(columnValues))}
                ) {
                    id
                }
            }`;

            const updateRes = await safeApi(monday, 'useTasks.createTask:updateProject', updateMutation);

            // עדכון state עם המשימה החדשה
            setTasks(prev => [...prev, newTask]);
            logger.functionEnd('useTasks.createTask', { task: newTask });
            return newTask;

        } catch (err) {
            logger.apiError('createTask', err);
            logger.error('useTasks', 'Error creating task', err);
            return null;
        }
    }, [customSettings.tasksBoardId, customSettings.connectedBoardId, customSettings.tasksProjectColumnId]);

    return {
        tasks,
        loading,
        fetchForProject,
        createTask
    };
};
