/**
 * GYROMAZE - Main Entry Point
 * A tilt-controlled ball maze game PWA
 */

import { GameEngine } from './game/GameEngine.js';
import { UIManager } from './ui/UIManager.js';
import { InputManager } from './game/InputManager.js';
import { LevelManager } from './game/LevelManager.js';
import { AudioManager } from './utils/AudioManager.js';
import { StorageManager } from './utils/StorageManager.js';
import { UpgradeManager } from './game/UpgradeManager.js';
import { EngagementManager } from './game/EngagementManager.js';

class MazeEscapeApp {
    constructor() {
        this.initialized = false;
        this.gameEngine = null;
        this.uiManager = null;
        this.inputManager = null;
        this.levelManager = null;
        this.audioManager = null;
        this.storageManager = null;
        this.upgradeManager = null;
        this.engagementManager = null;
    }

    async init() {
        console.log('🎮 Maze Escape Initializing...');

        // Show loading progress
        const progressBar = document.querySelector('.loader-progress');
        const loaderText = document.querySelector('.loader-text');

        // Helper to safely update progress
        const updateProgress = (text, percent) => {
            if (loaderText) loaderText.textContent = text;
            if (progressBar) progressBar.style.width = percent;
        };

        try {
            // Initialize storage (10%)
            loaderText.textContent = 'Loading saved data...';
            progressBar.style.width = '10%';
            this.storageManager = new StorageManager();
            await this.storageManager.init();
            await this.delay(100);

            // Initialize upgrade manager (20%)
            loaderText.textContent = 'Loading upgrades...';
            progressBar.style.width = '20%';
            this.upgradeManager = new UpgradeManager(this.storageManager);
            await this.delay(100);

            // Initialize engagement manager (25%)
            loaderText.textContent = 'Loading rewards...';
            progressBar.style.width = '25%';
            this.engagementManager = new EngagementManager(this.storageManager);
            this.engagementManager.init();
            await this.delay(100);

            // Initialize level manager (40%)
            loaderText.textContent = 'Generating 100 levels...';
            progressBar.style.width = '40%';
            this.levelManager = new LevelManager(this.storageManager, this.upgradeManager);
            await this.levelManager.init();
            await this.delay(100);

            // Initialize audio (50%)
            loaderText.textContent = 'Loading audio...';
            progressBar.style.width = '50%';
            this.audioManager = new AudioManager(this.storageManager);
            await this.audioManager.init();
            await this.delay(200);

            // Initialize input manager (70%)
            loaderText.textContent = 'Initializing sensors...';
            progressBar.style.width = '70%';
            this.inputManager = new InputManager(this.storageManager);
            await this.inputManager.init();
            await this.delay(200);

            // Initialize game engine (90%)
            loaderText.textContent = 'Preparing game engine...';
            progressBar.style.width = '90%';
            this.gameEngine = new GameEngine(
                this.inputManager,
                this.levelManager,
                this.audioManager,
                this.storageManager,
                this.upgradeManager
            );
            this.gameEngine.init();
            await this.delay(200);

            // Initialize UI (100%)
            loaderText.textContent = 'Ready!';
            progressBar.style.width = '100%';
            this.uiManager = new UIManager(
                this.gameEngine,
                this.levelManager,
                this.audioManager,
                this.storageManager,
                this.inputManager,
                this.upgradeManager,
                this.engagementManager
            );
            this.uiManager.init();
            await this.delay(300);

            // Register service worker
            this.registerServiceWorker();

            // Hide loading screen and show menu
            this.initialized = true;
            this.uiManager.showScreen('menu');

            console.log('✅ Maze Escape Ready!');
        } catch (error) {
            console.error('Failed to initialize Maze Escape:', error);
            console.error('Error stack:', error.stack);
            loaderText.textContent = `Error: ${error.message}`;
            progressBar.style.width = '0%';
            progressBar.style.background = '#ff3366';
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('./sw.js');
                console.log('ServiceWorker registered:', registration.scope);
            } catch (error) {
                console.warn('ServiceWorker registration failed:', error);
            }
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new MazeEscapeApp();
    app.init();

    // Make app globally accessible for debugging
    window.MazeEscapeApp = app;
});

// Prevent default touch behaviors that interfere with game
document.addEventListener('touchmove', (e) => {
    if (e.target.closest('#game-canvas, .touch-controls')) {
        e.preventDefault();
    }
}, { passive: false });

// Prevent zoom on double tap
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, false);

// Handle visibility change (pause game when tab hidden)
document.addEventListener('visibilitychange', () => {
    if (document.hidden && window.MazeEscapeApp?.gameEngine?.isRunning) {
        window.MazeEscapeApp.uiManager.pauseGame();
    }
});
