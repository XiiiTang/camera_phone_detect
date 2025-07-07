/**
 * UTC+8 Time Utility Module for Frontend
 * Provides consistent UTC+8 time handling across the application
 */
class UTC8TimeUtil {
    /**
     * Get current UTC+8 time as Date object
     * @returns {Date} Date object representing current UTC+8 time
     */
    static now() {
        const utcNow = new Date();
        // Add 8 hours (8 * 60 * 60 * 1000 milliseconds) to UTC time
        return new Date(utcNow.getTime() + (8 * 60 * 60 * 1000));
    }

    /**
     * Get UTC+8 timestamp string for database storage
     * Format: YYYY-MM-DD HH:MM:SS.mmm
     * @returns {string} Formatted timestamp string
     */
    static getTimestampString() {
        const utc8Time = this.now();
        const year = utc8Time.getUTCFullYear();
        const month = String(utc8Time.getUTCMonth() + 1).padStart(2, '0');
        const day = String(utc8Time.getUTCDate()).padStart(2, '0');
        const hours = String(utc8Time.getUTCHours()).padStart(2, '0');
        const minutes = String(utc8Time.getUTCMinutes()).padStart(2, '0');
        const seconds = String(utc8Time.getUTCSeconds()).padStart(2, '0');
        const milliseconds = String(utc8Time.getUTCMilliseconds()).padStart(3, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
    }

    /**
     * Get UTC+8 ISO string with timezone suffix (for external API compatibility)
     * Format: YYYY-MM-DDTHH:MM:SS.sss+08:00
     * @returns {string} ISO formatted string with timezone suffix
     */
    static getISOString() {
        const utc8Time = this.now();
        const year = utc8Time.getUTCFullYear();
        const month = String(utc8Time.getUTCMonth() + 1).padStart(2, '0');
        const day = String(utc8Time.getUTCDate()).padStart(2, '0');
        const hours = String(utc8Time.getUTCHours()).padStart(2, '0');
        const minutes = String(utc8Time.getUTCMinutes()).padStart(2, '0');
        const seconds = String(utc8Time.getUTCSeconds()).padStart(2, '0');
        const milliseconds = String(utc8Time.getUTCMilliseconds()).padStart(3, '0');

        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}+08:00`;
    }

    /**
     * Get UTC+8 time string for logging (without timezone suffix for cleaner logs)
     * Format: YYYY-MM-DDTHH:MM:SS.sss
     * @returns {string} Clean formatted string for logging
     */
    static getLogString() {
        const utc8Time = this.now();
        const year = utc8Time.getUTCFullYear();
        const month = String(utc8Time.getUTCMonth() + 1).padStart(2, '0');
        const day = String(utc8Time.getUTCDate()).padStart(2, '0');
        const hours = String(utc8Time.getUTCHours()).padStart(2, '0');
        const minutes = String(utc8Time.getUTCMinutes()).padStart(2, '0');
        const seconds = String(utc8Time.getUTCSeconds()).padStart(2, '0');
        const milliseconds = String(utc8Time.getUTCMilliseconds()).padStart(3, '0');

        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
    }

    /**
     * Parse timestamp string to UTC+8 Date object
     * @param {string} timestampStr - Timestamp string in various formats
     * @returns {Date} Date object representing the parsed time in UTC+8
     */
    static parseTimestamp(timestampStr) {
        if (!timestampStr) return this.now();

        if (timestampStr.includes('T')) {
            // ISO format
            if (timestampStr.includes('+08:00')) {
                // Already UTC+8
                return new Date(timestampStr);
            } else if (timestampStr.endsWith('Z')) {
                // UTC time, need to add 8 hours
                const utcTime = new Date(timestampStr);
                return new Date(utcTime.getTime() + (8 * 60 * 60 * 1000));
            } else {
                // Assume it's already UTC+8
                return new Date(timestampStr);
            }
        } else if (timestampStr.includes(' ') && !timestampStr.includes('T')) {
            // Database format "YYYY-MM-DD HH:MM:SS.mmm" - already UTC+8
            // Parse it directly as local time since it's already in the correct timezone
            const parts = timestampStr.split(' ');
            const datePart = parts[0];
            const timePart = parts[1] || '00:00:00';

            const [year, month, day] = datePart.split('-').map(Number);
            const timeComponents = timePart.split(':');
            const hours = Number(timeComponents[0]) || 0;
            const minutes = Number(timeComponents[1]) || 0;
            const secondsAndMs = timeComponents[2] || '0';
            const [seconds, milliseconds] = secondsAndMs.split('.').map(Number);

            // Create UTC+8 time by using UTC methods with the parsed values
            const utc8Date = new Date();
            utc8Date.setUTCFullYear(year, month - 1, day);
            utc8Date.setUTCHours(hours, minutes, seconds || 0, milliseconds || 0);
            
            return utc8Date;
        } else {
            // SQLite datetime format: "YYYY-MM-DD HH:MM:SS"
            // Treat as UTC+8 time
            return new Date(timestampStr + '+08:00');
        }
    }

    /**
     * Format Date object to display string
     * @param {Date|string} dateInput - Date object or timestamp string
     * @returns {string} Formatted display string (YYYY-MM-DD HH:MM:SS)
     */
    static formatForDisplay(dateInput) {
        let utc8Date;
        
        if (typeof dateInput === 'string') {
            utc8Date = this.parseTimestamp(dateInput);
        } else if (dateInput instanceof Date) {
            utc8Date = dateInput;
        } else {
            utc8Date = this.now();
        }

        const year = utc8Date.getUTCFullYear();
        const month = String(utc8Date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(utc8Date.getUTCDate()).padStart(2, '0');
        const hours = String(utc8Date.getUTCHours()).padStart(2, '0');
        const minutes = String(utc8Date.getUTCMinutes()).padStart(2, '0');
        const seconds = String(utc8Date.getUTCSeconds()).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    /**
     * Format time duration in seconds to human readable string
     * @param {number} seconds - Duration in seconds
     * @returns {string} Formatted duration string
     */
    static formatDuration(seconds) {
        if (!seconds || seconds === 0) {
            return '0秒';
        }

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;

        let result = '';

        if (hours > 0) {
            result += `${hours}小时`;
        }

        if (minutes > 0) {
            result += `${minutes}分`;
        }

        if (remainingSeconds > 0 || result === '') {
            result += `${remainingSeconds}秒`;
        }

        return result;
    }
}

// Make it available globally
window.UTC8TimeUtil = UTC8TimeUtil;
