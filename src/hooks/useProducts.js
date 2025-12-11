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

        // בדיקה שיש productsCustomerColumnId
        if (!customSettings.productsCustomerColumnId) {
            logger.warn('useProducts', 'productsCustomerColumnId is required but not set');
            return null;
        }

        logger.functionStart('useProducts.createProduct', { customerId, productName });

        try {
            // שלב 1: יצירת המוצר בלי קישור
            const createMutation = `mutation {
                create_item(
                    board_id: ${customSettings.productsBoardId},
                    item_name: "${productName}"
                ) {
                    id
                    name
                }
            }`;

            logger.api('createProduct - create item', createMutation);

            const createStartTime = Date.now();
            const createRes = await monday.api(createMutation);
            const createDuration = Date.now() - createStartTime;

            logger.apiResponse('createProduct - create item', createRes, createDuration);

            if (!createRes.data?.create_item) {
                logger.warn('useProducts', 'No product created in response');
                return null;
            }

            const newProduct = createRes.data.create_item;
            logger.debug('useProducts', 'Product created successfully', { productId: newProduct.id });

            // שלב 2: שימוש במוצרים הקיימים מה-state (שנשלפו ב-fetchForCustomer)
            const existingProductIds = products.map(product => product.id);
            const allProductIds = [...existingProductIds, newProduct.id];

            logger.debug('useProducts', 'Updating customer with products', { 
                existingCount: existingProductIds.length, 
                newProductId: newProduct.id,
                totalCount: allProductIds.length 
            });

            // שלב 3: עדכון הלקוח עם כל המוצרים (קיימים + חדש)
            const columnValues = {
                [customSettings.productsCustomerColumnId]: {
                    item_ids: allProductIds.map(id => parseInt(id))
                }
            };

            const updateMutation = `mutation {
                change_multiple_column_values(
                    item_id: ${customerId},
                    board_id: ${customSettings.connectedBoardId},
                    column_values: ${JSON.stringify(JSON.stringify(columnValues))}
                ) {
                    id
                }
            }`;

            logger.api('createProduct - update customer', updateMutation);

            const updateStartTime = Date.now();
            const updateRes = await monday.api(updateMutation);
            const updateDuration = Date.now() - updateStartTime;

            logger.apiResponse('createProduct - update customer', updateRes, updateDuration);

            // עדכון state עם המוצר החדש
            setProducts(prev => [...prev, newProduct]);
            logger.functionEnd('useProducts.createProduct', { product: newProduct });
            return newProduct;

        } catch (err) {
            logger.apiError('createProduct', err);
            logger.error('useProducts', 'Error creating product', err);
            return null;
        }
    }, [customSettings.productsBoardId, customSettings.connectedBoardId, customSettings.productsCustomerColumnId, products]);

    return {
        products,
        loading,
        fetchForCustomer,
        createProduct
    };
};

