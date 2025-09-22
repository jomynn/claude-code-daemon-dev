/**
 * Screen Capture Manager
 * Handles screenshot capture and management functionality
 */

class ScreenCaptureManager {
    constructor() {
        this.currentView = 'list';
        this.screenshots = [];
        this.currentScreenshot = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadScreenshots();
        this.loadStatus();
        this.setupAutoRefresh();
    }

    setupEventListeners() {
        // Capture button
        document.getElementById('captureBtn')?.addEventListener('click', () => this.takeScreenshot());

        // Refresh button
        document.getElementById('refreshList')?.addEventListener('click', () => this.loadScreenshots());

        // View toggle buttons
        document.getElementById('viewGrid')?.addEventListener('click', () => this.setView('grid'));
        document.getElementById('viewList')?.addEventListener('click', () => this.setView('list'));

        // Delete button in modal
        document.getElementById('deleteScreenshot')?.addEventListener('click', () => this.deleteCurrentScreenshot());

        // Modal close event
        const modal = document.getElementById('screenshotModal');
        modal?.addEventListener('hidden.bs.modal', () => {
            this.currentScreenshot = null;
        });
    }

    async takeScreenshot() {
        const captureBtn = document.getElementById('captureBtn');
        const originalText = captureBtn.innerHTML;

        try {
            // Show loading state
            captureBtn.disabled = true;
            captureBtn.innerHTML = '<i class="ti ti-loader-2 spinner"></i> Capturing...';

            // Prepare capture options
            const options = {
                format: document.getElementById('captureFormat').value,
                displayId: parseInt(document.getElementById('displayId').value)
            };

            const captureType = document.getElementById('captureType').value;
            if (captureType === 'window') {
                options.window = true;
            } else if (captureType === 'selection') {
                options.selection = true;
            }

            const customFilename = document.getElementById('customFilename').value.trim();
            if (customFilename) {
                options.filename = `${customFilename}_${Date.now()}.${options.format}`;
            }

            const response = await fetch('/api/screencapture/capture', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(options)
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('Screenshot captured successfully!', 'success');
                await this.loadScreenshots();
                await this.loadStatus();

                // Clear custom filename
                document.getElementById('customFilename').value = '';
            } else {
                throw new Error(result.error || 'Capture failed');
            }
        } catch (error) {
            console.error('Screenshot capture failed:', error);
            this.showNotification(`Capture failed: ${error.message}`, 'error');
        } finally {
            // Restore button state
            captureBtn.disabled = false;
            captureBtn.innerHTML = originalText;
        }
    }

    async loadScreenshots() {
        try {
            const response = await fetch('/api/screencapture/list');
            const result = await response.json();

            if (result.success) {
                this.screenshots = result.data;
                this.renderScreenshots();
            } else {
                throw new Error(result.error || 'Failed to load screenshots');
            }
        } catch (error) {
            console.error('Failed to load screenshots:', error);
            this.showNotification('Failed to load screenshots', 'error');
        }
    }

    async loadStatus() {
        try {
            const response = await fetch('/api/screencapture/status');
            const result = await response.json();

            if (result.success) {
                this.updateStatusDisplay(result.data);
            } else {
                throw new Error(result.error || 'Failed to load status');
            }
        } catch (error) {
            console.error('Failed to load status:', error);
        }
    }

    updateStatusDisplay(status) {
        document.getElementById('totalScreenshots').textContent = status.totalScreenshots;
        document.getElementById('diskUsage').textContent = this.formatFileSize(status.diskUsage);
        document.getElementById('latestCapture').textContent = status.latestScreenshot
            ? this.formatDate(status.latestScreenshot.created)
            : 'None';
        document.getElementById('captureDirectory').textContent = status.captureDirectory.split('/').pop();
    }

