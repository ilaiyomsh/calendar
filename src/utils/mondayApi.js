/**
 * פונקציות עזר לעבודה עם Monday API
 * כל הקריאות עוטפות ב-wrapMondayApiCall לטיפול אחיד בשגיאות ולוגים
 * 
 * @module mondayApi
 */

import logger from './logger';
import { extractOperationName } from './errorHandler';

/**
 * @typedef {Object} MondayItem
 * @property {string} id - מזהה האייטם
 * @property {string} name - שם האייטם
 * @property {Array} [column_values] - ערכי העמודות
 */

/**
 * @typedef {Object} Project
 * @property {string} id - מזהה הפרויקט
 * @property {string} name - שם הפרויקט
 */

/**
 * @typedef {Object} Task
 * @property {string} id - מזהה המשימה
 * @property {string} name - שם המשימה
 */

/**
 * @typedef {Object} StatusLabel
 * @property {string} id - מזהה הסטטוס
 * @property {string} label - תווית הסטטוס
 * @property {string} [color] - צבע הסטטוס
 */

/**
 * MondayApiError - שגיאה מותאמת עם פרטי Monday API
 */
export class MondayApiError extends Error {
    constructor(message, { response = null, apiRequest = null, errorCode = null, functionName = null, duration = null } = {}) {
        super(message);
        this.name = 'MondayApiError';
        this.response = response;
        this.apiRequest = apiRequest;
        this.errorCode = errorCode;
        this.functionName = functionName;
        this.duration = duration;
        this.timestamp = Date.now();
        
        // שמירת stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, MondayApiError);
        }
    }
    
    /**
     * המרה לאובייקט JSON מלא
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            errorCode: this.errorCode,
            response: this.response,
            apiRequest: this.apiRequest,
            functionName: this.functionName,
            duration: this.duration,
            timestamp: this.timestamp,
            stack: this.stack
        };
    }
}

/**
 * Wrapper לקריאות API של Monday - מטפל בלוגים ושגיאות באופן אחיד
 * @param {string} functionName - שם הפונקציה לצורך לוגים
 * @param {object} apiRequest - פרטי הבקשה (query, variables)
 * @param {Function} apiCall - הפונקציה שמבצעת את הקריאה ל-API
 * @returns {Promise<{response: object, duration: number}>}
 */
const wrapMondayApiCall = async (functionName, apiRequest, apiCall) => {
    const startTime = Date.now();
    try {
        const response = await apiCall();
        const duration = Date.now() - startTime;
        logger.apiResponse(functionName, response, duration);

        if (response.errors?.length > 0) {
            const firstError = response.errors[0];
            throw new MondayApiError(firstError.message || 'Unknown error', {
                response,
                apiRequest,
                errorCode: firstError.extensions?.code,
                functionName,
                duration
            });
        }
        return { response, duration };
    } catch (error) {
        logger.apiError(functionName, error);
        if (error instanceof MondayApiError) throw error;
        throw new MondayApiError(error.message || 'Unknown error', {
            response: error.response,
            apiRequest,
            errorCode: error.errorCode,
            functionName,
            duration: Date.now() - startTime
        });
    }
};

// פונקציה להמרת מחרוזת שעה (HH:MM) לאובייקט Date
export const parseTimeString = (timeString) => {
    if (!timeString) return null;
    const [hours, minutes] = timeString.split(':').map(Number);
    return new Date(1970, 1, 1, hours, minutes, 0);
};

// אחזור הגדרות עמודת Board מחובר
export const fetchColumnSettings = async (monday, boardId, columnId) => {
    logger.functionStart('fetchColumnSettings', { boardId, columnId });

    const query = `query {
        boards(ids: [${boardId}]) {
            columns(ids: "${columnId}") {
                settings
            }
        }
    }`;

    const apiRequest = { query, variables: null, operationName: extractOperationName(query) };
    logger.api('fetchColumnSettings', query);

    const { response } = await wrapMondayApiCall('fetchColumnSettings', apiRequest, () => monday.api(query));
    const columnSettings = response.data?.boards?.[0]?.columns?.[0]?.settings;
    logger.functionEnd('fetchColumnSettings', { hasSettings: !!columnSettings });
    return columnSettings;
};

