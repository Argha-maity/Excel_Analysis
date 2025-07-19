// Prevent any page reloads
window.addEventListener('beforeunload', (e) => {
    e.preventDefault();
    e.returnValue = '';
    return '';
});

// Prevent form submissions from causing page reload
document.addEventListener('submit', (e) => {
    e.preventDefault();
    return false;
});

Chart.register(ChartDataLabels);

document.addEventListener('DOMContentLoaded', () => {
    protectPage();
    fetchCurrentUser().then(() => {
        setupAdminPanelVisibility();
        loadDashboardStats();
        loadRecentFiles();
        setupEventListeners();
        setupSidebarNavigation();
        setupProfileForm();
        setupAdminPanel();
    });
});

let currentChart = null;
let currentFileData = null;
let currentFileId = null;

async function fetchCurrentUser() {
    const token = getToken();
    if (!token) return logout();

    try {
        const response = await fetch("http://localhost:8003/api/users/me", {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` },
        });

        if (!response.ok) throw new Error("Failed to fetch user info");

        const user = await response.json();

        // Store user data globally
        window.currentUser = user;

        document.querySelector(".user-profile span").textContent = user.username;
        document.querySelector(".user-avatar").textContent =
            user.username.split(" ").map(word => word[0].toUpperCase()).join("");

        // Update admin tab visibility based on role
        const adminTab = document.querySelector('.settings-tab[data-tab="adminTab"]');
        if (adminTab) {
            adminTab.style.display = user.role === 'admin' ? 'block' : 'none';
        }
    } catch {
        logout();
    }
}

function setupAdminPanelVisibility() {
    const adminTab = document.querySelector('.settings-tab[data-role="admin"]');
    if (window.currentUser && window.currentUser.role === 'admin') {
        adminTab.style.display = 'block';
    } else {
        adminTab.style.display = 'none';
    }
}

function setupEventListeners() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }

    const fileUpload = document.getElementById('file-upload');
    if (fileUpload) {
        fileUpload.addEventListener('change', handleFileUpload);
    }

    const chartType = document.getElementById('chartType');
    if (chartType) {
        chartType.addEventListener('change', updateChartType);
    }

    const exportChart = document.getElementById('exportChart');
    if (exportChart) {
        exportChart.addEventListener('click', (e) => {
            e.preventDefault();
            exportChartFunction();
        });
    }

    const exportData = document.getElementById('exportData');
    if (exportData) {
        exportData.addEventListener('click', (e) => {
            e.preventDefault();
            exportDataFunction();
        });
    }

    const sheetSelect = document.getElementById('sheetSelect');
    if (sheetSelect) {
        sheetSelect.addEventListener('change', updateSheetData);
    }

    const xAxisSelect = document.getElementById('xAxisSelect');
    if (xAxisSelect) {
        xAxisSelect.addEventListener('change', updateChartData);
    }

    const yAxisSelect = document.getElementById('yAxisSelect');
    if (yAxisSelect) {
        yAxisSelect.addEventListener('change', updateChartData);
    }
}

async function handleFileUpload(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    document.getElementById('chartSection').style.display = 'none';
    document.getElementById('dataTableSection').style.display = 'none';
    document.getElementById('dataControls').style.display = 'none';

    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }

    const file = event.target.files[0];
    if (!file) {
        showUploadStatus('No file selected.', 'error');
        return;
    }

    const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
    ];
    if (!allowedTypes.includes(file.type)) {
        showUploadStatus('Please select a valid Excel file (.xlsx or .xls)', 'error');
        return;
    }

    showUploadStatus(`Processing ${file.name}...`, 'info');

    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('http://localhost:8003/api/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Server error occurred');
        }

        const result = await response.json();
        currentFileData = result.data;
        currentFileId = result.fileId;

        showUploadStatus(`File processed successfully!`, 'success');
        setupDataUI(result.data);
        addToRecentFiles(result.filename, result.fileId);
        await loadDashboardStats();
    } catch (err) {
        showUploadStatus(`Error: ${err.message}`, 'error');
    } finally {
        event.target.value = '';
    }
}

function setupDataUI(fileData) {
    if (!fileData || typeof fileData !== 'object') {
        showUploadStatus("Invalid file data", "error");
        return;
    }

    document.getElementById('chartSection').style.display = 'block';
    document.getElementById('dataTableSection').style.display = 'block';
    document.getElementById('dataControls').style.display = 'flex';

    const sheetSelect = document.getElementById('sheetSelect');
    sheetSelect.innerHTML = '';

    Object.keys(fileData).forEach(sheetName => {
        const option = document.createElement('option');
        option.value = sheetName;
        option.textContent = sheetName;
        sheetSelect.appendChild(option);
    });

    updateSheetData();
}

function updateSheetData() {
    const sheetName = document.getElementById('sheetSelect').value;
    const sheetData = currentFileData[sheetName];
    if (!sheetData) return;

    updateColumnSelects(sheetData.headers);
    renderDataTable(sheetData);
    if (sheetData.headers.length >= 2) updateChartData();
}

function updateColumnSelects(headers) {
    const xAxisSelect = document.getElementById('xAxisSelect');
    const yAxisSelect = document.getElementById('yAxisSelect');

    xAxisSelect.innerHTML = '';
    yAxisSelect.innerHTML = '';

    headers.forEach((header, index) => {
        const xOption = document.createElement('option');
        xOption.value = index;
        xOption.textContent = header;
        xAxisSelect.appendChild(xOption);

        const yOption = document.createElement('option');
        yOption.value = index;
        yOption.textContent = header;
        yAxisSelect.appendChild(yOption);
    });

    xAxisSelect.value = 0;
    yAxisSelect.value = headers.length > 1 ? 1 : 0;
}

function updateChartData() {
    const sheetName = document.getElementById('sheetSelect').value;
    const sheetData = currentFileData[sheetName];

    const xAxisIndex = parseInt(document.getElementById('xAxisSelect').value);
    const yAxisIndex = parseInt(document.getElementById('yAxisSelect').value);
    const chartType = document.getElementById('chartType').value;

    const labels = sheetData.rows.map(row => row[xAxisIndex]);
    const values = sheetData.rows.map(row => row[yAxisIndex]);

    renderChart({
        labels,
        values,
        sheetName,
        xAxis: sheetData.headers[xAxisIndex],
        yAxis: sheetData.headers[yAxisIndex],
        chartType
    });
}

function renderChart(data) {
    const ctx = document.getElementById('mainChart');
    if (currentChart) currentChart.destroy();

    const chartOptions = {
        type: data.chartType,
        data: {
            labels: data.labels,
            datasets: [{
                label: data.yAxis,
                data: data.values,
                backgroundColor: getChartColors(data.chartType, data.values.length),
                borderColor: '#4e73df',
                borderWidth: 1
            }]
        },
        options: getChartOptions(data.chartType, data)
    };

    currentChart = new Chart(ctx, chartOptions);
}

function getChartColors(type, count) {
    const palettes = {
        bar: ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#858796', '#5a5c69'],
        line: ['#4e73df'],
        pie: ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#858796', '#5a5c69'],
        doughnut: ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#858796', '#5a5c69'],
        radar: ['rgba(78, 115, 223, 0.2)'],
        polarArea: ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#858796', '#5a5c69']
    };
    const colors = palettes[type] || ['#4e73df'];
    return Array(count).fill().map((_, i) => colors[i % colors.length]);
}

function getChartOptions(type, data) {
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top' },
            title: {
                display: true,
                text: `${data.sheetName} - ${data.xAxis} vs ${data.yAxis}`
            },
            tooltip: {
                callbacks: {
                    label: context => `${data.yAxis}: ${context.raw}`
                }
            }
        }
    };

    if (type === 'pie' || type === 'doughnut') {
        commonOptions.plugins.datalabels = {
            formatter: (value, ctx) => {
                const sum = ctx.dataset.data.reduce((a, b) => a + b, 0);
                return ((value * 100 / sum).toFixed(1)) + '%';
            },
            color: '#fff',
            font: { weight: 'bold' }
        };
    }

    if (type === 'bar' || type === 'line') {
        commonOptions.scales = {
            y: { beginAtZero: true, title: { display: true, text: data.yAxis } },
            x: { title: { display: true, text: data.xAxis } }
        };
    }

    return commonOptions;
}

function renderDataTable(sheetData) {
    const table = document.getElementById('excelDataTable');
    table.innerHTML = '';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    sheetData.headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    sheetData.rows.forEach(row => {
        const tr = document.createElement('tr');
        row.forEach((cell, index) => {
            const td = document.createElement('td');
            td.textContent = (sheetData.columnTypes?.[sheetData.headers[index]] === 'date')
                ? new Date(cell).toLocaleDateString() : cell;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
}

async function loadRecentFiles() {
    try {
        const response = await fetch('http://localhost:8003/api/files', {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        if (!response.ok) throw new Error('Failed to load recent files');

        const files = await response.json();
        const recentFilesContainer = document.querySelector('.recent-files');

        // Clear existing files (keep the header)
        while (recentFilesContainer.children.length > 1) {
            recentFilesContainer.removeChild(recentFilesContainer.lastChild);
        }

        files.forEach(file => {
            addToRecentFiles(file.filename, file._id, file.createdAt);
        });
    } catch (error) {
        console.error('Error loading recent files:', error);
        showUploadStatus('Error loading recent files', 'error');
    }
}

function addToRecentFiles(filename, fileId, createdAt) {
    if (!fileId || fileId === 'undefined') return;

    const recentFiles = document.querySelector('.recent-files');
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';

    const uploadDate = createdAt ? new Date(createdAt).toLocaleDateString() : new Date().toLocaleDateString();

    fileItem.innerHTML = `
        <div class="file-icon"><i class="fas fa-file-excel"></i></div>
        <div class="file-info">
            <div class="file-name">${filename}</div>
            <div class="file-date">Uploaded: ${uploadDate}</div>
        </div>
        <div class="file-actions">
            <button class="action-btn" title="Visualize" data-file-id="${fileId}">
                <i class="fas fa-chart-bar"></i>
            </button>
            <button class="action-btn" title="Download" data-file-id="${fileId}">
                <i class="fas fa-download"></i>
            </button>
            <button class="action-btn" title="Delete" data-file-id="${fileId}">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;

    recentFiles.insertBefore(fileItem, recentFiles.children[1]);

    fileItem.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const action = btn.getAttribute('title').toLowerCase();
            const fileId = btn.getAttribute('data-file-id');
            if (!fileId) return;

            if (action === 'visualize') await loadFile(fileId);
            else if (action === 'download') await downloadFile(fileId);
            else if (action === 'delete') await deleteFile(fileId, fileItem);
        });
    });
}

