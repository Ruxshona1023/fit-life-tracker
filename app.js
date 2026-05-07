// App State
let fitnessData = {
    user: {
        firstName: "Foydalanuvchi",
        lastName: "",
        avatar: null
    },
    goalSteps: 10000,
    streak: 0,
    lastActiveDate: null,
    dailyLogs: {}, // Key: YYYY-MM-DD, Value: { steps, water, sleep, hr, workouts, meals }
    history: [0, 0, 0, 0, 0, 0, 0] // Last 7 days steps
};

let selectedDate = new Date().toISOString().split('T')[0]; // Current viewing date
let todayDate = new Date().toISOString().split('T')[0];

const EXERCISE_MET = {
    running: 9.8, cycling: 7.5, swimming: 8.0, weights: 6.0, yoga: 3.0
};

const EXERCISE_NAMES = {
    running: "Yugurish", cycling: "Velosiped", swimming: "Suzish", weights: "Zal (Gym)", yoga: "Yoga"
};

// Elements
const stepsDisplay = document.getElementById('current-steps');
const goalDisplay = document.getElementById('goal-steps');
const distDisplay = document.getElementById('stat-dist');
const kcalDisplay = document.getElementById('stat-kcal');
const waterDisplay = document.getElementById('stat-water');
const sleepDisplay = document.getElementById('stat-sleep');
const hrDisplay = document.getElementById('stat-hr');
const streakDisplay = document.getElementById('streak-count');
const goalStatus = document.getElementById('goal-status');
const progressPath = document.getElementById('progress-path');
const cloudSyncBtn = document.getElementById('cloud-sync');
const trackBtn = document.getElementById('btn-track');
const trackStatus = document.getElementById('tracking-status');

let activityChart;
let isTracking = false;
let stepDetector = {
    lastMag: 0,
    threshold: 12.5, // Sensitivity threshold for walking
    runThreshold: 18.0, // Threshold for running
    lastStepTime: 0,
    minStepDelay: 350, // ms
    windowSize: 5,
    magHistory: []
};

// Helper to get or create log for a specific date
function getLog(date) {
    if (!fitnessData.dailyLogs[date]) {
        fitnessData.dailyLogs[date] = {
            steps: 0,
            runSteps: 0,
            water: 0,
            sleep: 0,
            hr: 75,
            workouts: [],
            meals: []
        };
    }
    return fitnessData.dailyLogs[date];
}

// Initialize App
async function init() {
    setupDateNavigation();
    const success = await loadData();
    if (success) {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';
        checkStreak();
        updateUI();
        initChart();
        setInterval(checkDayChange, 60000);
    } else {
        document.getElementById('auth-container').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
    }
}

function checkDayChange() {
    const currentToday = new Date().toISOString().split('T')[0];
    if (currentToday !== todayDate) {
        // If the user was viewing "today", update their view to the new "today"
        if (selectedDate === todayDate) {
            selectedDate = currentToday;
        }
        todayDate = currentToday;
        checkStreak();
        updateUI();
        updateChartData();
    }
}

async function loadData() {
    try {
        const res = await fetch('/api/get_data');
        if (res.ok) {
            const parsed = await res.json();
            fitnessData = { ...fitnessData, ...parsed };
            return true;
        }
    } catch(e) {
        console.error("Ma'lumotlarni yuklashda xato:", e);
    }
    return false;
}

async function saveData() {
    cloudSyncBtn.classList.add('syncing');
    try {
        await fetch('/api/save_data', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(fitnessData)
        });
    } catch(e) {
        console.error("Saqlashda xato:", e);
    }
    setTimeout(() => cloudSyncBtn.classList.remove('syncing'), 1500);
    updateChartData();
}

function checkStreak() {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (fitnessData.lastActiveDate !== today) {
        // Check if goal was met on the last active day to continue streak
        if (fitnessData.lastActiveDate) {
            const lastLog = getLog(fitnessData.lastActiveDate);
            if (lastLog.steps >= fitnessData.goalSteps) {
                // If it was yesterday, increment streak
                if (fitnessData.lastActiveDate === yesterdayStr) {
                    fitnessData.streak++;
                } else {
                    // Broke streak
                    fitnessData.streak = 0;
                }
            } else if (fitnessData.lastActiveDate !== yesterdayStr) {
                // Also broke streak if missed more than a day
                fitnessData.streak = 0;
            }
        }
        fitnessData.lastActiveDate = today;
        saveData();
    }
}

