class CameraManager {
    constructor() {
        this.stream = null;
        this.video = null;
        this.canvas = null;
        this.devices = [];
        this.currentDeviceId = null;
        this.isActive = false;
        this.constraints = {
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                facingMode: 'environment'
            },
            audio: false
        };
    }

    async init(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        
        try {
            await this.enumerateDevices();
            return true;
        } catch (error) {
            console.error('Camera initialization failed:', error);
            return false;
        }
    }

    async enumerateDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.devices = devices.filter(device => device.kind === 'videoinput');
            
            if (this.devices.length === 0) {
                throw new Error('No video input devices found');
            }
            
            return this.devices;
        } catch (error) {
            console.error('Error enumerating devices:', error);
            throw error;
        }
    }

    async startCamera(deviceId = null) {
        // Always stop current camera first to ensure clean state
        await this.stopCamera();

        try {
            const constraints = { ...this.constraints };
            
            // Use provided deviceId, or saved default, or current device
            const targetDeviceId = deviceId || localStorage.getItem('defaultCameraId') || this.currentDeviceId;
            
            if (targetDeviceId) {
                constraints.video.deviceId = { exact: targetDeviceId };
                this.currentDeviceId = targetDeviceId;
            }

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            this.isActive = true;
            
            return new Promise((resolve, reject) => {
                this.video.onloadedmetadata = () => {
                    this.video.play()
                        .then(() => {
                            console.log('Camera started successfully');
                            resolve();
                        })
                        .catch(reject);
                };
                this.video.onerror = (error) => {
                    console.error('Video error:', error);
                    reject(error);
                };
                
                // Add timeout to prevent hanging
                setTimeout(() => {
                    if (!this.isReady()) {
                        reject(new Error('Camera start timeout'));
                    }
                }, 5000);
            });
        } catch (error) {
            console.error('Error starting camera:', error);
            this.isActive = false;
            throw error;
        }
    }

    async stopCamera() {
        this.isActive = false;
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => {
                track.stop();
            });
            this.stream = null;
        }
        
        if (this.video) {
            this.video.srcObject = null;
            this.video.pause();
            // Clear event handlers to prevent memory leaks
            this.video.onloadedmetadata = null;
            this.video.onerror = null;
        }
        
        console.log('Camera stopped');
    }

    captureFrame() {
        if (!this.isActive || !this.video || !this.canvas) {
            return null;
        }

        try {
            const videoWidth = this.video.videoWidth;
            const videoHeight = this.video.videoHeight;
            
            if (videoWidth === 0 || videoHeight === 0) {
                return null;
            }

            this.canvas.width = videoWidth;
            this.canvas.height = videoHeight;
            
            const context = this.canvas.getContext('2d');
            context.drawImage(this.video, 0, 0, videoWidth, videoHeight);
            
            return this.canvas.toDataURL('image/jpeg', 0.8);
        } catch (error) {
            console.error('Error capturing frame:', error);
            return null;
        }
    }

    getDevices() {
        return this.devices;
    }

    getCurrentDevice() {
        return this.devices.find(device => device.deviceId === this.currentDeviceId);
    }

    isReady() {
        return this.isActive && this.video && this.video.readyState === 4;
    }

    getVideoResolution() {
        if (!this.video) return null;
        return {
            width: this.video.videoWidth,
            height: this.video.videoHeight
        };
    }
}

// Export for use in other modules
window.CameraManager = CameraManager;
