/**
 * פונקציות עזר לעבודה עם Monday API
 */

import logger from './logger';
import { extractOperationName } from './errorHandler';

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

    const apiRequest = {
        query,
        variables: null,
        operationName: extractOperationName(query)
    };

    logger.api('fetchColumnSettings', query);

    try {
        const startTime = Date.now();
        const response = await monday.api(query);
        const duration = Date.now() - startTime;

        logger.apiResponse('fetchColumnSettings', response, duration);
    
        // בדיקת שגיאות ברמת ה-GraphQL
        if (response.errors && response.errors.length > 0) {
            const firstError = response.errors[0];
            const errorCode = firstError.extensions?.code || null;
            throw new MondayApiError(
                firstError.message || 'Unknown error',
                { response, apiRequest, errorCode, functionName: 'fetchColumnSettings', duration }
            );
        }
    
        const columnSettings = response.data?.boards?.[0]?.columns?.[0]?.settings;
        logger.functionEnd('fetchColumnSettings', { hasSettings: !!columnSettings });
    
        return columnSettings;
    } catch (error) {
        logger.apiError('fetchColumnSettings', error);
        
        // אם זו כבר MondayApiError, פשוט נזרוק אותה
        if (error instanceof MondayApiError) {
            throw error;
        }
        
        // אחרת, נעטוף אותה ב-MondayApiError
        throw new MondayApiError(
            error.message || 'Unknown error',
            { 
                response: error.response || null, 
                apiRequest, 
                errorCode: error.errorCode || null,
                functionName: 'fetchColumnSettings',
                duration: Date.now() - (error.startTime || Date.now())
            }
        );
    }
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

    const firstApiRequest = {
        query: firstQuery,
        variables: null,
        operationName: extractOperationName(firstQuery)
    };

    logger.api('fetchAllBoardItems (first page)', firstQuery);

    try {
        const startTime = Date.now();
        const firstResponse = await monday.api(firstQuery);
        const duration = Date.now() - startTime;

        logger.apiResponse('fetchAllBoardItems (first page)', firstResponse, duration);
        
        // בדיקת שגיאות ברמת ה-GraphQL
        if (firstResponse.errors && firstResponse.errors.length > 0) {
            const firstError = firstResponse.errors[0];
            const errorCode = firstError.extensions?.code || null;
            throw new MondayApiError(
                firstError.message || 'Unknown error',
                { response: firstResponse, apiRequest: firstApiRequest, errorCode, functionName: 'fetchAllBoardItems', duration }
            );
        }

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

        const nextApiRequest = {
            query: nextQuery,
            variables: null,
            operationName: extractOperationName(nextQuery)
        };

        logger.api(`fetchAllBoardItems (page ${pageCount + 1})`, nextQuery);

        const pageStartTime = Date.now();
        const nextResponse = await monday.api(nextQuery);
        const pageDuration = Date.now() - pageStartTime;

        logger.apiResponse(`fetchAllBoardItems (page ${pageCount + 1})`, nextResponse, pageDuration);
        
        // בדיקת שגיאות ברמת ה-GraphQL
        if (nextResponse.errors && nextResponse.errors.length > 0) {
            const firstError = nextResponse.errors[0];
            const errorCode = firstError.extensions?.code || null;
            throw new MondayApiError(
                firstError.message || 'Unknown error',
                { response: nextResponse, apiRequest: nextApiRequest, errorCode, functionName: 'fetchAllBoardItems', duration: pageDuration }
            );
        }

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
    } catch (error) {
        logger.apiError('fetchAllBoardItems', error);
        
        // אם זו כבר MondayApiError, פשוט נזרוק אותה
        if (error instanceof MondayApiError) {
            throw error;
        }
        
        // אחרת, נעטוף אותה ב-MondayApiError (נשתמש ב-firstApiRequest)
        throw new MondayApiError(
            error.message || 'Unknown error',
            { 
                response: error.response || null, 
                apiRequest: firstApiRequest, 
                errorCode: error.errorCode || null,
                functionName: 'fetchAllBoardItems',
                duration: null
            }
        );
    }
};

