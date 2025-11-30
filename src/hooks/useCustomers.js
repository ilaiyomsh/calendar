import { useState, useEffect, useCallback } from 'react';
import mondaySdk from 'monday-sdk-js';
import { useSettings } from '../contexts/SettingsContext';
import logger from '../utils/logger';

const monday = mondaySdk();

/**
 * Hook לאחזור לקוחות המשויכים למשתמש הנוכחי, כולל המוצרים שלהם
 * @returns {Object} { customers, loading, error, refetch }
 */
export const useCustomers = () => {
    const { customSettings } = useSettings();
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchCustomers = useCallback(async () => {
        if (!customSettings.connectedBoardId || !customSettings.peopleColumnId) {
            logger.warn('useCustomers', 'Missing settings: connectedBoardId or peopleColumnId');
            setError("חסרות הגדרות לוח");
            return;
        }

        logger.functionStart('useCustomers.fetchCustomers', {
            boardId: customSettings.connectedBoardId,
            peopleColumnId: customSettings.peopleColumnId,
            productsColumnId: customSettings.productsCustomerColumnId
        });

        setLoading(true);
        setError(null);

        try {
            const query = `query {
                boards(ids: ${customSettings.connectedBoardId}) {
                    items_page(
                        query_params: {
                            rules: [
                                {
                                    column_id: "${customSettings.peopleColumnId}",
                                    compare_value: ["assigned_to_me"],
                                    operator: any_of
                                }
                            ]
                        }
                    ) {
                        items {
                            id
                            name
                            ${customSettings.productsCustomerColumnId ? `column_values(ids: "${customSettings.productsCustomerColumnId}") {
                                column {
                                    id
                                    title
                                }
                                ... on BoardRelationValue {
                                    linked_items {
                                        id
                                        name
                                    }
                                }
                            }` : ''}
                        }
                    }
                }
            }`;

            logger.api('fetchCustomers', query);

            const startTime = Date.now();
            const res = await monday.api(query);
            const duration = Date.now() - startTime;

            logger.apiResponse('fetchCustomers', res, duration);

            if (res.data && res.data.boards && res.data.boards[0]) {
                const items = res.data.boards[0].items_page.items || [];
                
                // עיבוד הנתונים - הוספת מוצרים לכל לקוח
                const processedCustomers = items.map(item => {
                    const customer = {
                        id: item.id,
                        name: item.name,
                        products: []
                    };

                    // חילוץ מוצרים מ-column_values אם קיים
                    if (item.column_values && item.column_values.length > 0) {
                        const productsColumn = item.column_values.find(
                            cv => cv.column?.id === customSettings.productsCustomerColumnId
                        );
                        
                        if (productsColumn?.linked_items) {
                            customer.products = productsColumn.linked_items.map(product => ({
                                id: product.id,
                                name: product.name
                            }));
                        }
                    }

                    return customer;
                });

                setCustomers(processedCustomers);
                logger.functionEnd('useCustomers.fetchCustomers', { 
                    count: processedCustomers.length,
                    withProducts: !!customSettings.productsCustomerColumnId
                });
            } else {
                setCustomers([]);
                logger.warn('useCustomers', 'No data in response');
            }
        } catch (err) {
            logger.apiError('fetchCustomers', err);
            logger.error('useCustomers', 'Error fetching customers', err);
            setError("שגיאה בטעינת הנתונים");
            setCustomers([]);
        } finally {
            setLoading(false);
        }
    }, [customSettings.connectedBoardId, customSettings.peopleColumnId, customSettings.productsCustomerColumnId]);

    useEffect(() => {
        if (customSettings.connectedBoardId && customSettings.peopleColumnId) {
            fetchCustomers();
        }
    }, [fetchCustomers]);

    return {
        customers,
        loading,
        error,
        refetch: fetchCustomers
    };
};

