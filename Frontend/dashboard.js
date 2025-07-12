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
    fetchCurrentUser();
    loadDashboardStats();
    loadRecentFiles();
    setupEventListeners();
    setupSidebarNavigation();
    setupProfileForm();
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

        document.querySelector(".user-profile span").textContent = user.username;
        document.querySelector(".user-avatar").textContent = 
            user.username.split(" ").map(word => word[0].toUpperCase()).join("");
    } catch {
        logout();
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
            await response.text(); // just consume it
            showUploadStatus('Server error occurred.', 'error');
            return;
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

        if (!response.ok) throw new Error();

        const files = await response.json();
        const recentFilesContainer = document.querySelector('.recent-files');

        while (recentFilesContainer.children.length > 1) {
            recentFilesContainer.removeChild(recentFilesContainer.lastChild);
        }

        files.forEach(file => {
            addToRecentFiles(file.filename, file._id, file.createdAt);
        });
    } catch {}
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

        if (!response.ok) throw new Error();

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
        const token = getToken();
        const response = await fetch(`http://localhost:8003/api/files/${fileId}/download`, {
            method: "GET",
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error();

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
    try {
        const response = await fetch(`http://localhost:8003/api/files/${fileId}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${getToken()}` 
            }
        });

        if (!response.ok) throw new Error();

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
    if (!currentChart) return;
    const link = document.createElement('a');
    link.download = `chart_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = document.getElementById('mainChart').toDataURL('image/png');
    link.click();
}

function exportDataFunction() {
    if (!currentFileData) return;
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
        const token = getToken();
        const response = await fetch('http://localhost:8003/api/files/dashboard/stats', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error();

        const stats = await response.json();

        document.getElementById('filesProcessed').textContent = stats.filesProcessed;
        document.getElementById('filesProcessedChange').textContent = stats.filesProcessedChange;
        document.getElementById('chartsCreated').textContent = stats.chartsCreated;
        document.getElementById('chartsCreatedChange').textContent = stats.chartsCreatedChange;
        document.getElementById('chartImports').textContent = stats.chartImports;
        document.getElementById('chartImportsChange').textContent = stats.chartImportsChange;
    } catch {
        console.error("Error loading dashboard stats:", err);
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
        });
    });
}

function toggleSection(showId) {
    const sectionIds = ['dashboardSection', 'settingsSection'];

    sectionIds.forEach(id => {
        const section = document.getElementById(id);
        if (section) section.style.display = (id === showId ? 'block' : 'none');
    });
}

function setupProfileForm() {
    const profileForm = document.getElementById("profileForm");
    const usernameInput = document.getElementById("usernameInput");
    const emailInput = document.getElementById("emailInput");
    const statusDiv = document.getElementById("profileUpdateStatus");

    // Prefill with current user data
    fetch("http://localhost:8003/api/users/me", {
        headers: {
            "Authorization": `Bearer ${getToken()}`
        }
    })
    .then(res => res.json())
    .then(user => {
        usernameInput.value = user.username || "";
        emailInput.value = user.email || "";
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

            if (!res.ok) throw new Error("Update failed");

            statusDiv.textContent = "Profile updated successfully!";
            statusDiv.style.color = "green";

            // Update name/avatar in header
            document.getElementById("user-name").textContent = updatedData.username;
            document.querySelector(".user-avatar").textContent = updatedData.username
                .split(" ").map(w => w[0].toUpperCase()).join("");
        } catch (err) {
            statusDiv.textContent = "Error updating profile.";
            statusDiv.style.color = "red";
        }
    });
}