// אחזור כל האייטמים מלוח עם pagination
export const fetchAllBoardItems = async (monday, boardId) => {
    logger.functionStart('fetchAllBoardItems', { boardId });

    let allItems = [];
    let cursor = null;
    let pageCount = 0;

    // קריאה ראשונה
    const firstQuery = `query {
        boards(ids: [${boardId}]) {
            items_page (limit:100){
                cursor
                items{
                    name
                    id
                }
            }
        }
    }`;

    const firstApiRequest = { query: firstQuery, variables: null, operationName: extractOperationName(firstQuery) };
    logger.api('fetchAllBoardItems (first page)', firstQuery);

    const { response: firstResponse } = await wrapMondayApiCall('fetchAllBoardItems', firstApiRequest, () => monday.api(firstQuery));
    const itemsPage = firstResponse.data?.boards?.[0]?.items_page;
    
    if (itemsPage) {
        allItems = allItems.concat(itemsPage.items);
        cursor = itemsPage.cursor;
        pageCount++;
        logger.debug('fetchAllBoardItems', `Page ${pageCount}: Fetched ${itemsPage.items.length} items`);
    }

    // קריאות המשך
    while (cursor) {
        const nextQuery = `query {
            next_items_page (cursor: "${cursor}", limit:100){
                cursor
                items{
                    name
                    id
                }
            }
        }`;

        const nextApiRequest = { query: nextQuery, variables: null, operationName: extractOperationName(nextQuery) };
        logger.api(`fetchAllBoardItems (page ${pageCount + 1})`, nextQuery);

        const { response: nextResponse } = await wrapMondayApiCall('fetchAllBoardItems', nextApiRequest, () => monday.api(nextQuery));
        const nextPage = nextResponse.data?.next_items_page;
        
        if (nextPage && nextPage.items) {
            allItems = allItems.concat(nextPage.items);
            cursor = nextPage.cursor;
            pageCount++;
            logger.debug('fetchAllBoardItems', `Page ${pageCount}: Fetched ${nextPage.items.length} items`);
        } else {
            cursor = null;
        }
    }

    logger.functionEnd('fetchAllBoardItems', { totalItems: allItems.length, pages: pageCount });
    
    // המרה לפורמט Combobox
    return allItems.map(item => ({
        value: item.id,
        label: item.name
    }));
};

// יצירת אייטם חדש בלוח עם ערכי עמודות
export const createBoardItem = async (monday, boardId, itemName, columnValues = null) => {
    logger.functionStart('createBoardItem', { boardId, itemName, hasColumnValues: !!columnValues });

    const query = `mutation create_item($boardId: ID!, $itemName: String!, $columnValues: JSON) {
        create_item (
            board_id: $boardId,
            item_name: $itemName,
            column_values: $columnValues
        ) {
            id
            name
        }
    }`;

    let formattedColumnValues = null;
    if (columnValues) {
        formattedColumnValues = typeof columnValues === 'string' ? columnValues : JSON.stringify(columnValues);
    }

    const variables = { boardId: parseInt(boardId), itemName, columnValues: formattedColumnValues };
    const apiRequest = { query, variables, operationName: extractOperationName(query) };
    logger.api('createBoardItem', query, variables);

    const { response } = await wrapMondayApiCall('createBoardItem', apiRequest, () => monday.api(query, { variables }));
    logger.functionEnd('createBoardItem', { item: response.data?.create_item });
    return response.data?.create_item;
};

// שליפת אירועים מהלוח בטווח תאריכים
export const fetchEventsFromBoard = async (monday, query) => {
    logger.functionStart('fetchEventsFromBoard');
    const apiRequest = { query, variables: null, operationName: extractOperationName(query) };
    logger.api('fetchEventsFromBoard', query);

    const { response } = await wrapMondayApiCall('fetchEventsFromBoard', apiRequest, () => monday.api(query));
    const items = response.data?.boards?.[0]?.items_page?.items || [];
    logger.functionEnd('fetchEventsFromBoard', { count: items.length });
    return items;
};

