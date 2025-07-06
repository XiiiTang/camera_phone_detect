const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Database initialization
const db = new sqlite3.Database('./ai_responses.db');

// Create table if not exists
db.run(`CREATE TABLE IF NOT EXISTS ai_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    question TEXT NOT NULL,
    response TEXT NOT NULL,
    image_size INTEGER,
    processing_time INTEGER
)`);

// WebSocket connection for real-time updates
wss.on('connection', (ws) => {
    console.log('Client connected for real-time updates');
    
    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// API endpoint to save AI response
app.post('/api/save-response', (req, res) => {
    const { question, response, imageSize, processingTime } = req.body;
    
    const stmt = db.prepare(`INSERT INTO ai_responses (question, response, image_size, processing_time) 
                            VALUES (?, ?, ?, ?)`);
    
    stmt.run([question, response, imageSize, processingTime], function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        const responseData = {
            id: this.lastID,
            timestamp: new Date().toISOString(),
            question,
            response,
            imageSize,
            processingTime
        };
        
        // Broadcast to all connected clients
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'new_response',
                    data: responseData
                }));
            }
        });
        
        res.json({ success: true, id: this.lastID });
    });
    
    stmt.finalize();
});

// API endpoint to get all responses
app.get('/api/responses', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    db.all(`SELECT * FROM ai_responses ORDER BY timestamp DESC LIMIT ? OFFSET ?`, 
           [limit, offset], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

// API endpoint to clear all responses
app.delete('/api/responses', (req, res) => {
    db.run(`DELETE FROM ai_responses`, function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        // Broadcast clear event
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'clear_responses'
                }));
            }
        });

        res.json({ success: true, deletedRows: this.changes });
    });
});

// API endpoint to get phone usage statistics
app.get('/api/phone-stats', (req, res) => {
    // Get all responses ordered by timestamp DESC (newest first)
    db.all(`SELECT timestamp, response FROM ai_responses ORDER BY timestamp DESC`, (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (rows.length === 0) {
            return res.json({
                currentContinuousPhoneTime: 0,
                currentContinuousNoPhoneTime: 0,
                lastResponse: null,
                message: 'No data available'
            });
        }

        // Calculate continuous time based on the specified logic
        const stats = calculateContinuousTime(rows);
        console.log('Phone stats calculated:', stats);
        res.json(stats);
    });
});

// Function to calculate continuous time based on the specified logic
function calculateContinuousTime(rows) {
    if (rows.length === 0) {
        return {
            currentContinuousPhoneTime: 0,
            currentContinuousNoPhoneTime: 0,
            lastResponse: null
        };
    }

    const latestResponse = rows[0];
    let continuousStartIndex = 0;
    let continuousTime = 0;

    // Convert timestamps to Date objects
    // SQLite stores timestamps as local time, so we treat them as UTC+8
    const responses = rows.map(row => ({
        timestamp: new Date(row.timestamp), // Treat as local time (UTC+8)
        response: row.response.toLowerCase().trim()
    }));

    // Start from the latest response and work backwards
    for (let i = 1; i < responses.length; i++) {
        const currentResponse = responses[i];
        const previousResponse = responses[i - 1];

        // Calculate time difference in seconds
        const timeDiff = (previousResponse.timestamp - currentResponse.timestamp) / 1000;

        // Check if time gap is too large (>20 seconds)
        if (timeDiff > 20) {
            // Time gap is too large, continuous period ends at the previous response (i-1)
            // So we calculate from latest (index 0) to the response before the gap (index i-1)
            continuousStartIndex = i - 1;
            break;
        }

        // Check if response content is different
        if (currentResponse.response !== previousResponse.response) {
            // Content is different, continuous period is from latest response to this different response
            // So we calculate from latest (index 0) to this different response (index i)
            continuousStartIndex = i;
            break;
        }

        // If we reach the end of the array, the continuous period includes all responses
        if (i === responses.length - 1) {
            continuousStartIndex = i;
        }
    }

    // Calculate the continuous time from the latest response to the end of continuous period
    if (continuousStartIndex > 0) {
        continuousTime = (responses[0].timestamp - responses[continuousStartIndex].timestamp) / 1000;
    } else {
        // Only one response or all responses are continuous to the end
        if (responses.length > 1) {
            continuousTime = (responses[0].timestamp - responses[responses.length - 1].timestamp) / 1000;
        } else {
            continuousTime = 0;
        }
    }

    // Determine if currently looking at phone or not
    const isLookingAtPhone = latestResponse.response.toLowerCase().trim() === 'yes';

    return {
        currentContinuousPhoneTime: isLookingAtPhone ? Math.round(continuousTime) : 0,
        currentContinuousNoPhoneTime: !isLookingAtPhone ? Math.round(continuousTime) : 0,
        lastResponse: latestResponse.response,
        lastTimestamp: latestResponse.timestamp,
        continuousSeconds: Math.round(continuousTime)
    };
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the app at: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed.');
        }
        server.close(() => {
            console.log('Server closed.');
            process.exit(0);
        });
    });
});