function updateUI() {
    const log = getLog(selectedDate);
    const user = fitnessData.user || {};
    
    document.getElementById('username').innerText = `${user.firstName || 'Foydalanuvchi'} ${user.lastName || ''}`.trim();
    if (user.avatar) document.getElementById('user-avatar').src = user.avatar;

    // Update Date Display
    const dateObj = new Date(selectedDate);
    let dateStr = dateObj.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long' });
    
    // Add "Bugun" label if it's today
    if (selectedDate === todayDate) {
        dateStr = "Bugun, " + dateStr;
    }
    
    document.getElementById('display-date').innerText = dateStr;

    stepsDisplay.innerText = log.steps.toLocaleString();
    goalDisplay.innerText = fitnessData.goalSteps.toLocaleString();
    distDisplay.innerText = (log.steps * 0.000762).toFixed(1);
    document.getElementById('stat-run').innerText = (log.runSteps || 0).toLocaleString();
    
    // Calculate total calories
    const walkSteps = Math.max(0, log.steps - (log.runSteps || 0));
    const stepsKcal = (walkSteps * 0.04) + ((log.runSteps || 0) * 0.08); // Running burns 2x more
    const workoutKcal = (log.workouts || []).reduce((acc, curr) => acc + curr.kcal, 0);
    const mealKcal = (log.meals || []).reduce((acc, curr) => acc + curr.kcal, 0);
    kcalDisplay.innerText = Math.floor(stepsKcal + workoutKcal - mealKcal);

    waterDisplay.innerText = log.water;
    sleepDisplay.innerText = log.sleep;
    hrDisplay.innerText = log.hr;
    streakDisplay.innerText = fitnessData.streak;

    const percentage = Math.min((log.steps / fitnessData.goalSteps) * 100, 100);
    progressPath.setAttribute('stroke-dasharray', `${percentage}, 100`);

    if (log.steps >= fitnessData.goalSteps) {
        goalStatus.innerText = "Tabriklaymiz! Maqsadga erishildi! 🔥";
        goalStatus.style.color = "#06b6d4";
    } else {
        goalStatus.innerText = "Maqsad sari olg'a!";
        goalStatus.style.color = "#94a3b8";
    }

    renderWorkouts();
    renderMeals();
}

// Actions
function addActivity() {
    const input = document.getElementById('input-steps');
    const val = parseInt(input.value);
    if (!isNaN(val) && val > 0) {
        const log = getLog(selectedDate);
        log.steps += val;
        updateUI();
        saveData();
        input.value = '';
    }
}

function updateWater(change) {
    const log = getLog(selectedDate);
    log.water = Math.max(0, log.water + change);
    updateUI(); saveData();
}

function updateSleep(change) {
    const log = getLog(selectedDate);
    log.sleep = Math.max(0, log.sleep + change);
    updateUI(); saveData();
}

// Automatic Step Tracking Logic
async function toggleTracking() {
    if (isTracking) {
        stopTracking();
    } else {
        await startTracking();
    }
}

async function startTracking() {
    // Request permission for iOS devices
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        try {
            const permission = await DeviceMotionEvent.requestPermission();
            if (permission !== 'granted') {
                alert("Harakat datchigiga ruxsat berilmadi.");
                return;
            }
        } catch (err) {
            console.error(err);
        }
    }

    if ('DeviceMotionEvent' in window) {
        window.addEventListener('devicemotion', handleMotion);
        isTracking = true;
        updateTrackingUI();
    } else {
        alert("Sizning qurilmangizda harakat datchigi mavjud emas yoki qo'llab-quvvatlanmaydi.");
    }
}

function stopTracking() {
    window.removeEventListener('devicemotion', handleMotion);
    isTracking = false;
    updateTrackingUI();
}

function updateTrackingUI() {
    if (isTracking) {
        trackBtn.classList.add('active');
        trackBtn.innerHTML = '<i data-lucide="square"></i> To\'xtatish';
        trackStatus.classList.add('active');
        trackStatus.innerHTML = '<span></span> Hisoblanmoqda...';
    } else {
        trackBtn.classList.remove('active');
        trackBtn.innerHTML = '<i data-lucide="play"></i> Avto-hisoblash';
        trackStatus.classList.remove('active');
        trackStatus.innerHTML = '<span></span> O\'chirilgan';
    }
    lucide.createIcons();
}

function handleMotion(event) {
    const acc = event.accelerationIncludingGravity;
    if (!acc) return;

    // Calculate magnitude: sqrt(x^2 + y^2 + z^2)
    const mag = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
    
    // Smooth the signal with a simple moving average
    stepDetector.magHistory.push(mag);
    if (stepDetector.magHistory.length > stepDetector.windowSize) {
        stepDetector.magHistory.shift();
    }
    
    const avgMag = stepDetector.magHistory.reduce((a, b) => a + b, 0) / stepDetector.magHistory.length;
    const now = Date.now();

    // Peak detection logic
    if (avgMag > stepDetector.threshold && (now - stepDetector.lastStepTime) > stepDetector.minStepDelay) {
        // We found a peak (potential step)
        if (stepDetector.lastMag < avgMag) {
            // Still ascending
        } else {
            // We just passed the peak
            onStepDetected(avgMag > stepDetector.runThreshold);
            stepDetector.lastStepTime = now;
        }
    }
    
    stepDetector.lastMag = avgMag;
}

