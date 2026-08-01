const STORAGE_KEYS = {
  profile: 'adaptive-learning-profile',
  state: 'adaptive-learning-state',
  logs: 'adaptive-learning-logs',
};

const lessonContent = {
  A: {
    title: 'Version A — Text',
    intro: 'Fractions are parts of a whole. A half is one of two equal parts, and a quarter is one of four equal parts.',
    bulletPoints: [
      'Use simple words and short paragraphs.',
      'Support reading with visible text and pacing.',
      'Keep the lesson focused on one core idea.',
    ],
  },
  B: {
    title: 'Version B — Pictures',
    intro: '🧩 Imagine a pizza cut into 2 equal slices. One slice is one half. Cut into 4 equal slices and one slice is one quarter.',
    bulletPoints: [
      'Icons and images replace dense text.',
      'High contrast helps visual learners focus.',
      'The lesson stays short and visual.',
    ],
  },
  C: {
    title: 'Version C — Voice',
    intro: 'Listen to the lesson: fractions describe equal parts of a whole. A half is one of two equal parts.',
    bulletPoints: [
      'Voice narration reinforces the concept.',
      'Text-to-speech can be toggled at any time.',
      'A short audio experience keeps the focus sharp.',
    ],
  },
};

const defaultState = {
  currentScreen: 'welcome',
  profile: null,
  lesson: {
    currentFormat: 'A',
    lastUpdated: null,
    logs: [],
  },
  settings: {
    highContrast: false,
    ttsEnabled: false,
    timerEnabled: false,
    timerDuration: 45,
    timerRemaining: 45,
  },
  timerIntervalId: null,
};

let appState = loadState();

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.state);
    const parsed = saved ? JSON.parse(saved) : null;
    return parsed ? { ...defaultState, ...parsed, settings: { ...defaultState.settings, ...(parsed.settings || {}) } } : structuredClone(defaultState);
  } catch (error) {
    console.warn('Could not load state', error);
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEYS.state, JSON.stringify(appState));
}

function persistProfile(profile) {
  localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
}

function loadProfile() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.profile);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.warn('Could not load profile', error);
    return null;
  }
}

function setScreen(screenName) {
  document.querySelectorAll('.screen').forEach((screen) => screen.classList.toggle('active', screen.id === `${screenName}-screen`));
  appState.currentScreen = screenName;
  saveState();
}

function getDefaultFormat(profile) {
  if (!profile) return 'A';
  if (profile.preference === 'Listening') return 'C';
  if (profile.preference === 'Pictures') return 'B';
  return 'A';
}

function logLessonEvent(message) {
  const entry = `${new Date().toLocaleTimeString()} — ${message}`;
  appState.lesson.logs.push(entry);
  localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(appState.lesson.logs));
  saveState();
}

function applyProfileDefaults(profile) {
  const defaultFormat = getDefaultFormat(profile);
  appState.lesson.currentFormat = defaultFormat;
  appState.settings.timerEnabled = profile.distraction === 'Often';
  appState.settings.highContrast = profile.preference === 'Pictures';
  appState.settings.timerRemaining = appState.settings.timerDuration;
  appState.lesson.lastUpdated = new Date().toISOString();
  logLessonEvent(`Profile saved with default format ${defaultFormat}`);
}

function render() {
  const profile = loadProfile();
  appState.profile = profile || appState.profile;

  if (!appState.profile) {
    setScreen('welcome');
  } else if (appState.currentScreen === 'welcome') {
    setScreen('dashboard');
  }

  document.body.classList.toggle('high-contrast', appState.settings.highContrast);
  document.getElementById('contrast-toggle').textContent = `High Contrast: ${appState.settings.highContrast ? 'On' : 'Off'}`;
  document.getElementById('tts-toggle').checked = appState.settings.ttsEnabled;
  document.getElementById('timer-toggle').checked = appState.settings.timerEnabled;
  document.getElementById('timer-duration').value = appState.settings.timerDuration;
  document.getElementById('timer-duration-value').textContent = appState.settings.timerDuration;

  if (appState.currentScreen === 'dashboard') {
    renderDashboard();
  }

  if (appState.currentScreen === 'lesson') {
    renderLesson();
  }
}

function renderDashboard() {
  const summary = document.getElementById('dashboard-summary');
  const profile = appState.profile;
  summary.innerHTML = profile
    ? `<p><strong>Profile:</strong> ${profile.preference} • ${profile.distraction}</p><p><strong>Default format:</strong> Version ${getDefaultFormat(profile)}</p><p><strong>Auto-enabled tools:</strong> ${profile.distraction === 'Often' ? 'Visual Timer' : 'None'}${profile.preference === 'Pictures' ? ' • High Contrast' : ''}</p>`
    : '<p>No profile yet. Start by completing onboarding.</p>';
}

