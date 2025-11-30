/**
 * פונקציות עזר לעבודה עם Monday API
 */

import logger from './logger';

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

    logger.api('fetchColumnSettings', query);

    try {
        const startTime = Date.now();
    const response = await monday.api(query);
        const duration = Date.now() - startTime;

        logger.apiResponse('fetchColumnSettings', response, duration);
    
    const columnSettings = response.data?.boards?.[0]?.columns?.[0]?.settings;
        logger.functionEnd('fetchColumnSettings', { hasSettings: !!columnSettings });
    
    return columnSettings;
    } catch (error) {
        logger.apiError('fetchColumnSettings', error);
        throw error;
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

    logger.api('fetchAllBoardItems (first page)', firstQuery);

    try {
        const startTime = Date.now();
    const firstResponse = await monday.api(firstQuery);
        const duration = Date.now() - startTime;

        logger.apiResponse('fetchAllBoardItems (first page)', firstResponse, duration);

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

            logger.api(`fetchAllBoardItems (page ${pageCount + 1})`, nextQuery);

            const pageStartTime = Date.now();
        const nextResponse = await monday.api(nextQuery);
            const pageDuration = Date.now() - pageStartTime;

            logger.apiResponse(`fetchAllBoardItems (page ${pageCount + 1})`, nextResponse, pageDuration);

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
        throw error;
    }
};

// יצירת אייטם חדש בלוח עם ערכי עמודות
export const createBoardItem = async (monday, boardId, itemName, columnValues = null) => {
    logger.functionStart('createBoardItem', { boardId, itemName, hasColumnValues: !!columnValues });

    const mutation = columnValues 
        ? `mutation {
            create_item (
                board_id: ${boardId},
                item_name: "${itemName}",
                column_values: ${JSON.stringify(columnValues)}
            ) {
                id
                name
            }
        }`
        : `mutation {
            create_item (
                board_id: ${boardId},
                item_name: "${itemName}"
            ) {
                id
                name
            }
        }`;

    logger.api('createBoardItem', mutation);

    try {
        const startTime = Date.now();
    const response = await monday.api(mutation);
        const duration = Date.now() - startTime;

        logger.apiResponse('createBoardItem', response, duration);
        logger.functionEnd('createBoardItem', { item: response.data?.create_item });
    
    return response.data?.create_item;
    } catch (error) {
        logger.apiError('createBoardItem', error);
        throw error;
    }
};

// שליפת אירועים מהלוח בטווח תאריכים
export const fetchEventsFromBoard = async (monday, query) => {
    logger.functionStart('fetchEventsFromBoard');
    logger.api('fetchEventsFromBoard', query);
    
    try {
        const startTime = Date.now();
        const response = await monday.api(query);
        const duration = Date.now() - startTime;

        logger.apiResponse('fetchEventsFromBoard', response, duration);

        const items = response.data?.boards?.[0]?.items_page?.items || [];
        
        logger.functionEnd('fetchEventsFromBoard', { count: items.length });
        return items;
    } catch (error) {
        logger.apiError('fetchEventsFromBoard', error);
        throw error;
    }
};

// אחזור לקוחות המשויכים למשתמש
export const fetchCustomersForUser = async (monday, boardId, peopleColumnId) => {
    logger.functionStart('fetchCustomersForUser', { boardId, peopleColumnId });

    const query = `query {
        boards(ids: ${boardId}) {
            items_page(
                query_params: {
                    rules: [
                        {
                            column_id: "${peopleColumnId}",
                            compare_value: ["assigned_to_me"],
                            operator: any_of
                        }
                    ]
                }
            ) {
                items {
                    id
                    name
                }
            }
        }
    }`;

    logger.api('fetchCustomersForUser', query);

    try {
        const startTime = Date.now();
        const response = await monday.api(query);
        const duration = Date.now() - startTime;

        logger.apiResponse('fetchCustomersForUser', response, duration);

        const items = response.data?.boards?.[0]?.items_page?.items || [];
        logger.functionEnd('fetchCustomersForUser', { count: items.length });
        
        return items;
    } catch (error) {
        logger.apiError('fetchCustomersForUser', error);
        throw error;
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

        logger.api('findCustomerLinkColumn', query);
        const res = await monday.api(query);
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
        throw error;
    }
};