// יצירת אייטם חדש בלוח עם ערכי עמודות - גרסה מתוקנת ובטוחה
export const createBoardItem = async (monday, boardId, itemName, columnValues = null) => {
    // לוג התחלה
    logger.functionStart('createBoardItem', { boardId, itemName, hasColumnValues: !!columnValues });

    // 1. הגדרת ה-Mutation עם משתנים (Variables)
    // שים לב לשימוש ב-$ לפני שמות המשתנים
    // הסוג JSON! ב-Monday מצפה לקבל *מחרוזת* שמכילה JSON
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

    // 2. הכנת אובייקט המשתנים
    // תיקון: בדיקה אם columnValues הוא כבר מחרוזת כדי למנוע stringify כפול
    let formattedColumnValues = null;
    if (columnValues) {
        if (typeof columnValues === 'string') {
            formattedColumnValues = columnValues; // כבר מחרוזת, לא צריך המרה
        } else {
            formattedColumnValues = JSON.stringify(columnValues); // אובייקט, צריך המרה
        }
    }

    const variables = {
        boardId: parseInt(boardId),
        itemName: itemName,
        columnValues: formattedColumnValues
    };

    const apiRequest = {
        query,
        variables,
        operationName: extractOperationName(query)
    };

    // עדכון הלוג שיראה גם את המשתנים (עוזר לדיבוג)
    logger.api('createBoardItem', query, variables);

    try {
        const startTime = Date.now();
        
        // 3. שליחת השאילתה יחד עם המשתנים
        const response = await monday.api(query, { variables });
        
        const duration = Date.now() - startTime;
        logger.apiResponse('createBoardItem', response, duration);
        
        // בדיקת שגיאות ברמת ה-GraphQL
        if (response.errors && response.errors.length > 0) {
            const firstError = response.errors[0];
            const errorCode = firstError.extensions?.code || null;
            throw new MondayApiError(
                firstError.message || 'Unknown error',
                { response, apiRequest, errorCode, functionName: 'createBoardItem', duration }
            );
        }
        
        logger.functionEnd('createBoardItem', { item: response.data?.create_item });
    
        return response.data?.create_item;
    } catch (error) {
        // לוג שגיאה קריטי - נשאר פעיל גם בפרודקשן
        logger.apiError('createBoardItem', error);
        
        // אם זו כבר MondayApiError, פשוט נזרוק אותה
        if (error instanceof MondayApiError) {
            throw error;
        }
        
        // אחרת, נעטוף אותה ב-MondayApiError
        throw new MondayApiError(
            error.message || 'Unknown error',
            { 
                response: error.response || null, 
                apiRequest, 
                errorCode: error.errorCode || null,
                functionName: 'createBoardItem',
                duration: Date.now() - (error.startTime || Date.now())
            }
        );
    }
};

// שליפת אירועים מהלוח בטווח תאריכים
export const fetchEventsFromBoard = async (monday, query) => {
    logger.functionStart('fetchEventsFromBoard');
    
    const apiRequest = {
        query,
        variables: null,
        operationName: extractOperationName(query)
    };
    
    logger.api('fetchEventsFromBoard', query);
    
    try {
        const startTime = Date.now();
        const response = await monday.api(query);
        const duration = Date.now() - startTime;

        logger.apiResponse('fetchEventsFromBoard', response, duration);
        
        // בדיקת שגיאות ברמת ה-GraphQL
        if (response.errors && response.errors.length > 0) {
            const firstError = response.errors[0];
            const errorCode = firstError.extensions?.code || null;
            throw new MondayApiError(
                firstError.message || 'Unknown error',
                { response, apiRequest, errorCode, functionName: 'fetchEventsFromBoard', duration }
            );
        }

        const items = response.data?.boards?.[0]?.items_page?.items || [];
        
        logger.functionEnd('fetchEventsFromBoard', { count: items.length });
        return items;
    } catch (error) {
        logger.apiError('fetchEventsFromBoard', error);
        
        // אם זו כבר MondayApiError, פשוט נזרוק אותה
        if (error instanceof MondayApiError) {
            throw error;
        }
        
        // אחרת, נעטוף אותה ב-MondayApiError
        throw new MondayApiError(
            error.message || 'Unknown error',
            { 
                response: error.response || null, 
                apiRequest, 
                errorCode: error.errorCode || null,
                functionName: 'fetchEventsFromBoard',
                duration: Date.now() - (error.startTime || Date.now())
            }
        );
    }
};

