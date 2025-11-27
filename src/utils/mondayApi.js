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

// אחזור מוצרים לפי לקוח
export const fetchProductsForCustomer = async (monday, productsBoardId, customerColumnId, customerId) => {
    logger.functionStart('fetchProductsForCustomer', { productsBoardId, customerColumnId, customerId });

    const query = `query {
        boards(ids: [${productsBoardId}]) {
            items_page(
                limit: 100,
                query_params: {
                    rules: [
                        {
                            column_id: "${customerColumnId}",
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

    try {
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
export const createProduct = async (monday, productsBoardId, customerColumnId, customerId, productName) => {
    logger.functionStart('createProduct', { productsBoardId, customerColumnId, customerId, productName });

    const columnValues = JSON.stringify({
        [customerColumnId]: {
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

    try {
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