// אחזור פרויקטים המשויכים למשתמש
export const fetchProjectsForUser = async (monday, boardId, peopleColumnIds) => {
    const columnIds = Array.isArray(peopleColumnIds) ? peopleColumnIds : (peopleColumnIds ? [peopleColumnIds] : []);
    logger.functionStart('fetchProjectsForUser', { boardId, peopleColumnIds: columnIds });

    if (columnIds.length === 0) {
        logger.warn('fetchProjectsForUser', 'No people column IDs provided');
        return [];
    }

    const rules = columnIds.map(columnId => ({
        column_id: columnId,
        compare_value: ["assigned_to_me"],
        operator: "any_of"
    }));

    const rulesGraphQL = rules.map(rule => 
        `{
            column_id: "${rule.column_id}",
            compare_value: ${JSON.stringify(rule.compare_value)},
            operator: ${rule.operator}
        }`
    ).join(',\n');

    const operator = columnIds.length > 1 ? 'or' : 'and';
    const query = `query {
        boards(ids: ${boardId}) {
            items_page(
                query_params: {
                    operator: ${operator},
                    rules: [${rulesGraphQL}]
                }
            ) {
                items {
                    id
                    name
                }
            }
        }
    }`;

    const apiRequest = { query, variables: null, operationName: extractOperationName(query) };
    logger.api('fetchProjectsForUser', query);

    const { response } = await wrapMondayApiCall('fetchProjectsForUser', apiRequest, () => monday.api(query));
    const items = response.data?.boards?.[0]?.items_page?.items || [];
    logger.functionEnd('fetchProjectsForUser', { count: items.length });
    return items;
};

// מציאת עמודת Connected Board בלוח המשימות שמקשרת ללוח הפרויקטים
export const findProjectLinkColumn = async (monday, tasksBoardId, projectBoardId) => {
    if (!tasksBoardId || !projectBoardId) return null;
    logger.functionStart('findProjectLinkColumn', { tasksBoardId, projectBoardId });

    const query = `query {
        boards(ids: [${tasksBoardId}]) {
            columns {
                id
                type
                settings_str
            }
        }
    }`;

    const apiRequest = { query, variables: null, operationName: extractOperationName(query) };
    logger.api('findProjectLinkColumn', query);
    
    const { response } = await wrapMondayApiCall('findProjectLinkColumn', apiRequest, () => monday.api(query));
    const columns = response.data?.boards?.[0]?.columns || [];

    for (const col of columns) {
        if (col.type === 'board_relation') {
            try {
                const settings = JSON.parse(col.settings_str || '{}');
                if (settings.boardIds && settings.boardIds.includes(parseInt(projectBoardId))) {
                    logger.functionEnd('findProjectLinkColumn', { columnId: col.id });
                    return col.id;
                }
            } catch { continue; }
        }
    }
    logger.warn('findProjectLinkColumn', 'Could not find project link column in tasks board');
    return null;
};

// יצירת משימה חדשה
export const createTask = async (monday, tasksBoardId, projectBoardId, projectId, taskName) => {
    logger.functionStart('createTask', { tasksBoardId, projectBoardId, projectId, taskName });

    const projectLinkColumnId = await findProjectLinkColumn(monday, tasksBoardId, projectBoardId);
    if (!projectLinkColumnId) {
        logger.warn('createTask', 'Could not find project link column in tasks board');
        return null;
    }

    const columnValues = JSON.stringify({
        [projectLinkColumnId]: { item_ids: [parseInt(projectId)] }
    });

    const mutation = `mutation {
        create_item(
            board_id: ${tasksBoardId},
            item_name: "${taskName}",
            column_values: ${JSON.stringify(columnValues)}
        ) {
            id
            name
        }
    }`;

    const apiRequest = { query: mutation, variables: null, operationName: extractOperationName(mutation) };
    logger.api('createTask', mutation);

    const { response } = await wrapMondayApiCall('createTask', apiRequest, () => monday.api(mutation));
    logger.functionEnd('createTask', { task: response.data?.create_item });
    return response.data?.create_item;
};

