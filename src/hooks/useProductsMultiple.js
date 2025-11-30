import { useState, useCallback } from 'react';
import mondaySdk from 'monday-sdk-js';
import { useSettings } from '../contexts/SettingsContext';
import { fetchProductsForCustomer, createProduct } from '../utils/mondayApi';
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
     */
    const fetchForCustomer = useCallback(async (customerId) => {
        if (!customSettings.productsBoardId || !customSettings.connectedBoardId || !customerId) {
            logger.warn('useProductsMultiple', 'Missing settings or customerId for fetching products');
            return;
        }

        logger.functionStart('useProductsMultiple.fetchForCustomer', { customerId });

        setLoadingProducts(prev => ({ ...prev, [customerId]: true }));

        try {
            const items = await fetchProductsForCustomer(
                monday,
                customSettings.productsBoardId,
                customSettings.connectedBoardId,
                customerId
            );

            setProducts(prev => ({ ...prev, [customerId]: items }));
            logger.functionEnd('useProductsMultiple.fetchForCustomer', { customerId, count: items.length });
        } catch (err) {
            logger.error('useProductsMultiple', 'Error fetching products for customer', err);
            setProducts(prev => ({ ...prev, [customerId]: [] }));
        } finally {
            setLoadingProducts(prev => ({ ...prev, [customerId]: false }));
        }
    }, [customSettings.productsBoardId, customSettings.connectedBoardId]);

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

