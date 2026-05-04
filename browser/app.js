// App State
let fitnessData = {
    currentSteps: 0,
    goalSteps: 10000,
    history: [4500, 6200, 3100, 8900, 5000, 7200, 0] // Weekly steps history
};

// Elements
const stepsDisplay = document.getElementById('current-steps');
const goalDisplay = document.getElementById('goal-steps');
const distDisplay = document.getElementById('stat-dist');
const kcalDisplay = document.getElementById('stat-kcal');
const progressPath = document.getElementById('progress-path');
const cloudSyncBtn = document.getElementById('cloud-sync');
const stepsInput = document.getElementById('input-steps');

let activityChart;

// Initialize App
function init() {
    loadData();
    updateUI();
    initChart();
}

// Load from LocalStorage
function loadData() {
    const saved = localStorage.getItem('fitLifeData');
    if (saved) {
        fitnessData = JSON.parse(saved);
    }
}

// Save to LocalStorage & Mock Cloud Sync
function saveData() {
    localStorage.setItem('fitLifeData', JSON.stringify(fitnessData));
    
    // Cloud sync animation
    cloudSyncBtn.classList.add('syncing');
    setTimeout(() => {
        cloudSyncBtn.classList.remove('syncing');
    }, 1500);
}

// Update UI Elements
function updateUI() {
    stepsDisplay.innerText = fitnessData.currentSteps.toLocaleString();
    goalDisplay.innerText = fitnessData.goalSteps.toLocaleString();
    
    // Calculate stats
    // 1 step is approx 0.000762 km
    // 1 step burns approx 0.04 calories
    const km = (fitnessData.currentSteps * 0.000762).toFixed(1);
    const kcal = Math.floor(fitnessData.currentSteps * 0.04);
    
    distDisplay.innerText = km;
    kcalDisplay.innerText = kcal;
    
    // Update progress circle
    const percentage = Math.min((fitnessData.currentSteps / fitnessData.goalSteps) * 100, 100);
    progressPath.setAttribute('stroke-dasharray', `${percentage}, 100`);
    
    // Update chart if exists
    if (activityChart) {
        activityChart.data.datasets[0].data[6] = fitnessData.currentSteps;
        activityChart.update();
    }
}

// Add activity
function addActivity() {
    const steps = parseInt(stepsInput.value);
    if (isNaN(steps) || steps <= 0) {
        alert("Iltimos, to'g'ri qadamlar sonini kiriting!");
        return;
    }
    
    fitnessData.currentSteps = steps;
    fitnessData.history[6] = steps;
    
    updateUI();
    saveData();
    stepsInput.value = '';
}

// Initialize Chart.js
function initChart() {
    const ctx = document.getElementById('activityChart').getContext('2d');
    
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(139, 92, 246, 0.4)');
    gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');

    activityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sha', 'Yak'],
            datasets: [{
                label: 'Qadamlar',
                data: fitnessData.history,
                borderColor: '#8b5cf6',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                backgroundColor: gradient,
                pointBackgroundColor: '#8b5cf6',
                pointBorderColor: '#fff',
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}

// Start the app
window.onload = init;
