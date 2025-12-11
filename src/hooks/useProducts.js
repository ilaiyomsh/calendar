import { useState, useCallback, useRef } from 'react';
import mondaySdk from 'monday-sdk-js';
import { useSettings } from '../contexts/SettingsContext';
import logger from '../utils/logger';

const monday = mondaySdk();

/**
 * Hook לניהול מוצרים - אחזור ויצירה
 * @returns {Object} { products, loading, fetchForCustomer, createProduct }
 */
export const useProducts = () => {
    const { customSettings } = useSettings();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Cache ל-customerLinkColumnId כדי לא לחפש אותו כל פעם (רק ל-createProduct)
    const customerLinkColumnCacheRef = useRef(null);

    /**
     * מציאת עמודת Connected Board בלוח המוצרים שמקשרת ללוח הלקוחות
     * נדרש רק ל-createProduct
     */
    const findCustomerLinkColumn = useCallback(async (productsBoardId, customerBoardId) => {
        if (!productsBoardId || !customerBoardId) return null;
        
        // בדיקה אם יש cache
        const cacheKey = `${productsBoardId}_${customerBoardId}`;
        if (customerLinkColumnCacheRef.current?.key === cacheKey) {
            logger.debug('useProducts', `Using cached customer link column: ${customerLinkColumnCacheRef.current.columnId}`);
            return customerLinkColumnCacheRef.current.columnId;
        }

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
                            logger.debug('useProducts', `Found customer link column: ${col.id}`);
                            // שמירה ב-cache
                            customerLinkColumnCacheRef.current = { key: cacheKey, columnId: col.id };
                            return col.id;
                        }
                    } catch {
                        continue;
                    }
                }
            }
            logger.warn('useProducts', 'Could not find customer link column in products board');
            return null;
        } catch (err) {
            logger.apiError('findCustomerLinkColumn', err);
            logger.error('useProducts', 'Error finding customer link column', err);
            return null;
        }
    }, []);

    /**
     * אחזור מוצרים לפי לקוח
     * משתמש ב-productsCustomerColumnId ישירות מההגדרות
     */
    const fetchForCustomer = useCallback(async (customerId) => {
        if (!customSettings.productsCustomerColumnId || !customerId) {
            logger.warn('useProducts', 'Missing productsCustomerColumnId or customerId for fetching products');
            setProducts([]);
            return;
        }
        
        // מניעת קריאות כפולות - אם כבר טוענים, לא לטעון שוב
        if (loading) {
            logger.debug('useProducts', 'Already loading products, skipping duplicate call');
            return;
        }

        logger.functionStart('useProducts.fetchForCustomer', { customerId });

        setLoading(true);

        try {
            // שאילתה ישירה - לוקחים את הלקוח ובודקים מה יש לו בעמודת המוצרים
            const query = `query {
                items(ids: [${customerId}]) {
                    name
                    column_values(ids: ["${customSettings.productsCustomerColumnId}"]) {
                        ...on BoardRelationValue {
                            linked_items {
                                id
                                name
                            }
                        }
                    }
                }
            }`;

            logger.api('fetchProductsForCustomer (direct)', query);

            const startTime = Date.now();
            const res = await monday.api(query);
            const duration = Date.now() - startTime;

            logger.apiResponse('fetchProductsForCustomer (direct)', res, duration);

            if (res.data?.items?.[0]?.column_values?.[0]?.linked_items) {
                const items = res.data.items[0].column_values[0].linked_items;
                setProducts(items);
                logger.functionEnd('useProducts.fetchForCustomer', { count: items.length });
            } else {
                setProducts([]);
                logger.debug('useProducts', 'No products found for customer');
            }
        } catch (err) {
            logger.apiError('fetchProductsForCustomer (direct)', err);
            logger.error('useProducts', 'Error fetching products', err);
            setProducts([]);
        } finally {
            setLoading(false);
        }
    }, [customSettings.productsCustomerColumnId]);

    /**
     * יצירת מוצר חדש
     */
    const createProduct = useCallback(async (customerId, productName) => {
        if (!customSettings.productsBoardId || !customSettings.connectedBoardId || !productName?.trim() || !customerId) {
            logger.warn('useProducts', 'Missing settings or data for creating product');
            return null;
        }

        logger.functionStart('useProducts.createProduct', { customerId, productName });

        try {
            // מציאת העמודה בלוח המוצרים שמקשרת ללקוח
            const customerLinkColumnId = await findCustomerLinkColumn(
                customSettings.productsBoardId,
                customSettings.connectedBoardId
            );

            if (!customerLinkColumnId) {
                logger.warn('useProducts', 'Could not find customer link column in products board');
                return null;
            }

            const columnValues = JSON.stringify({
                [customerLinkColumnId]: {
                    item_ids: [parseInt(customerId)]
                }
            });

            const mutation = `mutation {
                create_item(
                    board_id: ${customSettings.productsBoardId},
                    item_name: "${productName}",
                    column_values: ${JSON.stringify(columnValues)}
                ) {
                    id
                    name
                }
            }`;

            logger.api('createProduct', mutation);

            const startTime = Date.now();
            const res = await monday.api(mutation);
            const duration = Date.now() - startTime;

            logger.apiResponse('createProduct', res, duration);

            if (res.data?.create_item) {
                const newProduct = res.data.create_item;
                setProducts(prev => [...prev, newProduct]);
                logger.functionEnd('useProducts.createProduct', { product: newProduct });
                return newProduct;
            } else {
                logger.warn('useProducts', 'No product created in response');
                return null;
            }
        } catch (err) {
            logger.apiError('createProduct', err);
            logger.error('useProducts', 'Error creating product', err);
            return null;
        }
    }, [customSettings.productsBoardId, customSettings.connectedBoardId, findCustomerLinkColumn]);

    return {
        products,
        loading,
        fetchForCustomer,
        createProduct
    };
};

