import { useState, useEffect } from 'react';
import logger from '../utils/logger';

/**
 * Hook לטעינת ערכי "לא לחיוב" מעמודת status או dropdown
 * @param {Object} monday - Monday API instance
 * @param {string} boardId - מזהה הלוח
 * @param {string} columnId - מזהה העמודה
 * @returns {Object} { nonBillableOptions, loading, error }
 */
export const useNonBillableOptions = (monday, boardId, columnId) => {
    const [nonBillableOptions, setNonBillableOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!monday || !boardId || !columnId) {
            setNonBillableOptions([]);
            setError(null);
            return;
        }

        const fetchNonBillableOptions = async () => {
            setLoading(true);
            setError(null);
            
            try {
                logger.functionStart('useNonBillableOptions.fetchNonBillableOptions', { boardId, columnId });
                
                const query = `query {
                    boards(ids: [${boardId}]) {
                        columns(ids: ["${columnId}"]) {
                            id
                            type
                            settings
                        }
                    }
                }`;
                
                const res = await monday.api(query);
                
                if (res.data?.boards?.[0]?.columns?.[0]) {
                    const column = res.data.boards[0].columns[0];
                    const options = [];
                    
                    try {
                        const settings = column.settings || {};
                        
                        if (column.type === 'status' || column.type === 'dropdown') {
                            if (settings.labels && Array.isArray(settings.labels)) {
                                settings.labels.forEach((label) => {
                                    // רק labels שלא מושבתים ושיש להם טקסט
                                    if (!label.is_deactivated && label.label && label.label.trim() !== '') {
                                        options.push({
                                            id: label.id?.toString() || label.label,
                                            value: label.label,
                                            label: label.label
                                        });
                                    }
                                });
                            }
                        }
                        
                        setNonBillableOptions(options);
                        logger.functionEnd('useNonBillableOptions.fetchNonBillableOptions', { count: options.length });
                    } catch (parseError) {
                        logger.error('useNonBillableOptions', 'Error parsing column settings', parseError);
                        setError('שגיאה בפענוח הגדרות העמודה');
                        setNonBillableOptions([]);
                    }
                } else {
                    logger.warn('useNonBillableOptions', 'Column not found');
                    setError('עמודה לא נמצאה');
                    setNonBillableOptions([]);
                }
            } catch (err) {
                logger.error('useNonBillableOptions', 'Error fetching non-billable options', err);
                setError('שגיאה בטעינת ערכי לא לחיוב');
                setNonBillableOptions([]);
            } finally {
                setLoading(false);
            }
        };

        fetchNonBillableOptions();
    }, [monday, boardId, columnId]);

    return { nonBillableOptions, loading, error };
};
