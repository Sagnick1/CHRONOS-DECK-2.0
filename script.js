// --- CONFIGURATION ---
const GEMINI_API_KEY = "AIzaSyDgsq5UyHx9d53NT-waZxrmbD-YvBqJCCA";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;

// --- STATE MANAGEMENT ---
// --- STATE MANAGEMENT ---
const state = {
    isAuthenticated: false,
    tasks: [],
    focusTime: 0,
    timerInterval: null,
    isTimerRunning: false,
    timeLeft: 25 * 60, // 25 minutes in seconds
    zenMode: false,
    initialTime: 25 * 60
};

try {
    const storedTasks = localStorage.getItem('chronos_tasks');
    if (storedTasks) {
        state.tasks = JSON.parse(storedTasks);
    }
} catch (e) {
    console.error("Failed to parse tasks from local storage", e);
    state.tasks = [];
}

try {
    const storedFocusTime = localStorage.getItem('chronos_focus_time');
    if (storedFocusTime) {
        state.focusTime = parseInt(storedFocusTime) || 0;
    }
} catch (e) {
    console.error("Failed to parse focus time", e);
    state.focusTime = 0;
}

// --- DOM ELEMENTS ---
const elements = {
    lockScreen: document.getElementById('lock-screen'),
    appContainer: document.getElementById('app-container'),
    lockMessage: document.getElementById('lock-message'),
    loadingProgress: document.querySelector('.loading-progress'),
    loadingText: document.querySelector('.loading-text'),
    navLinks: document.querySelectorAll('.nav-links li'),
    sections: document.querySelectorAll('.view-section'),
    aiInput: document.getElementById('ai-input'),
    sendAiBtn: document.getElementById('send-ai-btn'),
    chatHistory: document.getElementById('chat-history'),
    timeLeft: document.getElementById('time-left'),
    startTimerBtn: document.getElementById('start-timer-btn'),
    resetTimerBtn: document.getElementById('reset-timer-btn'),
    zenModeBtn: document.getElementById('zen-mode-btn'),
    progressRing: document.querySelector('.progress-ring__circle'),
    timerDurationInput: document.getElementById('timer-duration'),
    setTimerBtn: document.getElementById('set-timer-btn'),
    focusTaskSelect: document.getElementById('focus-task-select'),
    subjectInput: document.getElementById('subject-input'),
    timeInput: document.getElementById('time-input'),
    taskDate: document.getElementById('task-date'),
    addTaskBtn: document.getElementById('add-task-btn'),
    taskList: document.getElementById('task-list'),
    pendingCount: document.getElementById('pending-count'),
    totalFocusTime: document.getElementById('total-focus-time'),
    backupBtn: document.getElementById('backup-btn'),
    sounds: {
        access: document.getElementById('access-granted-sound'),
        mission: document.getElementById('mission-complete-sound')
    }
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    startSystemSequence();
    setupEventListeners();
    renderTasks();
    updateDashboardStats();
    initCharts();
    populateFocusSelect();

    // Set initial timer circle
    const radius = elements.progressRing.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    elements.progressRing.style.strokeDasharray = `${circumference} ${circumference}`;
    elements.progressRing.style.strokeDashoffset = 0;
});

// --- SYSTEM SEQUENCE ---
function startSystemSequence() {
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 5;
        if (progress > 100) progress = 100;

        if (elements.loadingProgress) elements.loadingProgress.style.width = `${progress}%`;

        if (elements.loadingText) {
            if (progress < 30) elements.loadingText.textContent = "LOADING KERNEL...";
            else if (progress < 60) elements.loadingText.textContent = "MOUNTING FILE SYSTEM...";
            else if (progress < 90) elements.loadingText.textContent = "ESTABLISHING NEURAL LINK...";
            else elements.loadingText.textContent = "SYSTEM READY";
        }

        if (progress >= 100) {
            clearInterval(interval);
            setTimeout(() => unlockSystem(true), 500);
        }
    }, 100);

    // Fallback to unlock if something hangs
    setTimeout(() => {
        if (!state.isAuthenticated) unlockSystem(false);
    }, 5000);
}

