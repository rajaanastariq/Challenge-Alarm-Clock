// ---------------- Global State ----------------
let alarms = [];
let sounds = [];
let currentUser = null;
let activeAlarmAudio = null;
let activeAlarm = null;
let challengeTimeout = null;
let answerTimeout = null;

const CHALLENGE_DELAY = 2 * 60 * 1000; // 2 minutes to show challenge
const ANSWER_TIMEOUT = 2 * 60 * 1000; // 2 minutes to answer

// Map default alarm names to actual audio files
const SOUND_MAP = {
    default: "/static/sounds/default.mp3",
    gentle: "/static/sounds/gentle.mp3",
    intense: "/static/sounds/intense.mp3",
    birds: "/static/sounds/birds.mp3"
};

// ---------------- Mobile Menu Toggle ----------------
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const mobileOverlay = document.getElementById('mobileOverlay');
const sidebar = document.getElementById('sidebar');

if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', toggleMobileMenu);
}

if (mobileOverlay) {
    mobileOverlay.addEventListener('click', closeMobileMenu);
}

function toggleMobileMenu() {
    mobileMenuToggle.classList.toggle('active');
    sidebar.classList.toggle('mobile-active');
    mobileOverlay.classList.toggle('active');
    document.body.style.overflow = sidebar.classList.contains('mobile-active') ? 'hidden' : '';
}

