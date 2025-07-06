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
            this.addLogEntry(data);
            // Trigger phone stats update when new response is received
            this.phoneStats.triggerUpdate();
        };

        this.dbService.onClearResponses = () => {
            this.clearLogDisplay();
            // Trigger phone stats update when responses are cleared
            this.phoneStats.triggerUpdate();
        };

        this.dbService.onConnectionChange = (isConnected) => {
            this.updateConnectionStatus(isConnected);
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
            
            // Save to database
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
            
            logElement.innerHTML = `
                <div class="log-content">
                    <div class="log-response">${log.response.toUpperCase()}</div>
                    <div class="log-timestamp">${new Date(log.timestamp).toLocaleString()}</div>
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