function unlockSystem(playSound) {
    state.isAuthenticated = true;

    if (elements.lockScreen) elements.lockScreen.classList.add('unlocked');
    if (elements.appContainer) elements.appContainer.classList.remove('hidden');

    if (playSound && elements.sounds.access) {
        elements.sounds.access.play().catch(e => console.log("Audio play failed:", e));
    }
}

// --- NAVIGATION ---
function setupEventListeners() {
    // Navigation
    if (elements.navLinks) {
        elements.navLinks.forEach(link => {
            link.addEventListener('click', () => {
                const view = link.getAttribute('data-view');
                switchView(view);
                if (view === 'focus-hub') {
                    populateFocusSelect();
                }
            });
        });
    }

    // AI
    if (elements.sendAiBtn) elements.sendAiBtn.addEventListener('click', handleAiQuery);
    if (elements.aiInput) elements.aiInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAiQuery();
    });

    // Timer
    if (elements.startTimerBtn) elements.startTimerBtn.addEventListener('click', toggleTimer);
    if (elements.resetTimerBtn) elements.resetTimerBtn.addEventListener('click', resetTimer);
    if (elements.zenModeBtn) elements.zenModeBtn.addEventListener('click', toggleZenMode);
    if (elements.setTimerBtn) elements.setTimerBtn.addEventListener('click', setTimer);
    if (elements.focusTaskSelect) elements.focusTaskSelect.addEventListener('change', handleTaskSelect);

    // Planner
    if (elements.addTaskBtn) elements.addTaskBtn.addEventListener('click', addTask);
    if (elements.backupBtn) elements.backupBtn.addEventListener('click', backupData);
}

function switchView(viewId) {
    // Update Nav
    if (elements.navLinks) {
        elements.navLinks.forEach(link => {
            if (link.getAttribute('data-view') === viewId) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    // Update Sections
    if (elements.sections) {
        elements.sections.forEach(section => {
            if (section.id === viewId) {
                section.classList.add('active');
            } else {
                section.classList.remove('active');
            }
        });
    }
}

// --- AI ORACLE ---
async function handleAiQuery() {
    const prompt = elements.aiInput.value.trim();
    if (!prompt) return;

    // Add User Message
    addMessageToChat('USER', prompt);
    elements.aiInput.value = '';

    // Add Loading Message
    const loadingId = 'loading-' + Date.now();
    addMessageToChat('SYS', 'Processing query...', loadingId);

    try {
        const responseText = await askGemini(prompt);
        // Remove loading
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();

        // Type response
        const aiMsgContainer = document.createElement('div');
        aiMsgContainer.className = 'message ai';
        aiMsgContainer.innerHTML = '<span class="prefix">ORACLE:</span> <span class="content"></span>';
        elements.chatHistory.appendChild(aiMsgContainer);

        const contentEl = aiMsgContainer.querySelector('.content');
        await typeText(contentEl, responseText);

        // Parse Markdown after typing
        if (typeof marked !== 'undefined') {
            contentEl.innerHTML = marked.parse(responseText);
        } else {
            contentEl.textContent = responseText; // Fallback
        }

    } catch (error) {
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();
        addMessageToChat('SYS', '⚠ Connection Lost. Check API Key.');
        console.error(error);
    }
}

async function askGemini(prompt) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }]
        })
    });

    if (!response.ok) throw new Error('API Request Failed');

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

function addMessageToChat(sender, text, id = null) {
    const div = document.createElement('div');
    div.className = `message ${sender.toLowerCase()}`;
    if (id) div.id = id;
    div.innerHTML = `<span class="prefix">${sender}:</span> ${text}`;
    elements.chatHistory.appendChild(div);
    elements.chatHistory.scrollTop = elements.chatHistory.scrollHeight;
}

function typeText(element, text) {
    return new Promise(resolve => {
        let i = 0;
        const interval = setInterval(() => {
            element.textContent += text.charAt(i);
            i++;
            elements.chatHistory.scrollTop = elements.chatHistory.scrollHeight;
            if (i >= text.length) {
                clearInterval(interval);
                resolve();
            }
        }, 10);
    });
}