function closeMobileMenu() {
    mobileMenuToggle.classList.remove('active');
    sidebar.classList.remove('mobile-active');
    mobileOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

// ---------------- Helpers ----------------
async function fetchJSON(url, opts = {}) {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error("Network error");
    return res.json();
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Convert 24-hour time to 12-hour format
function convertTo12Hour(time24) {
    const [h24, m] = time24.split(':').map(Number);
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    let h12 = h24 % 12;
    h12 = h12 ? h12 : 12;
    return `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
}

// ---------------- Clock (12-hour format) ----------------
function updateClock() {
    const now = new Date();
    let h = now.getHours();
    const m = now.getMinutes().toString().padStart(2, "0");
    const s = now.getSeconds().toString().padStart(2, "0");

    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12; // 0 should be 12
    const hh = h.toString().padStart(2, "0");

    document.getElementById("currentTime").textContent = `${hh}:${m}:${s} ${ampm}`;
}
updateClock();
setInterval(updateClock, 1000);

// ---------------- Sidebar Navigation ----------------
document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", () => {
        document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
        link.classList.add("active");

        const page = link.dataset.page;
        document.querySelectorAll(".page").forEach(p => {
            p.classList.toggle("active", p.id === page);
        });

        // Close mobile menu after navigation
        if (window.innerWidth <= 768) {
            closeMobileMenu();
        }
    });
});

// ---------------- User Account ----------------
async function loadCurrentUser() {
    try {
        const data = await fetchJSON("/api/account");
        if (data.logged_in) {
            currentUser = data.user;
            document.getElementById("loginArea").style.display = "none";
            document.getElementById("loggedArea").style.display = "flex";
            document.getElementById("userPhone").textContent = currentUser.phone;
            await loadAlarms();
            await loadSounds();
            await loadStatistics();
        } else {
            currentUser = null;
            document.getElementById("loginArea").style.display = "flex";
            document.getElementById("loggedArea").style.display = "none";
        }
    } catch (err) {
        console.error(err);
    }
}

window.registerOrLogin = async function () {
    const phone = document.getElementById("phoneInput").value.trim();
    if (!phone) return showToast("Phone number required", "error");
    try {
        await fetchJSON("/api/account/register", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ phone })
        });
        await loadCurrentUser();
        showToast("Logged in successfully!", "success");
    } catch {
        showToast("Login failed", "error");
    }
};

window.logout = async function () {
    await fetchJSON("/api/account/logout", { method: "POST" });
    showToast("Logged out successfully", "success");
    setTimeout(() => location.reload(), 1000);
};

// ---------------- Sounds ----------------
async function loadSounds() {
    try {
        const data = await fetchJSON("/api/user_sounds");
        sounds = data;
        updateSoundSelect();
    } catch (e) {
        console.error(e);
    }
}

function updateSoundSelect() {
    const select = document.getElementById("userSoundsSelect");
    select.innerHTML = '<option value="">— Choose uploaded sound —</option>';
    sounds.forEach(s => {
        const option = document.createElement("option");
        option.value = s.url;
        option.textContent = s.original_name;
        select.appendChild(option);
    });
}

window.openUploadModal = function () {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "audio/*";
    fileInput.onchange = () => uploadSound(fileInput.files[0]);
    fileInput.click();
};

async function uploadSound(file) {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
        const data = await fetchJSON("/api/upload_sound", {
            method: "POST",
            body: formData
        });
        if (data.sound) {
            sounds.push({ url: data.sound.url, original_name: file.name });
            updateSoundSelect();
            showToast("Sound uploaded successfully!", "success");
        } else if (data.error) showToast(data.error, "error");
    } catch {
        showToast("Upload failed", "error");
    }
}

// ---------------- Alarms ----------------
async function loadAlarms() {
    try {
        const data = await fetchJSON("/api/alarms");
        alarms = data.map(a => ({ ...a, triggered: false }));
        renderAlarms();
    } catch (e) {
        console.error(e);
    }
}

function renderAlarms() {
    const list = document.getElementById("alarmList");
    list.innerHTML = "";
    if (!alarms.length) {
        list.innerHTML = '<p class="empty-state">No alarms yet. Create your first alarm!</p>';
        return;
    }
    alarms.forEach(a => {
        const div = document.createElement("div");
        div.className = "alarm-item";

        // Convert 24-hour time to 12-hour format for display
        const time12 = convertTo12Hour(a.time);

        div.innerHTML = `
            <div class="alarm-item-left">
                <div class="alarm-time-display">⏰ ${time12}</div>
                <div class="alarm-details">
                    <span class="alarm-label-text">${a.label}</span>
                    <span class="alarm-challenge-badge">${a.challenge_type === 'math' ? '🧮 Math' : '✍️ Sentence'}</span>
                </div>
            </div>
            <div class="alarm-item-right">
                <button class="btn-delete">
                    <span class="delete-icon">🗑️</span>
                    <span class="delete-text">Delete</span>
                </button>
            </div>
        `;
        div.querySelector(".btn-delete").addEventListener("click", () => deleteAlarm(a.id));
        list.appendChild(div);
    });
}

// Handle alarm form
document.getElementById("alarmForm").addEventListener("submit", async e => {
    e.preventDefault();
    const timeInput = document.getElementById("alarmTime").value;
    const ampm = document.getElementById("ampm").value;
    const label = document.getElementById("alarmLabel").value || "Alarm";
    const challenge_type = document.getElementById("challengeType").value;
    const sound = document.getElementById("userSoundsSelect").value || document.getElementById("alarmSound").value;

    if (!timeInput) return showToast("Time required", "error");

    let [h, m] = timeInput.split(":").map(Number);
    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    const time = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;

    try {
        const data = await fetchJSON("/api/alarms", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ time, label, challenge_type, sound, enabled: true })
        });
        if (data.id) {
            alarms.push({ ...data, triggered: false });
            renderAlarms();
            showToast(`Alarm created for ${timeInput} ${ampm}!`, "success");
            document.getElementById("alarmForm").reset();
        } else if (data.error) showToast(data.error, "error");
    } catch {
        showToast("Error creating alarm", "error");
    }
});

async function deleteAlarm(id) {
    try {
        const data = await fetchJSON("/api/alarms", {
            method: "DELETE",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ id })
        });
        if (data.success) {
            alarms = alarms.filter(a => a.id !== id);
            renderAlarms();
            showToast("Alarm deleted", "success");
        }
    } catch {
        showToast("Delete failed", "error");
    }
}

// ---------------- Alarm Trigger ----------------
function checkAlarms() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();

    alarms.forEach(a => {
        if (!a.enabled) return;
        const [ah, am] = a.time.split(":").map(Number);

        if (ah === h && am === m && !a.triggered) {
            a.triggered = true;
            triggerAlarm(a);
        }

        if (!(ah === h && am === m)) {
            a.triggered = false;
        }
    });
}

async function triggerAlarm(alarm) {
    if (challengeTimeout) clearTimeout(challengeTimeout);
    if (answerTimeout) clearTimeout(answerTimeout);

    if (activeAlarmAudio) {
        activeAlarmAudio.pause();
        activeAlarmAudio = null;
    }

    // Get sound file - prioritize custom uploaded sounds
    let soundFile;
    if (alarm.sound && alarm.sound.startsWith('/')) {
        // Custom uploaded sound
        soundFile = alarm.sound;
    } else if (alarm.sound && SOUND_MAP[alarm.sound]) {
        // Default sound from SOUND_MAP
        soundFile = SOUND_MAP[alarm.sound];
    } else {
        // Fallback to default
        soundFile = SOUND_MAP.default;
    }

    activeAlarmAudio = new Audio(soundFile);
    activeAlarmAudio.loop = true;

    activeAlarmAudio.play().catch(() => {
        document.body.addEventListener("click", () => activeAlarmAudio.play(), { once: true });
    });

    recordEvent(alarm.id, "alarm_triggered");
    activeAlarm = alarm;

    showSnoozeStopOverlay();
}

setInterval(checkAlarms, 1000);

// ---------------- Snooze/Stop Overlay ----------------
function showSnoozeStopOverlay() {
    const old = document.getElementById("snoozeStopOverlay");
    if (old) old.remove();

    const overlay = document.createElement("div");
    overlay.id = "snoozeStopOverlay";
    overlay.className = "snooze-stop-overlay";

    overlay.innerHTML = `
        <div class="snooze-stop-content">
            <div class="alarm-ringing-icon">⏰</div>
            <div class="alarm-ringing-title">ALARM RINGING!</div>
            <div class="alarm-label-display">${activeAlarm.label}</div>
            <div class="snooze-stop-buttons">
                <button class="btn-snooze" id="btnSnooze">
                    😴 Snooze 5 min
                </button>
                <button class="btn-stop-alarm" id="btnStop">
                    ⏹️ Stop
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById("btnSnooze").onclick = () => {
        if (!activeAlarm) return;

        const next = new Date(Date.now() + 5 * 60 * 1000);
        const hh = next.getHours().toString().padStart(2, "0");
        const mm = next.getMinutes().toString().padStart(2, "0");

        activeAlarm.time = `${hh}:${mm}`;
        activeAlarm.triggered = false;
        recordEvent(activeAlarm.id, "snoozed");

        if (activeAlarmAudio) {
            activeAlarmAudio.pause();
            activeAlarmAudio = null;
        }

        overlay.remove();
        showToast("Alarm snoozed for 5 minutes", "success");
    };

    document.getElementById("btnStop").onclick = () => {
        recordEvent(activeAlarm.id, "stopped");
        overlay.remove();

        // Show waiting screen for 2 minutes before challenge
        showWaitingScreen();
        challengeTimeout = setTimeout(() => showChallengeModal(activeAlarm), CHALLENGE_DELAY);
    };
}

// ---------------- Waiting Screen (2 minutes before challenge) ----------------
function showWaitingScreen() {
    if (activeAlarmAudio) {
        activeAlarmAudio.pause();
        activeAlarmAudio = null;
    }

    const old = document.getElementById("waitingScreen");
    if (old) old.remove();

    const screen = document.createElement("div");
    screen.id = "waitingScreen";
    screen.style.position = "fixed";
    screen.style.top = 0;
    screen.style.left = 0;
    screen.style.width = "100%";
    screen.style.height = "100%";
    screen.style.backgroundColor = "rgba(11, 35, 64, 0.95)";
    screen.style.backdropFilter = "blur(10px)";
    screen.style.display = "flex";
    screen.style.justifyContent = "center";
    screen.style.alignItems = "center";
    screen.style.zIndex = 2500;
    screen.style.animation = "fadeIn 0.3s ease";
    screen.style.padding = "20px";

    const box = document.createElement("div");
    box.style.background = "rgba(14, 53, 86, 0.98)";
    box.style.border = "2px solid rgba(94, 166, 255, 0.3)";
    box.style.padding = "40px";
    box.style.borderRadius = "16px";
    box.style.textAlign = "center";
    box.style.maxWidth = "450px";
    box.style.width = "90%";
    box.style.boxShadow = "0 20px 60px rgba(0, 0, 0, 0.5)";

    box.innerHTML = `
        <div style="font-size: 64px; margin-bottom: 20px;">⏳</div>
        <div style="font-size: 24px; font-weight: 600; color: #5ea6ff; margin-bottom: 15px;">
            Preparing Your Challenge...
        </div>
        <div id="waitingTimer" style="font-size: 36px; color: #ffa502; font-weight: 700; margin-bottom: 15px;">
            2:00
        </div>
        <div style="font-size: 14px; color: rgba(234, 242, 255, 0.6);">
            Get ready to prove you're awake!
        </div>
    `;

    screen.appendChild(box);
    document.body.appendChild(screen);

    // Start countdown
    let remainingSeconds = 120;
    const timerInterval = setInterval(() => {
        remainingSeconds--;
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        const timerEl = document.getElementById("waitingTimer");
        if (timerEl) {
            timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }

        if (remainingSeconds <= 0) {
            clearInterval(timerInterval);
        }
    }, 1000);
}

// ---------------- Challenge Modal ----------------
function createChallengeModal() {
    if (document.getElementById("alarmModal")) return;

    const modal = document.createElement("div");
    modal.id = "alarmModal";
    modal.style.position = "fixed";
    modal.style.top = 0;
    modal.style.left = 0;
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.backgroundColor = "rgba(11, 35, 64, 0.95)";
    modal.style.backdropFilter = "blur(10px)";
    modal.style.display = "flex";
    modal.style.justifyContent = "center";
    modal.style.alignItems = "center";
    modal.style.zIndex = 3000;
    modal.style.animation = "fadeIn 0.3s ease";
    modal.style.padding = "20px";

    const box = document.createElement("div");
    box.style.background = "rgba(14, 53, 86, 0.98)";
    box.style.border = "2px solid rgba(94, 166, 255, 0.3)";
    box.style.padding = "30px";
    box.style.borderRadius = "16px";
    box.style.textAlign = "center";
    box.style.maxWidth = "450px";
    box.style.width = "90%";
    box.style.boxShadow = "0 20px 60px rgba(0, 0, 0, 0.5)";
    box.style.animation = "slideIn 0.4s ease";

    const title = document.createElement("div");
    title.textContent = "⏰ Wake-up Challenge";
    title.style.fontSize = "24px";
    title.style.fontWeight = "600";
    title.style.marginBottom = "20px";
    title.style.color = "#5ea6ff";
    box.appendChild(title);

    const question = document.createElement("div");
    question.id = "alarmQuestion";
    question.style.marginBottom = "20px";
    question.style.fontSize = "18px";
    question.style.color = "#eaf2ff";
    question.style.lineHeight = "1.5";
    question.style.wordBreak = "break-word";
    box.appendChild(question);

    const timer = document.createElement("div");
    timer.id = "challengeTimer";
    timer.style.marginBottom = "20px";
    timer.style.fontSize = "28px";
    timer.style.color = "#ff6b6b";
    timer.style.fontWeight = "700";
    timer.style.padding = "12px 20px";
    timer.style.background = "rgba(255, 107, 107, 0.1)";
    timer.style.borderRadius = "10px";
    timer.style.border = "2px solid rgba(255, 107, 107, 0.3)";
    box.appendChild(timer);

    const input = document.createElement("input");
    input.type = "text";
    input.id = "alarmAnswer";
    input.placeholder = "Type your answer here...";
    input.style.width = "100%";
    input.style.marginBottom = "20px";
    input.style.padding = "15px";
    input.style.fontSize = "16px";
    input.style.borderRadius = "10px";
    input.style.border = "2px solid rgba(94, 166, 255, 0.3)";
    input.style.background = "rgba(255, 255, 255, 0.05)";
    input.style.color = "#eaf2ff";
    input.style.fontFamily = "'Poppins', sans-serif";
    box.appendChild(input);

    input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") checkChallengeAnswer();
    });

    const btnCheck = document.createElement("button");
    btnCheck.textContent = "Submit Answer ✓";
    btnCheck.className = "btn-primary";
    btnCheck.style.padding = "14px 30px";
    btnCheck.style.fontSize = "16px";
    btnCheck.style.fontWeight = "600";
    btnCheck.style.cursor = "pointer";
    btnCheck.style.border = "none";
    btnCheck.style.borderRadius = "10px";
    btnCheck.style.background = "#5ea6ff";
    btnCheck.style.color = "#04263b";
    btnCheck.style.transition = "all 0.3s ease";
    btnCheck.style.width = "100%";
    btnCheck.onclick = checkChallengeAnswer;
    btnCheck.onmouseover = () => btnCheck.style.background = "#7bd3ff";
    btnCheck.onmouseout = () => btnCheck.style.background = "#5ea6ff";
    box.appendChild(btnCheck);

    const hint = document.createElement("div");
    hint.textContent = "You must answer correctly to dismiss the alarm";
    hint.style.marginTop = "15px";
    hint.style.fontSize = "12px";
    hint.style.color = "rgba(234, 242, 255, 0.5)";
    box.appendChild(hint);

    modal.appendChild(box);
    document.body.appendChild(modal);

    setTimeout(() => input.focus(), 100);
}

