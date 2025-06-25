function getToken() {
    return localStorage.getItem("token") || sessionStorage.getItem("token");
}

function validateToken(token) {
    if (!token) return false;

    const parts = token.split(".");
    if (parts.length !== 3) {
        console.warn("Invalid token structure");
        return false;
    }

    try {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp && Date.now() >= payload.exp * 1000) {
            console.warn("Token expired");
            return false;
        }
        return true;
    } catch (err) {
        console.error("Invalid token payload:", err);
        return false;
    }
}

function setToken(token, remember) {
    if (remember) {
        localStorage.setItem("token", token);
    } else {
        sessionStorage.setItem("token", token);
    }
}

function clearAuth() {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    sessionStorage.removeItem("userEmail");
}

function getUserEmail() {
    return localStorage.getItem("userEmail") || sessionStorage.getItem("userEmail");
}

function isAuthenticated() {
    return validateToken(getToken());
}

function logout() {
    clearAuth();
    window.location.href = "index.html";
}

function protectPage() {
    const token = getToken();
    if (!validateToken(token)) {
        clearAuth();
        window.location.href = "login.html";
    }
}

async function checkAuthStatus() {
  const token = getToken();
  if (!token) return false;

  try {
    const response = await fetch('/api/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) {
      logout();
      return false;
    }
    return true;
  } catch (err) {
    console.error("Auth status check failed:", err);
    logout();
    return false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('protected-page')) {
        protectPage();
    }
});

window.getToken = getToken;
window.validateToken = validateToken;
window.setToken = setToken;
window.clearAuth = clearAuth;
window.getUserEmail = getUserEmail;
window.isAuthenticated = isAuthenticated;
window.logout = logout;
window.protectPage = protectPage;
window.checkAuthStatus = checkAuthStatus;