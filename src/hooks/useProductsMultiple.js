import { useState, useCallback } from 'react';
import mondaySdk from 'monday-sdk-js';
import { useSettings } from '../contexts/SettingsContext';
import { createProduct } from '../utils/mondayApi';
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

        logger.functionStart('useProductsMultiple.createProductForCustomer', { customerId, productName });

        try {
            const newProduct = await createProduct(
                monday,
                customSettings.productsBoardId,
                customSettings.connectedBoardId,
                customerId,
                productName
            );

            if (newProduct) {
                setProducts(prev => ({
                    ...prev,
                    [customerId]: [...(prev[customerId] || []), newProduct]
                }));
                logger.functionEnd('useProductsMultiple.createProductForCustomer', { product: newProduct });
                return newProduct;
            }
            return null;
        } catch (err) {
            logger.error('useProductsMultiple', 'Error creating product', err);
            return null;
        }
    }, [customSettings.productsBoardId, customSettings.connectedBoardId]);

    return {
        products,
        loadingProducts,
        fetchForCustomer,
        createProduct: createProductForCustomer
    };
};

