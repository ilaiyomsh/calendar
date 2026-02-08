import { useSyncExternalStore } from 'react';

const MOBILE_QUERY = '(max-width: 768px)';

let mql = null;

function getMql() {
    if (!mql) {
        mql = window.matchMedia(MOBILE_QUERY);
    }
    return mql;
}

function subscribe(callback) {
    const mediaQuery = getMql();
    mediaQuery.addEventListener('change', callback);
    return () => mediaQuery.removeEventListener('change', callback);
}

function getSnapshot() {
    return getMql().matches;
}

function getServerSnapshot() {
    return false;
}

/**
 * Hook לזיהוי מסך מובייל באמצעות useSyncExternalStore
 * מונע double-render שמתרחש עם useState + useEffect
 */
export function useIsMobile() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