async function showChallengeModal(alarm) {
    if (!alarm) return;

    // Remove waiting screen
    const waitingScreen = document.getElementById("waitingScreen");
    if (waitingScreen) waitingScreen.remove();

    createChallengeModal();

    const ch = await fetchJSON(`/api/challenge?type=${alarm.challenge_type}`);
    const qEl = document.getElementById("alarmQuestion");
    qEl.textContent = ch.type === "math" ? `Solve: ${ch.question}` : `Type exactly: ${ch.sentence}`;
    qEl.dataset.correct = ch.answer || ch.sentence;
    document.getElementById("alarmAnswer").value = "";
    document.getElementById("alarmModal").style.display = "flex";

    startChallengeTimer();

    if (answerTimeout) clearTimeout(answerTimeout);
    answerTimeout = setTimeout(() => {
        handleTimeoutExpired();
    }, ANSWER_TIMEOUT);
}

function startChallengeTimer() {
    const timerEl = document.getElementById("challengeTimer");
    let remainingSeconds = ANSWER_TIMEOUT / 1000;

    const updateTimer = () => {
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        timerEl.textContent = `⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}`;

        if (remainingSeconds <= 30) {
            timerEl.style.color = "#ff4757";
            timerEl.style.animation = "pulse 1s infinite";
        } else if (remainingSeconds <= 60) {
            timerEl.style.color = "#ffa502";
        }

        if (remainingSeconds > 0) {
            remainingSeconds--;
            setTimeout(updateTimer, 1000);
        }
    };

    updateTimer();

    if (!document.getElementById("pulseAnimation")) {
        const style = document.createElement("style");
        style.id = "pulseAnimation";
        style.textContent = `
            @keyframes pulse {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.05); opacity: 0.8; }
            }
        `;
        document.head.appendChild(style);
    }
}

