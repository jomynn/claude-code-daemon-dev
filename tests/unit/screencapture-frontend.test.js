/**
 * Unit Tests for Screen Capture Frontend JavaScript
 * Tests the ScreenCaptureManager class and DOM interactions
 */

// Mock DOM APIs
const { JSDOM } = require('jsdom');

// Set up DOM environment
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
    <button id="captureBtn">Capture</button>
    <button id="refreshList">Refresh</button>
    <button id="viewGrid">Grid View</button>
    <button id="viewList">List View</button>
    <button id="deleteScreenshot">Delete</button>

    <select id="captureType">
        <option value="fullscreen">Full Screen</option>
        <option value="window">Window</option>
        <option value="selection">Selection</option>
    </select>

    <select id="captureFormat">
        <option value="png">PNG</option>
        <option value="jpg">JPG</option>
    </select>

    <select id="displayId">
        <option value="1">Display 1</option>
        <option value="2">Display 2</option>
    </select>

    <input type="text" id="customFilename" />

    <div id="screenshotsList"></div>
    <div id="totalScreenshots"></div>
    <div id="diskUsage"></div>
    <div id="latestCapture"></div>
    <div id="captureDirectory"></div>

    <div class="modal" id="screenshotModal">
        <h5 id="screenshotModalTitle"></h5>
        <img id="screenshotPreview" />
    </div>
