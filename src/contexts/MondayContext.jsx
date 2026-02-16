import React, { createContext, useContext, useState, useEffect } from 'react';
import logger from '../utils/logger';

const MondayContext = createContext({
    context: null,
    isMobile: false,
});

/**
 * ספק מרכזי לקונטקסט Monday SDK
 * טוען את הקונטקסט פעם אחת ומנגיש אותו לכל האפליקציה
 * @param {object} props.monday - אובייקט ה-Monday SDK
 */
export function MondayProvider({ monday, children }) {
    const [context, setContext] = useState(null);

    useEffect(() => {
        monday.get('context').then(res => {
            if (res.data) {
                setContext(res.data);
                logger.info('MondayProvider', 'Loaded context', res.data);
            }
        }).catch(error => {
            logger.error('MondayProvider', 'Error loading context', error);
        });
    }, [monday]);

    const isMobile = context?.mode === 'mobile';

    return (
        <MondayContext.Provider value={{ context, isMobile }}>
            {children}
        </MondayContext.Provider>
    );
}

/**
 * Hook לגישה לקונטקסט Monday המלא
 * @returns {{ context: object|null, isMobile: boolean }}
 */
export function useMondayContext() {
    return useContext(MondayContext);
}

/**
 * Hook קיצור לבדיקת מובייל
 * @returns {boolean}
 */
export function useMobile() {
    const { isMobile } = useMondayContext();
    return isMobile;
}