function renderLesson() {
  const content = lessonContent[appState.lesson.currentFormat];
  const contentBox = document.getElementById('lesson-content');
  const assistiveSummary = document.getElementById('assistive-summary');
  const timerStatus = document.getElementById('timer-status');

  contentBox.innerHTML = `
    <h3>${content.title}</h3>
    <p>${content.intro}</p>
    <ul>
      ${content.bulletPoints.map((item) => `<li>${item}</li>`).join('')}
    </ul>
  `;

  assistiveSummary.innerHTML = `
    <p><strong>Default:</strong> ${appState.profile?.preference || 'Reading'}</p>
    <p><strong>Auto timer:</strong> ${appState.profile?.distraction === 'Often' ? 'Enabled' : 'Off'}</p>
    <p><strong>Current format:</strong> ${content.title}</p>
  `;

  timerStatus.textContent = appState.settings.timerEnabled ? `Timer active • ${appState.settings.timerRemaining}s` : 'Timer off';

  document.querySelectorAll('.chip-btn').forEach((button) => {
    button.classList.toggle('primary-btn', button.dataset.format === appState.lesson.currentFormat);
    button.classList.toggle('secondary-btn', button.dataset.format !== appState.lesson.currentFormat);
  });
}

function startTimer() {
  if (!appState.settings.timerEnabled) return;
  if (appState.timerIntervalId) clearInterval(appState.timerIntervalId);
  appState.settings.timerRemaining = appState.settings.timerDuration;
  appState.timerIntervalId = setInterval(() => {
    appState.settings.timerRemaining -= 1;
    if (appState.settings.timerRemaining <= 0) {
      clearInterval(appState.timerIntervalId);
      appState.timerIntervalId = null;
      appState.settings.timerRemaining = 0;
      logLessonEvent('Timer finished');
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance('Time is up. Take a short break.');
        speechSynthesis.speak(utterance);
      }
    }
    saveState();
    renderLesson();
  }, 1000);
  saveState();
}

function readAloud() {
  const content = lessonContent[appState.lesson.currentFormat];
  if (!('speechSynthesis' in window)) {
    alert('Speech synthesis is not supported in this browser.');
    return;
  }
  const utterance = new SpeechSynthesisUtterance(`${content.title}. ${content.intro}`);
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function bindEvents() {
  document.getElementById('guest-button').addEventListener('click', () => {
    setScreen('profile');
    render();
  });

  document.getElementById('profile-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const profile = {
      preference: data.get('preference'),
      distraction: data.get('distraction'),
      updatedAt: new Date().toISOString(),
    };

    if (!profile.preference || !profile.distraction) {
      alert('Please complete both questions before continuing.');
      return;
    }

    persistProfile(profile);
    appState.profile = profile;
    applyProfileDefaults(profile);
    saveState();
    setScreen('dashboard');
    render();
  });

  document.getElementById('continue-lesson-btn').addEventListener('click', () => {
    setScreen('lesson');
    render();
    startTimer();
  });

  document.getElementById('back-to-dashboard').addEventListener('click', () => {
    setScreen('dashboard');
    render();
  });

  document.querySelectorAll('.chip-btn').forEach((button) => {
    button.addEventListener('click', () => {
      appState.lesson.currentFormat = button.dataset.format;
      logLessonEvent(`Switched to format ${button.dataset.format}`);
      saveState();
      renderLesson();
    });
  });

  document.getElementById('tts-toggle').addEventListener('change', (event) => {
    appState.settings.ttsEnabled = event.target.checked;
    saveState();
  });

  document.getElementById('timer-toggle').addEventListener('change', (event) => {
    appState.settings.timerEnabled = event.target.checked;
    saveState();
    if (appState.settings.timerEnabled) startTimer();
    else {
      if (appState.timerIntervalId) clearInterval(appState.timerIntervalId);
      appState.timerIntervalId = null;
      renderLesson();
    }
  });

  document.getElementById('timer-duration').addEventListener('input', (event) => {
    appState.settings.timerDuration = Number(event.target.value);
    document.getElementById('timer-duration-value').textContent = appState.settings.timerDuration;
    appState.settings.timerRemaining = appState.settings.timerDuration;
    saveState();
    renderLesson();
  });

  document.getElementById('read-aloud-btn').addEventListener('click', readAloud);

  document.getElementById('contrast-toggle').addEventListener('click', () => {
    appState.settings.highContrast = !appState.settings.highContrast;
    saveState();
    render();
  });

  document.getElementById('profile-button').addEventListener('click', () => {
    setScreen('profile');
    render();
  });
}

bindEvents();
appState.profile = loadProfile();
if (appState.profile) {
  appState.currentScreen = 'dashboard';
}
render();