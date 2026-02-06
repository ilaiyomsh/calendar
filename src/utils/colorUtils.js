/**
 * מחשב האם הטקסט צריך להיות שחור או לבן על סמך צבע הרקע (HEX)
 * @param {string} hexColor - צבע הרקע בפורמט HEX (למשל #ffffff)
 * @returns {string} - '#ffffff' או '#000000'
 */
export const getContrastColor = (hexColor) => {
    if (!hexColor) return '#ffffff';
    
    // הסרת ה-# אם קיים
    const hex = hexColor.replace('#', '');
    
    // המרה ל-RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // חישוב בהירות (YIQ formula)
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    
    // אם הבהירות מעל 128, הרקע בהיר ולכן הטקסט צריך להיות שחור
    return (yiq >= 128) ? '#000000' : '#ffffff';
};

/**
 * מוודא שהצבע כהה מספיק לטקסט לבן
 * אם הצבע בהיר מדי - מחשיך אותו
 * @param {string} hexColor - צבע בפורמט HEX
 * @param {number} threshold - סף בהירות (ברירת מחדל: 150)
 * @returns {string} - צבע מתוקן בפורמט HEX
 */
export const ensureDarkEnough = (hexColor, threshold = 150) => {
    if (!hexColor) return '#579bfc';
    
    // הסרת ה-# אם קיים
    const hex = hexColor.replace('#', '');
    
    // טיפול ב-hex מקוצר (3 תווים)
    let fullHex = hex;
    if (hex.length === 3) {
        fullHex = hex.split('').map(char => char + char).join('');
    }
    
    let r = parseInt(fullHex.substr(0, 2), 16);
    let g = parseInt(fullHex.substr(2, 2), 16);
    let b = parseInt(fullHex.substr(4, 2), 16);
    
    // חישוב בהירות YIQ
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    
    // אם הצבע בהיר מדי, נחשיך אותו
    if (yiq > threshold) {
        const darkenFactor = threshold / yiq;
        r = Math.floor(r * darkenFactor);
        g = Math.floor(g * darkenFactor);
        b = Math.floor(b * darkenFactor);
    }
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

/**
 * פלטת הצבעים הרשמית של Monday.com (מ-Vibe Design System)
 * צבעים חיים (ירוק, צהוב, כתום, אדום, ורוד, סגול, כחול) ראשונים - מועדפים
 * צבעים ניטרליים (חום, אפור, בז') אחרונים
 */
const MONDAY_COLORS = [
    // === צבעים חיים - מועדפים (80% מהפרויקטים) ===
    '#00c875', // done-green (ירוק בהיר)
    '#fdab3d', // working_orange (כתום)
    '#df2f4a', // stuck-red (אדום)
    '#9d50dd', // purple (סגול)
    '#579bfc', // bright-blue (כחול)
    '#ffcb00', // egg_yolk (צהוב)
    '#ff5ac4', // lipstick (ורוד בהיר)
    '#9cd326', // bright-green (ירוק-צהוב)
    '#ff6d3b', // dark-orange (כתום כהה)
    '#4eccc6', // aquamarine (טורקיז)
    '#bb3354', // dark-red (אדום כהה)
    '#784bd1', // dark_purple (סגול כהה)
    '#66ccff', // chili-blue (תכלת)
    '#e50073', // sofia_pink (ורוד חזק)
    '#037f4c', // grass_green (ירוק כהה)
    '#cab641', // saladish (חרדל)
    '#5559df', // indigo (אינדיגו)
    '#ff7575', // sunset (שקיעה)
    '#faa1f1', // bubble (ורוד בועות)
    '#ffadad', // peach (אפרסק)
    '#216edf', // royal (כחול מלכותי)
    '#bda8f9', // lavender (לבנדר)
    '#e484bd', // orchid (סחלב)
    '#007eb5', // dark-blue (כחול כהה)
    
    // === צבעים ניטרליים - פחות מועדפים (20%) ===
    '#74afcc', // river (כחול-אפור)
    '#a1e3f6', // sky (שמיים)
    '#9aadbd', // winter (אפור-כחול)
    '#a9bee8', // steel (פלדה)
    '#9d99b9', // lilac (לילך)
    '#7f5347', // brown (חום)
    '#bca58a', // tan (בז')
    '#cd9282', // coffee (קפה)
    '#563e3e', // pecan (פקאן)
];

// מספר הצבעים החיים (לשימוש בהסתברות מוטה)
const VIBRANT_COLORS_COUNT = 24;

/**
 * יוצר hash מספרי ממחרוזת
 * @param {string} str - מחרוזת כלשהי
 * @returns {number} - מספר hash חיובי
 */
const hashString = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
};