// אחזור לקוחות המשויכים למשתמש
export const fetchCustomersForUser = async (monday, boardId, peopleColumnIds) => {
    // תמיכה ב-backward compatibility - אם זה string, להמיר ל-array
    const columnIds = Array.isArray(peopleColumnIds) ? peopleColumnIds : (peopleColumnIds ? [peopleColumnIds] : []);
    
    logger.functionStart('fetchCustomersForUser', { boardId, peopleColumnIds: columnIds });

    if (columnIds.length === 0) {
        logger.warn('fetchCustomersForUser', 'No people column IDs provided');
        return [];
    }

    // בניית rules לכל עמודת people
    const rules = columnIds.map(columnId => ({
        column_id: columnId,
        compare_value: ["assigned_to_me"],
        operator: "any_of"
    }));

    // המרת rules ל-GraphQL format
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

    const apiRequest = {
        query,
        variables: null,
        operationName: extractOperationName(query)
    };

    logger.api('fetchCustomersForUser', query);

    try {
        const startTime = Date.now();
        const response = await monday.api(query);
        const duration = Date.now() - startTime;

        logger.apiResponse('fetchCustomersForUser', response, duration);
        
        // בדיקת שגיאות ברמת ה-GraphQL
        if (response.errors && response.errors.length > 0) {
            const firstError = response.errors[0];
            const errorCode = firstError.extensions?.code || null;
            throw new MondayApiError(
                firstError.message || 'Unknown error',
                { response, apiRequest, errorCode, functionName: 'fetchCustomersForUser', duration }
            );
        }

        const items = response.data?.boards?.[0]?.items_page?.items || [];
        logger.functionEnd('fetchCustomersForUser', { count: items.length });
        
        return items;
    } catch (error) {
        logger.apiError('fetchCustomersForUser', error);
        
        // אם זו כבר MondayApiError, פשוט נזרוק אותה
        if (error instanceof MondayApiError) {
            throw error;
        }
        
        // אחרת, נעטוף אותה ב-MondayApiError
        throw new MondayApiError(
            error.message || 'Unknown error',
            { 
                response: error.response || null, 
                apiRequest, 
                errorCode: error.errorCode || null,
                functionName: 'fetchCustomersForUser',
                duration: Date.now() - (error.startTime || Date.now())
            }
        );
    }
};