// --- FOCUS HUB ---
function populateFocusSelect() {
    if (!elements.focusTaskSelect) return;

    elements.focusTaskSelect.innerHTML = '<option value="">-- FREESTYLE MODE --</option>';

    // Filter incomplete tasks
    const incompleteTasks = state.tasks.filter(t => !t.completed);

    incompleteTasks.forEach(task => {
        const option = document.createElement('option');
        option.value = task.id;
        option.textContent = `${task.subject} (${task.time}m)`;
        elements.focusTaskSelect.appendChild(option);
    });
}

function handleTaskSelect() {
    const taskId = elements.focusTaskSelect.value;
    if (taskId) {
        const task = state.tasks.find(t => t.id == taskId);
        if (task) {
            elements.timerDurationInput.value = task.time;
            setTimer();
        }
    }
}

function setTimer() {
    const minutes = parseInt(elements.timerDurationInput.value);
    if (minutes > 0 && minutes <= 120) {
        state.initialTime = minutes * 60;
        resetTimer();
    } else {
        alert("Please enter a duration between 1 and 120 minutes.");
    }
}

function toggleTimer() {
    if (state.isTimerRunning) {
        clearInterval(state.timerInterval);
        state.isTimerRunning = false;
        elements.startTimerBtn.textContent = "RESUME";
    } else {
        state.isTimerRunning = true;
        elements.startTimerBtn.textContent = "PAUSE";
        state.timerInterval = setInterval(() => {
            state.timeLeft--;
            updateTimerDisplay();

            if (state.timeLeft <= 0) {
                completeTimer();
            }
        }, 1000);
    }
}

function resetTimer() {
    clearInterval(state.timerInterval);
    state.isTimerRunning = false;
    state.timeLeft = state.initialTime;
    elements.startTimerBtn.textContent = "INITIALIZE";
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const minutes = Math.floor(state.timeLeft / 60);
    const seconds = state.timeLeft % 60;
    elements.timeLeft.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // Update Circle
    const radius = elements.progressRing.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (state.timeLeft / state.initialTime) * circumference;
    elements.progressRing.style.strokeDashoffset = offset;
}

function completeTimer() {
    clearInterval(state.timerInterval);
    state.isTimerRunning = false;
    elements.sounds.mission.play().catch(e => { });

    // Log stats
    state.focusTime += Math.floor(state.initialTime / 60);
    localStorage.setItem('chronos_focus_time', state.focusTime);

    // Complete Task if selected
    const selectedTaskId = elements.focusTaskSelect.value;
    if (selectedTaskId) {
        const task = state.tasks.find(t => t.id == selectedTaskId);
        if (task) {
            task.completed = true;
            saveTasks();
            renderTasks();
            populateFocusSelect(); // Refresh list
            alert(`MISSION COMPLETE: ${task.subject} COMPLETED.`);
        }
    } else {
        alert("MISSION COMPLETE. FOCUS CYCLE FINISHED.");
    }

    updateDashboardStats();
    resetTimer();
}

function toggleZenMode() {
    document.body.classList.toggle('zen-mode');
    state.zenMode = !state.zenMode;
    elements.zenModeBtn.textContent = state.zenMode ? "EXIT ZEN" : "ZEN MODE";
}

// --- PLANNER ---
function addTask() {
    const subject = elements.subjectInput.value.trim();
    const time = parseInt(elements.timeInput.value);
    const date = elements.taskDate.value;

    if (!subject || !time || !date) {
        alert("Please fill in Subject, Time, and Date.");
        return;
    }

    const task = {
        id: Date.now(),
        subject,
        time,
        date,
        completed: false
    };

    state.tasks.push(task);
    saveTasks();
    renderTasks();
    updateCharts();
    populateFocusSelect();

    elements.subjectInput.value = '';
    elements.timeInput.value = '';
}

function toggleTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        saveTasks();
        renderTasks();
        populateFocusSelect();
    }
}

function deleteTask(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveTasks();
    renderTasks();
    updateCharts();
    populateFocusSelect();
}

function saveTasks() {
    localStorage.setItem('chronos_tasks', JSON.stringify(state.tasks));
    updateDashboardStats();
}

