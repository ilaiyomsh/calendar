import React, { createContext, useContext } from 'react';

const MobileContext = createContext(false);

/**
 * ספק מובייל - מזהה מובייל לפי context.mode מ-Monday SDK
 * @param {object} props.context - הקונטקסט שמתקבל מ-monday.get('context')
 */
export function MobileProvider({ context, children }) {
    const isMobile = context?.mode === 'mobile';
    return (
        <MobileContext.Provider value={isMobile}>
            {children}
        </MobileContext.Provider>
    );
}

export function useMobile() {
    return useContext(MobileContext);
}