// מציאת עמודת Connected Board בלוח המוצרים שמקשרת ללוח הלקוחות
export const findCustomerLinkColumn = async (monday, productsBoardId, customerBoardId) => {
    if (!productsBoardId || !customerBoardId) return null;

    logger.functionStart('findCustomerLinkColumn', { productsBoardId, customerBoardId });

    try {
        const query = `query {
            boards(ids: [${productsBoardId}]) {
                columns {
                    id
                    type
                    settings_str
                }
            }
        }`;

        const apiRequest = {
            query,
            variables: null,
            operationName: extractOperationName(query)
        };

        logger.api('findCustomerLinkColumn', query);
        const res = await monday.api(query);
        
        // בדיקת שגיאות ברמת ה-GraphQL
        if (res.errors && res.errors.length > 0) {
            const firstError = res.errors[0];
            const errorCode = firstError.extensions?.code || null;
            throw new MondayApiError(
                firstError.message || 'Unknown error',
                { response: res, apiRequest, errorCode, functionName: 'findCustomerLinkColumn', duration: null }
            );
        }
        
        const columns = res.data?.boards?.[0]?.columns || [];

        // מציאת עמודת board_relation שמקשרת ללוח הלקוחות
        for (const col of columns) {
            if (col.type === 'board_relation') {
                try {
                    const settings = JSON.parse(col.settings_str || '{}');
                    if (settings.boardIds && settings.boardIds.includes(parseInt(customerBoardId))) {
                        logger.functionEnd('findCustomerLinkColumn', { columnId: col.id });
                        return col.id;
                    }
                } catch {
                    continue;
                }
            }
        }
        logger.warn('findCustomerLinkColumn', 'Could not find customer link column in products board');
        return null;
    } catch (error) {
        logger.apiError('findCustomerLinkColumn', error);
        
        // אם זו כבר MondayApiError, פשוט נזרוק אותה
        if (error instanceof MondayApiError) {
            throw error;
        }
        
        // אחרת, נעטוף אותה ב-MondayApiError (אבל אין לנו apiRequest כאן)
        throw new MondayApiError(
            error.message || 'Unknown error',
            { 
                response: error.response || null, 
                apiRequest: null, 
                errorCode: error.errorCode || null,
                functionName: 'findCustomerLinkColumn',
                duration: null
            }
        );
    }
};

// יצירת מוצר חדש
export const createProduct = async (monday, productsBoardId, customerBoardId, customerId, productName) => {
    logger.functionStart('createProduct', { productsBoardId, customerBoardId, customerId, productName });

    try {
        // מציאת העמודה בלוח המוצרים שמקשרת ללקוח
        const customerLinkColumnId = await findCustomerLinkColumn(monday, productsBoardId, customerBoardId);

        if (!customerLinkColumnId) {
            logger.warn('createProduct', 'Could not find customer link column in products board');
            return null;
        }

        const columnValues = JSON.stringify({
            [customerLinkColumnId]: {
                item_ids: [parseInt(customerId)]
            }
        });

        const mutation = `mutation {
            create_item(
                board_id: ${productsBoardId},
                item_name: "${productName}",
                column_values: ${JSON.stringify(columnValues)}
            ) {
                id
                name
            }
        }`;

        const apiRequest = {
            query: mutation,
            variables: null,
            operationName: extractOperationName(mutation)
        };

        logger.api('createProduct', mutation);

        const startTime = Date.now();
        const response = await monday.api(mutation);
        const duration = Date.now() - startTime;

        logger.apiResponse('createProduct', response, duration);
        
        // בדיקת שגיאות ברמת ה-GraphQL
        if (response.errors && response.errors.length > 0) {
            const firstError = response.errors[0];
            const errorCode = firstError.extensions?.code || null;
            throw new MondayApiError(
                firstError.message || 'Unknown error',
                { response, apiRequest, errorCode, functionName: 'createProduct', duration }
            );
        }
        
        logger.functionEnd('createProduct', { product: response.data?.create_item });
        
        return response.data?.create_item;
    } catch (error) {
        logger.apiError('createProduct', error);
        
        // אם זו כבר MondayApiError, פשוט נזרוק אותה
        if (error instanceof MondayApiError) {
            throw error;
        }
        
        // אחרת, נעטוף אותה ב-MondayApiError
        throw new MondayApiError(
            error.message || 'Unknown error',
            { 
                response: error.response || null, 
                apiRequest: error.apiRequest || null, 
                errorCode: error.errorCode || null,
                functionName: 'createProduct',
                duration: Date.now() - (error.startTime || Date.now())
            }
        );
    }
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

    const apiRequest = {
        query: mutation,
        variables: null,
        operationName: extractOperationName(mutation)
    };

    logger.api('updateItemColumnValues', mutation);

    try {
        const startTime = Date.now();
        const response = await monday.api(mutation);
        const duration = Date.now() - startTime;

        logger.apiResponse('updateItemColumnValues', response, duration);
        
        // בדיקת שגיאות ברמת ה-GraphQL
        if (response.errors && response.errors.length > 0) {
            const firstError = response.errors[0];
            const errorCode = firstError.extensions?.code || null;
            throw new MondayApiError(
                firstError.message || 'Unknown error',
                { response, apiRequest, errorCode, functionName: 'updateItemColumnValues', duration }
            );
        }
        
        logger.functionEnd('updateItemColumnValues', { success: !!response.data });
        
        return response.data;
    } catch (error) {
        logger.apiError('updateItemColumnValues', error);
        
        // אם זו כבר MondayApiError, פשוט נזרוק אותה
        if (error instanceof MondayApiError) {
            throw error;
        }
        
        // אחרת, נעטוף אותה ב-MondayApiError
        throw new MondayApiError(
            error.message || 'Unknown error',
            { 
                response: error.response || null, 
                apiRequest, 
                errorCode: error.errorCode || null,
                functionName: 'updateItemColumnValues',
                duration: Date.now() - (error.startTime || Date.now())
            }
        );
    }
};

