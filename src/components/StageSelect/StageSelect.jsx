import React, { useEffect, useRef, useState } from 'react';
import styles from './StageSelect.module.css';

/**
 * רכיב Dropdown לשלבים
 */
const StageSelect = ({ 
    stages, 
    selectedStage, 
    onSelectStage, 
    isLoading, 
    disabled,
    placeholder = "בחר ..."
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 'auto', bottom: 'auto', left: 'auto', width: 'auto' });
    const containerRef = useRef(null);
    const dropdownRef = useRef(null);

    // חישוב מיקום ה-dropdown
    const calculateDropdownPosition = () => {
        if (!containerRef.current) return;
        
        const rect = containerRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        const dropdownHeight = 240; // max-height של ה-dropdown
        
        // חישוב מיקום אופקי
        const left = rect.left;
        const width = rect.width;
        
        // אם אין מספיק מקום למטה אבל יש למעלה, נציג למעלה
        if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
            setDropdownPosition({ 
                bottom: `${viewportHeight - rect.top + 4}px`,
                top: 'auto',
                left: `${left}px`,
                width: `${width}px`
            });
        } else {
            setDropdownPosition({ 
                top: `${rect.bottom + 4}px`,
                bottom: 'auto',
                left: `${left}px`,
                width: `${width}px`
            });
        }
    };

    useEffect(() => {
        if (isOpen) {
            calculateDropdownPosition();
            
            // עדכון מיקום בעת גלילה או שינוי גודל
            const handleScroll = () => {
                calculateDropdownPosition();
            };
            
            const handleResize = () => {
                calculateDropdownPosition();
            };
            
            window.addEventListener('scroll', handleScroll, true);
            window.addEventListener('resize', handleResize);
            
            return () => {
                window.removeEventListener('scroll', handleScroll, true);
                window.removeEventListener('resize', handleResize);
            };
        }
    }, [isOpen]);

    // סגירת הדרופדאון בלחיצה מחוץ לרכיב
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedOption = stages.find(s => s.label === selectedStage || s.value === selectedStage || s.id?.toString() === selectedStage?.toString());

    const handleSelect = (stageLabel) => {
        // שומרים את ה-label (לא את ה-id) כי Monday API מצפה ל-label
        onSelectStage(stageLabel);
        setIsOpen(false);
    };

    return (
        <div className={styles.container} ref={containerRef}>
            {/* הטריגר */}
            <div 
                className={`${styles.trigger} ${disabled ? styles.disabled : ''}`}
                onClick={() => !disabled && !isLoading && setIsOpen(!isOpen)}
            >
                <span className={styles.triggerText}>
                    {selectedOption 
                        ? selectedOption.label || selectedOption.name
                        : (isLoading ? "טוען..." : placeholder)
                    }
                </span>
                <div className={styles.triggerIcon}>
                    {isLoading ? "⏳" : (isOpen ? "▲" : "▼")}
                </div>
            </div>

            {/* הרשימה הנפתחת */}
            {isOpen && !disabled && (
                <div 
                    ref={dropdownRef}
                    className={styles.dropdown}
                    style={{
                        top: dropdownPosition.top,
                        bottom: dropdownPosition.bottom,
                        left: dropdownPosition.left,
                        width: dropdownPosition.width
                    }}
                >
                    {/* רשימת שלבים */}
                    <div className={styles.stagesList}>
                        {stages.length > 0 ? (
                            stages.map((stage) => {
                                const isSelected = selectedStage === stage.label || selectedStage === stage.value || selectedStage === stage.id?.toString();
                                return (
                                    <div
                                        key={stage.id || stage.value || stage.label}
                                        className={`${styles.stageItem} ${isSelected ? styles.selected : ''}`}
                                        onClick={() => handleSelect(stage.label || stage.value)}
                                    >
                                        {stage.label || stage.name}
                                    </div>
                                );
                            })
                        ) : (
                            <div className={styles.emptyState}>
                                אין שלבים זמינים
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StageSelect;