function onStepDetected(isRunning) {
    const log = getLog(selectedDate);
    log.steps += 1;
    if (isRunning) {
        log.runSteps = (log.runSteps || 0) + 1;
    }
    
    // UI Feedback
    const displayEl = isRunning ? document.getElementById('stat-run') : stepsDisplay;
    displayEl.classList.remove('step-bump');
    void displayEl.offsetWidth; // Trigger reflow
    displayEl.classList.add('step-bump');
    
    updateUI();
    if (log.steps % 5 === 0) saveData(); 
}

function updateHeartRate(val) {
    const log = getLog(selectedDate);
    log.hr = val;
    hrDisplay.innerText = val;
    saveData();
}

function calculateBMI() {
    const w = parseFloat(document.getElementById('bmi-weight').value);
    const h = parseFloat(document.getElementById('bmi-height').value) / 100;
    const resDiv = document.getElementById('bmi-result');
    if (w > 0 && h > 0) {
        const bmi = (w / (h * h)).toFixed(1);
        let status = "";
        if (bmi < 18.5) status = "Vazn kam";
        else if (bmi < 25) status = "Normal";
        else if (bmi < 30) status = "Ortiqcha vazn";
        else status = "Semizlik";
        resDiv.innerText = `${bmi} (${status})`;
    }
}

function addFood() {
    const name = document.getElementById('food-name').value;
    const kcal = parseInt(document.getElementById('food-kcal').value);
    if (name && !isNaN(kcal)) {
        const log = getLog(selectedDate);
        log.meals.unshift({ name, kcal, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) });
        updateUI(); saveData();
        document.getElementById('food-name').value = '';
        document.getElementById('food-kcal').value = '';
    }
}

function renderMeals() {
    const log = getLog(selectedDate);
    const list = document.getElementById('food-list');
    if (log.meals.length === 0) {
        list.innerHTML = '<p class="empty-msg">Hali ovqatlar yo\'q</p>';
        return;
    }
    list.innerHTML = log.meals.map(m => `
        <div class="food-item">
            <div><strong>${m.name}</strong><br><small>${m.time}</small></div>
            <div style="color: #f472b6">-${m.kcal} kcal</div>
        </div>
    `).join('');
}

function addWorkout() {
    const type = document.getElementById('select-exercise').value;
    const duration = parseInt(document.getElementById('input-duration').value);
    const editId = document.getElementById('input-duration').dataset.editId;

    if (type !== 'none' && !isNaN(duration)) {
        const met = EXERCISE_MET[type];
        const kcal = Math.floor(met * 70 * (duration / 60));
        const log = getLog(selectedDate);
        
        if (editId) {
            const index = log.workouts.findIndex(w => w.id == editId);
            if (index !== -1) {
                log.workouts[index].typeName = EXERCISE_NAMES[type];
                log.workouts[index].type = type;
                log.workouts[index].duration = duration;
                log.workouts[index].kcal = kcal;
            }
            delete document.getElementById('input-duration').dataset.editId;
            document.querySelector('.workout-form button').innerText = "Qo'shish";
        } else {
            log.workouts.unshift({
                id: Date.now(),
                type: type,
                typeName: EXERCISE_NAMES[type],
                duration: duration,
                kcal: kcal, 
                time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
            });
        }
        
        updateUI(); saveData();
        document.getElementById('input-duration').value = '';
        document.getElementById('select-exercise').value = 'none';
    }
}

function deleteWorkout(id) {
    if (confirm("Ushbu mashg'ulotni o'chirishni xohlaysizmi?")) {
        const log = getLog(selectedDate);
        log.workouts = log.workouts.filter(w => w.id !== id);
        updateUI(); saveData();
    }
}

function editWorkout(id) {
    const log = getLog(selectedDate);
    const workout = log.workouts.find(w => w.id === id);
    if (workout) {
        document.getElementById('select-exercise').value = workout.type;
        document.getElementById('input-duration').value = workout.duration;
        document.getElementById('input-duration').dataset.editId = id;
        document.querySelector('.workout-form button').innerText = "Saqlash";
        document.getElementById('select-exercise').focus();
    }
}