function handleTimeoutExpired() {
    const modal = document.getElementById("alarmModal");
    if (!modal) return;

    const box = modal.querySelector("div");

    box.innerHTML = `
        <div style="font-size: 64px; margin-bottom: 20px;">⏰</div>
        <div style="font-size: 24px; font-weight: 600; color: #ff6b6b; margin-bottom: 10px;">
            Time's Up!
        </div>
        <div style="font-size: 16px; color: rgba(234, 242, 255, 0.8); margin-bottom: 20px;">
            You didn't answer in time.<br>The alarm will ring again...
        </div>
        <div style="font-size: 14px; color: rgba(234, 242, 255, 0.5);">
            Restarting in 3 seconds...
        </div>
    `;

    recordEvent(activeAlarm.id, "timeout");

    setTimeout(() => {
        modal.remove();
        if (activeAlarm) {
            triggerAlarm(activeAlarm);
        }
    }, 3000);
}

function checkChallengeAnswer() {
    const input = document.getElementById("alarmAnswer");
    const correct = document.getElementById("alarmQuestion").dataset.correct.trim();

    if (input.value.trim() === correct) {
        if (answerTimeout) clearTimeout(answerTimeout);
        if (challengeTimeout) clearTimeout(challengeTimeout);

        showSuccessMessage();
        recordEvent(activeAlarm.id, "success");

        setTimeout(() => {
            dismissAlarm();
            loadStatistics();
        }, 1500);
    } else {
        const inputEl = document.getElementById("alarmAnswer");
        inputEl.style.animation = "shake 0.5s";
        inputEl.style.borderColor = "#ff4757";

        setTimeout(() => {
            inputEl.style.animation = "";
            inputEl.style.borderColor = "rgba(94, 166, 255, 0.3)";
        }, 500);

        showToast("Wrong answer! Try again", "error");
        recordEvent(activeAlarm.id, "failed");

        // After wrong answer, restart the alarm flow
        setTimeout(() => {
            const modal = document.getElementById("alarmModal");
            if (modal) modal.remove();
            if (activeAlarm) {
                triggerAlarm(activeAlarm);
            }
        }, 1500);

        if (!document.getElementById("shakeAnimation")) {
            const style = document.createElement("style");
            style.id = "shakeAnimation";
            style.textContent = `
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                    20%, 40%, 60%, 80% { transform: translateX(5px); }
                }
            `;
            document.head.appendChild(style);
        }
    }
}