// אחזור פרטי המשתמש הנוכחי
export const fetchCurrentUser = async (monday) => {
    logger.functionStart('fetchCurrentUser');

    const query = `query {
        me {
            name
            id
        }
    }`;

    const apiRequest = {
        query,
        variables: null,
        operationName: extractOperationName(query)
    };

    logger.api('fetchCurrentUser', query);

    try {
        const startTime = Date.now();
        const response = await monday.api(query);
        const duration = Date.now() - startTime;

        logger.apiResponse('fetchCurrentUser', response, duration);
        
        // בדיקת שגיאות ברמת ה-GraphQL
        if (response.errors && response.errors.length > 0) {
            const firstError = response.errors[0];
            const errorCode = firstError.extensions?.code || null;
            throw new MondayApiError(
                firstError.message || 'Unknown error',
                { response, apiRequest, errorCode, functionName: 'fetchCurrentUser', duration }
            );
        }
        
        const user = response.data?.me;
        logger.functionEnd('fetchCurrentUser', { hasUser: !!user });
        
        return user;
    } catch (error) {
        logger.apiError('fetchCurrentUser', error);
        
        // אם זו כבר MondayApiError, פשוט נזרוק אותה
        if (error instanceof MondayApiError) {
            throw error;
        }
        
        // אחרת, נעטוף אותה ב-MondayApiError
        throw new MondayApiError(
            error.message || 'Unknown error',
            { 
                response: error.response || null, 
                apiRequest, 
                errorCode: error.errorCode || null,
                functionName: 'fetchCurrentUser',
                duration: Date.now() - (error.startTime || Date.now())
            }
        );
    }
};

// מחיקת אייטם
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

    const apiRequest = {
        query,
        variables: null,
        operationName: extractOperationName(query)
    };

    logger.api('fetchItemById', query);

    try {
        const startTime = Date.now();
        const response = await monday.api(query);
        const duration = Date.now() - startTime;

        logger.apiResponse('fetchItemById', response, duration);
        
        // בדיקת שגיאות ברמת ה-GraphQL
        if (response.errors && response.errors.length > 0) {
            const firstError = response.errors[0];
            const errorCode = firstError.extensions?.code || null;
            throw new MondayApiError(
                firstError.message || 'Unknown error',
                { response, apiRequest, errorCode, functionName: 'fetchItemById', duration }
            );
        }

        const items = response.data?.items || [];
        const item = items.length > 0 ? items[0] : null;
        
        logger.functionEnd('fetchItemById', { found: !!item });
        return item;
    } catch (error) {
        logger.apiError('fetchItemById', error);
        
        // אם זו כבר MondayApiError, פשוט נזרוק אותה
        if (error instanceof MondayApiError) {
            throw error;
        }
        
        // אחרת, נעטוף אותה ב-MondayApiError
        throw new MondayApiError(
            error.message || 'Unknown error',
            { 
                response: error.response || null, 
                apiRequest, 
                errorCode: error.errorCode || null,
                functionName: 'fetchItemById',
                duration: Date.now() - (error.startTime || Date.now())
            }
        );
    }
};