// עדכון ערכי עמודות באייטם
export const updateItemColumnValues = async (monday, boardId, itemId, columnValues) => {
    logger.functionStart('updateItemColumnValues', { boardId, itemId });

    const mutation = `mutation {
        change_multiple_column_values(
            item_id: ${itemId}, 
            board_id: ${boardId}, 
            column_values: ${JSON.stringify(JSON.stringify(columnValues))}
        ) {
            id
        }
    }`;

    const apiRequest = { query: mutation, variables: null, operationName: extractOperationName(mutation) };
    logger.api('updateItemColumnValues', mutation);

    const { response } = await wrapMondayApiCall('updateItemColumnValues', apiRequest, () => monday.api(mutation));
    logger.functionEnd('updateItemColumnValues', { success: !!response.data });
    return response.data;
};

// אחזור פרטי המשתמש הנוכחי
export const fetchCurrentUser = async (monday) => {
    logger.functionStart('fetchCurrentUser');
    const query = `query { me { name id } }`;
    const apiRequest = { query, variables: null, operationName: extractOperationName(query) };
    logger.api('fetchCurrentUser', query);

    const { response } = await wrapMondayApiCall('fetchCurrentUser', apiRequest, () => monday.api(query));
    const user = response.data?.me;
    logger.functionEnd('fetchCurrentUser', { hasUser: !!user });
    return user;
};

// אחזור אייטם בודד לפי ID
export const fetchItemById = async (monday, boardId, itemId) => {
    logger.functionStart('fetchItemById', { boardId, itemId });

    const query = `query {
        items(ids: [${itemId}]) {
            id
            name
            column_values {
                id
                value
                type
                ... on DateValue {
                    date
                    time
                }
                ... on BoardRelationValue {
                    value
                    linked_items {
                        name
                        id
                    }
                }
                ... on TextValue {
                    text
                }
            }
        }
    }`;

    const apiRequest = { query, variables: null, operationName: extractOperationName(query) };
    logger.api('fetchItemById', query);

    const { response } = await wrapMondayApiCall('fetchItemById', apiRequest, () => monday.api(query));
    const items = response.data?.items || [];
    const item = items.length > 0 ? items[0] : null;
    logger.functionEnd('fetchItemById', { found: !!item });
    return item;
};

// אחזור פרויקט בודד לפי ID
export const fetchProjectById = async (monday, boardId, projectId) => {
    logger.functionStart('fetchProjectById', { boardId, projectId });

    const query = `query {
        items(ids: [${projectId}]) {
            id
            name
        }
    }`;

    const apiRequest = { query, variables: null, operationName: extractOperationName(query) };
    logger.api('fetchProjectById', query);

    const { response } = await wrapMondayApiCall('fetchProjectById', apiRequest, () => monday.api(query));
    const items = response.data?.items || [];
    const project = items.length > 0 ? { id: items[0].id, name: items[0].name } : null;
    logger.functionEnd('fetchProjectById', { found: !!project });
    return project;
};

export const deleteItem = async (monday, itemId) => {
    logger.functionStart('deleteItem', { itemId });
    const mutation = `mutation { delete_item(item_id: ${itemId}) { id } }`;
    const apiRequest = { query: mutation, variables: null, operationName: extractOperationName(mutation) };
    logger.api('deleteItem', mutation);

    const { response } = await wrapMondayApiCall('deleteItem', apiRequest, () => monday.api(mutation));
    logger.functionEnd('deleteItem', { success: !!response.data });
    return response.data;
};

// יצירת עמודת Status חדשה לסוג אירוע עם הלייבלים הנדרשים
export const createEventTypeStatusColumn = async (monday, boardId, columnTitle = 'סוג דיווח') => {
    logger.functionStart('createEventTypeStatusColumn', { boardId, columnTitle });

    // הגדרת הלייבלים בפורמט של Monday API
    // צבעים: working_orange, stuck_red, grass_green, dark_blue, sunset, purple
    const mutation = `mutation {
        create_status_column(
            board_id: ${boardId}
            title: "${columnTitle}"
            defaults: {
                labels: [
                    { color: working_orange, label: "חופשה", index: 0 }
                    { color: stuck_red, label: "מחלה", index: 1 }
                    { color: grass_green, label: "מילואים", index: 2 }
                    { color: dark_blue, label: "שעתי", index: 3 }
                    { color: sunset, label: "לא לחיוב", index: 4 }
                    { color: purple, label: "זמני", index: 5 }
                ]
            }
        ) {
            id
        }
    }`;

    const apiRequest = { query: mutation, variables: null, operationName: 'create_status_column' };
    logger.api('createEventTypeStatusColumn', mutation);

    const { response } = await wrapMondayApiCall('createEventTypeStatusColumn', apiRequest, () => monday.api(mutation));
    const columnId = response.data?.create_status_column?.id;
    logger.functionEnd('createEventTypeStatusColumn', { columnId });
    return columnId;
};

