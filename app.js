// ============================================
// DATA LAYER - localStorage persistence
// ============================================
const DB = {
    get(key) { return JSON.parse(localStorage.getItem('studyflow_' + key) || '[]'); },
    set(key, data) { localStorage.setItem('studyflow_' + key, JSON.stringify(data)); },
};

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    setTodayDate();
    updateDateDisplay();
    refreshReportPage();
    renderTargets();
    renderPlanner();
    renderGoals();
    renderNotes();
    updateStreak();
});

function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('log-date');
    if (dateInput) dateInput.value = today;
}

function updateDateDisplay() {
    const el = document.getElementById('current-date');
    const now = new Date();
    el.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

// ============================================
// NAVIGATION
// ============================================
function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');

    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.nav-btn[data-page="${pageId}"]`).classList.add('active');

    const titles = {
        report: 'Study Report',
        targets: 'Targets',
        planner: 'Study Planner',
        goals: 'Goal Tracker',
        notes: 'Notes',
    };
    document.getElementById('page-title').textContent = titles[pageId];
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2800);
}

// ============================================
// PAGE 1: STUDY REPORT
// ============================================
function logSession(e) {
    e.preventDefault();
    const session = {
        id: Date.now(),
        subject: document.getElementById('log-subject').value.trim(),
        duration: parseInt(document.getElementById('log-duration').value),
        date: document.getElementById('log-date').value,
        quality: document.getElementById('log-quality').value,
    };
    const sessions = DB.get('sessions');
    sessions.unshift(session);
    DB.set('sessions', sessions);
    e.target.reset();
    setTodayDate();
    refreshReportPage();
    updateStreak();
    showToast('✅ Session logged successfully!');
}

function deleteSession(id) {
    let sessions = DB.get('sessions');
    sessions = sessions.filter(s => s.id !== id);
    DB.set('sessions', sessions);
    refreshReportPage();
    showToast('🗑️ Session deleted');
}

function clearAllSessions() {
    if (confirm('Are you sure you want to clear all sessions? This cannot be undone.')) {
        DB.set('sessions', []);
        refreshReportPage();
        showToast('🗑️ All sessions cleared');
    }
}

function refreshReportPage() {
    const sessions = DB.get('sessions');
    updateStats(sessions);
    renderWeeklyChart(sessions);
    renderSubjectDonut(sessions);
    renderSessionsTable(sessions);
}

function updateStats(sessions) {
    const today = new Date().toISOString().split('T')[0];
    const todayMins = sessions.filter(s => s.date === today).reduce((sum, s) => sum + s.duration, 0);

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekMins = sessions.filter(s => s.date >= weekStartStr).reduce((sum, s) => sum + s.duration, 0);

    const subjects = new Set(sessions.map(s => s.subject));

    document.getElementById('stat-today').textContent = formatDuration(todayMins);
    document.getElementById('stat-week').textContent = formatDuration(weekMins);
    document.getElementById('stat-sessions').textContent = sessions.length;
    document.getElementById('stat-subjects').textContent = subjects.size;
}

function formatDuration(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
}

function renderWeeklyChart(sessions) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const weekData = Array(7).fill(0);

    sessions.forEach(s => {
        const d = new Date(s.date);
        const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
        if (diff >= 0 && diff < 7) {
            weekData[d.getDay()] += s.duration;
        }
    });

    const maxVal = Math.max(...weekData, 60);
    const chartEl = document.getElementById('weekly-chart');
    const labelsEl = document.getElementById('weekly-labels');

    chartEl.innerHTML = weekData.map((val, i) => `
        <div class="bar-wrapper">
            <div class="bar" style="height: ${(val / maxVal) * 100}%">
                ${val > 0 ? `<span class="bar-value">${formatDuration(val)}</span>` : ''}
            </div>
        </div>
    `).join('');

    labelsEl.innerHTML = days.map(d => `<span>${d}</span>`).join('');
}

function renderSubjectDonut(sessions) {
    const subjectMap = {};
    sessions.forEach(s => {
        subjectMap[s.subject] = (subjectMap[s.subject] || 0) + s.duration;
    });

    const entries = Object.entries(subjectMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const total = entries.reduce((sum, [, v]) => sum + v, 0) || 1;

    const colors = ['#6366f1', '#a855f7', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444'];
    const donutEl = document.getElementById('subject-donut');
    const legendEl = document.getElementById('donut-legend');

    if (entries.length === 0) {
        donutEl.style.background = 'var(--bg-input)';
        legendEl.innerHTML = '<span style="color:var(--text-muted);font-size:0.82rem">No data yet</span>';
        return;
    }

    let gradient = '';
    let offset = 0;
    entries.forEach(([, val], i) => {
        const pct = (val / total) * 100;
        gradient += `${colors[i]} ${offset}% ${offset + pct}%, `;
        offset += pct;
    });
    donutEl.style.background = `conic-gradient(${gradient.slice(0, -2)})`;
    donutEl.style.mask = 'radial-gradient(circle 42px, transparent 100%, black 100%)';
    donutEl.style.webkitMask = 'radial-gradient(circle 42px, transparent 100%, black 100%)';

    legendEl.innerHTML = entries.map(([name, val], i) => `
        <div class="legend-item">
            <span class="legend-dot" style="background:${colors[i]}"></span>
            <span class="legend-label">${name}</span>
            <span class="legend-value">${formatDuration(val)}</span>
        </div>
    `).join('');
}

function renderSessionsTable(sessions) {
    const tbody = document.getElementById('sessions-table');
    const emptyEl = document.getElementById('sessions-empty');

    if (sessions.length === 0) {
        tbody.innerHTML = '';
        emptyEl.style.display = 'block';
        return;
    }
    emptyEl.style.display = 'none';

    tbody.innerHTML = sessions.slice(0, 20).map(s => `
        <tr>
            <td>${new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
            <td style="font-weight:600;color:var(--text-primary)">${s.subject}</td>
            <td>${formatDuration(s.duration)}</td>
            <td><span class="quality-badge quality-${s.quality}">${s.quality}</span></td>
            <td>
                <button class="delete-btn" onclick="deleteSession(${s.id})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>
            </td>
        </tr>
    `).join('');
}

// ============================================
// STREAK TRACKER
// ============================================
function updateStreak() {
    const sessions = DB.get('sessions');
    const dates = [...new Set(sessions.map(s => s.date))].sort().reverse();
    let streak = 0;
    const today = new Date();

    for (let i = 0; i < 365; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        const dateStr = checkDate.toISOString().split('T')[0];
        if (dates.includes(dateStr)) {
            streak++;
        } else if (i > 0) {
            break;
        }
    }
    document.getElementById('streak-count').textContent = `${streak} day streak`;
}

// ============================================
// PAGE 2: TARGETS
// ============================================
function addTarget(e) {
    e.preventDefault();
    const target = {
        id: Date.now(),
        name: document.getElementById('target-name').value.trim(),
        subject: document.getElementById('target-subject').value.trim(),
        hoursPerDay: parseFloat(document.getElementById('target-hours').value),
        deadline: document.getElementById('target-deadline').value,
        createdAt: new Date().toISOString().split('T')[0],
    };
    const targets = DB.get('targets');
    targets.unshift(target);
    DB.set('targets', targets);
    e.target.reset();
    renderTargets();
    showToast('🎯 Target added!');
}

function deleteTarget(id) {
    let targets = DB.get('targets');
    targets = targets.filter(t => t.id !== id);
    DB.set('targets', targets);
    renderTargets();
    showToast('🗑️ Target removed');
}

function renderTargets() {
    const targets = DB.get('targets');
    const container = document.getElementById('targets-list');
    const emptyEl = document.getElementById('targets-empty');

    if (targets.length === 0) {
        container.innerHTML = '';
        container.appendChild(emptyEl);
        emptyEl.style.display = 'block';
        return;
    }
    emptyEl.style.display = 'none';

    const sessions = DB.get('sessions');

    container.innerHTML = targets.map(t => {
        const relevantSessions = sessions.filter(s => s.subject.toLowerCase() === t.subject.toLowerCase() && s.date >= t.createdAt);
        const totalHoursStudied = relevantSessions.reduce((sum, s) => sum + s.duration, 0) / 60;

        const start = new Date(t.createdAt);
        const end = new Date(t.deadline);
        const totalDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
        const totalHoursNeeded = totalDays * t.hoursPerDay;
        const progress = Math.min(100, Math.round((totalHoursStudied / totalHoursNeeded) * 100));

        const circumference = 2 * Math.PI * 22;
        const dashOffset = circumference - (progress / 100) * circumference;

        const daysLeft = Math.max(0, Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24)));

        return `
            <div class="target-card">
                <div class="target-progress-ring">
                    <svg viewBox="0 0 50 50">
                        <circle class="ring-bg" cx="25" cy="25" r="22"/>
                        <circle class="ring-fill" cx="25" cy="25" r="22" stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"/>
                    </svg>
                    <span class="target-percent">${progress}%</span>
                </div>
                <div class="target-info">
                    <div class="target-name">${t.name}</div>
                    <div class="target-meta">
                        <span>📚 ${t.subject}</span>
                        <span>⏱ ${t.hoursPerDay}h/day</span>
                        <span>📅 ${daysLeft} days left</span>
                    </div>
                </div>
                <div class="target-actions">
                    <button class="delete-btn" onclick="deleteTarget(${t.id})">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// PAGE 3: STUDY PLANNER
// ============================================
function addPlannerItem(e) {
    e.preventDefault();
    const item = {
        id: Date.now(),
        day: document.getElementById('planner-day').value,
        time: document.getElementById('planner-time').value,
        task: document.getElementById('planner-task').value.trim(),
        duration: parseInt(document.getElementById('planner-dur').value),
    };
    const planner = DB.get('planner');
    planner.push(item);
    DB.set('planner', planner);
    e.target.reset();
    renderPlanner();
    showToast('📅 Added to planner!');
}

function deletePlannerItem(id) {
    let planner = DB.get('planner');
    planner = planner.filter(p => p.id !== id);
    DB.set('planner', planner);
    renderPlanner();
}

function renderPlanner() {
    const planner = DB.get('planner');
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const container = document.getElementById('planner-grid');

    container.innerHTML = days.map(day => {
        const items = planner.filter(p => p.day === day).sort((a, b) => a.time.localeCompare(b.time));
        return `
            <div class="planner-day-card">
                <div class="planner-day-header">${day}</div>
                <div class="planner-items">
                    ${items.length === 0 ? '<div class="planner-empty">No tasks scheduled</div>' :
                    items.map(item => `
                        <div class="planner-item">
                            <span class="planner-item-time">${formatTime12(item.time)}</span>
                            <span class="planner-item-task">${item.task}</span>
                            <span class="planner-item-dur">${item.duration}m</span>
                            <button class="delete-btn" onclick="deletePlannerItem(${item.id})">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function formatTime12(time24) {
    const [h, m] = time24.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
}

// ============================================
// PAGE 4: GOAL TRACKER & TIMER
// ============================================

// --- Timer ---
let timerInterval = null;
let timerTotalSeconds = 25 * 60;
let timerRemaining = 25 * 60;
let timerRunning = false;

function setTimerPreset(mins) {
    if (timerRunning) return;
    timerTotalSeconds = mins * 60;
    timerRemaining = mins * 60;
    updateTimerDisplay();
    updateTimerProgress();

    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
}

function startTimer() {
    if (timerRunning) return;
    timerRunning = true;
    document.getElementById('timer-start').style.display = 'none';
    document.getElementById('timer-pause').style.display = 'inline-flex';
    document.getElementById('timer-label').textContent = 'Studying...';

    timerInterval = setInterval(() => {
        timerRemaining--;
        updateTimerDisplay();
        updateTimerProgress();

        if (timerRemaining <= 0) {
            clearInterval(timerInterval);
            timerRunning = false;
            document.getElementById('timer-start').style.display = 'inline-flex';
            document.getElementById('timer-pause').style.display = 'none';
            document.getElementById('timer-label').textContent = 'Session Complete! 🎉';
            showToast('🎉 Timer complete! Great study session!');

            // Auto-log this session
            if (confirm('Timer finished! Do you want to log this as a study session?')) {
                const subject = prompt('Which subject did you study?', 'General');
                if (subject) {
                    const session = {
                        id: Date.now(),
                        subject: subject,
                        duration: Math.round(timerTotalSeconds / 60),
                        date: new Date().toISOString().split('T')[0],
                        quality: 'good',
                    };
                    const sessions = DB.get('sessions');
                    sessions.unshift(session);
                    DB.set('sessions', sessions);
                    refreshReportPage();
                    updateStreak();
                    showToast('✅ Session auto-logged!');
                }
            }
            resetTimer();
        }
    }, 1000);
}

function pauseTimer() {
    clearInterval(timerInterval);
    timerRunning = false;
    document.getElementById('timer-start').style.display = 'inline-flex';
    document.getElementById('timer-pause').style.display = 'none';
    document.getElementById('timer-label').textContent = 'Paused';
}

function resetTimer() {
    clearInterval(timerInterval);
    timerRunning = false;
    timerRemaining = timerTotalSeconds;
    updateTimerDisplay();
    updateTimerProgress();
    document.getElementById('timer-start').style.display = 'inline-flex';
    document.getElementById('timer-pause').style.display = 'none';
    document.getElementById('timer-label').textContent = 'Focus Time';
}

function updateTimerDisplay() {
    const mins = Math.floor(timerRemaining / 60);
    const secs = timerRemaining % 60;
    document.getElementById('timer-display').textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateTimerProgress() {
    const circumference = 2 * Math.PI * 90;
    const progress = timerRemaining / timerTotalSeconds;
    const offset = circumference * (1 - progress);
    document.getElementById('timer-progress').style.strokeDasharray = circumference;
    document.getElementById('timer-progress').style.strokeDashoffset = offset;
}

// --- Goals ---
function addGoal(e) {
    e.preventDefault();
    const goal = {
        id: Date.now(),
        text: document.getElementById('goal-text').value.trim(),
        priority: document.getElementById('goal-priority').value,
        completed: false,
    };
    const goals = DB.get('goals');
    goals.unshift(goal);
    DB.set('goals', goals);
    e.target.reset();
    renderGoals();
    showToast('⭐ Goal created!');
}

function toggleGoal(id) {
    const goals = DB.get('goals');
    const goal = goals.find(g => g.id === id);
    if (goal) goal.completed = !goal.completed;
    DB.set('goals', goals);
    renderGoals();
}

function deleteGoal(id) {
    let goals = DB.get('goals');
    goals = goals.filter(g => g.id !== id);
    DB.set('goals', goals);
    renderGoals();
    showToast('🗑️ Goal removed');
}

function renderGoals() {
    const goals = DB.get('goals');
    const container = document.getElementById('goals-list');
    const emptyEl = document.getElementById('goals-empty');

    if (goals.length === 0) {
        container.innerHTML = '';
        container.appendChild(emptyEl);
        emptyEl.style.display = 'block';
        return;
    }
    emptyEl.style.display = 'none';

    // Sort: incomplete first, then completed
    const sorted = [...goals].sort((a, b) => a.completed - b.completed);

    container.innerHTML = sorted.map(g => `
        <div class="goal-card ${g.completed ? 'completed' : ''}">
            <div class="goal-checkbox ${g.completed ? 'checked' : ''}" onclick="toggleGoal(${g.id})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <span class="goal-text">${g.text}</span>
            <span class="priority-badge priority-${g.priority}">${g.priority}</span>
            <button class="delete-btn" onclick="deleteGoal(${g.id})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
        </div>
    `).join('');
}

// ============================================
// PAGE 5: NOTES
// ============================================
function addNote(e) {
    e.preventDefault();
    const note = {
        id: Date.now(),
        title: document.getElementById('note-title').value.trim(),
        category: document.getElementById('note-category').value,
        content: document.getElementById('note-content').value.trim(),
        date: new Date().toISOString(),
    };
    const notes = DB.get('notes');
    notes.unshift(note);
    DB.set('notes', notes);
    e.target.reset();
    renderNotes();
    showToast('📝 Note saved!');
}

function deleteNote(id) {
    let notes = DB.get('notes');
    notes = notes.filter(n => n.id !== id);
    DB.set('notes', notes);
    renderNotes();
    showToast('🗑️ Note deleted');
}

let currentNoteFilter = 'all';

function filterNotes(category) {
    currentNoteFilter = category;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    renderNotes();
}

function renderNotes() {
    const notes = DB.get('notes');
    const filtered = currentNoteFilter === 'all' ? notes : notes.filter(n => n.category === currentNoteFilter);
    const container = document.getElementById('notes-grid');
    const emptyEl = document.getElementById('notes-empty');

    if (filtered.length === 0) {
        container.innerHTML = '';
        container.appendChild(emptyEl);
        emptyEl.style.display = 'block';
        return;
    }
    emptyEl.style.display = 'none';

    const categoryColors = {
        general: '#6366f1',
        math: '#a855f7',
        science: '#06b6d4',
        english: '#22c55e',
        history: '#f59e0b',
        other: '#ef4444',
    };

    container.innerHTML = filtered.map(n => `
        <div class="note-card">
            <button class="delete-btn" onclick="deleteNote(${n.id})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
            <span class="note-category-tag" style="background:${categoryColors[n.category]}20;color:${categoryColors[n.category]}">${n.category}</span>
            <div class="note-card-title">${n.title}</div>
            <div class="note-card-content">${n.content}</div>
            <div class="note-card-date">${new Date(n.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
    `).join('');
}