function showSuccessMessage() {
    const modal = document.getElementById("alarmModal");
    const box = modal.querySelector("div");

    box.innerHTML = `
        <div style="font-size: 64px; margin-bottom: 20px;">✅</div>
        <div style="font-size: 24px; font-weight: 600; color: #5ea6ff; margin-bottom: 10px;">
            Success!
        </div>
        <div style="font-size: 16px; color: rgba(234, 242, 255, 0.8);">
            Alarm dismissed. Good morning! 🌅
        </div>
    `;
}

function dismissAlarm() {
    if (challengeTimeout) clearTimeout(challengeTimeout);
    if (answerTimeout) clearTimeout(answerTimeout);

    if (activeAlarmAudio) {
        activeAlarmAudio.pause();
        activeAlarmAudio = null;
    }

    const modal = document.getElementById("alarmModal");
    if (modal) modal.remove();

    const overlay = document.getElementById("snoozeStopOverlay");
    if (overlay) overlay.remove();

    const waitingScreen = document.getElementById("waitingScreen");
    if (waitingScreen) waitingScreen.remove();

    activeAlarm = null;
}

// ---------------- Statistics ----------------
async function loadStatistics() {
    try {
        const data = await fetchJSON("/api/statistics");
        document.getElementById("statTotal").textContent = data.total_alarms || 0;
        document.getElementById("statSuccess").textContent = data.successful_wakeups || 0;
        document.getElementById("statFailed").textContent = data.failed_attempts || 0;
        document.getElementById("statStreak").textContent = data.streak || 0;
    } catch (e) {
        console.error(e);
    }
}