    renderScreenshots() {
        const container = document.getElementById('screenshotsList');

        if (this.screenshots.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="ti ti-photo-off text-muted fs-1"></i>
                    <p class="text-muted mt-2">No screenshots yet. Take your first screenshot!</p>
                </div>
            `;
            return;
        }

        if (this.currentView === 'list') {
            container.innerHTML = this.screenshots.map(screenshot => `
                <div class="screenshot-item" data-filename="${screenshot.filename}">
                    <img src="/api/screencapture/view/${screenshot.filename}"
                         alt="${screenshot.filename}"
                         class="screenshot-thumbnail"
                         onclick="screencaptureManager.viewScreenshot('${screenshot.filename}')">
                    <div class="screenshot-info">
                        <h6>${screenshot.filename}</h6>
                        <small class="text-muted">
                            ${this.formatDate(screenshot.created)} • ${this.formatFileSize(screenshot.size)}
                        </small>
                    </div>
                    <div class="screenshot-actions">
                        <button class="btn btn-sm btn-outline-primary me-2"
                                onclick="screencaptureManager.viewScreenshot('${screenshot.filename}')">
                            <i class="ti ti-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger"
                                onclick="screencaptureManager.deleteScreenshot('${screenshot.filename}')">
                            <i class="ti ti-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = this.screenshots.map(screenshot => `
                <div class="screenshot-item" data-filename="${screenshot.filename}">
                    <img src="/api/screencapture/view/${screenshot.filename}"
                         alt="${screenshot.filename}"
                         class="img-fluid mb-2"
                         style="cursor: pointer; max-height: 120px; width: 100%; object-fit: cover;"
                         onclick="screencaptureManager.viewScreenshot('${screenshot.filename}')">
                    <h6 class="small mb-1">${screenshot.filename}</h6>
                    <small class="text-muted d-block mb-2">
                        ${this.formatDate(screenshot.created)}
                    </small>
                    <div class="d-flex justify-content-center gap-1">
                        <button class="btn btn-sm btn-outline-primary"
                                onclick="screencaptureManager.viewScreenshot('${screenshot.filename}')">
                            <i class="ti ti-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger"
                                onclick="screencaptureManager.deleteScreenshot('${screenshot.filename}')">
                            <i class="ti ti-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }
    }

    setView(view) {
        this.currentView = view;
        const container = document.getElementById('screenshotsList');

        // Update button states
        document.getElementById('viewList').classList.toggle('active', view === 'list');
        document.getElementById('viewGrid').classList.toggle('active', view === 'grid');

        // Update container class
        container.className = `screenshots-container ${view}-view`;

        // Re-render with new view
        this.renderScreenshots();
    }

    viewScreenshot(filename) {
        this.currentScreenshot = filename;
        const modal = new bootstrap.Modal(document.getElementById('screenshotModal'));

        // Set modal content
        document.getElementById('screenshotModalTitle').textContent = filename;
        document.getElementById('screenshotPreview').src = `/api/screencapture/view/${filename}`;

        modal.show();
    }

    async deleteScreenshot(filename) {
        if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/screencapture/${filename}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('Screenshot deleted successfully', 'success');
                await this.loadScreenshots();
                await this.loadStatus();

                // Close modal if this screenshot was open
                if (this.currentScreenshot === filename) {
                    const modal = bootstrap.Modal.getInstance(document.getElementById('screenshotModal'));
                    modal?.hide();
                }
            } else {
                throw new Error(result.error || 'Delete failed');
            }
        } catch (error) {
            console.error('Failed to delete screenshot:', error);
            this.showNotification(`Delete failed: ${error.message}`, 'error');
        }
    }

    async deleteCurrentScreenshot() {
        if (this.currentScreenshot) {
            await this.deleteScreenshot(this.currentScreenshot);
        }
    }

    setupAutoRefresh() {
        // Refresh screenshots list every 30 seconds
        setInterval(() => {
            this.loadScreenshots();
            this.loadStatus();
        }, 30000);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString();
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 1050; min-width: 300px;';
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.screencaptureManager = new ScreenCaptureManager();
});

// Add spinner animation CSS
const style = document.createElement('style');
style.textContent = `
    .spinner {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);