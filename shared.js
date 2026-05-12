// ============================================
// DOMES-Acoustics Shared JavaScript
// ============================================

// --- Theme Management ---
const SVG_MOON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
const SVG_SUN = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';

function updateThemeIcon(isLight) {
    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.innerHTML = isLight ? SVG_MOON : SVG_SUN;
}

function setTheme(theme) {
    const isLight = theme === 'light';
    document.body.classList.toggle('light-theme', isLight);
    localStorage.setItem('theme', theme);
    updateThemeIcon(isLight);
}

function toggleTheme() {
    const currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
    setTheme(currentTheme === 'light' ? 'dark' : 'light');
}

// Initialize theme
const savedTheme = localStorage.getItem('theme') || 'dark';
document.addEventListener('DOMContentLoaded', () => setTheme(savedTheme));

// --- Navigation Active State ---
function setActiveNav(navId) {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(navId);
    if (activeBtn) activeBtn.classList.add('active');
}

// --- Utility Functions ---
function formatTime(s) {
    s = Math.max(0, s);
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 10);
    return `${m}:${sec.toString().padStart(2, '0')}.${ms}`;
}