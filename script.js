// PWAのサービスワーカーを登録
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // [修正] パスを修正
    navigator.serviceWorker.register('/WebIntervalTimer/sw.js').then(registration => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, err => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}

// Initialize Lucide Icons
lucide.createIcons();

// Web Audio API context
let audioContext;

function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// Get HTML elements
const countdownEl = document.getElementById('countdown');
const statusTextEl = document.getElementById('status-text');
const minutesInputEl = document.getElementById('minutes-input');
const secondsInputEl = document.getElementById('seconds-input');
const addButton = document.getElementById('add-button');
const startButton = document.getElementById('start-button');
const pauseButton = document.getElementById('pause-button');
const resetButton = document.getElementById('reset-button');
const intervalListEl = document.getElementById('interval-list');
const messageBoxEl = document.getElementById('message-box');
const quickAddButtons = document.querySelectorAll('.quick-add');
const progressRing = document.getElementById('progress-ring');

const cycleCountInputEl = document.getElementById('cycle-count-input');
const currentCycleNumberEl = document.getElementById('current-cycle-number');
const totalCycleNumberEl = document.getElementById('total-cycle-number');
const intervalSoundSelector = document.getElementById('interval-sound-selector');
const cycleSoundSelector = document.getElementById('cycle-sound-selector');

// Circular progress bar setup
const radius = progressRing.r.baseVal.value;
const circumference = 2 * Math.PI * radius;
progressRing.style.strokeDasharray = `${circumference} ${circumference}`;
progressRing.style.strokeDashoffset = circumference;

// State management variables
let intervals = []; // in seconds
let currentIndex = 0;
let timeRemaining = 0; // in milliseconds
let currentIntervalTotalTime = 0; // in milliseconds
let timerInterval;
let isPaused = true;
let lastTickTime; // for precise timer
let cycleCount = 1;
let currentCycle = 1;

// Sound patterns and parameters
const noteFrequencies = { 'C': 523.25, 'D': 587.33, 'E': 659.25, 'F': 698.46, 'G': 783.99, 'A': 880.00, 'B': 987.77 };
const soundPatterns = {
    // Pattern 1: Sparkling Chime
    pattern1: { type: 'sine', notes: [
        { freq: noteFrequencies['G'], duration: 0.4, gain: 0.3 },
        { freq: noteFrequencies['C'] * 2, duration: 0.4, gain: 0.3, delay: 0.1 },
        { freq: noteFrequencies['E'] * 2, duration: 0.4, gain: 0.3, delay: 0.2 }
    ]},
    // Pattern 2: Grand Arpeggio
    pattern2: { type: 'triangle', notes: [
        { freq: noteFrequencies['C'], duration: 0.15, gain: 0.4, delay: 0.0 },
        { freq: noteFrequencies['E'], duration: 0.15, gain: 0.4, delay: 0.08 },
        { freq: noteFrequencies['G'], duration: 0.15, gain: 0.4, delay: 0.16 },
        { freq: noteFrequencies['B'], duration: 0.15, gain: 0.4, delay: 0.24 },
        { freq: noteFrequencies['C'] * 2, duration: 0.25, gain: 0.4, delay: 0.32 }
    ]},
    // Pattern 3: Symphonic Chord
    pattern3: { type: 'sawtooth', notes: [
        { freq: noteFrequencies['C'] / 2, duration: 0.6, gain: 0.15 },
        { freq: noteFrequencies['C'], duration: 0.6, gain: 0.15, delay: 0.02 },
        { freq: noteFrequencies['E'], duration: 0.6, gain: 0.15, delay: 0.04 },
        { freq: noteFrequencies['G'], duration: 0.6, gain: 0.15, delay: 0.06 }
    ]},
    // Pattern 4: Sharp Whistle
    pattern4: { type: 'sine', notes: [
         { freq: 2200, duration: 0.15, gain: 0.35 },
         { freq: 2500, duration: 0.15, gain: 0.35, delay: 0.05 }
    ]}
};

// Main function to play sound
function playSound(pattern) {
    initAudioContext();
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    const now = audioContext.currentTime;
    const selectedPattern = soundPatterns[pattern];
    selectedPattern.notes.forEach(note => {
        playBeep({ frequency: note.freq, duration: note.duration, type: selectedPattern.type, gain: note.gain, delay: note.delay, startTime: now });
    });
}

// Helper function to generate a beep
function playBeep(options) {
    const { frequency, duration, type, gain, delay = 0, startTime } = options;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    const startPoint = startTime + delay;
    gainNode.gain.setValueAtTime(0, startPoint);
    gainNode.gain.linearRampToValueAtTime(gain, startPoint + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startPoint + duration);
    oscillator.start(startPoint);
    oscillator.stop(startPoint + duration + 0.05);
}