async function recordEvent(alarm_id, event) {
    try {
        await fetch("/api/statistics", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ alarm_id, event })
        });
    } catch (e) {
        console.error(e);
    }
}

// ---------------- Window Resize Handler ----------------
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        // Close mobile menu if window is resized to desktop
        if (window.innerWidth > 768) {
            closeMobileMenu();
        }
    }, 250);
});

// ---------------- Prevent Body Scroll When Modal Open ----------------
function preventBodyScroll() {
    const modals = ['snoozeStopOverlay', 'alarmModal', 'waitingScreen'];
    const hasActiveModal = modals.some(id => document.getElementById(id));
    document.body.style.overflow = hasActiveModal ? 'hidden' : '';
}

// Call this whenever modals are shown/hidden
const originalCreateElement = document.createElement.bind(document);
document.createElement = function(...args) {
    const element = originalCreateElement(...args);
    if (element.id && ['snoozeStopOverlay', 'alarmModal', 'waitingScreen'].includes(element.id)) {
        setTimeout(preventBodyScroll, 0);
    }
    return element;
};

// ---------------- Touch Support for Better Mobile Experience ----------------
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

// Swipe to close sidebar on mobile
if (sidebar) {
    sidebar.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    sidebar.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
    }, { passive: true });
}

function handleSwipe() {
    const deltaX = touchEndX - touchStartX;
    const deltaY = Math.abs(touchEndY - touchStartY);

    // Only trigger if horizontal swipe is more significant than vertical
    if (Math.abs(deltaX) > 50 && deltaY < 50) {
        if (deltaX < 0 && sidebar.classList.contains('mobile-active')) {
            // Swipe left to close
            closeMobileMenu();
        }
    }
}

