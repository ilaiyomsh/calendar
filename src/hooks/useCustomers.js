import { useState, useEffect, useCallback } from 'react';
import mondaySdk from 'monday-sdk-js';
import { useSettings } from '../contexts/SettingsContext';
import logger from '../utils/logger';

const monday = mondaySdk();

/**
 * Hook לאחזור לקוחות המשויכים למשתמש הנוכחי
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
            peopleColumnId: customSettings.peopleColumnId
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
                setCustomers(items);
                logger.functionEnd('useCustomers.fetchCustomers', { count: items.length });
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
    }, [customSettings.connectedBoardId, customSettings.peopleColumnId]);

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

