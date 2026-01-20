import { useState, useCallback } from 'react';
import mondaySdk from 'monday-sdk-js';
import { useSettings } from '../contexts/SettingsContext';
import { fetchItemsStatus } from '../utils/mondayApi';
import logger from '../utils/logger';

const monday = mondaySdk();

/**
 * Hook לניהול משימות מרובות - עבור מספר פרויקטים במקביל
 * תומך בסינון לפי עמודת סטטוס (אם מופעל)
 * @returns {Object} { tasks, loadingTasks, fetchForProject, createTask }
 */
export const useTasksMultiple = () => {
    const { customSettings } = useSettings();
    const [tasks, setTasks] = useState({}); // { projectId: [tasks] }
    const [loadingTasks, setLoadingTasks] = useState({}); // { projectId: boolean }

    /**
     * אחזור משימות לפי פרויקט
     * משתמש ב-tasksProjectColumnId ישירות מההגדרות
     * תומך בסינון נוסף לפי סטטוס
     */
    const fetchForProject = useCallback(async (projectId) => {
        if (!customSettings.tasksProjectColumnId || !projectId) {
            logger.warn('useTasksMultiple', 'Missing tasksProjectColumnId or projectId for fetching tasks');
            setTasks(prev => ({ ...prev, [projectId]: [] }));
            return;
        }

        // בדיקה אם פילטר סטטוס מופעל
        const statusFilterEnabled = customSettings.taskStatusFilterEnabled &&
            customSettings.taskStatusColumnId &&
            customSettings.taskActiveStatusValues?.length > 0;

        logger.functionStart('useTasksMultiple.fetchForProject', { 
            projectId,
            statusFilterEnabled,
            statusColumnId: statusFilterEnabled ? customSettings.taskStatusColumnId : null
        });

        setLoadingTasks(prev => ({ ...prev, [projectId]: true }));

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

            logger.api('useTasksMultiple.fetchForProject', query);

            const startTime = Date.now();
            const res = await monday.api(query);
            const duration = Date.now() - startTime;

            logger.apiResponse('useTasksMultiple.fetchForProject', res, duration);

            if (res.data?.items?.[0]?.column_values?.[0]?.linked_items) {
                let items = res.data.items[0].column_values[0].linked_items;
                
                // סינון לפי סטטוס (אם מופעל)
                if (statusFilterEnabled && items.length > 0) {
                    logger.debug('useTasksMultiple', 'Applying status filter', {
                        projectId,
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
                    
                    logger.debug('useTasksMultiple', 'Status filter applied', {
                        projectId,
                        beforeCount: itemIds.length,
                        afterCount: items.length
                    });
                }
                
                setTasks(prev => ({ ...prev, [projectId]: items }));
                logger.functionEnd('useTasksMultiple.fetchForProject', { 
                    projectId, 
                    count: items.length,
                    statusFilterApplied: statusFilterEnabled
                });
            } else {
                setTasks(prev => ({ ...prev, [projectId]: [] }));
                logger.debug('useTasksMultiple', 'No tasks found for project', projectId);
            }
        } catch (err) {
            logger.apiError('useTasksMultiple.fetchForProject', err);
            logger.error('useTasksMultiple', 'Error fetching tasks for project', err);
            setTasks(prev => ({ ...prev, [projectId]: [] }));
        } finally {
            setLoadingTasks(prev => ({ ...prev, [projectId]: false }));
        }
    }, [
        customSettings.tasksProjectColumnId,
        customSettings.taskStatusFilterEnabled,
        customSettings.taskStatusColumnId,
        customSettings.taskActiveStatusValues
    ]);

    /**
     * יצירת משימה חדשה
     */
    const createTaskForProject = useCallback(async (projectId, taskName) => {
        if (!customSettings.tasksBoardId || !customSettings.connectedBoardId || !taskName?.trim() || !projectId) {
            logger.warn('useTasksMultiple', 'Missing settings or data for creating task');
            return null;
        }

        // בדיקה שיש tasksProjectColumnId
        if (!customSettings.tasksProjectColumnId) {
            logger.warn('useTasksMultiple', 'tasksProjectColumnId is required but not set');
            return null;
        }

        logger.functionStart('useTasksMultiple.createTaskForProject', { projectId, taskName });

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

            logger.api('useTasksMultiple.createTaskForProject - create item', createMutation);

            const createStartTime = Date.now();
            const createRes = await monday.api(createMutation);
            const createDuration = Date.now() - createStartTime;

            logger.apiResponse('useTasksMultiple.createTaskForProject - create item', createRes, createDuration);

            if (!createRes.data?.create_item) {
                logger.warn('useTasksMultiple', 'No task created in response');
                return null;
            }

            const newTask = createRes.data.create_item;
            logger.debug('useTasksMultiple', 'Task created successfully', { taskId: newTask.id });

            // שלב 2: שימוש במשימות הקיימות מה-state של הפרויקט הספציפי
            const existingTasks = tasks[projectId] || [];
            const existingTaskIds = existingTasks.map(task => task.id);
            const allTaskIds = [...existingTaskIds, newTask.id];

            logger.debug('useTasksMultiple', 'Updating project with tasks', { 
                projectId,
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

            logger.api('useTasksMultiple.createTaskForProject - update project', updateMutation);

            const updateStartTime = Date.now();
            const updateRes = await monday.api(updateMutation);
            const updateDuration = Date.now() - updateStartTime;

            logger.apiResponse('useTasksMultiple.createTaskForProject - update project', updateRes, updateDuration);

            // עדכון state עם המשימה החדשה
            setTasks(prev => ({
                ...prev,
                [projectId]: [...(prev[projectId] || []), newTask]
            }));
            logger.functionEnd('useTasksMultiple.createTaskForProject', { task: newTask });
            return newTask;

        } catch (err) {
            logger.apiError('useTasksMultiple.createTaskForProject', err);
            logger.error('useTasksMultiple', 'Error creating task', err);
            return null;
        }
    }, [customSettings.tasksBoardId, customSettings.connectedBoardId, customSettings.tasksProjectColumnId, tasks]);

    return {
        tasks,
        loadingTasks,
        fetchForProject,
        createTask: createTaskForProject
    };
};
