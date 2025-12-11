import { useState, useCallback } from 'react';
import mondaySdk from 'monday-sdk-js';
import { useSettings } from '../contexts/SettingsContext';
import logger from '../utils/logger';

const monday = mondaySdk();

/**
 * Hook לניהול מוצרים מרובים - עבור מספר לקוחות במקביל
 * @returns {Object} { products, loadingProducts, fetchForCustomer, createProduct }
 */
export const useProductsMultiple = () => {
    const { customSettings } = useSettings();
    const [products, setProducts] = useState({}); // { customerId: [products] }
    const [loadingProducts, setLoadingProducts] = useState({}); // { customerId: boolean }

    /**
     * אחזור מוצרים לפי לקוח
     * משתמש ב-productsCustomerColumnId ישירות מההגדרות
     */
    const fetchForCustomer = useCallback(async (customerId) => {
        if (!customSettings.productsCustomerColumnId || !customerId) {
            logger.warn('useProductsMultiple', 'Missing productsCustomerColumnId or customerId for fetching products');
            setProducts(prev => ({ ...prev, [customerId]: [] }));
            return;
        }

        logger.functionStart('useProductsMultiple.fetchForCustomer', { customerId });

        setLoadingProducts(prev => ({ ...prev, [customerId]: true }));

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

            logger.api('useProductsMultiple.fetchForCustomer', query);

            const startTime = Date.now();
            const res = await monday.api(query);
            const duration = Date.now() - startTime;

            logger.apiResponse('useProductsMultiple.fetchForCustomer', res, duration);

            if (res.data?.items?.[0]?.column_values?.[0]?.linked_items) {
                const items = res.data.items[0].column_values[0].linked_items;
                setProducts(prev => ({ ...prev, [customerId]: items }));
                logger.functionEnd('useProductsMultiple.fetchForCustomer', { customerId, count: items.length });
            } else {
                setProducts(prev => ({ ...prev, [customerId]: [] }));
                logger.debug('useProductsMultiple', 'No products found for customer', customerId);
            }
        } catch (err) {
            logger.apiError('useProductsMultiple.fetchForCustomer', err);
            logger.error('useProductsMultiple', 'Error fetching products for customer', err);
            setProducts(prev => ({ ...prev, [customerId]: [] }));
        } finally {
            setLoadingProducts(prev => ({ ...prev, [customerId]: false }));
        }
    }, [customSettings.productsCustomerColumnId]);

    /**
     * יצירת מוצר חדש
     */
    const createProductForCustomer = useCallback(async (customerId, productName) => {
        if (!customSettings.productsBoardId || !customSettings.connectedBoardId || !productName?.trim() || !customerId) {
            logger.warn('useProductsMultiple', 'Missing settings or data for creating product');
            return null;
        }

        // בדיקה שיש productsCustomerColumnId
        if (!customSettings.productsCustomerColumnId) {
            logger.warn('useProductsMultiple', 'productsCustomerColumnId is required but not set');
            return null;
        }

        logger.functionStart('useProductsMultiple.createProductForCustomer', { customerId, productName });

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

            logger.api('useProductsMultiple.createProductForCustomer - create item', createMutation);

            const createStartTime = Date.now();
            const createRes = await monday.api(createMutation);
            const createDuration = Date.now() - createStartTime;

            logger.apiResponse('useProductsMultiple.createProductForCustomer - create item', createRes, createDuration);

            if (!createRes.data?.create_item) {
                logger.warn('useProductsMultiple', 'No product created in response');
                return null;
            }

            const newProduct = createRes.data.create_item;
            logger.debug('useProductsMultiple', 'Product created successfully', { productId: newProduct.id });

            // שלב 2: שימוש במוצרים הקיימים מה-state של הלקוח הספציפי
            const existingProducts = products[customerId] || [];
            const existingProductIds = existingProducts.map(product => product.id);
            const allProductIds = [...existingProductIds, newProduct.id];

            logger.debug('useProductsMultiple', 'Updating customer with products', { 
                customerId,
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

            logger.api('useProductsMultiple.createProductForCustomer - update customer', updateMutation);

            const updateStartTime = Date.now();
            const updateRes = await monday.api(updateMutation);
            const updateDuration = Date.now() - updateStartTime;

            logger.apiResponse('useProductsMultiple.createProductForCustomer - update customer', updateRes, updateDuration);

            // עדכון state עם המוצר החדש
            setProducts(prev => ({
                ...prev,
                [customerId]: [...(prev[customerId] || []), newProduct]
            }));
            logger.functionEnd('useProductsMultiple.createProductForCustomer', { product: newProduct });
            return newProduct;

        } catch (err) {
            logger.apiError('useProductsMultiple.createProductForCustomer', err);
            logger.error('useProductsMultiple', 'Error creating product', err);
            return null;
        }
    }, [customSettings.productsBoardId, customSettings.connectedBoardId, customSettings.productsCustomerColumnId, products]);

    return {
        products,
        loadingProducts,
        fetchForCustomer,
        createProduct: createProductForCustomer
    };
};

