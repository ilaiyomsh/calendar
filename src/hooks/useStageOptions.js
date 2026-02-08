import { useState, useEffect } from 'react';
import logger from '../utils/logger';

/**
 * Hook לטעינת ערכי שלב מעמודת status או dropdown
 * @param {Object} monday - Monday API instance
 * @param {string} boardId - מזהה הלוח
 * @param {string} columnId - מזהה העמודה
 * @returns {Object} { stageOptions, loading, error }
 */
export const useStageOptions = (monday, boardId, columnId) => {
    const [stageOptions, setStageOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!monday || !boardId || !columnId) {
            setStageOptions([]);
            setError(null);
            return;
        }

        const fetchStageOptions = async () => {
            setLoading(true);
            setError(null);
            
            try {
                logger.functionStart('useStageOptions.fetchStageOptions', { boardId, columnId });
                
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
                        // settings הוא JSON type - יכול להגיע כאובייקט או כמחרוזת
                        let settings = column.settings || {};
                        if (typeof settings === 'string') {
                            settings = JSON.parse(settings);
                        }

                        logger.debug('useStageOptions', 'Column settings', { type: column.type, settings });

                        if (column.type === 'status' || column.type === 'dropdown') {
                            // עמודת status - labels יכולים להיות מערך או אובייקט
                            const labels = settings.labels || {};

                            if (Array.isArray(labels)) {
                                // פורמט מערך
                                labels.forEach((label) => {
                                    if (!label.is_deactivated && label.label && label.label.trim() !== '') {
                                        options.push({
                                            id: label.id?.toString() || String(label.index) || label.label,
                                            value: label.label,
                                            label: label.label
                                        });
                                    }
                                });
                            } else if (typeof labels === 'object') {
                                // פורמט אובייקט - { "0": "Label1", "1": "Label2" }
                                Object.entries(labels).forEach(([index, labelText]) => {
                                    if (labelText && typeof labelText === 'string' && labelText.trim() !== '') {
                                        options.push({
                                            id: index,
                                            value: labelText,
                                            label: labelText
                                        });
                                    }
                                });
                            }
                        }

                        setStageOptions(options);
                        logger.functionEnd('useStageOptions.fetchStageOptions', { count: options.length });
                    } catch (parseError) {
                        logger.error('useStageOptions', 'Error parsing column settings', parseError);
                        setError('שגיאה בפענוח הגדרות העמודה');
                        setStageOptions([]);
                    }
                } else {
                    logger.warn('useStageOptions', 'Column not found');
                    setError('עמודה לא נמצאה');
                    setStageOptions([]);
                }
            } catch (err) {
                logger.error('useStageOptions', 'Error fetching stage options', err);
                setError('שגיאה בטעינת ערכי השלב');
                setStageOptions([]);
            } finally {
                setLoading(false);
            }
        };

        fetchStageOptions();
    }, [monday, boardId, columnId]);

    return { stageOptions, loading, error };
};