// ---------------- Accessibility Improvements ----------------
// Add keyboard navigation support
document.addEventListener('keydown', (e) => {
    // Escape key to close mobile menu or modals
    if (e.key === 'Escape') {
        if (sidebar.classList.contains('mobile-active')) {
            closeMobileMenu();
        }
    }

    // Handle modal navigation
    const modal = document.getElementById('alarmModal');
    if (modal && e.key === 'Enter') {
        const answerInput = document.getElementById('alarmAnswer');
        if (document.activeElement === answerInput) {
            checkChallengeAnswer();
        }
    }
});

// Add focus trap for modals (accessibility)
function trapFocus(element) {
    const focusableElements = element.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    element.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
            if (document.activeElement === firstElement) {
                lastElement.focus();
                e.preventDefault();
            }
        } else {
            if (document.activeElement === lastElement) {
                firstElement.focus();
                e.preventDefault();
            }
        }
    });
}

// Apply focus trap when challenge modal is created
const originalShowChallengeModal = showChallengeModal;
showChallengeModal = async function(alarm) {
    await originalShowChallengeModal(alarm);
    const modal = document.getElementById('alarmModal');
    if (modal) {
        trapFocus(modal);
    }
};

// ---------------- Performance Optimization ----------------
// Debounce function for performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function for scroll events
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ---------------- Enhanced Error Handling ----------------
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    // Don't show error toast for every error, only critical ones
    if (e.error && e.error.message && e.error.message.includes('fetch')) {
        showToast('Network connection issue. Please check your connection.', 'error');
    }
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
    // Handle specific promise rejections if needed
});

// ---------------- Service Worker Registration (Optional for PWA) ----------------
// Uncomment this if you want to add PWA support
/*
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker registered:', registration);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
    });
}
*/

// ---------------- Online/Offline Detection ----------------
window.addEventListener('online', () => {
    showToast('Connection restored!', 'success');
});

window.addEventListener('offline', () => {
    showToast('You are offline. Some features may not work.', 'error');
});

// ---------------- Viewport Height Fix for Mobile Browsers ----------------
// Fix for mobile browsers that change viewport height when address bar shows/hides
function setVH() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}

setVH();
window.addEventListener('resize', throttle(setVH, 250));
window.addEventListener('orientationchange', setVH);

// ---------------- Improve Touch Feedback ----------------
// Add active class on touch for better feedback
document.addEventListener('touchstart', (e) => {
    const target = e.target.closest('button, .nav-link, .alarm-item');
    if (target) {
        target.style.opacity = '0.8';
    }
}, { passive: true });

document.addEventListener('touchend', (e) => {
    const target = e.target.closest('button, .nav-link, .alarm-item');
    if (target) {
        target.style.opacity = '1';
    }
}, { passive: true });

// ---------------- Lazy Loading for Better Performance ----------------
// Lazy load images if you add any in the future
if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                observer.unobserve(img);
            }
        });
    });

    // Apply to any images with lazy class
    document.querySelectorAll('img.lazy').forEach(img => imageObserver.observe(img));
}

// ---------------- Auto-save Form Data (Optional Enhancement) ----------------
// Save form data to prevent loss on accidental close
const alarmForm = document.getElementById('alarmForm');
const FORM_STORAGE_KEY = 'wakeup_alarm_form_data';

// Load saved form data on page load
function loadFormData() {
    try {
        const savedData = localStorage.getItem(FORM_STORAGE_KEY);
        if (savedData) {
            const data = JSON.parse(savedData);
            if (data.alarmTime) document.getElementById('alarmTime').value = data.alarmTime;
            if (data.ampm) document.getElementById('ampm').value = data.ampm;
            if (data.alarmLabel) document.getElementById('alarmLabel').value = data.alarmLabel;
            if (data.challengeType) document.getElementById('challengeType').value = data.challengeType;
            if (data.alarmSound) document.getElementById('alarmSound').value = data.alarmSound;
        }
    } catch (e) {
        console.error('Error loading form data:', e);
    }
}

