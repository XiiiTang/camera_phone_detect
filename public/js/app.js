class AppController {
    constructor() {
        this.camera = new CameraManager();
        this.aiService = new AIService();
        this.dbService = new DatabaseService();
        this.phoneStats = new PhoneStatsService(this.dbService);

        this.isProcessing = false;
        this.processingInterval = null;
        this.currentInterval = 10000; // Default 10 seconds

        this.elements = {};
        this.logs = [];
        this.maxLogs = 100;

        this.init();
    }

    async init() {
        this.initializeElements();
        this.setupEventListeners();
        this.setupWebSocket();

        try {
            await this.initializeCamera();
            await this.loadLogs();

            // Start phone statistics service
            this.phoneStats.start();

            this.updateStatus('Camera initialized successfully', 'success');
        } catch (error) {
            this.updateStatus(`Initialization failed: ${error.message}`, 'error');
        }
    }

    initializeElements() {
        this.elements = {
            // Camera elements
            video: document.getElementById('videoFeed'),
            canvas: document.getElementById('canvas'),
            cameraSelect: document.getElementById('cameraSelect'),
            videoOverlay: document.getElementById('videoOverlay'),
            setDefaultCameraButton: document.getElementById('setDefaultCameraButton'),
            
            // Control elements
            startButton: document.getElementById('startButton'),
            aiURLInput: document.getElementById('aiURL'),
            questionInput: document.getElementById('questionText'),
            intervalSelect: document.getElementById('intervalSelect'),
            
            // Status elements
            statusDisplay: document.getElementById('statusDisplay'),
            connectionStatus: document.getElementById('connectionStatus'),
            
            // Log elements
            logsContent: document.getElementById('logsContent'),
            clearLogsButton: document.getElementById('clearLogsButton')
        };
        
        // Set default interval value in UI
        this.elements.intervalSelect.value = this.currentInterval;
    }

    setupEventListeners() {
        // Camera selection
        this.elements.cameraSelect.addEventListener('change', (e) => {
            if (this.camera.isActive) {
                this.switchCamera(e.target.value);
            }
        });

        // Set default camera
        this.elements.setDefaultCameraButton.addEventListener('click', () => {
            this.setDefaultCamera();
        });

        // Start/Stop button
        this.elements.startButton.addEventListener('click', () => {
            if (this.isProcessing) {
                this.pauseProcessing();
            } else {
                this.startProcessing();
            }
        });

        // AI URL change
        this.elements.aiURLInput.addEventListener('change', (e) => {
            this.aiService.setBaseURL(e.target.value);
        });

        // Interval change
        this.elements.intervalSelect.addEventListener('change', (e) => {
            this.currentInterval = parseInt(e.target.value);
        });

        // Clear logs
        this.elements.clearLogsButton.addEventListener('click', () => {
            this.clearLogs();
        });

        // Window beforeunload
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    setupWebSocket() {
        this.dbService.onNewResponse = (data) => {
            console.log('WebSocket: New response received, triggering stats update');
            this.addLogEntry(data);
            // Trigger phone stats update when new AI response is received
            // This is the primary mechanism for updating statistics
            this.phoneStats.triggerUpdate();
        };

        this.dbService.onClearResponses = () => {
            console.log('WebSocket: Clear responses received, triggering stats update');
            this.clearLogDisplay();
            // Trigger phone stats update when responses are cleared
            this.phoneStats.triggerUpdate();
        };

        this.dbService.onConnectionChange = (isConnected) => {
            console.log('WebSocket: Connection change:', isConnected);
            this.updateConnectionStatus(isConnected);
            // Don't trigger stats update on connection change
            // Stats will be updated when new responses arrive
        };

        this.dbService.connectWebSocket();
    }

    async initializeCamera() {
        const initialized = await this.camera.init(this.elements.video, this.elements.canvas);
        
        if (!initialized) {
            throw new Error('Camera initialization failed');
        }

        await this.populateCameraSelect();
        await this.camera.startCamera();
        this.updateVideoOverlay();
    }

    async populateCameraSelect() {
        const devices = this.camera.getDevices();
        const select = this.elements.cameraSelect;
        
        // Load default camera from localStorage
        const defaultCameraId = localStorage.getItem('defaultCameraId');
        
        select.innerHTML = '';
        
        devices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Camera ${index + 1}`;
            
            // Select default camera if available
            if (defaultCameraId === device.deviceId) {
                option.selected = true;
            }
            
            select.appendChild(option);
        });

        // If default camera is set, start with that camera
        if (defaultCameraId && devices.find(d => d.deviceId === defaultCameraId)) {
            await this.switchCamera(defaultCameraId);
        }
    }

    async switchCamera(deviceId) {
        try {
            await this.camera.startCamera(deviceId);
            this.updateVideoOverlay();
            this.updateStatus('Camera switched successfully', 'success');
        } catch (error) {
            this.updateStatus(`Failed to switch camera: ${error.message}`, 'error');
        }
    }

    updateVideoOverlay() {
        const resolution = this.camera.getVideoResolution();
        if (resolution) {
            this.elements.videoOverlay.textContent = `${resolution.width}x${resolution.height}`;
        }
    }

    async startProcessing() {
        try {
            // Ensure camera is started
            if (!this.camera.isActive) {
                this.updateStatus('Starting camera...', 'info');
                await this.camera.startCamera();
                
                // Wait for camera to be ready
                let retries = 0;
                while (!this.camera.isReady() && retries < 30) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    retries++;
                }
                
                if (!this.camera.isReady()) {
                    throw new Error('Camera failed to start properly');
                }
            }

            this.isProcessing = true;
            this.elements.startButton.textContent = 'Pause Processing';
            this.elements.startButton.className = 'btn btn-warning';

            // Disable controls
            this.elements.cameraSelect.disabled = true;
            this.elements.setDefaultCameraButton.disabled = true;
            this.elements.intervalSelect.disabled = true;
            this.elements.questionInput.disabled = true;
            this.elements.aiURLInput.disabled = true;

            // Notify phone stats service that processing has started (not paused)
            this.phoneStats.setPaused(false);

            this.updateStatus('Processing started...', 'info');
            
            // Start processing immediately
            this.processFrame();
            
            // Set interval for subsequent processing
            this.processingInterval = setInterval(() => {
                this.processFrame();
            }, this.currentInterval);
        } catch (error) {
            this.updateStatus(`Failed to start processing: ${error.message}`, 'error');
            
            // Reset UI state if starting failed
            this.elements.startButton.textContent = 'Start Processing';
            this.elements.startButton.className = 'btn btn-success';
            
            // Re-enable controls
            this.elements.cameraSelect.disabled = false;
            this.elements.setDefaultCameraButton.disabled = false;
            this.elements.intervalSelect.disabled = false;
            this.elements.questionInput.disabled = false;
            this.elements.aiURLInput.disabled = false;
        }
    }

    pauseProcessing() {
        this.isProcessing = false;

        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }

        // Stop camera completely
        this.camera.stopCamera();

        // Notify phone stats service that processing is paused
        this.phoneStats.setPaused(true);

        this.elements.startButton.textContent = 'Start Processing';
        this.elements.startButton.className = 'btn btn-success';

        // Enable controls
        this.elements.cameraSelect.disabled = false;
        this.elements.setDefaultCameraButton.disabled = false;
        this.elements.intervalSelect.disabled = false;
        this.elements.questionInput.disabled = false;
        this.elements.aiURLInput.disabled = false;

        this.updateStatus('Processing paused - Camera stopped', 'info');
    }

    stopProcessing() {
        this.pauseProcessing(); // Use same logic as pause
    }

    async processFrame() {
        if (!this.isProcessing) return;

        try {
            const imageData = this.camera.captureFrame();
            if (!imageData) {
                this.updateStatus('Failed to capture frame', 'warning');
                return;
            }

            const question = this.elements.questionInput.value.trim();
            if (!question) {
                this.updateStatus('Please enter a question', 'warning');
                return;
            }

            const result = await this.aiService.sendChatCompletion(question, imageData);

            // Save to database - this will trigger WebSocket notification
            // which will automatically update phone stats via onNewResponse
            await this.dbService.saveResponse(
                question,
                result.response,
                imageData.length,
                result.processingTime
            );

            this.updateStatus(`Response: ${result.response}`, 'success');

        } catch (error) {
            console.error('Processing error:', error);
            this.updateStatus(`Processing error: ${error.message}`, 'error');
        }
    }

    async loadLogs() {
        try {
            const logs = await this.dbService.getResponses(this.maxLogs);
            this.logs = logs;
            this.renderLogs();
        } catch (error) {
            console.error('Error loading logs:', error);
        }
    }

    addLogEntry(data) {
        this.logs.unshift(data);
        if (this.logs.length > this.maxLogs) {
            this.logs.pop();
        }
        this.renderLogs();
    }

    renderLogs() {
        const container = this.elements.logsContent;
        container.innerHTML = '';

        this.logs.forEach(log => {
            const logElement = document.createElement('div');
            logElement.className = `log-entry log-entry-${log.response}`;

            // Format timestamp as UTC+8
            const utc8TimeString = this.formatUTC8Time(log.timestamp);

            logElement.innerHTML = `
                <div class="log-content">
                    <div class="log-response">${log.response.toUpperCase()}</div>
                    <div class="log-timestamp">${utc8TimeString}</div>
                </div>
            `;

            container.appendChild(logElement);
        });
    }

    clearLogDisplay() {
        this.logs = [];
        this.renderLogs();
    }

    async clearLogs() {
        try {
            await this.dbService.clearAllResponses();
            this.updateStatus('Logs cleared successfully', 'success');
        } catch (error) {
            this.updateStatus(`Failed to clear logs: ${error.message}`, 'error');
        }
    }

    updateStatus(message, type = 'info') {
        const statusElement = this.elements.statusDisplay;
        statusElement.textContent = message;
        statusElement.className = `status-display status-${type}`;
    }

    updateConnectionStatus(isConnected) {
        const element = this.elements.connectionStatus;
        if (isConnected) {
            element.textContent = 'Connected';
            element.className = 'connection-status connection-online';
        } else {
            element.textContent = 'Disconnected';
            element.className = 'connection-status connection-offline';
        }
    }

    setDefaultCamera() {
        const selectedCamera = this.elements.cameraSelect.value;
        if (selectedCamera) {
            localStorage.setItem('defaultCameraId', selectedCamera);
            this.updateStatus('Default camera set successfully', 'success');
        } else {
            this.updateStatus('Please select a camera first', 'warning');
        }
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

    cleanup() {
        this.stopProcessing();
        this.camera.stopCamera();
        this.dbService.disconnect();
        this.aiService.stopHealthCheck();
        this.phoneStats.stop();
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AppController();
});
