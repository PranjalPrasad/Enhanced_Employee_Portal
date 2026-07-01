// Charts Configuration and Management

class ChartManager {
    constructor() {
        this.attendanceChart = null;
        this.taskChart = null;
    }

    initCharts() {
        this.createAttendanceChart();
        this.createTaskChart();
        this.setupChartControls();
    }

    createAttendanceChart() {
        const ctx = document.getElementById('attendanceChart')?.getContext('2d');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.attendanceChart) {
            this.attendanceChart.destroy();
        }

        const data = MockData.attendance.monthlyAttendance;
        const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        this.attendanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Days Present',
                    data: data,
                    borderColor: '#4a90e2',
                    backgroundColor: 'rgba(74, 144, 226, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#4a90e2',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        padding: 12,
                        titleFont: {
                            size: 14
                        },
                        bodyFont: {
                            size: 13
                        },
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.y} days present`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 25,
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        },
                        ticks: {
                            callback: function(value) {
                                return value + ' days';
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    createTaskChart() {
        const ctx = document.getElementById('taskChart')?.getContext('2d');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.taskChart) {
            this.taskChart.destroy();
        }

        const data = MockData.tasks.weeklyProgress;
        const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        this.taskChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Tasks Completed (%)',
                    data: data,
                    backgroundColor: [
                        'rgba(74, 144, 226, 0.8)',
                        'rgba(74, 144, 226, 0.8)',
                        'rgba(74, 144, 226, 0.8)',
                        'rgba(74, 144, 226, 0.8)',
                        'rgba(74, 144, 226, 0.8)',
                        'rgba(155, 89, 182, 0.8)',
                        'rgba(155, 89, 182, 0.8)'
                    ],
                    borderColor: '#4a90e2',
                    borderWidth: 1,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Progress: ${context.parsed.y}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        },
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    setupChartControls() {
        const attendanceSelect = document.getElementById('attendancePeriod');
        const taskSelect = document.getElementById('taskPeriod');

        attendanceSelect?.addEventListener('change', (e) => {
            this.updateAttendanceChart(e.target.value);
        });

        taskSelect?.addEventListener('change', (e) => {
            this.updateTaskChart(e.target.value);
        });
    }

    updateAttendanceChart(period) {
        // Update chart data based on selected period
        let data, labels;

        switch(period) {
            case 'week':
                data = [5, 5, 4, 5, 5, 0, 0];
                labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                break;
            case 'month':
                data = MockData.attendance.monthlyAttendance;
                labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                break;
            case 'quarter':
                data = [55, 58, 56, 54];
                labels = ['Q1', 'Q2', 'Q3', 'Q4'];
                break;
        }

        if (this.attendanceChart) {
            this.attendanceChart.data.labels = labels;
            this.attendanceChart.data.datasets[0].data = data;
            this.attendanceChart.update();
        }
    }

    updateTaskChart(period) {
        // Update chart data based on selected period
        let data, labels;

        switch(period) {
            case 'week':
                data = MockData.tasks.weeklyProgress;
                labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                break;
            case 'month':
                data = [75, 80, 85, 82, 88, 90];
                labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
                break;
        }

        if (this.taskChart) {
            this.taskChart.data.labels = labels;
            this.taskChart.data.datasets[0].data = data;
            this.taskChart.update();
        }
    }
}

// Initialize charts when DOM is ready
let chartManager;

document.addEventListener('DOMContentLoaded', () => {
    chartManager = new ChartManager();
    
    // Wait for dashboard to be ready
    window.addEventListener('dashboard-ready', () => {
        chartManager.initCharts();
    });
});