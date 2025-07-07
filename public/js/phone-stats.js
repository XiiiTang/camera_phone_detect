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

        console.log('Phone stats updated:', stats, 'isPaused:', this.isPaused);
    }



    formatTime(seconds) {
        return UTC8TimeUtil.formatDuration(seconds);
    }

    formatUTC8Time(timestampInput) {
        return UTC8TimeUtil.formatForDisplay(timestampInput);
    }

    displayError() {
        this.continuousPhoneTimeElement.textContent = '--';
        this.continuousNoPhoneTimeElement.textContent = '--';
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

        console.log('Phone stats display set to paused state');
    }

    // Method to check if currently paused
    isPausedState() {
        return this.isPaused;
    }
}

// Export for use in other modules
window.PhoneStatsService = PhoneStatsService;