// Update sound choice UI
function updateSoundChoiceUI(selector) {
    const labels = selector.querySelectorAll('label');
    labels.forEach(label => {
        const radio = label.querySelector('input[type="radio"]');
        if (radio.checked) {
            label.classList.add('border-indigo-500', 'bg-slate-600');
            label.classList.remove('bg-slate-700');
        } else {
            label.classList.remove('border-indigo-500', 'bg-slate-600');
            label.classList.add('bg-slate-700');
        }
    });
}

intervalSoundSelector.addEventListener('change', (e) => {
     playSound(e.target.value);
     updateSoundChoiceUI(intervalSoundSelector);
});

cycleSoundSelector.addEventListener('change', (e) => {
    playSound(e.target.value);
    updateSoundChoiceUI(cycleSoundSelector);
});

cycleCountInputEl.addEventListener('change', () => {
    cycleCount = parseInt(cycleCountInputEl.value, 10) || 1;
    if (cycleCount < 1) {
        cycleCount = 1;
        cycleCountInputEl.value = 1;
    }
    if (isPaused) {
        updateInitialDisplay();
    }
});

// Add interval function
function addInterval(minutes, seconds) {
    const totalSeconds = minutes * 60 + seconds;
    if (totalSeconds > 0) {
        intervals.push(totalSeconds);
        renderIntervalList();
        messageBoxEl.textContent = '';
        if (isPaused) {
            updateInitialDisplay();
        }
    } else {
        messageBoxEl.textContent = 'インターバルは1秒以上で設定してください。';
    }
}

addButton.addEventListener('click', () => {
    const minutes = parseInt(minutesInputEl.value) || 0;
    const seconds = parseInt(secondsInputEl.value) || 0;
    addInterval(minutes, seconds);
});

quickAddButtons.forEach(button => {
    button.addEventListener('click', () => {
        const minutes = parseInt(button.dataset.minutes) || 0;
        const seconds = parseInt(button.dataset.seconds) || 0;
        addInterval(minutes, seconds);
    });
});

// Helper function to format seconds into MM:SS
function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Helper function to format milliseconds for display
function formatMilliseconds(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    return formatTime(totalSeconds);
}

// Render interval list on screen
function renderIntervalList() {
    intervalListEl.innerHTML = '';
    if (intervals.length === 0) {
         intervalListEl.innerHTML = '<p class="text-slate-500 text-center">インターバルがありません</p>';
    }
    intervals.forEach((time, index) => {
        const li = document.createElement('li');
        li.className = `flex justify-between items-center p-3 rounded-lg transition-colors ${!isPaused && index === currentIndex ? 'bg-indigo-500/50' : 'bg-slate-700'}`;
        
        const infoContainer = document.createElement('div');
        infoContainer.className = 'flex items-center gap-4';

        const numberEl = document.createElement('span');
        numberEl.className = 'flex items-center justify-center w-7 h-7 bg-slate-600 rounded-full text-sm font-bold text-slate-300';
        numberEl.textContent = index + 1;

        const timeText = document.createElement('span');
        timeText.className = 'font-semibold text-lg';
        timeText.textContent = formatTime(time);

        infoContainer.appendChild(numberEl);
        infoContainer.appendChild(timeText);
        li.appendChild(infoContainer);

        const deleteButton = document.createElement('button');
        deleteButton.className = 'text-red-400 hover:text-red-300';
        deleteButton.innerHTML = '<i data-lucide="trash-2" class="w-5 h-5"></i>';
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            intervals.splice(index, 1);
            if (isPaused || index < currentIndex) {
                 resetTimer();
            } else if (index === currentIndex) {
                 clearInterval(timerInterval);
                 startTimer();
            } else {
                 renderIntervalList();
            }
        });
        li.appendChild(deleteButton);
        intervalListEl.appendChild(li);
    });
    lucide.createIcons();
}

// Timer start button event listener
startButton.addEventListener('click', () => {
    if (intervals.length === 0) {
        messageBoxEl.textContent = 'インターバルを追加してください。';
        return;
    }
    
    if (isPaused) {
        // Timer was finished, so reset everything before starting
        if (currentCycle > cycleCount || (currentCycle === cycleCount && currentIndex >= intervals.length)) {
            resetTimer();
        }

        // Play sound on very first start
        if (currentCycle === 1 && currentIndex === 0 && intervals.length > 0 && timeRemaining === intervals[0] * 1000) {
             const selectedIntervalPattern = document.querySelector('input[name="interval-sound-choice"]:checked').value;
             playSound(selectedIntervalPattern);
        }

        isPaused = false;
        messageBoxEl.textContent = '';
        
        startTimer();
        updatePauseButtonUI();
    }
});

