document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const freshAuth = urlParams.get('freshAuth');
    
    if (freshAuth) {
        updateAuthUI();
        window.history.replaceState({}, '', document.title, window.location.pathname);
    } 
    updateAuthUI();
    
    if (!freshAuth) {
        await checkAuthStatus();
        updateAuthUI();
    }
    setupDashboardButton();
});

function updateAuthUI() {
    const navButtons = document.querySelector('.nav-buttons');
    if (!navButtons) return;

    if (isAuthenticated()) {
        navButtons.innerHTML = `
            <span class="user-email">${getUserEmail()}</span>
            <button class="btn-outline" id="logoutBtn">Logout</button>
        `;
        document.getElementById('logoutBtn')?.addEventListener('click', logout);
    } else {
        navButtons.innerHTML = `
            <a href="login.html" class="btn-outline">Log in</a>
            <a href="signup.html" class="btn-primary">Sign up</a>
        `;
    }
}

function setupDashboardButton() {
    const dashboardBtn = document.querySelector('.dashboard-btn');
    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', (e) => {
            if (!isAuthenticated()) {
                e.preventDefault();
                alert('Please log in to access the dashboard.');
                window.location.href = 'login.html';
            }
        });
    }
}

if (document.body.classList.contains('protected-page')) {
    protectPage();
}