function renderWorkouts() {
    const log = getLog(selectedDate);
    const list = document.getElementById('workout-list');
    if (log.workouts.length === 0) {
        list.innerHTML = '<p class="empty-msg">Hali mashqlar yo\'q</p>';
        return;
    }
    list.innerHTML = log.workouts.map(w => `
        <div class="workout-item">
            <div class="workout-item-info">
                <h5>${w.typeName}</h5>
                <p>${w.duration} daqiqa • ${w.time}</p>
            </div>
            <div class="workout-actions">
                <div class="workout-item-kcal">+${w.kcal} kcal</div>
                <div class="action-btns">
                    <button class="btn-icon edit" onclick="editWorkout(${w.id})" title="Tahrirlash">
                        <i data-lucide="edit-3"></i>
                    </button>
                    <button class="btn-icon delete" onclick="deleteWorkout(${w.id})" title="O'chirish">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

function updateProfile() {
    const fInput = document.getElementById('input-fname');
    const lInput = document.getElementById('input-lname');
    const f = fInput.value;
    const l = lInput.value;
    const avatar = document.getElementById('input-avatar').files[0];
    
    if (f) fitnessData.user.firstName = f;
    if (l) fitnessData.user.lastName = l;
    
    if (avatar) {
        const reader = new FileReader();
        reader.onload = (e) => { 
            fitnessData.user.avatar = e.target.result; 
            updateUI(); 
            saveData();
            fInput.value = '';
            lInput.value = '';
            alert("Profil muvaffaqiyatli yangilandi!");
        };
        reader.readAsDataURL(avatar);
    } else { 
        updateUI(); 
        saveData();
        fInput.value = '';
        lInput.value = '';
        alert("Profil muvaffaqiyatli yangilandi!");
    }
}

function updateGoal() {
    const g = parseInt(document.getElementById('input-goal').value);
    if (g >= 1000) { fitnessData.goalSteps = g; updateUI(); saveData(); }
}

function setupDateNavigation() {
    window.changeDate = (days) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + days);
        selectedDate = d.toISOString().split('T')[0];
        updateUI();
    };

    window.goToToday = () => {
        selectedDate = todayDate;
        updateUI();
    };
}

function initChart() {
    const ctx = document.getElementById('activityChart').getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(139, 92, 246, 0.4)');
    gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');

    activityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: getHistoryLabels(),
            datasets: [{
                label: 'Qadamlar',
                data: getHistoryData(), 
                borderColor: '#8b5cf6', 
                borderWidth: 3, 
                tension: 0.4, 
                fill: true, 
                backgroundColor: gradient
            }]
        },
        options: { 
            responsive: true, 
            plugins: { legend: { display: false } }, 
            scales: { 
                y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' } }, 
                x: { grid: { display: false } } 
            } 
        }
    });
}

function getHistoryLabels() {
    const labels = [];
    const today = new Date();
    const days = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        labels.push(days[d.getDay()]);
    }
    return labels;
}

function getHistoryData() {
    const data = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        data.push(fitnessData.dailyLogs[dateStr]?.steps || 0);
    }
    return data;
}

function updateChartData() {
    if (activityChart) {
        activityChart.data.datasets[0].data = getHistoryData();
        activityChart.update();
    }
}

// --- AUTH LOGIC ---
function switchAuthTab(tab) {
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('tab-register').classList.remove('active');
    document.getElementById('form-login').classList.remove('active');
    document.getElementById('form-register').classList.remove('active');
    
    document.getElementById('tab-' + tab).classList.add('active');
    document.getElementById('form-' + tab).classList.add('active');
}

async function doLogin() {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    const err = document.getElementById('login-error');
    if(!u || !p) return err.innerText = "Barcha maydonlarni to'ldiring";
    
    err.innerText = "Yuklanmoqda...";
    const res = await fetch('/api/login', {
        method: 'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({username: u, password: p})
    });
    if(res.ok) {
        location.reload();
    } else {
        const data = await res.json();
        err.innerText = data.error || "Login yoki parol xato";
    }
}

async function doRegister() {
    const u = document.getElementById('reg-user').value;
    const p = document.getElementById('reg-pass').value;
    const err = document.getElementById('reg-error');
    if(!u || !p) return err.innerText = "Barcha maydonlarni to'ldiring";
    
    err.innerText = "Yuklanmoqda...";
    const res = await fetch('/api/register', {
        method: 'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({username: u, password: p})
    });
    if(res.ok) {
        location.reload();
    } else {
        const data = await res.json();
        err.innerText = data.error || "Xatolik yuz berdi";
    }
}

async function doLogout() {
    await fetch('/api/logout', {method: 'POST'});
    location.reload();
}

window.onload = init;