// שליפת הגדרות עמודה (settings) לפי ID
export const fetchStatusColumnSettings = async (monday, boardId, columnId) => {
    logger.functionStart('fetchStatusColumnSettings', { boardId, columnId });

    const query = `query {
        boards(ids: [${boardId}]) {
            columns(ids: ["${columnId}"]) {
                type
                id
                title
                settings
            }
        }
    }`;

    const apiRequest = { query, variables: null, operationName: extractOperationName(query) };
    logger.api('fetchStatusColumnSettings', query);

    const { response } = await wrapMondayApiCall('fetchStatusColumnSettings', apiRequest, () => monday.api(query));
    const column = response.data?.boards?.[0]?.columns?.[0];
    logger.functionEnd('fetchStatusColumnSettings', { hasColumn: !!column });
    return column;
};

// שליפת כל עמודות הסטטוס מלוח
export const fetchStatusColumnsFromBoard = async (monday, boardId) => {
    if (!boardId) return [];
    logger.functionStart('fetchStatusColumnsFromBoard', { boardId });

    const query = `query {
        boards(ids: [${boardId}]) {
            columns {
                id
                title
                type
                settings_str
            }
        }
    }`;

    const apiRequest = { query, variables: null, operationName: extractOperationName(query) };
    logger.api('fetchStatusColumnsFromBoard', query);

    const { response } = await wrapMondayApiCall('fetchStatusColumnsFromBoard', apiRequest, () => monday.api(query));
    const columns = response.data?.boards?.[0]?.columns || [];
    const statusColumns = columns
        .filter(col => col.type === 'status')
        .map(col => ({
            id: col.id,
            title: col.title,
            settings_str: col.settings_str
        }));
    
    logger.functionEnd('fetchStatusColumnsFromBoard', { count: statusColumns.length });
    return statusColumns;
};

/**
 * חילוץ labels מהגדרות עמודת סטטוס
 * תומך בפורמט חדש (array) ופורמט ישן (object)
 * @param {string|object} columnSettings - הגדרות העמודה (settings או settings_str)
 * @returns {Array<{id: string, label: string, color?: string}>}
 */
export const parseStatusLabels = (columnSettings) => {
    if (!columnSettings) return [];
    
    let settings = columnSettings;
    
    // אם זה string, נפרסר אותו
    if (typeof columnSettings === 'string') {
        try {
            settings = JSON.parse(columnSettings);
        } catch {
            logger.warn('parseStatusLabels', 'Failed to parse column settings string');
            return [];
        }
    }
    
    if (!settings.labels) return [];
    
    // פורמט חדש - מערך
    if (Array.isArray(settings.labels)) {
        return settings.labels
            .filter(item => item && item.label && !item.is_deactivated)
            .map(item => ({
                id: item.id?.toString() || item.label,
                label: item.label,
                color: item.color || item.hex
            }));
    }
    
    // פורמט ישן - אובייקט
    return Object.entries(settings.labels)
        .filter(([id]) => id !== 'empty' && id !== '')
        .map(([id, data]) => ({
            id,
            label: typeof data === 'string' ? data : (data?.label || ''),
            color: typeof data === 'object' ? (data?.color || data?.hex) : undefined
        }))
        .filter(item => item.label); // מסנן ערכים ריקים
};

/**
 * שליפת ערכי סטטוס עבור רשימת אייטמים
 * @param {object} monday - Monday SDK instance
 * @param {string[]} itemIds - רשימת מזהי אייטמים
 * @param {string} statusColumnId - מזהה עמודת הסטטוס
 * @returns {Promise<Map<string, string>>} - מפה של itemId -> statusLabel
 */
