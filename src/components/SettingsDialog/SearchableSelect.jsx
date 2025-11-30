import React, { useState, useEffect, useRef } from 'react';
import styles from './SearchableSelect.module.css';

const SearchableSelect = ({ options, value, onChange, placeholder, isLoading, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownPosition, setDropdownPosition] = useState({ top: 'auto', bottom: 'auto' });
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
    
    // אם אין מספיק מקום למטה אבל יש למעלה, נציג למעלה
    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      setDropdownPosition({ 
        bottom: `${viewportHeight - rect.top + 4}px`,
        top: 'auto'
      });
    } else {
      setDropdownPosition({ 
        top: `${rect.bottom + 4}px`,
        bottom: 'auto'
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
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // סינון האפשרויות לפי החיפוש
  const filteredOptions = options.filter(option => 
    option.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOption = options.find(o => o.id === value);

  const handleSelect = (option) => {
    onChange(option.id);
    setIsOpen(false);
    setSearchTerm("");
  };

  return (
    <div className={styles.container} ref={containerRef}>
      {/* הטריגר (הכפתור הראשי) */}
      <div 
        className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ''} ${disabled ? styles.triggerDisabled : ''}`}
        onClick={() => !disabled && !isLoading && setIsOpen(!isOpen)}
      >
        <span className={`${styles.triggerText} ${!selectedOption ? styles.triggerTextPlaceholder : ''}`}>
          {selectedOption ? selectedOption.name : (isLoading ? "טוען..." : placeholder)}
        </span>
        <div className={styles.triggerIcon}>
          {isLoading ? "⏳" : (isOpen ? "▲" : "▼")}
        </div>
      </div>

      {/* הרשימה הנפתחת */}
      {isOpen && !disabled && containerRef.current && (
        <div 
          ref={dropdownRef}
          className={styles.dropdown}
          style={{
            position: 'fixed',
            left: `${containerRef.current.getBoundingClientRect().left}px`,
            width: `${containerRef.current.getBoundingClientRect().width}px`,
            ...dropdownPosition
          }}
        >
          {/* שדה החיפוש */}
          <div className={styles.searchContainer}>
            <div className={styles.searchWrapper}>
              <input 
                autoFocus
                type="text"
                className={styles.searchInput}
                placeholder="חפש ברשימה..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <div className={styles.searchIcon}>
                🔍
              </div>
            </div>
          </div>

          {/* רשימת האפשרויות */}
          <div className={styles.optionsList}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option.id}
                  className={`${styles.option} ${value === option.id ? styles.optionSelected : ''}`}
                  onClick={() => handleSelect(option)}
                >
                  {option.name}
                  {value === option.id && (
                    <span className={styles.optionIndicator}></span>
                  )}
                </div>
              ))
            ) : (
              <div className={styles.noResults}>
                לא נמצאו תוצאות עבור "{searchTerm}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;

