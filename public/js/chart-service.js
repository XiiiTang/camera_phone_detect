class ChartService {
    constructor(databaseService) {
        this.databaseService = databaseService;
        this.chart = null;
        this.currentPeriod = 'today';
        
        // DOM elements
        this.chartCanvas = document.getElementById('usageChart');
        this.chartLoading = document.getElementById('chartLoading');
        this.chartError = document.getElementById('chartError');
        this.chartEmpty = document.getElementById('chartEmpty');
        this.chartStats = document.getElementById('chartStats');
        
        // Control elements
        this.todayBtn = document.getElementById('todayBtn');
        this.weekBtn = document.getElementById('weekBtn');
        this.monthBtn = document.getElementById('monthBtn');
        
        // Statistics elements
        this.totalPhoneTimeElement = document.getElementById('totalPhoneTime');
        this.totalNoPhoneTimeElement = document.getElementById('totalNoPhoneTime');
        this.totalRecordsElement = document.getElementById('totalRecords');

        // Statistics label elements
        this.phoneTimeLabelElement = document.getElementById('phoneTimeLabel');
        this.noPhoneTimeLabelElement = document.getElementById('noPhoneTimeLabel');
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Period selection buttons
        this.todayBtn.addEventListener('click', () => this.switchPeriod('today'));
        this.weekBtn.addEventListener('click', () => this.switchPeriod('week'));
        this.monthBtn.addEventListener('click', () => this.switchPeriod('month'));
    }
    
    switchPeriod(period) {
        if (this.currentPeriod === period) return;

        this.currentPeriod = period;
        this.updateActiveButton();
        this.updateStatisticsLabels();
        this.loadChartData();
    }
    
    updateActiveButton() {
        // Remove active class from all buttons
        [this.todayBtn, this.weekBtn, this.monthBtn].forEach(btn => {
            btn.classList.remove('active');
        });

        // Add active class to current period button
        switch (this.currentPeriod) {
            case 'today':
                this.todayBtn.classList.add('active');
                break;
            case 'week':
                this.weekBtn.classList.add('active');
                break;
            case 'month':
                this.monthBtn.classList.add('active');
                break;
        }
    }

    updateStatisticsLabels() {
        // Update statistics labels based on current period
        switch (this.currentPeriod) {
            case 'today':
                this.phoneTimeLabelElement.textContent = '今日看手机总时长:';
                this.noPhoneTimeLabelElement.textContent = '今日没看手机总时长:';
                break;
            case 'week':
                this.phoneTimeLabelElement.textContent = '本周看手机总时长:';
                this.noPhoneTimeLabelElement.textContent = '本周没看手机总时长:';
                break;
            case 'month':
                this.phoneTimeLabelElement.textContent = '本月看手机总时长:';
                this.noPhoneTimeLabelElement.textContent = '本月没看手机总时长:';
                break;
        }
    }
    
    async loadChartData() {
        this.showLoading();

        try {
            const chartData = await this.databaseService.getChartData(this.currentPeriod);
            this.renderChart(chartData);
            this.updateStatistics(chartData.statistics);
            this.hideLoading();

        } catch (error) {
            console.error('Error loading chart data:', error);
            this.showError();
        }
    }
    
    renderChart(chartData) {
        // Destroy existing chart if it exists
        if (this.chart) {
            this.chart.destroy();
        }

        // Check if we have data
        if (!chartData || !chartData.datasets || chartData.datasets.length === 0) {
            this.showEmpty();
            return;
        }

        // Check if all datasets are empty
        const hasData = chartData.datasets.some(dataset =>
            dataset.data && dataset.data.some(value => value > 0)
        );

        if (!hasData) {
            this.showEmpty();
            return;
        }

        const ctx = this.chartCanvas.getContext('2d');
        
        // Configure chart based on type
        let chartConfig;
        
        if (chartData.type === 'today') {
            // Stacked bar chart for today view
            chartConfig = {
                type: 'bar',
                data: {
                    labels: chartData.labels,
                    datasets: chartData.datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            stacked: true,
                            title: {
                                display: true,
                                text: '时间 (小时)'
                            }
                        },
                        y: {
                            stacked: true,
                            beginAtZero: true,
                            max: 60,
                            title: {
                                display: true,
                                text: '时长 (分钟)'
                            }
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: '今日手机使用情况 (24小时)',
                            font: {
                                size: 16,
                                weight: 'bold'
                            }
                        },
                        legend: {
                            display: true,
                            position: 'top'
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: 'white',
                            bodyColor: 'white',
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                            borderWidth: 1,
                            callbacks: {
                                title: function(context) {
                                    return `时间段: ${context[0].label}`;
                                },
                                label: function(context) {
                                    return `${context.dataset.label}: ${context.parsed.y}分钟`;
                                },
                                footer: function(context) {
                                    const total = context.reduce((sum, item) => sum + item.parsed.y, 0);
                                    return `总计: ${total}分钟`;
                                }
                            }
                        }
                    },
                    animation: false,
                    onClick: (event, elements) => {
                        if (elements.length > 0) {
                            const element = elements[0];
                            const dataIndex = element.index;
                            const hour = chartData.labels[dataIndex];
                            const phoneTime = chartData.datasets[1].data[dataIndex];
                            const noPhoneTime = chartData.datasets[0].data[dataIndex];

                            console.log(`点击了 ${hour} 时段: 看手机 ${phoneTime}分钟, 没看手机 ${noPhoneTime}分钟`);
                        }
                    }
                }
            };
        } else {
            // Line chart for week/month view
            chartConfig = {
                type: 'line',
                data: {
                    labels: chartData.labels,
                    datasets: chartData.datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: chartData.type === 'week' ? '日期 (本周)' : '日期 (本月)'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            max: 10,
                            title: {
                                display: true,
                                text: '时长 (小时)'
                            }
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: chartData.type === 'week' ? '本周手机使用趋势 (7天)' : '本月手机使用趋势 (31天)',
                            font: {
                                size: 16,
                                weight: 'bold'
                            }
                        },
                        legend: {
                            display: true,
                            position: 'top'
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: 'white',
                            bodyColor: 'white',
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                            borderWidth: 1,
                            callbacks: {
                                title: function(context) {
                                    return `日期: ${context[0].label}`;
                                },
                                label: function(context) {
                                    return `${context.dataset.label}: ${context.parsed.y}小时`;
                                },
                                footer: function(context) {
                                    const total = context.reduce((sum, item) => sum + item.parsed.y, 0);
                                    return `当日总计: ${total.toFixed(2)}小时`;
                                }
                            }
                        }
                    },
                    elements: {
                        point: {
                            radius: 4,
                            hoverRadius: 6
                        }
                    },
                    animation: {
                        duration: 1000,
                        easing: 'easeInOutQuart'
                    },
                    onClick: (event, elements) => {
                        if (elements.length > 0) {
                            const element = elements[0];
                            const dataIndex = element.index;
                            const date = chartData.labels[dataIndex];
                            const phoneTime = chartData.datasets[1].data[dataIndex];
                            const noPhoneTime = chartData.datasets[0].data[dataIndex];

                            console.log(`点击了 ${date} 日期: 看手机 ${phoneTime}小时, 没看手机 ${noPhoneTime}小时`);
                        }
                    }
                }
            };
        }
        
        this.chart = new Chart(ctx, chartConfig);
    }
    
    updateStatistics(stats) {
        if (!stats) return;

        const totalTime = stats.totalPhoneTime + stats.totalNoPhoneTime;
        const phonePercentage = totalTime > 0 ? ((stats.totalPhoneTime / totalTime) * 100).toFixed(1) : 0;
        const noPhonePercentage = totalTime > 0 ? ((stats.totalNoPhoneTime / totalTime) * 100).toFixed(1) : 0;

        // Format time based on current period
        if (this.currentPeriod === 'today') {
            // Today view shows minutes
            this.totalPhoneTimeElement.textContent = `${stats.totalPhoneTime}分钟 (${phonePercentage}%)`;
            this.totalNoPhoneTimeElement.textContent = `${stats.totalNoPhoneTime}分钟 (${noPhonePercentage}%)`;
        } else {
            // Week/month view shows hours
            this.totalPhoneTimeElement.textContent = `${stats.totalPhoneTime}小时 (${phonePercentage}%)`;
            this.totalNoPhoneTimeElement.textContent = `${stats.totalNoPhoneTime}小时 (${noPhonePercentage}%)`;
        }

        this.totalRecordsElement.textContent = stats.totalRecords;
    }
    
    showLoading() {
        this.chartLoading.classList.remove('hidden');
        this.chartError.classList.add('hidden');
        this.chartEmpty.classList.add('hidden');
        this.chartStats.style.opacity = '0.5';
    }

    hideLoading() {
        this.chartLoading.classList.add('hidden');
        this.chartError.classList.add('hidden');
        this.chartEmpty.classList.add('hidden');
        this.chartStats.style.opacity = '1';
    }

    showError(message = '加载图表数据失败') {
        this.chartLoading.classList.add('hidden');
        this.chartError.textContent = message;
        this.chartError.classList.remove('hidden');
        this.chartEmpty.classList.add('hidden');
        this.chartStats.style.opacity = '0.5';
    }

    showEmpty() {
        this.chartLoading.classList.add('hidden');
        this.chartError.classList.add('hidden');
        this.chartEmpty.classList.remove('hidden');
        this.chartStats.style.opacity = '0.5';

        // Clear statistics when showing empty state
        this.totalPhoneTimeElement.textContent = '--';
        this.totalNoPhoneTimeElement.textContent = '--';
        this.totalRecordsElement.textContent = '0';
    }
    
    // Method to refresh chart (called when new AI response is received)
    refreshChart() {
        console.log('Refreshing chart data...');
        // Only refresh if current period is 'today'
        // Weekly and monthly views should only refresh on view switch
        if (this.currentPeriod === 'today') {
            console.log('Auto-refreshing daily view due to AI response');
            this.loadChartData();
        } else {
            console.log(`Skipping auto-refresh for ${this.currentPeriod} view - only refreshes on view switch`);
        }
    }

    // Initialize chart with default period
    initialize() {
        this.updateStatisticsLabels();
        this.loadChartData();
    }
}

// Export for use in other modules
window.ChartService = ChartService;