// אחזור מוצרים לפי לקוח
export const fetchProductsForCustomer = async (monday, productsBoardId, customerBoardId, customerId) => {
    logger.functionStart('fetchProductsForCustomer', { productsBoardId, customerBoardId, customerId });

    try {
        // מציאת העמודה בלוח המוצרים שמקשרת ללקוח
        const customerLinkColumnId = await findCustomerLinkColumn(monday, productsBoardId, customerBoardId);

        if (!customerLinkColumnId) {
            logger.warn('fetchProductsForCustomer', 'Could not find customer link column in products board');
            return [];
        }

        const query = `query {
            boards(ids: [${productsBoardId}]) {
                items_page(
                    limit: 100,
                    query_params: {
                        rules: [
                            {
                                column_id: "${customerLinkColumnId}",
                                compare_value: [${customerId}]
                            }
                        ]
                    }
                ) {
                    items {
                        id
                        name
                    }
                }
            }
        }`;

        logger.api('fetchProductsForCustomer', query);

        const startTime = Date.now();
        const response = await monday.api(query);
        const duration = Date.now() - startTime;

        logger.apiResponse('fetchProductsForCustomer', response, duration);

        const items = response.data?.boards?.[0]?.items_page?.items || [];
        logger.functionEnd('fetchProductsForCustomer', { count: items.length });
        
        return items;
    } catch (error) {
        logger.apiError('fetchProductsForCustomer', error);
        throw error;
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

        logger.api('createProduct', mutation);

        const startTime = Date.now();
        const response = await monday.api(mutation);
        const duration = Date.now() - startTime;

        logger.apiResponse('createProduct', response, duration);
        logger.functionEnd('createProduct', { product: response.data?.create_item });
        
        return response.data?.create_item;
    } catch (error) {
        logger.apiError('createProduct', error);
        throw error;
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

    logger.api('updateItemColumnValues', mutation);

    try {
        const startTime = Date.now();
        const response = await monday.api(mutation);
        const duration = Date.now() - startTime;

        logger.apiResponse('updateItemColumnValues', response, duration);
        logger.functionEnd('updateItemColumnValues', { success: !!response.data });
        
        return response.data;
    } catch (error) {
        logger.apiError('updateItemColumnValues', error);
        throw error;
    }
};

// מחיקת אייטם
// אחזור אייטם בודד לפי ID
export const fetchItemById = async (monday, boardId, itemId) => {
    logger.functionStart('fetchItemById', { boardId, itemId });

    const query = `query {
        boards(ids: [${boardId}]) {
            items_page(
                limit: 1,
                query_params: {
                    rules: [
                        {
                            column_id: "id",
                            compare_value: [${itemId}],
                            operator: any_of
                        }
                    ]
                }
            ) {
                items {
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
                        }
                        ... on TextValue {
                            text
                        }
                    }
                }
            }
        }
    }`;

    logger.api('fetchItemById', query);

    try {
        const startTime = Date.now();
        const response = await monday.api(query);
        const duration = Date.now() - startTime;

        logger.apiResponse('fetchItemById', response, duration);

        const items = response.data?.boards?.[0]?.items_page?.items || [];
        const item = items.length > 0 ? items[0] : null;
        
        logger.functionEnd('fetchItemById', { found: !!item });
        return item;
    } catch (error) {
        logger.apiError('fetchItemById', error);
        throw error;
    }
};

// אחזור לקוח בודד לפי ID
export const fetchCustomerById = async (monday, boardId, customerId) => {
    logger.functionStart('fetchCustomerById', { boardId, customerId });

    const query = `query {
        boards(ids: [${boardId}]) {
            items_page(
                limit: 1,
                query_params: {
                    rules: [
                        {
                            column_id: "id",
                            compare_value: [${customerId}],
                            operator: any_of
                        }
                    ]
                }
            ) {
                items {
                    id
                    name
                }
            }
        }
    }`;

    logger.api('fetchCustomerById', query);

    try {
        const startTime = Date.now();
        const response = await monday.api(query);
        const duration = Date.now() - startTime;

        logger.apiResponse('fetchCustomerById', response, duration);

        const items = response.data?.boards?.[0]?.items_page?.items || [];
        const customer = items.length > 0 ? { id: items[0].id, name: items[0].name } : null;
        
        logger.functionEnd('fetchCustomerById', { found: !!customer });
        return customer;
    } catch (error) {
        logger.apiError('fetchCustomerById', error);
        throw error;
    }
};

export const deleteItem = async (monday, itemId) => {
    logger.functionStart('deleteItem', { itemId });

    const mutation = `mutation {
        delete_item(item_id: ${itemId}) {
            id
        }
    }`;

    logger.api('deleteItem', mutation);

    try {
        const startTime = Date.now();
        const response = await monday.api(mutation);
        const duration = Date.now() - startTime;

        logger.apiResponse('deleteItem', response, duration);
        logger.functionEnd('deleteItem', { success: !!response.data });
        
        return response.data;
    } catch (error) {
        logger.apiError('deleteItem', error);
        throw error;
    }
};