// אחזור לקוח בודד לפי ID
export const fetchCustomerById = async (monday, boardId, customerId) => {
    logger.functionStart('fetchCustomerById', { boardId, customerId });

    const query = `query {
        items(ids: [${customerId}]) {
            id
            name
        }
    }`;

    const apiRequest = {
        query,
        variables: null,
        operationName: extractOperationName(query)
    };

    logger.api('fetchCustomerById', query);

    try {
        const startTime = Date.now();
        const response = await monday.api(query);
        const duration = Date.now() - startTime;

        logger.apiResponse('fetchCustomerById', response, duration);
        
        // בדיקת שגיאות ברמת ה-GraphQL
        if (response.errors && response.errors.length > 0) {
            const firstError = response.errors[0];
            const errorCode = firstError.extensions?.code || null;
            throw new MondayApiError(
                firstError.message || 'Unknown error',
                { response, apiRequest, errorCode, functionName: 'fetchCustomerById', duration }
            );
        }

        const items = response.data?.items || [];
        const customer = items.length > 0 ? { id: items[0].id, name: items[0].name } : null;
        
        logger.functionEnd('fetchCustomerById', { found: !!customer });
        return customer;
    } catch (error) {
        logger.apiError('fetchCustomerById', error);
        
        // אם זו כבר MondayApiError, פשוט נזרוק אותה
        if (error instanceof MondayApiError) {
            throw error;
        }
        
        // אחרת, נעטוף אותה ב-MondayApiError
        throw new MondayApiError(
            error.message || 'Unknown error',
            { 
                response: error.response || null, 
                apiRequest, 
                errorCode: error.errorCode || null,
                functionName: 'fetchCustomerById',
                duration: Date.now() - (error.startTime || Date.now())
            }
        );
    }
};

export const deleteItem = async (monday, itemId) => {
    logger.functionStart('deleteItem', { itemId });

    const mutation = `mutation {
        delete_item(item_id: ${itemId}) {
            id
        }
    }`;

    const apiRequest = {
        query: mutation,
        variables: null,
        operationName: extractOperationName(mutation)
    };

    logger.api('deleteItem', mutation);

    try {
        const startTime = Date.now();
        const response = await monday.api(mutation);
        const duration = Date.now() - startTime;

        logger.apiResponse('deleteItem', response, duration);
        
        // בדיקת שגיאות ברמת ה-GraphQL
        if (response.errors && response.errors.length > 0) {
            const firstError = response.errors[0];
            const errorCode = firstError.extensions?.code || null;
            throw new MondayApiError(
                firstError.message || 'Unknown error',
                { response, apiRequest, errorCode, functionName: 'deleteItem', duration }
            );
        }
        
        logger.functionEnd('deleteItem', { success: !!response.data });
        
        return response.data;
    } catch (error) {
        logger.apiError('deleteItem', error);
        
        // אם זו כבר MondayApiError, פשוט נזרוק אותה
        if (error instanceof MondayApiError) {
            throw error;
        }
        
        // אחרת, נעטוף אותה ב-MondayApiError
        throw new MondayApiError(
            error.message || 'Unknown error',
            { 
                response: error.response || null, 
                apiRequest, 
                errorCode: error.errorCode || null,
                functionName: 'deleteItem',
                duration: Date.now() - (error.startTime || Date.now())
            }
        );
    }
};