async function loadFile(fileId) {
    try {
        const response = await fetch(`http://localhost:8003/api/files/${fileId}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        if (!response.ok) throw new Error('Failed to load file');

        const result = await response.json();
        currentFileData = result.data;
        currentFileId = result.fileId;

        setupDataUI(result.data);
        showUploadStatus(`Loaded file data successfully!`, 'success');
    } catch (err) {
        showUploadStatus(`Error: ${err.message}`, 'error');
    }
}

async function downloadFile(fileId) {
    try {
        const response = await fetch(`http://localhost:8003/api/files/${fileId}/download`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        if (!response.ok) throw new Error('Failed to download file');

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `file_${fileId}.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        showUploadStatus(`Error: ${err.message}`, "error");
    }
}

async function deleteFile(fileId, element) {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
        const response = await fetch(`http://localhost:8003/api/files/${fileId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });

        if (!response.ok) throw new Error('Failed to delete file');

        if (element) element.remove();

        if (fileId === currentFileId) {
            currentFileData = null;
            currentFileId = null;
            if (currentChart) {
                currentChart.destroy();
                currentChart = null;
            }
            document.getElementById('chartSection').style.display = 'none';
            document.getElementById('dataTableSection').style.display = 'none';
            document.getElementById('dataControls').style.display = 'none';
        }

        showUploadStatus(`File deleted successfully`, 'success');
    } catch (err) {
        showUploadStatus(`Error: ${err.message}`, 'error');
    }
}

function exportChartFunction() {
    if (!currentChart) {
        showUploadStatus('No chart to export', 'error');
        return;
    }
    const link = document.createElement('a');
    link.download = `chart_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = document.getElementById('mainChart').toDataURL('image/png');
    link.click();
}

function exportDataFunction() {
    if (!currentFileData) {
        showUploadStatus('No data to export', 'error');
        return;
    }

    const sheetName = document.getElementById('sheetSelect').value;
    const sheetData = currentFileData[sheetName];

    let csvContent = sheetData.headers.join(',') + '\n';
    sheetData.rows.forEach(row => {
        csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `data_${sheetName}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
}

function updateChartType() {
    if (!currentFileData) return;
    updateChartData();
}

function showUploadStatus(message, type = 'info') {
    const fileInfo = document.getElementById('file-info');
    if (!fileInfo) return;

    fileInfo.innerHTML = `
        <div class="upload-status ${type}">
            ${type === 'info' ? '<i class="fas fa-spinner fa-spin"></i>' : ''}
            ${type === 'success' ? '<i class="fas fa-check-circle"></i>' : ''}
            ${type === 'error' ? '<i class="fas fa-exclamation-circle"></i>' : ''}
            ${message}
        </div>
    `;
}

function getToken() {
    return localStorage.getItem("token") || sessionStorage.getItem("token");
}

async function loadDashboardStats() {
    try {
        const response = await fetch('http://localhost:8003/api/files/dashboard/stats', {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        if (!response.ok) throw new Error('Failed to load dashboard stats');

        const stats = await response.json();

        document.getElementById('filesProcessed').textContent = stats.filesProcessed;
        document.getElementById('filesProcessedChange').textContent = stats.filesProcessedChange;
        document.getElementById('chartsCreated').textContent = stats.chartsCreated;
        document.getElementById('chartsCreatedChange').textContent = stats.chartsCreatedChange;
        document.getElementById('chartImports').textContent = stats.chartImports;
        document.getElementById('chartImportsChange').textContent = stats.chartImportsChange;
    } catch (error) {
        console.error("Error loading dashboard stats:", error);
    }
}

function setupSidebarNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            // Remove active from all
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            const targetId = link.getAttribute('data-section');
            toggleSection(targetId);

            // Activate profile tab by default when settings is opened
            if (targetId === 'settingsSection') {
                activateTab('profileTab');
            }
        });
    });
}