export const fetchItemsStatus = async (monday, itemIds, statusColumnId) => {
    if (!itemIds || itemIds.length === 0 || !statusColumnId) {
        return new Map();
    }
    
    logger.functionStart('fetchItemsStatus', { itemCount: itemIds.length, statusColumnId });

    const query = `query {
        items(ids: [${itemIds.join(',')}]) {
            id
            column_values(ids: ["${statusColumnId}"]) {
                id
                text
            }
        }
    }`;

    const apiRequest = { query, variables: null, operationName: extractOperationName(query) };
    logger.api('fetchItemsStatus', query);

    const { response } = await wrapMondayApiCall('fetchItemsStatus', apiRequest, () => monday.api(query));
    const items = response.data?.items || [];
    const statusMap = new Map();
    
    items.forEach(item => {
        const statusColumn = item.column_values?.find(col => col.id === statusColumnId);
        if (statusColumn) {
            // text מכיל את ה-label של הסטטוס
            statusMap.set(item.id.toString(), statusColumn.text || '');
        }
    });
    
    logger.functionEnd('fetchItemsStatus', { mappedCount: statusMap.size });
    return statusMap;
};

/**
 * שליפת הקצאות פעילות (Assignments) עבור המשתמש הנוכחי
 * מחזירה רשימת פרויקטים מהקצאות שהתאריכים שלהם כוללים את היום
 * @param {object} monday - Monday SDK instance
 * @param {string} boardId - מזהה לוח ההקצאות
 * @param {string} personColumnId - מזהה עמודת אנשים
 * @param {string} startDateColumnId - מזהה עמודת תאריך התחלה
 * @param {string} endDateColumnId - מזהה עמודת תאריך סיום
 * @param {string} projectLinkColumnId - מזהה עמודת קישור לפרויקט
 * @returns {Promise<Array<{id: string, name: string}>>} - רשימת פרויקטים ייחודיים
 */
export const fetchActiveAssignments = async (monday, boardId, personColumnId, startDateColumnId, endDateColumnId, projectLinkColumnId) => {
    if (!boardId || !personColumnId || !startDateColumnId || !endDateColumnId || !projectLinkColumnId) {
        logger.warn('fetchActiveAssignments', 'Missing required parameters');
        return [];
    }

    logger.functionStart('fetchActiveAssignments', {
        boardId,
        personColumnId,
        startDateColumnId,
        endDateColumnId,
        projectLinkColumnId
    });

    // בניית שאילתה עם 3 תנאים:
    // 1. עמודת אנשים = המשתמש הנוכחי
    // 2. תאריך התחלה <= היום
    // 3. תאריך סיום >= היום
    const query = `query {
        boards(ids: [${boardId}]) {
            items_page(
                query_params: {
                    operator: and,
                    rules: [
                        {
                            column_id: "${personColumnId}",
                            compare_value: ["assigned_to_me"],
                            operator: any_of
                        },
                        {
                            column_id: "${startDateColumnId}",
                            compare_value: ["TODAY"],
                            operator: lower_than_or_equal
                        },
                        {
                            column_id: "${endDateColumnId}",
                            compare_value: ["TODAY"],
                            operator: greater_than_or_equals
                        }
                    ]
                }
            ) {
                items {
                    id
                    column_values(ids: ["${projectLinkColumnId}"]) {
                        ... on BoardRelationValue {
                            linked_items {
                                id
                                name
                            }
                        }
                    }
                }
            }
        }
    }`;

    const apiRequest = { query, variables: null, operationName: extractOperationName(query) };
    logger.api('fetchActiveAssignments', query);

    const { response } = await wrapMondayApiCall('fetchActiveAssignments', apiRequest, () => monday.api(query));
    const items = response.data?.boards?.[0]?.items_page?.items || [];

    // חילוץ פרויקטים ייחודיים מההקצאות
    const projectsMap = new Map();
    items.forEach(item => {
        const linkedItems = item.column_values?.[0]?.linked_items || [];
        linkedItems.forEach(project => {
            if (project.id && !projectsMap.has(project.id)) {
                projectsMap.set(project.id, { 
                    id: project.id, 
                    name: project.name,
                    assignmentId: item.id  // מזהה שורת ההקצאה בלוח ההקצאות
                });
            }
        });
    });

    const projects = Array.from(projectsMap.values());
    logger.functionEnd('fetchActiveAssignments', {
        assignmentsCount: items.length,
        uniqueProjectsCount: projects.length
    });

    return projects;
};