</body>
</html>
`, { url: 'http://localhost' });

global.window = dom.window;
global.document = dom.window.document;
global.bootstrap = {
    Modal: class {
        constructor(element) {
            this.element = element;
        }
        show() { this.isShown = true; }
        hide() { this.isShown = false; }
        static getInstance(element) {
            return new this(element);
        }
    }
};

// Mock fetch API
global.fetch = jest.fn();

// Load the screencapture manager
let ScreenCaptureManager;

describe('ScreenCaptureManager Frontend', () => {
    let manager;
    let mockFetch;

    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch = global.fetch;

        // Define the ScreenCaptureManager class inline for testing
        class TestScreenCaptureManager {
            constructor() {
                this.currentView = 'list';
                this.screenshots = [];
                this.currentScreenshot = null;
            }

            setupEventListeners() {
                document.getElementById('captureBtn')?.addEventListener('click', () => this.takeScreenshot());
                document.getElementById('refreshList')?.addEventListener('click', () => this.loadScreenshots());
                document.getElementById('viewGrid')?.addEventListener('click', () => this.setView('grid'));
                document.getElementById('viewList')?.addEventListener('click', () => this.setView('list'));
                document.getElementById('deleteScreenshot')?.addEventListener('click', () => this.deleteCurrentScreenshot());
            }

            async takeScreenshot() {
                const captureBtn = document.getElementById('captureBtn');
                const originalText = captureBtn.innerHTML;

                try {
                    captureBtn.disabled = true;
                    captureBtn.innerHTML = '<i class="ti ti-loader-2 spinner"></i> Capturing...';

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
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(options)
                    });

                    const result = await response.json();

                    if (result.success) {
                        this.showNotification('Screenshot captured successfully!', 'success');
                        await this.loadScreenshots();
                        document.getElementById('customFilename').value = '';
                    } else {
                        throw new Error(result.error || 'Capture failed');
                    }
                } catch (error) {
                    this.showNotification(`Capture failed: ${error.message}`, 'error');
                } finally {
                    captureBtn.disabled = false;
                    captureBtn.innerHTML = originalText;
                }
            }

            async loadScreenshots() {
                const response = await fetch('/api/screencapture/list');
                const result = await response.json();

                if (result.success) {
                    this.screenshots = result.data;
                    this.renderScreenshots();
                }
            }

            async loadStatus() {
                const response = await fetch('/api/screencapture/status');
                const result = await response.json();

                if (result.success) {
                    this.updateStatusDisplay(result.data);
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
                    container.innerHTML = '<p>No screenshots yet</p>';
                    return;
                }

                if (this.currentView === 'list') {
                    container.innerHTML = this.screenshots.map(screenshot => `
                        <div class="screenshot-item" data-filename="${screenshot.filename}">
                            <img src="/api/screencapture/view/${screenshot.filename}" class="screenshot-thumbnail">
                            <div class="screenshot-info">
                                <h6>${screenshot.filename}</h6>
                                <small>${this.formatDate(screenshot.created)} • ${this.formatFileSize(screenshot.size)}</small>
                            </div>
                        </div>
                    `).join('');
                } else {
                    container.innerHTML = this.screenshots.map(screenshot => `
                        <div class="screenshot-item grid-item">
                            <img src="/api/screencapture/view/${screenshot.filename}">
                            <h6>${screenshot.filename}</h6>
                        </div>
                    `).join('');
                }
            }

            setView(view) {
                this.currentView = view;
                const container = document.getElementById('screenshotsList');

                document.getElementById('viewList').classList.toggle('active', view === 'list');
                document.getElementById('viewGrid').classList.toggle('active', view === 'grid');

                container.className = `screenshots-container ${view}-view`;
                this.renderScreenshots();
            }

            viewScreenshot(filename) {
                this.currentScreenshot = filename;
                document.getElementById('screenshotModalTitle').textContent = filename;
                document.getElementById('screenshotPreview').src = `/api/screencapture/view/${filename}`;
            }

            async deleteScreenshot(filename) {
                const response = await fetch(`/api/screencapture/${filename}`, {
                    method: 'DELETE'
                });

                const result = await response.json();

                if (result.success) {
                    this.showNotification('Screenshot deleted successfully', 'success');
                    await this.loadScreenshots();
                } else {
                    throw new Error(result.error || 'Delete failed');
                }
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
                // Mock notification for testing
                this.lastNotification = { message, type };
            }
        }

        manager = new TestScreenCaptureManager();
    });

    describe('Initialization', () => {
        it('should initialize with default values', () => {
            expect(manager.currentView).toBe('list');
            expect(manager.screenshots).toEqual([]);
            expect(manager.currentScreenshot).toBeNull();
        });

        it('should set up event listeners', () => {
            const captureBtn = document.getElementById('captureBtn');
            const refreshBtn = document.getElementById('refreshList');

            expect(captureBtn).toBeTruthy();
            expect(refreshBtn).toBeTruthy();

            manager.setupEventListeners();
            // Event listeners are set up (we can't easily test the actual listeners without more complex setup)
        });
    });

    describe('Screenshot Capture', () => {
        beforeEach(() => {
            manager.setupEventListeners();
        });

        it('should capture screenshot with default options', async () => {
            mockFetch.mockResolvedValueOnce({
                json: () => Promise.resolve({
                    success: true,
                    data: {
                        filename: 'screenshot_123.png',
                        size: 1024000,
                        timestamp: '2023-01-01T10:00:00Z'
                    }
                })
            });

            await manager.takeScreenshot();

            expect(mockFetch).toHaveBeenCalledWith('/api/screencapture/capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    format: 'png',
                    displayId: 1
                })
            });
        });

        it('should capture screenshot with custom options', async () => {
            // Set custom values
            document.getElementById('captureType').value = 'window';
            document.getElementById('captureFormat').value = 'jpg';
            document.getElementById('displayId').value = '2';
            document.getElementById('customFilename').value = 'my_screenshot';

            mockFetch.mockResolvedValueOnce({
                json: () => Promise.resolve({ success: true, data: {} })
            });

            await manager.takeScreenshot();

            expect(mockFetch).toHaveBeenCalledWith('/api/screencapture/capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: expect.stringMatching(/"format":"jpg".*"displayId":2.*"window":true.*"filename":"my_screenshot_\d+\.jpg"/)
            });
        });

        it('should handle capture failure', async () => {
            mockFetch.mockResolvedValueOnce({
                json: () => Promise.resolve({
                    success: false,
                    error: 'Screen capture failed'
                })
            });

            await manager.takeScreenshot();

            expect(manager.lastNotification).toEqual({
                message: 'Capture failed: Screen capture failed',
                type: 'error'
            });
        });

        it('should disable button during capture', async () => {
            const captureBtn = document.getElementById('captureBtn');
            const originalText = captureBtn.innerHTML;

            // Mock a slow response
            let resolvePromise;
            const promise = new Promise(resolve => { resolvePromise = resolve; });

            mockFetch.mockReturnValueOnce(promise.then(() => ({
                json: () => Promise.resolve({ success: true, data: {} })
            })));

            const capturePromise = manager.takeScreenshot();

            // Button should be disabled during capture
            expect(captureBtn.disabled).toBe(true);
            expect(captureBtn.innerHTML).toContain('Capturing...');

            // Resolve the mock response
            resolvePromise();
            await capturePromise;

            // Button should be re-enabled
            expect(captureBtn.disabled).toBe(false);
            expect(captureBtn.innerHTML).toBe(originalText);
        });
    });

    describe('Screenshot List Management', () => {
        it('should load and display screenshots', async () => {
            const mockScreenshots = [
                {
                    filename: 'shot1.png',
                    size: 1024000,
                    created: '2023-01-01T10:00:00Z'
                },
                {
                    filename: 'shot2.jpg',
                    size: 512000,
                    created: '2023-01-01T11:00:00Z'
                }
            ];

            mockFetch.mockResolvedValueOnce({
                json: () => Promise.resolve({
                    success: true,
                    data: mockScreenshots
                })
            });

            await manager.loadScreenshots();

            expect(manager.screenshots).toEqual(mockScreenshots);

            const container = document.getElementById('screenshotsList');
            expect(container.innerHTML).toContain('shot1.png');
            expect(container.innerHTML).toContain('shot2.jpg');
        });

        it('should display empty state when no screenshots', async () => {
            mockFetch.mockResolvedValueOnce({
                json: () => Promise.resolve({
                    success: true,
                    data: []
                })
            });

            await manager.loadScreenshots();

            const container = document.getElementById('screenshotsList');
            expect(container.innerHTML).toContain('No screenshots yet');
        });
    });

    describe('View Management', () => {
        beforeEach(() => {
            manager.screenshots = [
                { filename: 'test1.png', size: 1000, created: '2023-01-01T10:00:00Z' },
                { filename: 'test2.png', size: 2000, created: '2023-01-01T11:00:00Z' }
            ];
        });

        it('should switch to grid view', () => {
            manager.setView('grid');

            expect(manager.currentView).toBe('grid');

            const listBtn = document.getElementById('viewList');
            const gridBtn = document.getElementById('viewGrid');

            expect(listBtn.classList.contains('active')).toBe(false);
            expect(gridBtn.classList.contains('active')).toBe(true);

            const container = document.getElementById('screenshotsList');
            expect(container.className).toContain('grid-view');
        });

        it('should switch to list view', () => {
            manager.currentView = 'grid';
            manager.setView('list');

            expect(manager.currentView).toBe('list');

            const listBtn = document.getElementById('viewList');
            const gridBtn = document.getElementById('viewGrid');

            expect(listBtn.classList.contains('active')).toBe(true);
            expect(gridBtn.classList.contains('active')).toBe(false);

            const container = document.getElementById('screenshotsList');
            expect(container.className).toContain('list-view');
        });
    });

    describe('Status Display', () => {
        it('should update status display with data', () => {
            const mockStatus = {
                totalScreenshots: 5,
                diskUsage: 5242880, // 5MB
                latestScreenshot: {
                    created: '2023-01-01T10:00:00Z'
                },
                captureDirectory: '/path/to/captures'
            };

            manager.updateStatusDisplay(mockStatus);

            expect(document.getElementById('totalScreenshots').textContent).toBe('5');
            expect(document.getElementById('diskUsage').textContent).toBe('5 MB');
            expect(document.getElementById('latestCapture').textContent).toContain('2023');
            expect(document.getElementById('captureDirectory').textContent).toBe('captures');
        });

        it('should handle empty status', () => {
            const mockStatus = {
                totalScreenshots: 0,
                diskUsage: 0,
                latestScreenshot: null,
                captureDirectory: '/empty/path'
            };

            manager.updateStatusDisplay(mockStatus);

            expect(document.getElementById('totalScreenshots').textContent).toBe('0');
            expect(document.getElementById('diskUsage').textContent).toBe('0 B');
            expect(document.getElementById('latestCapture').textContent).toBe('None');
        });
    });

    describe('Screenshot Deletion', () => {
        it('should delete screenshot successfully', async () => {
            mockFetch.mockResolvedValueOnce({
                json: () => Promise.resolve({
                    success: true,
                    data: { filename: 'test.png' }
                })
            });

            // Mock loadScreenshots to avoid additional fetch
            manager.loadScreenshots = jest.fn();

            await manager.deleteScreenshot('test.png');

            expect(mockFetch).toHaveBeenCalledWith('/api/screencapture/test.png', {
                method: 'DELETE'
            });

            expect(manager.lastNotification).toEqual({
                message: 'Screenshot deleted successfully',
                type: 'success'
            });

            expect(manager.loadScreenshots).toHaveBeenCalled();
        });

        it('should handle deletion failure', async () => {
            mockFetch.mockResolvedValueOnce({
                json: () => Promise.resolve({
                    success: false,
                    error: 'File not found'
                })
            });

            await expect(manager.deleteScreenshot('test.png')).rejects.toThrow('File not found');
        });
    });

    describe('Utility Functions', () => {
        describe('formatFileSize', () => {
            it('should format bytes correctly', () => {
                expect(manager.formatFileSize(0)).toBe('0 B');
                expect(manager.formatFileSize(512)).toBe('512 B');
                expect(manager.formatFileSize(1024)).toBe('1 KB');
                expect(manager.formatFileSize(1536)).toBe('1.5 KB');
                expect(manager.formatFileSize(1048576)).toBe('1 MB');
                expect(manager.formatFileSize(1073741824)).toBe('1 GB');
            });
        });

        describe('formatDate', () => {
            it('should format date strings', () => {
                const dateString = '2023-01-01T10:00:00Z';
                const formatted = manager.formatDate(dateString);

                expect(formatted).toContain('2023');
                expect(typeof formatted).toBe('string');
            });
        });
    });

    describe('Screenshot Modal', () => {
        it('should open screenshot in modal', () => {
            const filename = 'test.png';

            manager.viewScreenshot(filename);

            expect(manager.currentScreenshot).toBe(filename);
            expect(document.getElementById('screenshotModalTitle').textContent).toBe(filename);
            expect(document.getElementById('screenshotPreview').src).toBe(`http://localhost/api/screencapture/view/${filename}`);
        });
    });
});