function renderTasks() {
    elements.taskList.innerHTML = '';

    // Sort by date
    const sortedTasks = [...state.tasks].sort((a, b) => {
        return new Date(a.date) - new Date(b.date);
    });

    sortedTasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        li.innerHTML = `
            <div onclick="toggleTask(${task.id})" style="cursor: pointer; flex: 1;">
                <span style="font-weight: bold; color: var(--primary-color);">${task.subject}</span>
                <span style="margin-left: 10px;">${task.time}m</span>
                <small style="color: #666; margin-left: 10px;">${task.date}</small>
            </div>
            <button class="delete-btn" onclick="deleteTask(${task.id})"><i data-lucide="trash-2"></i></button>
        `;
        elements.taskList.appendChild(li);
    });

    lucide.createIcons();
}

// --- ANALYTICS ---
function updateDashboardStats() {
    const pending = state.tasks.filter(t => !t.completed).length;
    elements.pendingCount.textContent = pending;

    const hours = Math.floor(state.focusTime / 60);
    const mins = state.focusTime % 60;
    elements.totalFocusTime.textContent = `${hours}h ${mins}m`;
}

let subjectChartInstance = null;
let activityChartInstance = null;

function initCharts() {
    if (typeof Chart === 'undefined') {
        console.error("Chart.js not loaded");
        return;
    }

    // Activity Chart (Dummy Data for visual)
    const ctxActivity = document.getElementById('activityChart').getContext('2d');
    activityChartInstance = new Chart(ctxActivity, {
        type: 'bar',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Focus Hours',
                data: [2, 4, 1, 5, 3, 6, 2],
                backgroundColor: 'rgba(0, 243, 255, 0.5)',
                borderColor: '#00f3ff',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: '#e0e0e0' } }
            },
            scales: {
                y: { ticks: { color: '#e0e0e0' }, grid: { color: '#333' } },
                x: { ticks: { color: '#e0e0e0' }, grid: { color: '#333' } }
            }
        }
    });

    // Subject Chart (Dynamic)
    const ctxSubject = document.getElementById('subjectChart').getContext('2d');
    subjectChartInstance = new Chart(ctxSubject, {
        type: 'pie',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    'rgba(0, 243, 255, 0.7)',
                    'rgba(189, 0, 255, 0.7)',
                    'rgba(255, 0, 100, 0.7)',
                    'rgba(255, 255, 0, 0.7)',
                    'rgba(0, 255, 100, 0.7)',
                    'rgba(255, 165, 0, 0.7)',
                    'rgba(138, 43, 226, 0.7)',
                    'rgba(0, 128, 128, 0.7)',
                    'rgba(255, 20, 147, 0.7)',
                    'rgba(50, 205, 50, 0.7)'
                ],
                borderColor: '#000',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: '#e0e0e0' } },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            let value = context.raw;
                            let total = context.chart._metasets[context.datasetIndex].total;
                            let percentage = Math.round((value / total) * 100) + '%';
                            return label + value + 'm (' + percentage + ')';
                        }
                    }
                }
            }
        }
    });

    updateCharts();
}

function updateCharts() {
    if (!subjectChartInstance) return;

    // Filter tasks for TODAY
    const today = new Date().toISOString().split('T')[0];
    const todaysTasks = state.tasks.filter(t => t.date === today);

    // Group by Subject
    const subjectMap = {};
    todaysTasks.forEach(task => {
        if (subjectMap[task.subject]) {
            subjectMap[task.subject] += task.time;
        } else {
            subjectMap[task.subject] = task.time;
        }
    });

    // Update Chart Data
    subjectChartInstance.data.labels = Object.keys(subjectMap);
    subjectChartInstance.data.datasets[0].data = Object.values(subjectMap);
    subjectChartInstance.update();
}

function backupData() {
    const data = {
        tasks: state.tasks,
        focusTime: state.focusTime,
        pin: localStorage.getItem('chronos_pin')
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chronos_backup.json';
    a.click();
    URL.revokeObjectURL(url);
}

// Expose functions to global scope for HTML onclick handlers
window.toggleTask = toggleTask;
window.deleteTask = deleteTask;
