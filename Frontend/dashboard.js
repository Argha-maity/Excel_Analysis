Chart.register(ChartDataLabels);

document.addEventListener('DOMContentLoaded', () => {
    protectPage();
    fetchCurrentUser();
    loadDashboardStats();
    loadRecentFiles();
    setupEventListeners();
});

// Global variables
let currentChart = null;
let currentFileData = null;
let currentFileId = null;

async function fetchCurrentUser() {
    const token = getToken();
    if (!token) return logout();

    try {
        const response = await fetch("http://localhost:8003/api/users/me", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
            },
        });

        if (!response.ok) throw new Error("Failed to fetch user info");

        const user = await response.json();

        document.querySelector(".user-profile span").textContent = user.username;
        document.querySelector(".user-avatar").textContent = 
            user.username.split(" ").map(word => word[0].toUpperCase()).join("");

    } catch (err) {
        console.error("Error fetching user:", err);
        logout();
    }
}

function setupEventListeners() {
    document.getElementById('logoutBtn').addEventListener('click', logout);

    document.getElementById('file-upload').addEventListener('change', handleFileUpload);

    document.getElementById('chartType').addEventListener('change', updateChartType);

    document.getElementById('exportChart').addEventListener('click', exportChart);
    document.getElementById('exportData').addEventListener('click', exportData);

    document.getElementById('sheetSelect').addEventListener('change', updateSheetData);

    document.getElementById('xAxisSelect').addEventListener('change', updateChartData);
    document.getElementById('yAxisSelect').addEventListener('change', updateChartData);
}

async function handleFileUpload(e) {
    // clear old chart/data while uploading new file
    document.getElementById('chartSection').style.display = 'none';
    document.getElementById('dataTableSection').style.display = 'none';
    document.getElementById('dataControls').style.display = 'none';

    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }

    const file = e.target.files[0];
    if (!file) {
        showUploadStatus('No file selected.', 'error');
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
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Upload failed');
        }

        const result = await response.json();
        currentFileData = result.data;
        currentFileId = result.fileId;

        showUploadStatus(`File processed successfully!`, 'success');
        setupDataUI(result.data);  // render sheets, selects, chart, etc.
        addToRecentFiles(result.filename, result.fileId);
        await loadDashboardStats();

    } catch (err) {
        console.error('Upload error:', err);
        showUploadStatus(`Error: ${err.message}`, 'error');
    }
}


function setupDataUI(fileData) {
    // Show all sections
    document.getElementById('chartSection').style.display = 'block';
    document.getElementById('dataTableSection').style.display = 'block';
    document.getElementById('dataControls').style.display = 'flex';

    const sheetSelect = document.getElementById('sheetSelect');
    sheetSelect.innerHTML = ''; //clear

    Object.keys(fileData).forEach(sheetName => {
        const option = document.createElement('option');
        option.value = sheetName;
        option.textContent = sheetName;
        sheetSelect.appendChild(option);
    });

    sheetSelect.onchange = updateSheetData;

    updateSheetData();
}

function updateSheetData() {
    const sheetName = document.getElementById('sheetSelect').value;
    const sheetData = currentFileData[sheetName];
    
    updateColumnSelects(sheetData.headers);
    
    renderDataTable(sheetData);
    
    if (sheetData.headers.length >= 2) {
        updateChartData();
    }
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
    
    // Default 
    xAxisSelect.value = 0;
    yAxisSelect.value = headers.length > 1 ? 1 : 0;

    xAxisSelect.onchange = updateChartData;
    yAxisSelect.onchange = updateChartData;
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
    
    if (currentChart) {
        currentChart.destroy();
    }
    
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
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: `${data.sheetName} - ${data.xAxis} vs ${data.yAxis}`
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return `${data.yAxis}: ${context.raw}`;
                    }
                }
            }
        }
    };
    
    if (type === 'pie' || type === 'doughnut') {
        commonOptions.plugins.datalabels = {
            formatter: (value, ctx) => {
                const sum = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = (value * 100 / sum).toFixed(1) + '%';
                return percentage;
            },
            color: '#fff',
            font: {
                weight: 'bold'
            }
        };
    }
    
    if (type === 'bar' || type === 'line') {
        commonOptions.scales = {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: data.yAxis
                }
            },
            x: {
                title: {
                    display: true,
                    text: data.xAxis
                }
            }
        };
    }
    
    return commonOptions;
}

