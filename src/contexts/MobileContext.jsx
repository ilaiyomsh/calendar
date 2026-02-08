import React, { createContext, useContext } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

const MobileContext = createContext(false);

export function MobileProvider({ children }) {
    const isMobile = useIsMobile();
    return (
        <MobileContext.Provider value={isMobile}>
            {children}
        </MobileContext.Provider>
    );
}

export function useMobile() {
    return useContext(MobileContext);
}