// Save form data as user types
function saveFormData() {
    try {
        const data = {
            alarmTime: document.getElementById('alarmTime').value,
            ampm: document.getElementById('ampm').value,
            alarmLabel: document.getElementById('alarmLabel').value,
            challengeType: document.getElementById('challengeType').value,
            alarmSound: document.getElementById('alarmSound').value
        };
        localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('Error saving form data:', e);
    }
}

// Clear saved form data when alarm is created
const originalFormSubmit = alarmForm.onsubmit;
alarmForm.addEventListener('submit', async (e) => {
    try {
        localStorage.removeItem(FORM_STORAGE_KEY);
    } catch (err) {
        console.error('Error clearing form data:', err);
    }
});

// Auto-save on input change
['alarmTime', 'ampm', 'alarmLabel', 'challengeType', 'alarmSound'].forEach(id => {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener('change', debounce(saveFormData, 500));
    }
});

// Load form data on initialization
if (typeof(Storage) !== 'undefined') {
    loadFormData();
}

// ---------------- Notification Permission (Optional) ----------------
// Request notification permission for alarm reminders
async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                showToast('Notifications enabled!', 'success');
            }
        } catch (e) {
            console.error('Notification permission error:', e);
        }
    }
}

// You can call this when user creates their first alarm
// requestNotificationPermission();

// ---------------- Battery Status Monitoring (Optional) ----------------
// Warn user if battery is low and they have alarms set
if ('getBattery' in navigator) {
    navigator.getBattery().then(battery => {
        function updateBatteryStatus() {
            if (battery.level < 0.15 && alarms.length > 0 && !battery.charging) {
                showToast('Low battery! Charge your device to ensure alarms work.', 'error');
            }
        }

        battery.addEventListener('levelchange', updateBatteryStatus);
        battery.addEventListener('chargingchange', updateBatteryStatus);
        updateBatteryStatus();
    });
}

// ---------------- Wake Lock API (Keep Screen On During Alarm) ----------------
let wakeLock = null;

async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('Wake lock active');

            wakeLock.addEventListener('release', () => {
                console.log('Wake lock released');
            });
        } catch (err) {
            console.error('Wake lock error:', err);
        }
    }
}

async function releaseWakeLock() {
    if (wakeLock !== null) {
        try {
            await wakeLock.release();
            wakeLock = null;
        } catch (err) {
            console.error('Wake lock release error:', err);
        }
    }
}

// Request wake lock when alarm rings
const originalTriggerAlarm = triggerAlarm;
triggerAlarm = async function(alarm) {
    await requestWakeLock();
    await originalTriggerAlarm(alarm);
};

// Release wake lock when alarm is dismissed
const originalDismissAlarm = dismissAlarm;
dismissAlarm = function() {
    releaseWakeLock();
    originalDismissAlarm();
};

// ---------------- Haptic Feedback for Mobile ----------------
function vibrate(pattern = [200]) {
    if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
    }
}

// Add vibration feedback to important actions
document.addEventListener('click', (e) => {
    const target = e.target.closest('button');
    if (target && target.classList.contains('btn-delete')) {
        vibrate([50]);
    } else if (target && (target.classList.contains('btn-primary') || target.classList.contains('btn-stop-alarm'))) {
        vibrate([100]);
    }
});

// Vibrate when alarm rings
const originalShowSnoozeStopOverlay = showSnoozeStopOverlay;
showSnoozeStopOverlay = function() {
    vibrate([200, 100, 200, 100, 200]);
    originalShowSnoozeStopOverlay();
};

// ---------------- Initialize Application ----------------
loadCurrentUser();

// Show welcome message on first visit
if (typeof(Storage) !== 'undefined') {
    const hasVisited = localStorage.getItem('wakeup_has_visited');
    if (!hasVisited) {
        setTimeout(() => {
            showToast('Welcome to WakeUp! 🎉 Create your first alarm to get started.', 'success');
            localStorage.setItem('wakeup_has_visited', 'true');
        }, 1000);
    }
}

// Log app version (useful for debugging)
console.log('%c WakeUp Alarm Clock v1.0 ', 'background: #5ea6ff; color: white; font-size: 16px; padding: 5px 10px; border-radius: 5px;');
console.log('%c Fully Responsive & Mobile Optimized ', 'background: #2ecc71; color: white; font-size: 12px; padding: 3px 8px; border-radius: 3px;');