// Main timer tick function
function tick() {
    const now = Date.now();
    const deltaTime = now - lastTickTime;
    lastTickTime = now;
    timeRemaining -= deltaTime;

    updateDisplay();

    if (timeRemaining <= 0) {
        clearInterval(timerInterval);
        currentIndex++;
        timeRemaining = 0;
        startTimer();
    }
}

// Timer pause/resume button event listener
pauseButton.addEventListener('click', () => {
    if (!timerInterval && isPaused && intervals.length === 0) return;

    isPaused = !isPaused;
    if (isPaused) {
        clearInterval(timerInterval);
    } else {
        startTimer();
    }
    updatePauseButtonUI();
});

// Timer reset button event listener
resetButton.addEventListener('click', resetTimer);

function resetTimer() {
     clearInterval(timerInterval);
     isPaused = true;
     currentIndex = 0;
     currentCycle = 1;
     timeRemaining = 0;
     updateInitialDisplay();
     updatePauseButtonUI();
}

function updatePauseButtonUI() {
    const pauseIcon = document.getElementById('pause-icon');
    const pauseText = document.getElementById('pause-text');
    if(isPaused) {
        pauseIcon.setAttribute('data-lucide', 'play');
        pauseText.textContent = '再開';
        // Update status text when paused or reset
        if (intervals.length === 0) {
            statusTextEl.textContent = '準備';
        } else if (currentCycle > cycleCount || (currentCycle === cycleCount && currentIndex >= intervals.length)) {
            statusTextEl.textContent = '完了！';
        } else if (timeRemaining > 0) {
            statusTextEl.textContent = '一時停止中';
        } else {
            statusTextEl.textContent = '準備完了';
        }
    } else {
        pauseIcon.setAttribute('data-lucide', 'pause');
        pauseText.textContent = '一時停止';
        statusTextEl.textContent = '実行中';
    }
    lucide.createIcons();
}

// Main function to start/continue the timer
function startTimer() {
    if (isPaused) return;
    
    // Check if all intervals in the current cycle are done
    if (currentIndex >= intervals.length) {
        clearInterval(timerInterval);
        const selectedCyclePattern = document.querySelector('input[name="cycle-sound-choice"]:checked').value;
        playSound(selectedCyclePattern);

        // Check if all cycles are done
        if (currentCycle < cycleCount) {
            currentCycle++;
            currentIndex = 0;
            startTimer(); // Immediately start next cycle
        } else {
            // All cycles complete
            isPaused = true;
            updatePauseButtonUI();
            renderIntervalList();
        }
        return;
    }

    if (timeRemaining <= 0) {
        currentIntervalTotalTime = intervals[currentIndex] * 1000;
        timeRemaining = currentIntervalTotalTime;
        // Play sound only for subsequent intervals, not the very first one
        if (currentIndex > 0 || currentCycle > 1) {
            const selectedIntervalPattern = document.querySelector('input[name="interval-sound-choice"]:checked').value;
            playSound(selectedIntervalPattern);
        }
    }
    
    cycleCount = parseInt(cycleCountInputEl.value, 10) || 1;
    currentCycleNumberEl.textContent = currentCycle;
    totalCycleNumberEl.textContent = cycleCount;
    renderIntervalList();
    updateDisplay();
    
    lastTickTime = Date.now();
    timerInterval = setInterval(tick, 100);
}

// Function to update display and progress bar
function updateDisplay() {
    countdownEl.textContent = formatMilliseconds(timeRemaining);

    let percentage = 0;
    if (currentIntervalTotalTime > 0) {
        const elapsed = currentIntervalTotalTime - timeRemaining;
        percentage = Math.min(100, (elapsed / currentIntervalTotalTime) * 100);
    }
    const offset = circumference - (percentage / 100) * circumference;
    progressRing.style.strokeDashoffset = offset;
}

// Function to update the initial display
function updateInitialDisplay() {
    cycleCount = parseInt(cycleCountInputEl.value, 10) || 1;
    currentCycleNumberEl.textContent = currentCycle;
    totalCycleNumberEl.textContent = cycleCount;

    if (intervals.length > 0) {
        currentIntervalTotalTime = intervals[0] * 1000;
        timeRemaining = currentIntervalTotalTime;
        statusTextEl.textContent = '準備完了';
    } else {
        currentIntervalTotalTime = 0;
        timeRemaining = 0;
        statusTextEl.textContent = '準備';
    }
    updateDisplay();
    renderIntervalList();
}

// Initial setup on page load
updateInitialDisplay();
updateSoundChoiceUI(intervalSoundSelector);
updateSoundChoiceUI(cycleSoundSelector);
