import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import styles from './DashboardMultiSelect.module.css';

/**
 * דרופדאון multi-select לדשבורד — תמיד גלוי בשורת הפילטרים
 */
const DashboardMultiSelect = ({
    label,
    options = [],       // [{ id, name }]
    selectedIds = [],
    onChange,
    loading = false,
    placeholder = 'חיפוש...',
    allLabel = null      // תווית "הכל" — מוצגת כשאין סינון פעיל
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const wrapperRef = useRef(null);

    // סגירה בקליק חיצוני
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const filteredOptions = useMemo(() =>
        options.filter(o => (o.name || '').toLowerCase().includes(search.toLowerCase())),
        [options, search]
    );

    const toggleItem = (id) => {
        const idStr = String(id);
        const current = selectedIds.map(x => String(x));
        const next = current.includes(idStr)
            ? current.filter(x => x !== idStr)
            : [...current, idStr];
        onChange(next);
    };

    const selectedCount = selectedIds.length;

    return (
        <div className={styles.wrapper} ref={wrapperRef}>
            <button
                type="button"
                className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ''} ${selectedCount > 0 ? styles.triggerActive : ''}`}
                onClick={() => setIsOpen(prev => !prev)}
            >
                <span className={styles.triggerLabel}>{label}</span>
                {selectedCount > 0 && <span className={styles.badge}>{selectedCount}</span>}
                <ChevronDown size={14} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} />
            </button>

            {isOpen && (
                <div className={styles.dropdown}>
                    <div className={styles.searchRow}>
                        <Search size={14} className={styles.searchIcon} />
                        <input
                            type="text"
                            className={styles.searchInput}
                            placeholder={placeholder}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className={styles.list}>
                        {loading ? (
                            <div className={styles.empty}>...</div>
                        ) : filteredOptions.length > 0 ? (
                            <>
                                {allLabel && !search && (
                                    <div
                                        className={`${styles.item} ${selectedCount === 0 ? styles.itemSelected : ''}`}
                                        onClick={() => { onChange([]); setSearch(''); }}
                                    >
                                        <span className={styles.itemName}>{allLabel}</span>
                                    </div>
                                )}
                                {filteredOptions.map(opt => {
                                    const isSelected = selectedIds.map(x => String(x)).includes(String(opt.id));
                                    return (
                                        <div
                                            key={opt.id}
                                            className={`${styles.item} ${isSelected ? styles.itemSelected : ''}`}
                                            onClick={() => toggleItem(opt.id)}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => {}}
                                                className={styles.checkbox}
                                            />
                                            <span className={styles.itemName}>{opt.name}</span>
                                        </div>
                                    );
                                })}
                            </>
                        ) : (
                            <div className={styles.empty}>
                                {search ? 'לא נמצאו תוצאות' : 'אין אפשרויות'}
                            </div>
                        )}
                    </div>
                    {selectedCount > 0 && (
                        <button
                            type="button"
                            className={styles.clearBtn}
                            onClick={() => { onChange([]); setSearch(''); }}
                        >
                            נקה בחירה
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default DashboardMultiSelect;