/**
 * יוצר צבע עקבי ממחרוזת (כגון מזהה פרויקט)
 * משתמש בפלטת Monday עם העדפה לצבעים חיים (ירוק, צהוב, כתום, אדום, ורוד, סגול, כחול)
 * @param {string} stringInput - מחרוזת כלשהי (לדוגמה: מזהה פרויקט)
 * @returns {string} - צבע בפורמט HEX מפלטת Monday
 */
export const stringToColor = (stringInput) => {
    if (!stringInput) return '#579bfc';  // bright-blue כברירת מחדל
    
    const hash = hashString(stringInput.toString());
    
    // שימוש ב-Golden Ratio לפיזור אופטימלי
    const goldenRatio = 0.618033988749895;
    
    // 80% סיכוי לצבע חי (מ-24 הראשונים), 20% מכל המערך
    const useVibrant = (hash % 100) < 80;
    const colorPool = useVibrant ? VIBRANT_COLORS_COUNT : MONDAY_COLORS.length;
    
    const colorIndex = Math.floor((hash * goldenRatio % 1) * colorPool);
    
    // החשכה אוטומטית אם נדרש כדי להבטיח קריאות עם טקסט לבן
    return ensureDarkEnough(MONDAY_COLORS[colorIndex]);
};

/**
 * צבעים קבועים לסוגי אירועים יומיים
 * משתמש בצבעי Monday הרשמיים
 */
export const EVENT_TYPE_COLORS = {
    'חופשה': '#fdab3d',  // working_orange - כתום
    'מחלה': '#e2445c',   // stuck_red - אדום
    'מילואים': '#037f4c' // grass_green - ירוק כהה
};

/**
 * צבעים לסוגי חגים
 * MODERN: חגים מודרניים ישראליים (יום העצמאות, יום השואה וכו')
 * MAJOR: חגים דתיים מרכזיים (ראש השנה, יום כיפור וכו')
 * MINOR: חגים קטנים (חנוכה, פורים וכו')
 */
export const HOLIDAY_COLORS = {
    MODERN: '#0073ea',  // כחול Monday - חגים מודרניים
    MAJOR: '#784bd1',   // סגול - חגים דתיים מרכזיים
    MINOR: '#9cd326'    // ירוק - חגים קטנים
};

/**
 * מחזיר צבע לחג לפי סוגו
 * @param {string} holidayType - סוג החג (MODERN/MAJOR/MINOR)
 * @returns {string} צבע בפורמט HEX
 */
export const getHolidayColor = (holidayType) => {
    return HOLIDAY_COLORS[holidayType] || HOLIDAY_COLORS.MINOR;
};

/**
 * מחזיר צבע לאירוע לפי סוג האירוע או מזהה הפרויקט
 * @param {string} eventType - סוג האירוע (חופשה/מחלה/מילואים/שעתי)
 * @param {string} projectId - מזהה הפרויקט
 * @param {string} [eventTypeColor] - צבע הלייבל מ-Monday API (label_style.color)
 * @returns {string} - צבע בפורמט HSL או HEX
 */
export const getEventColor = (eventType, projectId, eventTypeColor) => {
    // 1. צבע מ-Monday API (מיפוי דינאמי)
    if (eventTypeColor) {
        return ensureDarkEnough(eventTypeColor);
    }

    // 2. אירועים יומיים - צבע קבוע legacy (מוודא שהוא כהה מספיק)
    if (eventType && EVENT_TYPE_COLORS[eventType]) {
        return ensureDarkEnough(EVENT_TYPE_COLORS[eventType]);
    }

    // 3. אירועים עם פרויקט - צבע דינאמי לפי מזהה הפרויקט (כבר עטוף ב-stringToColor)
    if (projectId) {
        return stringToColor(projectId.toString());
    }

    // 4. ברירת מחדל
    return ensureDarkEnough('#3174ad');
};
