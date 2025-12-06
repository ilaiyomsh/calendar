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
        if (!customSettings.connectedBoardId || !customSettings.peopleColumnIds || customSettings.peopleColumnIds.length === 0) {
            logger.warn('useCustomers', 'Missing settings: connectedBoardId or peopleColumnIds');
            setError("חסרות הגדרות לוח");
            return;
        }

        logger.functionStart('useCustomers.fetchCustomers', {
            boardId: customSettings.connectedBoardId,
            peopleColumnIds: customSettings.peopleColumnIds
        });

        setLoading(true);
        setError(null);

        try {
            // בניית rules לכל עמודת people
            const rules = customSettings.peopleColumnIds.map(columnId => ({
                column_id: columnId,
                compare_value: ["assigned_to_me"],
                operator: "any_of"
            }));

            const rulesString = rules.map(rule => 
                `{
                    column_id: "${rule.column_id}",
                    compare_value: ${JSON.stringify(rule.compare_value)},
                    operator: ${rule.operator}
                }`
            ).join(',\n');

            const query = `query {
                boards(ids: ${customSettings.connectedBoardId}) {
                    items_page(
                        query_params: {
                            operator: or,
                            rules: [${rulesString}]
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
                
                // עיבוד הנתונים - רק לקוחות, ללא מוצרים (מוצרים ייטענו מאוחר יותר)
                const processedCustomers = items.map(item => ({
                    id: item.id,
                    name: item.name
                }));

                setCustomers(processedCustomers);
                logger.functionEnd('useCustomers.fetchCustomers', { 
                    count: processedCustomers.length
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
    }, [customSettings.connectedBoardId, customSettings.peopleColumnIds]);

    useEffect(() => {
        if (customSettings.connectedBoardId && customSettings.peopleColumnIds && customSettings.peopleColumnIds.length > 0) {
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