function renderDataTable(sheetData) {
    const table = document.getElementById('excelDataTable');
    table.innerHTML = '';
    
    // Create header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    sheetData.headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create body
    const tbody = document.createElement('tbody');
    
    sheetData.rows.forEach(row => {
        const tr = document.createElement('tr');
        
        row.forEach((cell, index) => {
            const td = document.createElement('td');
            
            // Format based on detected type
            if (sheetData.columnTypes && sheetData.columnTypes[sheetData.headers[index]] === 'date') {
                td.textContent = new Date(cell).toLocaleDateString();
            } else {
                td.textContent = cell;
            }
            
            tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
}

async function loadRecentFiles() {
    try {
        const response = await fetch('http://localhost:8003/api/files', {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load recent files');
        
        const files = await response.json();
        const recentFilesContainer = document.querySelector('.recent-files');
        
        // Clear existing items except the first one (which is the title)
        while (recentFilesContainer.children.length > 1) {
            recentFilesContainer.removeChild(recentFilesContainer.lastChild);
        }
        
        files.forEach(file => {
            addToRecentFiles(file.filename, file._id, file.createdAt);
        });
        
    } catch (err) {
        console.error('Error loading recent files:', err);
    }
}

function addToRecentFiles(filename, fileId, createdAt) {
    const recentFiles = document.querySelector('.recent-files');
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    
    const uploadDate = createdAt ? new Date(createdAt).toLocaleDateString() : new Date().toLocaleDateString();
    
    fileItem.innerHTML = `
        <div class="file-icon">
            <i class="fas fa-file-excel"></i>
        </div>
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
    
    // Insert after the section title
    recentFiles.insertBefore(fileItem, recentFiles.children[1]);
    
    // Add event listeners to the new buttons
    fileItem.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = btn.getAttribute('title').toLowerCase();
            const fileId = btn.getAttribute('data-file-id');

            if (!fileId) return alert("No file ID found.");
            
            if (action === 'visualize') 
                loadFile(fileId);
            else if (action === 'download') 
                downloadFile(fileId);
            else if (action === 'delete') 
                deleteFile(fileId, fileItem);
        });
    });
}

async function loadFile(fileId) {
    try {
        const response = await fetch(`http://localhost:8003/api/files/${fileId}`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load file data');
        
        const fileData = await response.json();
        currentFileData = fileData;
        currentFileId = fileId;
        
        setupDataUI(fileData);
        showUploadStatus(`Loaded file data successfully!`, 'success');
        
    } catch (err) {
        console.error('Error loading file:', err);
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

    if (!response.ok) throw new Error("Failed to download file");

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `file_${fileId}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);

  } catch (err) {
    console.error("Error downloading file:", err);
    showUploadStatus(`Error: ${err.message}`, "error");
  }
}

async function deleteFile(fileId, element) {
    if (!fileId || fileId === 'undefined') {
        console.error("Invalid file ID for deletion:", fileId);
        showUploadStatus(`Error: Invalid file ID`, 'error');
        return;
    }
    
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
        const response = await fetch(`http://localhost:8003/api/files/${fileId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Backend responded with:', errorData);
            throw new Error(errorData.message || 'Failed to delete file');
        }

        if (element) {
            element.remove();
        }

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
        console.error('Error deleting file:', err);
        showUploadStatus(`Error: ${err.message}`, 'error');
    }
}

function exportChart() {
    if (!currentChart) return;
    
    const link = document.createElement('a');
    link.download = `chart_${new Date().toISOString().slice(0,10)}.png`;
    link.href = document.getElementById('mainChart').toDataURL('image/png');
    link.click();
}

function exportData() {
    if (!currentFileData) return;
    
    const sheetName = document.getElementById('sheetSelect').value;
    const sheetData = currentFileData[sheetName];
    
    // Convert to CSV
    let csvContent = sheetData.headers.join(',') + '\n';
    sheetData.rows.forEach(row => {
        csvContent += row.join(',') + '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `data_${sheetName}_${new Date().toISOString().slice(0,10)}.csv`;
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
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error("Failed to load dashboard stats");

    const stats = await response.json();

    // Update HTML
    document.getElementById('filesProcessed').textContent = stats.filesProcessed;
    document.getElementById('filesProcessedChange').textContent = stats.filesProcessedChange;

    document.getElementById('chartsCreated').textContent = stats.chartsCreated;
    document.getElementById('chartsCreatedChange').textContent = stats.chartsCreatedChange;

    document.getElementById('chartImports').textContent = stats.chartImports;
    document.getElementById('chartImportsChange').textContent = stats.chartImportsChange;

  } catch (err) {
    console.error("Error loading dashboard stats:", err);
  }
}