/**
 * שליפת הגדרות עמודת Connect Boards לזיהוי הלוחות המקושרים
 * @param {Object} monday - Monday SDK instance
 * @param {string} boardId - מזהה הלוח
 * @param {string} columnId - מזהה העמודה
 * @returns {Promise<Array<{id: string, name: string}>>} רשימת הלוחות המקושרים
 */
export const fetchConnectedBoardsFromColumn = async (monday, boardId, columnId) => {
    logger.functionStart('fetchConnectedBoardsFromColumn', { boardId, columnId });

    const query = `query {
        boards(ids: [${boardId}]) {
            columns(ids: ["${columnId}"]) {
                settings_str
            }
        }
    }`;

    const apiRequest = { query, variables: null, operationName: 'fetchConnectedBoardsFromColumn' };
    logger.api('fetchConnectedBoardsFromColumn', query);

    const { response } = await wrapMondayApiCall('fetchConnectedBoardsFromColumn', apiRequest, () => monday.api(query));
    const settingsStr = response.data?.boards?.[0]?.columns?.[0]?.settings_str;

    if (!settingsStr) {
        logger.warn('fetchConnectedBoardsFromColumn', 'No settings found for column');
        return [];
    }

    try {
        const settings = JSON.parse(settingsStr);
        const boardIds = settings.boardIds || [];

        if (boardIds.length === 0) {
            logger.warn('fetchConnectedBoardsFromColumn', 'No connected boards found');
            return [];
        }

        // שליפת שמות הלוחות
        const boardsQuery = `query {
            boards(ids: [${boardIds.join(',')}]) {
                id
                name
            }
        }`;

        const boardsResponse = await monday.api(boardsQuery);
        const boards = boardsResponse.data?.boards || [];

        logger.functionEnd('fetchConnectedBoardsFromColumn', { boardsCount: boards.length });
        return boards.map(b => ({ id: b.id, name: b.name }));
    } catch (error) {
        logger.error('fetchConnectedBoardsFromColumn', 'Error parsing settings', error);
        return [];
    }
};

/**
 * שליפת כל האנשים הייחודיים מעמודת People בלוח
 * @param {Object} monday - Monday SDK instance
 * @param {string} boardId - מזהה הלוח
 * @param {string} columnId - מזהה עמודת ה-People
 * @returns {Promise<Array<{id: string, name: string}>>} רשימת האנשים הייחודיים
 */
export const fetchUniquePeopleFromBoard = async (monday, boardId, columnId) => {
    logger.functionStart('fetchUniquePeopleFromBoard', { boardId, columnId });

    const query = `query {
        boards(ids: [${boardId}]) {
            items_page(limit: 500) {
                cursor
                items {
                    column_values(ids: ["${columnId}"]) {
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

    const apiRequest = { query, variables: null, operationName: 'fetchUniquePeopleFromBoard' };
    logger.api('fetchUniquePeopleFromBoard', query);

    const { response } = await wrapMondayApiCall('fetchUniquePeopleFromBoard', apiRequest, () => monday.api(query));
    const items = response.data?.boards?.[0]?.items_page?.items || [];

    // איסוף מזהי אנשים ייחודיים (רק persons, לא teams)
    const personIds = new Set();
    items.forEach(item => {
        const peopleValue = item.column_values?.[0];
        const personsAndTeams = peopleValue?.persons_and_teams || [];
        personsAndTeams.forEach(p => {
            if (p.kind === 'person') {
                personIds.add(p.id);
            }
        });
    });

    if (personIds.size === 0) {
        logger.warn('fetchUniquePeopleFromBoard', 'No people found in column');
        return [];
    }

    // שליפת פרטי המשתמשים
    const userIds = Array.from(personIds);
    const usersQuery = `query {
        users(ids: [${userIds.join(',')}]) {
            id
            name
        }
    }`;

    const usersResponse = await monday.api(usersQuery);
    const users = usersResponse.data?.users || [];

    logger.functionEnd('fetchUniquePeopleFromBoard', { uniquePeopleCount: users.length });
    return users.map(u => ({ id: u.id, name: u.name }));
};
