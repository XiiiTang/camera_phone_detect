class PhoneStatsService {
    constructor(databaseService) {
        this.databaseService = databaseService;
        this.updateInterval = null;
        this.updateFrequency = 5000; // Update every 5 seconds (only when not paused)

        // Pause state management
        this.isPaused = true; // Start in paused state when frontend opens

        // Prevent duplicate updates
        this.isUpdating = false;
        this.lastUpdateTime = 0;
        this.minUpdateInterval = 1000; // Minimum 1 second between updates

        // DOM elements
        this.continuousPhoneTimeElement = document.getElementById('continuousPhoneTime');
        this.continuousNoPhoneTimeElement = document.getElementById('continuousNoPhoneTime');
        this.lastUpdateTimeElement = document.getElementById('lastUpdateTime');
        this.lastResponseElement = document.getElementById('lastResponse');

        // Stat cards for visual feedback
        this.phoneStatCard = document.querySelector('.stat-phone');
        this.noPhoneStatCard = document.querySelector('.stat-no-phone');
    }

    start() {
        // Don't do initial update - wait for first AI response
        // This prevents unnecessary API calls on startup
        console.log('Phone stats service started (waiting for AI responses)');
    }

    stop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        console.log('Phone stats service stopped');
    }

    async updateStats() {
        // Prevent duplicate updates
        const now = Date.now();
        if (this.isUpdating || (now - this.lastUpdateTime) < this.minUpdateInterval) {
            console.log('Phone stats update skipped (too frequent or already updating)');
            return;
        }

        this.isUpdating = true;
        this.lastUpdateTime = now;

        try {
            // Add stack trace to identify caller
            const stack = new Error().stack;
            console.log('Updating phone stats... Called from:', stack.split('\n')[2].trim());
            const stats = await this.databaseService.getPhoneStats();
            console.log('Received stats:', stats);
            this.displayStats(stats);
        } catch (error) {
            console.error('Error updating phone stats:', error);
            this.displayError();
        } finally {
            this.isUpdating = false;
        }
    }

    displayStats(stats) {
        if (!stats) {
            this.displayError();
            return;
        }

        // If paused, force continuous time to display as 0
        let phoneTime, noPhoneTime;
        if (this.isPaused) {
            phoneTime = this.formatTime(0);
            noPhoneTime = this.formatTime(0);
        } else {
            phoneTime = this.formatTime(stats.currentContinuousPhoneTime);
            noPhoneTime = this.formatTime(stats.currentContinuousNoPhoneTime);
        }

        this.continuousPhoneTimeElement.textContent = phoneTime;
        this.continuousNoPhoneTimeElement.textContent = noPhoneTime;

        // Update last response info
        if (stats.lastResponse) {
            this.lastResponseElement.textContent = `最后响应: ${stats.lastResponse}`;
        }

        if (stats.lastTimestamp) {
            // Format as UTC+8 time with consistent format
            const utc8TimeString = this.formatUTC8Time(stats.lastTimestamp);
            this.lastUpdateTimeElement.textContent = `最后更新: ${utc8TimeString}`;
        }

        // Update visual indicators - also consider pause state
        this.updateVisualIndicators(stats);

        console.log('Phone stats updated:', stats, 'isPaused:', this.isPaused);
    }

    updateVisualIndicators(stats) {
        // Remove active classes
        this.phoneStatCard.classList.remove('active');
        this.noPhoneStatCard.classList.remove('active');

        // If paused, don't show any active indicators
        if (this.isPaused) {
            return;
        }

        // Add active class based on current state
        if (stats.currentContinuousPhoneTime > 0) {
            this.phoneStatCard.classList.add('active');
        } else if (stats.currentContinuousNoPhoneTime > 0) {
            this.noPhoneStatCard.classList.add('active');
        }
    }

    formatTime(seconds) {
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

    formatUTC8Time(timestampInput) {
        // Handle different timestamp formats from server
        let utc8Date;

        if (typeof timestampInput === 'string') {
            if (timestampInput.includes(' ') && !timestampInput.includes('T')) {
                // Database format "YYYY-MM-DD HH:MM:SS.mmm" - already UTC+8
                // Parse it directly as local time since it's already in the correct timezone
                const parts = timestampInput.split(' ');
                const datePart = parts[0];
                const timePart = parts[1] || '00:00:00';

                const [year, month, day] = datePart.split('-').map(Number);
                const [hours, minutes, seconds] = timePart.split(':').map(Number);

                // Create date object directly with UTC+8 values
                utc8Date = new Date(year, month - 1, day, hours, minutes, seconds);
            } else if (timestampInput.includes('T')) {
                // ISO format - might be UTC+8 marked as Z, so parse carefully
                utc8Date = new Date(timestampInput);
            } else {
                utc8Date = new Date(timestampInput);
            }
        } else if (timestampInput instanceof Date) {
            utc8Date = timestampInput;
        } else {
            // Fallback
            utc8Date = new Date();
        }

        // Format as YYYY-MM-DD HH:MM:SS
        const year = utc8Date.getFullYear();
        const month = String(utc8Date.getMonth() + 1).padStart(2, '0');
        const day = String(utc8Date.getDate()).padStart(2, '0');
        const hours = String(utc8Date.getHours()).padStart(2, '0');
        const minutes = String(utc8Date.getMinutes()).padStart(2, '0');
        const seconds = String(utc8Date.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    displayError() {
        this.continuousPhoneTimeElement.textContent = '--';
        this.continuousNoPhoneTimeElement.textContent = '--';
        this.lastUpdateTimeElement.textContent = '最后更新: 获取数据失败';
        this.lastResponseElement.textContent = '最后响应: --';
        
        // Remove active classes
        this.phoneStatCard.classList.remove('active');
        this.noPhoneStatCard.classList.remove('active');
    }

    // Method to trigger immediate update (called when new AI response is received)
    triggerUpdate() {
        // Only update if not paused - this is the primary update mechanism
        if (!this.isPaused) {
            this.updateStats();
        } else {
            console.log('Phone stats update skipped (paused)');
        }
    }

    // Method to set pause state
    setPaused(isPaused) {
        this.isPaused = isPaused;
        console.log('Phone stats service pause state changed:', isPaused);

        if (isPaused) {
            // Stop any periodic updates when paused
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }
            // Force display to show 0 when paused
            this.displayPausedState();
        } else {
            // When unpaused, don't start periodic updates
            // Statistics will be updated only when AI responses arrive
            // This ensures updates are completely response-driven
            console.log('Phone stats service unpaused - waiting for AI responses');
        }
    }

    // Display paused state without making API call
    displayPausedState() {
        this.continuousPhoneTimeElement.textContent = this.formatTime(0);
        this.continuousNoPhoneTimeElement.textContent = this.formatTime(0);

        // Remove active classes
        this.phoneStatCard.classList.remove('active');
        this.noPhoneStatCard.classList.remove('active');

        console.log('Phone stats display set to paused state');
    }

    // Method to check if currently paused
    isPausedState() {
        return this.isPaused;
    }
}

// Export for use in other modules
window.PhoneStatsService = PhoneStatsService;