function toggleSection(showId) {
    const sectionIds = ['dashboardSection', 'settingsSection'];
    const pageTitle = document.querySelector('.page-title');

    sectionIds.forEach(id => {
        const section = document.getElementById(id);
        if (section) section.style.display = (id === showId ? 'block' : 'none');
    });

    // When showing settings, activate profile tab by default
    if (showId === 'settingsSection') {
        activateTab('profileTab');
    }

    // Update page title
    if (pageTitle) {
        pageTitle.textContent = showId === 'dashboardSection' ? 'Dashboard' : 'Settings';
    }
}

function activateTab(tabId) {
    // Deactivate all tabs
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.settings-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Activate the selected tab
    const tabButton = document.querySelector(`.settings-tab[data-tab="${tabId}"]`);
    const tabContent = document.getElementById(tabId);

    if (tabButton) tabButton.classList.add('active');
    if (tabContent) tabContent.classList.add('active');

    // Special handling for admin tab
    if (tabId === 'adminTab') {
        loadUsers();
        loadSystemSettings();
    }
}

function setupProfileForm() {
    const profileForm = document.getElementById("profileForm");
    const usernameInput = document.getElementById("usernameInput");
    const emailInput = document.getElementById("emailInput");
    const statusDiv = document.getElementById("profileUpdateStatus");

    if (!profileForm || !usernameInput || !emailInput || !statusDiv) {
        console.error("Profile form elements not found!");
        return;
    }

    // Prefill with current user data
    fetch("http://localhost:8003/api/users/me", {
        headers: {
            "Authorization": `Bearer ${getToken()}`
        }
    })
        .then(res => {
            if (!res.ok) throw new Error('Failed to fetch user data');
            return res.json();
        })
        .then(user => {
            usernameInput.value = user.username || "";
            emailInput.value = user.email || "";
        })
        .catch(error => {
            console.error("Error fetching user data:", error);
            statusDiv.textContent = "Error loading profile data";
            statusDiv.style.color = "red";
        });

    profileForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const updatedData = {
            username: usernameInput.value.trim(),
            email: emailInput.value.trim(),
        };

        try {
            const res = await fetch("http://localhost:8003/api/users/me", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${getToken()}`
                },
                body: JSON.stringify(updatedData)
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Update failed");
            }

            statusDiv.textContent = "Profile updated successfully!";
            statusDiv.style.color = "green";

            // Update name/avatar in header
            document.getElementById("user-name").textContent = updatedData.username;
            document.querySelector(".user-avatar").textContent = updatedData.username
                .split(" ").map(w => w[0].toUpperCase()).join("");

            // Update current user data
            if (window.currentUser) {
                window.currentUser.username = updatedData.username;
                window.currentUser.email = updatedData.email;
            }
        } catch (err) {
            statusDiv.textContent = err.message || "Error updating profile";
            statusDiv.style.color = "red";
        }
    });
}

function setupAdminPanel() {
    // Check if admin elements exist
    const adminTab = document.querySelector('.settings-tab[data-tab="adminTab"]');
    if (!adminTab) return;

    // Hide admin tab if user is not admin
    if (!window.currentUser || window.currentUser.role !== 'admin') {
        adminTab.style.display = 'none';
        return;
    }

    // Tab switching
    const tabs = document.querySelectorAll('.settings-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const tabId = tab.getAttribute('data-tab');
            document.querySelectorAll('.settings-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Load users when admin tab is clicked
    adminTab.addEventListener('click', loadUsers);

    // User search functionality
    const userSearch = document.getElementById('userSearch');
    if (userSearch) {
        userSearch.addEventListener('input', (e) => {
            filterUsers(e.target.value);
        });
    }

    // Refresh users button
    const refreshBtn = document.getElementById('refreshUsers');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadUsers);
    }

    // System settings form
    const systemForm = document.getElementById('systemSettingsForm');
    if (systemForm) {
        systemForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveSystemSettings();
        });
    }

    // Load current system settings
    loadSystemSettings();
}

async function loadUsers() {
    try {
        const response = await fetch('http://localhost:8003/api/admin/users', {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to load users');
        }

        const users = await response.json();
        renderUsersTable(users);
    } catch (error) {
        console.error('Error loading users:', error);
        showAdminNotification(error.message || 'Failed to load users', 'error');
    }
}

function renderUsersTable(users) {
    const tbody = document.querySelector('#usersTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    users.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td class="action-buttons">
                <button class="action-btn edit-user" data-user-id="${user._id}" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn delete delete-user" data-user-id="${user._id}" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Add event listeners to action buttons
    document.querySelectorAll('.edit-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const userId = e.currentTarget.getAttribute('data-user-id');
            editUser(userId);
        });
    });

    document.querySelectorAll('.delete-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const userId = e.currentTarget.getAttribute('data-user-id');
            deleteUser(userId);
        });
    });
}

function filterUsers(searchTerm) {
    const rows = document.querySelectorAll('#usersTable tbody tr');
    rows.forEach(row => {
        const username = row.cells[0].textContent.toLowerCase();
        const email = row.cells[1].textContent.toLowerCase();
        const search = searchTerm.toLowerCase();

        if (username.includes(search) || email.includes(search)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

async function editUser(userId) {
    try {
        console.log(`Fetching user data for ID: ${userId}`); // Debug

        const response = await fetch(`http://localhost:8003/api/admin/users/${userId}`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Response status:', response.status); // Debug

        if (!response.ok) {
            const text = await response.text(); // don't try response.json() if status is error
            throw new Error(`Server error: ${text}`);
        }

        const user = await response.json();
        console.log('User data:', user); // Debug

        // Create and show edit modal
        showEditUserModal(user);
    } catch (err) {
        console.error('Error editing user:', err);
        showAdminNotification(err.message || 'Failed to edit user', 'error');
    }
}

function showEditUserModal(user) {
    // Remove any existing modals
    const existingModal = document.querySelector('.user-edit-modal');
    if (existingModal) existingModal.remove();

    const modalHTML = `
        <div class="user-edit-modal">
            <div class="modal-content">
                <h3>Edit User</h3>
                <form id="editUserForm">
                    <div class="form-group">
                        <label>Username</label>
                        <input type="text" id="editUsername" value="${user.username}" required>
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" id="editEmail" value="${user.email}" required>
                    </div>
                    <div class="form-group">
                        <label>Role</label>
                        <select id="editRole">
                            <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">Save</button>
                        <button type="button" class="btn-outline cancel-edit">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Handle form submission
    document.getElementById('editUserForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await updateUser(user._id);
    });

    // Handle cancel
    document.querySelector('.cancel-edit').addEventListener('click', () => {
        document.querySelector('.user-edit-modal').remove();
    });
}

async function updateUser(userId) {
    try {
        const updatedData = {
            username: document.getElementById('editUsername').value.trim(),
            email: document.getElementById('editEmail').value.trim(),
            role: document.getElementById('editRole').value
        };

        const response = await fetch(`http://localhost:8003/api/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify(updatedData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to update user');
        }

        // Remove modal and refresh user list
        document.querySelector('.user-edit-modal').remove();
        showAdminNotification('User updated successfully', 'success');
        loadUsers();
    } catch (error) {
        console.error('Error updating user:', error);
        showAdminNotification(error.message || 'Failed to update user', 'error');
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
        // 1. Get current token
        const token = getToken();
        if (!token) {
            showAdminNotification('Not authenticated', 'error');
            return logout();
        }

        // 2. Make delete request
        const response = await fetch(`http://localhost:8003/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        // 3. Handle response
        const contentType = response.headers.get('content-type');
        let result;

        if (contentType && contentType.includes('application/json')) {
            result = await response.json();
        } else {
            const text = await response.text();
            throw new Error(text || 'Unknown server error');
        }

        if (!response.ok) {
            throw new Error(result.message || 'Delete operation failed');
        }

        showAdminNotification(result.message || 'User deleted successfully', 'success');
        loadUsers(); // Refresh user list
    } catch (error) {
        console.error('Delete user error:', error);

        let errorMessage = error.message;
        if (error.message.includes('Invalid session user ID')) {
            errorMessage = 'Your session is invalid. Please log in again.';
            logout();
        }

        showAdminNotification(errorMessage, 'error');
    }
}

async function loadSystemSettings() {
    try {
        const response = await fetch("http://localhost:8003/api/admin/settings", {
            headers: {
                "Authorization": `Bearer ${getToken()}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || "Failed to load settings");
        }

        const settings = await response.json();

        document.getElementById("maxFileSize").value = settings.maxFileSize || "";
        document.getElementById("allowedFileTypes").value =
            Array.isArray(settings.allowedFileTypes)
                ? settings.allowedFileTypes.join(", ")
                : settings.allowedFileTypes || "";
    } catch (error) {
        console.error("Error loading system settings:", error);
        showAdminNotification(error.message || "Failed to load settings", "error");
    }
}

async function saveSystemSettings() {
    try {
        const settings = {
            maxFileSize: parseInt(document.getElementById('maxFileSize').value) || 10,
            allowedFileTypes: document.getElementById('allowedFileTypes').value
                .split(',')
                .map(item => item.trim())
                .filter(item => item)
        };

        const response = await fetch('http://localhost:8003/api/admin/settings', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify(settings)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to save settings');
        }

        showAdminNotification('Settings saved successfully', 'success');
    } catch (error) {
        console.error('Error saving system settings:', error);
        showAdminNotification(error.message || 'Failed to save settings', 'error');
    }
}

function showAdminNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `admin-notification ${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button class="close-notification">&times;</button>
    `;

    // Add to DOM
    const container = document.querySelector('.admin-panel') || document.body;
    container.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 5000);

    // Manual close
    notification.querySelector('.close-notification').addEventListener('click', () => {
        notification.remove();
    });
}