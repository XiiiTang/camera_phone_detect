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

// UTC+8 Time Utility Module
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
}



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
    const connectTime = UTC8TimeUtil.getLogString();
    console.log(`[${connectTime}] Client connected for real-time updates`);

    ws.on('close', () => {
        const disconnectTime = UTC8TimeUtil.getLogString();
        console.log(`[${disconnectTime}] Client disconnected`);
    });
});

// API endpoint to save AI response
app.post('/api/save-response', (req, res) => {
    const { question, response, imageSize, processingTime } = req.body;

    // Get UTC+8 timestamp for database insertion
    const utc8Timestamp = UTC8TimeUtil.getTimestampString();

    const stmt = db.prepare(`INSERT INTO ai_responses (timestamp, question, response, image_size, processing_time)
                            VALUES (?, ?, ?, ?, ?)`);

    stmt.run([utc8Timestamp, question, response, imageSize, processingTime], function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        // Create UTC+8 timestamp for response
        const utc8TimestampString = UTC8TimeUtil.getTimestampString();

        const responseData = {
            id: this.lastID,
            timestamp: utc8TimestampString,
            question,
            response,
            imageSize,
            processingTime
        };

        // Log the save operation with UTC+8 time
        const logTime = UTC8TimeUtil.getLogString();
        console.log(`[${logTime}] Saved response: ${response} (ID: ${this.lastID})`);

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
    // Get all responses ordered by ID DESC (newest first) to ensure correct ordering
    db.all(`SELECT timestamp, response FROM ai_responses ORDER BY id DESC`, (err, rows) => {
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

// API endpoint to get chart data for different time periods
app.get('/api/chart-data', (req, res) => {
    const period = req.query.period || 'today'; // today, week, month

    // Get all responses ordered by timestamp ASC for chart processing
    db.all(`SELECT timestamp, response FROM ai_responses ORDER BY timestamp ASC`, (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        try {
            let chartData;
            switch (period) {
                case 'today':
                    chartData = generateTodayChartData(rows);
                    break;
                case 'week':
                    chartData = generateWeekChartData(rows);
                    break;
                case 'month':
                    chartData = generateMonthChartData(rows);
                    break;
                default:
                    return res.status(400).json({ error: 'Invalid period parameter' });
            }

            console.log(`Chart data generated for ${period}:`, chartData);
            res.json(chartData);
        } catch (error) {
            console.error('Error generating chart data:', error);
            res.status(500).json({ error: 'Error generating chart data' });
        }
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

    // Convert timestamps to Date objects using UTC+8 time utility
    const responses = rows.map(row => {
        const timestamp = UTC8TimeUtil.parseTimestamp(row.timestamp);

        return {
            timestamp: timestamp,
            response: row.response.toLowerCase().trim()
        };
    });

    // Check if there's a time gap > 20 seconds between the latest response and the previous one
    if (responses.length > 1) {
        const latestTimestamp = responses[0].timestamp;
        const previousTimestamp = responses[1].timestamp;
        const timeDiff = (latestTimestamp - previousTimestamp) / 1000;

        // If time gap is too large (>20 seconds), reset continuous time to 0
        if (timeDiff > 20) {
            continuousTime = 0;
        } else {
            // Start from the latest response and work backwards to find continuous period
            for (let i = 1; i < responses.length; i++) {
                const currentResponse = responses[i];
                const previousResponse = responses[i - 1];

                // Calculate time difference in seconds
                const timeDiffInLoop = (previousResponse.timestamp - currentResponse.timestamp) / 1000;

                // Check if time gap is too large (>20 seconds)
                if (timeDiffInLoop > 20) {
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
        }
    } else {
        // Only one response, continuous time is 0
        continuousTime = 0;
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

// Function to generate today's chart data (24 hours, stacked bar chart)
function generateTodayChartData(rows) {
    const utc8Now = UTC8TimeUtil.now();
    const startOfDay = new Date(utc8Now);
    startOfDay.setUTCHours(0, 0, 0, 0);

    // Initialize 24 hours data structure
    const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        phoneTime: 0,      // minutes looking at phone
        noPhoneTime: 0,    // minutes not looking at phone
        label: `${hour.toString().padStart(2, '0')}:00`
    }));

    // Process responses and calculate usage periods
    const usagePeriods = calculateUsagePeriods(rows);

    // Aggregate data by hour
    usagePeriods.forEach(period => {
        const periodStart = new Date(period.startTime);
        const periodEnd = new Date(period.endTime);

        // Only include periods from today
        if (periodStart >= startOfDay && periodStart < new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)) {
            const startHour = periodStart.getHours();
            const endHour = periodEnd.getHours();
            const durationMinutes = Math.round(period.duration / 60); // Convert seconds to minutes

            if (startHour === endHour) {
                // Period within single hour
                if (period.isPhoneUsage) {
                    hourlyData[startHour].phoneTime += durationMinutes;
                } else {
                    hourlyData[startHour].noPhoneTime += durationMinutes;
                }
            } else {
                // Period spans multiple hours - distribute proportionally
                for (let hour = startHour; hour <= endHour && hour < 24; hour++) {
                    const hourStart = new Date(periodStart);
                    hourStart.setHours(hour, 0, 0, 0);
                    const hourEnd = new Date(hourStart);
                    hourEnd.setHours(hour + 1, 0, 0, 0);

                    const overlapStart = new Date(Math.max(periodStart, hourStart));
                    const overlapEnd = new Date(Math.min(periodEnd, hourEnd));
                    const overlapMinutes = Math.max(0, (overlapEnd - overlapStart) / (1000 * 60));

                    if (period.isPhoneUsage) {
                        hourlyData[hour].phoneTime += Math.round(overlapMinutes);
                    } else {
                        hourlyData[hour].noPhoneTime += Math.round(overlapMinutes);
                    }
                }
            }
        }
    });

    // Cap values at 60 minutes per hour
    hourlyData.forEach(data => {
        data.phoneTime = Math.min(data.phoneTime, 60);
        data.noPhoneTime = Math.min(data.noPhoneTime, 60);
    });

    return {
        type: 'today',
        labels: hourlyData.map(d => d.label),
        datasets: [
            {
                label: '没看手机',
                data: hourlyData.map(d => d.noPhoneTime),
                backgroundColor: '#FFE4B5', // Light orange
                borderWidth: 0
            },
            {
                label: '看手机',
                data: hourlyData.map(d => d.phoneTime),
                backgroundColor: '#20B2AA', // Teal
                borderWidth: 0
            }
        ],
        statistics: {
            totalPhoneTime: hourlyData.reduce((sum, d) => sum + d.phoneTime, 0),
            totalNoPhoneTime: hourlyData.reduce((sum, d) => sum + d.noPhoneTime, 0),
            totalRecords: rows.length
        }
    };
}

// Function to generate week chart data (7 days, filled line chart)
function generateWeekChartData(rows) {
    const utc8Now = UTC8TimeUtil.now();
    const startOfWeek = new Date(utc8Now);
    startOfWeek.setUTCDate(utc8Now.getUTCDate() - 6); // Last 7 days including today
    startOfWeek.setUTCHours(0, 0, 0, 0);

    // Initialize 7 days data structure
    const dailyData = Array.from({ length: 7 }, (_, dayIndex) => {
        const date = new Date(startOfWeek);
        date.setUTCDate(startOfWeek.getUTCDate() + dayIndex);
        return {
            date: date,
            phoneTime: 0,      // hours looking at phone
            noPhoneTime: 0,    // hours not looking at phone
            label: `${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')}`
        };
    });

    // Process responses and calculate usage periods
    const usagePeriods = calculateUsagePeriods(rows);

    // Aggregate data by day
    usagePeriods.forEach(period => {
        const periodStart = new Date(period.startTime);
        const dayIndex = Math.floor((periodStart - startOfWeek) / (24 * 60 * 60 * 1000));

        if (dayIndex >= 0 && dayIndex < 7) {
            const durationHours = period.duration / 3600; // Convert seconds to hours

            if (period.isPhoneUsage) {
                dailyData[dayIndex].phoneTime += durationHours;
            } else {
                dailyData[dayIndex].noPhoneTime += durationHours;
            }
        }
    });

    // Cap values at 10 hours per day
    dailyData.forEach(data => {
        data.phoneTime = Math.min(data.phoneTime, 10);
        data.noPhoneTime = Math.min(data.noPhoneTime, 10);
    });

    return {
        type: 'week',
        labels: dailyData.map(d => d.label),
        datasets: [
            {
                label: '没看手机',
                data: dailyData.map(d => Math.round(d.noPhoneTime * 100) / 100), // Round to 2 decimal places
                borderColor: '#28a745', // Green
                backgroundColor: 'rgba(40, 167, 69, 0.1)',
                fill: true,
                tension: 0.4
            },
            {
                label: '看手机',
                data: dailyData.map(d => Math.round(d.phoneTime * 100) / 100),
                borderColor: '#dc3545', // Red
                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                fill: true,
                tension: 0.4
            }
        ],
        statistics: {
            totalPhoneTime: Math.round(dailyData.reduce((sum, d) => sum + d.phoneTime, 0) * 100) / 100,
            totalNoPhoneTime: Math.round(dailyData.reduce((sum, d) => sum + d.noPhoneTime, 0) * 100) / 100,
            totalRecords: rows.length
        }
    };
}

// Function to generate month chart data (31 days, filled line chart)
function generateMonthChartData(rows) {
    const utc8Now = UTC8TimeUtil.now();
    const startOfMonth = new Date(utc8Now);
    startOfMonth.setUTCDate(utc8Now.getUTCDate() - 30); // Last 31 days including today
    startOfMonth.setUTCHours(0, 0, 0, 0);

    // Initialize 31 days data structure
    const dailyData = Array.from({ length: 31 }, (_, dayIndex) => {
        const date = new Date(startOfMonth);
        date.setUTCDate(startOfMonth.getUTCDate() + dayIndex);
        return {
            date: date,
            phoneTime: 0,      // hours looking at phone
            noPhoneTime: 0,    // hours not looking at phone
            label: `${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')}`
        };
    });

    // Process responses and calculate usage periods
    const usagePeriods = calculateUsagePeriods(rows);

    // Aggregate data by day
    usagePeriods.forEach(period => {
        const periodStart = new Date(period.startTime);
        const dayIndex = Math.floor((periodStart - startOfMonth) / (24 * 60 * 60 * 1000));

        if (dayIndex >= 0 && dayIndex < 31) {
            const durationHours = period.duration / 3600; // Convert seconds to hours

            if (period.isPhoneUsage) {
                dailyData[dayIndex].phoneTime += durationHours;
            } else {
                dailyData[dayIndex].noPhoneTime += durationHours;
            }
        }
    });

    // Cap values at 10 hours per day
    dailyData.forEach(data => {
        data.phoneTime = Math.min(data.phoneTime, 10);
        data.noPhoneTime = Math.min(data.noPhoneTime, 10);
    });

    return {
        type: 'month',
        labels: dailyData.map(d => d.label),
        datasets: [
            {
                label: '没看手机',
                data: dailyData.map(d => Math.round(d.noPhoneTime * 100) / 100),
                borderColor: '#28a745', // Green
                backgroundColor: 'rgba(40, 167, 69, 0.1)',
                fill: true,
                tension: 0.4
            },
            {
                label: '看手机',
                data: dailyData.map(d => Math.round(d.phoneTime * 100) / 100),
                borderColor: '#dc3545', // Red
                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                fill: true,
                tension: 0.4
            }
        ],
        statistics: {
            totalPhoneTime: Math.round(dailyData.reduce((sum, d) => sum + d.phoneTime, 0) * 100) / 100,
            totalNoPhoneTime: Math.round(dailyData.reduce((sum, d) => sum + d.noPhoneTime, 0) * 100) / 100,
            totalRecords: rows.length
        }
    };
}

// Function to calculate usage periods from raw response data
function calculateUsagePeriods(rows) {
    if (rows.length === 0) return [];

    const periods = [];
    let currentPeriod = null;

    // Convert timestamps and sort by time (ascending) using UTC+8 time utility
    const responses = rows.map(row => {
        const timestamp = UTC8TimeUtil.parseTimestamp(row.timestamp);

        return {
            timestamp: timestamp,
            response: row.response.toLowerCase().trim(),
            isPhoneUsage: row.response.toLowerCase().trim() === 'yes'
        };
    }).sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 0; i < responses.length; i++) {
        const current = responses[i];
        const next = responses[i + 1];

        // Start a new period if this is the first response or if the response type changed
        if (!currentPeriod || currentPeriod.isPhoneUsage !== current.isPhoneUsage) {
            // End the previous period if it exists (end at previous response time)
            if (currentPeriod && i > 0) {
                const previous = responses[i - 1];
                currentPeriod.endTime = previous.timestamp;
                currentPeriod.duration = (currentPeriod.endTime - currentPeriod.startTime) / 1000;
                if (currentPeriod.duration >= 1) {
                    periods.push(currentPeriod);
                }
            }

            // Start new period
            currentPeriod = {
                startTime: current.timestamp,
                endTime: current.timestamp,
                isPhoneUsage: current.isPhoneUsage,
                duration: 0
            };
        }

        // Update current period end time to current response
        currentPeriod.endTime = current.timestamp;

        // Check time gap to next response
        if (next) {
            const timeDiff = (next.timestamp - current.timestamp) / 1000;

            // If gap is too large (>20 seconds), end current period
            if (timeDiff > 20) {
                currentPeriod.duration = (currentPeriod.endTime - currentPeriod.startTime) / 1000;
                if (currentPeriod.duration >= 1) {
                    periods.push(currentPeriod);
                }
                currentPeriod = null;
            }
        } else {
            // This is the last response, end the current period
            if (currentPeriod) {
                currentPeriod.duration = (currentPeriod.endTime - currentPeriod.startTime) / 1000;
                if (currentPeriod.duration >= 1) {
                    periods.push(currentPeriod);
                }
            }
        }
    }

    return periods;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    // Return UTC+8 timestamp
    const logTime = UTC8TimeUtil.getLogString();
    const responseTime = UTC8TimeUtil.getLogString(); // Use clean format for API response too
    console.log(`[${logTime}] Health check requested`);
    res.json({ status: 'OK', timestamp: responseTime });
});

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    const logTimeString = UTC8TimeUtil.getLogString();
    console.log(`[${logTimeString}] Server running on port ${PORT}`);
    console.log(`[${logTimeString}] Access the app at: http://localhost:${PORT}`);
    console.log(`[${logTimeString}] Current UTC+8 time: ${logTimeString}`);
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
