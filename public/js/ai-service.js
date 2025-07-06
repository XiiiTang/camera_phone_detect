class AIService {
    constructor() {
        this.baseURL = 'http://localhost:8080';
        this.isOnline = false;
        this.lastHealthCheck = null;
        this.healthCheckInterval = null;
    }

    setBaseURL(url) {
        this.baseURL = url.replace(/\/$/, ''); // Remove trailing slash
    }

    async checkHealth() {
        try {
            const response = await fetch(`${this.baseURL}/health`, {
                method: 'GET',
                timeout: 5000
            });
            
            this.isOnline = response.ok;
            this.lastHealthCheck = new Date();
            return this.isOnline;
        } catch (error) {
            console.error('Health check failed:', error);
            this.isOnline = false;
            this.lastHealthCheck = new Date();
            return false;
        }
    }

    startHealthCheck(interval = 10000) {
        this.stopHealthCheck();
        this.healthCheckInterval = setInterval(() => {
            this.checkHealth();
        }, interval);
    }

    stopHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }

    async sendChatCompletion(instruction, imageBase64URL) {
        const startTime = Date.now();
        
        try {
            const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    max_tokens: 10, // Limiting to ensure short responses
                    temperature: 0.1, // Low temperature for consistent responses
                    messages: [
                        { 
                            role: 'user', 
                            content: [
                                { type: 'text', text: instruction },
                                { 
                                    type: 'image_url', 
                                    image_url: {
                                        url: imageBase64URL,
                                    } 
                                }
                            ] 
                        },
                    ]
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`Server error: ${response.status} - ${errorData}`);
            }

            const data = await response.json();
            const processingTime = Date.now() - startTime;
            
            let aiResponse = data.choices[0].message.content.trim().toLowerCase();
            
            // Force response to be 'yes' or 'no'
            if (aiResponse.includes('yes') && !aiResponse.includes('no')) {
                aiResponse = 'yes';
            } else if (aiResponse.includes('no') && !aiResponse.includes('yes')) {
                aiResponse = 'no';
            } else {
                // If unclear, default to 'no' for safety
                aiResponse = 'no';
            }

            return {
                response: aiResponse,
                processingTime: processingTime,
                originalResponse: data.choices[0].message.content
            };
        } catch (error) {
            console.error('AI service error:', error);
            throw error;
        }
    }

    getStatus() {
        return {
            isOnline: this.isOnline,
            lastHealthCheck: this.lastHealthCheck,
            baseURL: this.baseURL
        };
    }
}

// Export for use in other modules
window.AIService = AIService;
