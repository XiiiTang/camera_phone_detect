class PhoneStatsService {
    constructor(databaseService) {
        this.databaseService = databaseService;
        this.updateInterval = null;
        this.updateFrequency = 5000; // Update every 5 seconds
        
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
        // Initial update
        this.updateStats();
        
        // Set up periodic updates
        this.updateInterval = setInterval(() => {
            this.updateStats();
        }, this.updateFrequency);
        
        console.log('Phone stats service started');
    }

    stop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        console.log('Phone stats service stopped');
    }

    async updateStats() {
        try {
            console.log('Updating phone stats...');
            const stats = await this.databaseService.getPhoneStats();
            console.log('Received stats:', stats);
            this.displayStats(stats);
        } catch (error) {
            console.error('Error updating phone stats:', error);
            this.displayError();
        }
    }

    displayStats(stats) {
        if (!stats) {
            this.displayError();
            return;
        }

        // Update time values
        const phoneTime = this.formatTime(stats.currentContinuousPhoneTime);
        const noPhoneTime = this.formatTime(stats.currentContinuousNoPhoneTime);
        
        this.continuousPhoneTimeElement.textContent = phoneTime;
        this.continuousNoPhoneTimeElement.textContent = noPhoneTime;
        
        // Update last response info
        if (stats.lastResponse) {
            this.lastResponseElement.textContent = `最后响应: ${stats.lastResponse}`;
        }
        
        if (stats.lastTimestamp) {
            const lastUpdate = new Date(stats.lastTimestamp);
            // Display as local time (already in UTC+8 from server)
            this.lastUpdateTimeElement.textContent = `最后更新: ${lastUpdate.toLocaleString('zh-CN')}`;
        }
        
        // Update visual indicators
        this.updateVisualIndicators(stats);
        
        console.log('Phone stats updated:', stats);
    }

    updateVisualIndicators(stats) {
        // Remove active classes
        this.phoneStatCard.classList.remove('active');
        this.noPhoneStatCard.classList.remove('active');
        
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

    displayError() {
        this.continuousPhoneTimeElement.textContent = '--';
        this.continuousNoPhoneTimeElement.textContent = '--';
        this.lastUpdateTimeElement.textContent = '最后更新: 获取数据失败';
        this.lastResponseElement.textContent = '最后响应: --';
        
        // Remove active classes
        this.phoneStatCard.classList.remove('active');
        this.noPhoneStatCard.classList.remove('active');
    }

    // Method to trigger immediate update (can be called when new response is received)
    triggerUpdate() {
        this.updateStats();
    }
}

// Export for use in other modules
window.PhoneStatsService = PhoneStatsService;
