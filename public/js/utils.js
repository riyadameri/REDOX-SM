// Utility functions that can be used across the application

/**
 * Format a date to Arabic locale string
 * @param {Date} date 
 * @returns {string} Formatted date
 */
function formatArabicDate(date) {
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    return date.toLocaleDateString('ar-EG', options);
}

/**
 * Format time to 12-hour format with AM/PM in Arabic
 * @param {string} timeString - Time in "HH:MM" format
 * @returns {string} Formatted time
 */
function formatArabicTime(timeString) {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'م' : 'ص';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
}

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - Type of notification (success, error, warning, info)
 * @param {number} duration - Duration in milliseconds (default: 3000)
 */
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, duration);
}

/**
 * Validate a Saudi phone number
 * @param {string} phone 
 * @returns {boolean} True if valid
 */
function validateSaudiPhone(phone) {
    return /^(009665|9665|\+9665|05|5)(5|0|3|6|4|9|1|8|7)([0-9]{7})$/.test(phone);
}

/**
 * Format a number as currency (Saudi Riyals)
 * @param {number} amount 
 * @returns {string} Formatted currency
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('ar-SA', { 
        style: 'currency', 
        currency: 'SAR' 
    }).format(amount);
}

/**
 * Debounce a function to limit how often it can be called
 * @param {Function} func - The function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Get the current academic year based on current date
 * @returns {string} Academic year in format "1444-1445"
 */
function getCurrentAcademicYear() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Academic year starts in September
    if (currentMonth >= 8) { // September is month 8 (0-indexed)
        return `${currentYear}-${currentYear + 1}`;
    } else {
        return `${currentYear - 1}-${currentYear}`;
    }
}

/**
 * Convert Gregorian date to Hijri date
 * @param {Date} date 
 * @returns {string} Hijri date string
 */
function toHijriDate(date) {
    // This is a simplified version - in production use a proper library
    const gregorianYear = date.getFullYear();
    const hijriYear = Math.floor((gregorianYear - 622) * (33 / 32));
    return hijriYear;
}

/**
 * Capitalize the first letter of each word in Arabic string
 * @param {string} str 
 * @returns {string} Capitalized string
 */
function arabicCapitalize(str) {
    return str.replace(/(^|\s)\S/g, function(t) { return t.toUpperCase(); });
}

/**
 * Check if the user is logged in and has a valid token
 * @returns {boolean} True if authenticated
 */
function isAuthenticated() {
    const token = localStorage.getItem('studentToken');
    if (!token) return false;
    
    try {
        const decoded = jwtDecode(token);
        return decoded && decoded.exp > Date.now() / 1000;
    } catch (e) {
        return false;
    }
}

/**
 * Simple JWT decode function (for client-side only)
 * @param {string} token 
 * @returns {object|null} Decoded token payload or null
 */
function jwtDecode(token) {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        return null;
    }
}

// Add toast styles to the head if they don't exist
if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
        .toast {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            border-radius: 4px;
            color: white;
            opacity: 0;
            transition: opacity 0.3s ease;
            z-index: 1000;
        }
        .toast.show {
            opacity: 1;
        }
        .toast-success {
            background-color: #28a745;
        }
        .toast-error {
            background-color: #dc3545;
        }
        .toast-warning {
            background-color: #ffc107;
            color: #212529;
        }
        .toast-info {
            background-color: #17a2b8;
        }
    `;
    document.head.appendChild(style);
}