class DatabaseService {
    constructor() {
        this.baseURL = window.location.origin;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.onNewResponse = null;
        this.onClearResponses = null;
        this.onConnectionChange = null;
    }

    async saveResponse(question, response, imageSize, processingTime) {
        try {
            const result = await fetch(`${this.baseURL}/api/save-response`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    question,
                    response,
                    imageSize,
                    processingTime
                })
            });

            if (!result.ok) {
                throw new Error(`Failed to save response: ${result.status}`);
            }

            return await result.json();
        } catch (error) {
            console.error('Error saving response:', error);
            throw error;
        }
    }

    async getResponses(limit = 50, offset = 0) {
        try {
            const response = await fetch(`${this.baseURL}/api/responses?limit=${limit}&offset=${offset}`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch responses: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching responses:', error);
            throw error;
        }
    }

    async clearAllResponses() {
        try {
            const response = await fetch(`${this.baseURL}/api/responses`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`Failed to clear responses: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error clearing responses:', error);
            throw error;
        }
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsURL = `${protocol}//${window.location.host}`;
        
        try {
            this.ws = new WebSocket(wsURL);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.reconnectAttempts = 0;
                if (this.onConnectionChange) {
                    this.onConnectionChange(true);
                }
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    if (data.type === 'new_response' && this.onNewResponse) {
                        this.onNewResponse(data.data);
                    } else if (data.type === 'clear_responses' && this.onClearResponses) {
                        this.onClearResponses();
                    }
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                if (this.onConnectionChange) {
                    this.onConnectionChange(false);
                }
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('Error connecting WebSocket:', error);
            this.attemptReconnect();
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            
            setTimeout(() => {
                this.connectWebSocket();
            }, this.reconnectDelay);
        } else {
            console.error('Max reconnection attempts reached');
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }
}

// Export for use in other modules
window.DatabaseService = DatabaseService;
