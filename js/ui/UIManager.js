/**
 * UIManager.js
 * Handles all UI screens, transitions, and user interactions
 */

// Shop items configuration
const SHOP_ITEMS = {
    balls: [
        { id: 'ball_default', name: 'Cyan', price: 0, colors: ['#ffffff', '#00f5ff', '#0088aa'], glow: '#00f5ff' },
        { id: 'ball_fire', name: 'Fire', price: 50, colors: ['#ffffff', '#ff6b35', '#ff0000'], glow: '#ff6b35' },
        { id: 'ball_toxic', name: 'Toxic', price: 50, colors: ['#ffffff', '#00ff88', '#00aa44'], glow: '#00ff88' },
        { id: 'ball_purple', name: 'Purple', price: 75, colors: ['#ffffff', '#8b5cf6', '#5b21b6'], glow: '#8b5cf6' },
        { id: 'ball_gold', name: 'Gold', price: 100, colors: ['#ffffff', '#ffd700', '#b8860b'], glow: '#ffd700' },
        { id: 'ball_rainbow', name: 'Rainbow', price: 200, colors: ['#ff0000', '#00ff00', '#0000ff'], glow: '#ffffff', rainbow: true }
    ],
    trails: [
        { id: 'trail_default', name: 'Default', price: 0, color: '#00f5ff' },
        { id: 'trail_none', name: 'None', price: 25, color: 'transparent' },
        { id: 'trail_fire', name: 'Fire', price: 75, color: '#ff6b35' },
        { id: 'trail_sparkle', name: 'Sparkle', price: 100, color: '#ffd700' },
        { id: 'trail_rainbow', name: 'Rainbow', price: 150, color: null, rainbow: true }
    ]
};

export class UIManager {
    constructor(gameEngine, levelManager, audioManager, storageManager, inputManager, upgradeManager, engagementManager) {
        this.gameEngine = gameEngine;
        this.levelManager = levelManager;
        this.audioManager = audioManager;
        this.storageManager = storageManager;
        this.inputManager = inputManager;
        this.upgradeManager = upgradeManager;
        this.engagementManager = engagementManager;

        // Screen references
        this.screens = {};
        this.currentScreen = 'loading';
        this.selectedLevel = 0;

        // Timer display
        this.timerElement = null;

        // Track wall hits for no-wall achievement
        this.wallHitsThisLevel = 0;
        this.deathsThisLevel = 0;

        // Pending upgrade for purchase flow
        this.pendingUpgrade = null;
    }

    init() {
        // Cache screen elements
        this.screens = {
            loading: document.getElementById('loading-screen'),
            menu: document.getElementById('menu-screen'),
            levels: document.getElementById('level-screen'),
            settings: document.getElementById('settings-screen'),
            game: document.getElementById('game-screen'),
            store: document.getElementById('store-screen')
        };

        this.timerElement = document.getElementById('game-timer');

        // Setup event listeners
        this.setupMenuListeners();
        this.setupLevelSelectListeners();
        this.setupSettingsListeners();
        this.setupGameListeners();
        this.setupModalListeners();
        this.setupStoreListeners();
        this.setupUpgradeListeners();
        this.setupCopyUrlButton();

        // Setup game engine callbacks
        this.setupGameCallbacks();

        // Populate level grid
        this.populateLevelGrid();

        // Update coin displays
        this.updateCoinDisplays();

        // Update progress display
        this.updateProgressDisplay();

        // Setup engagement listeners
        this.setupEngagementListeners();

        // Check for engagement rewards on load
        setTimeout(() => this.checkEngagementRewards(), 500);

        console.log('UIManager initialized');
    }

    checkEngagementRewards() {
        if (!this.engagementManager) {
            console.warn('EngagementManager not available');
            return;
        }

        try {
            // Check comeback bonus first
            const comeback = this.engagementManager.checkComebackBonus();
            if (comeback && comeback.eligible) {
                this.showComebackModal(comeback);
                return; // Show one at a time
            }

            // Check daily reward
            const daily = this.engagementManager.checkDailyReward();
            if (daily && daily.available && !daily.alreadyClaimed) {
                this.showDailyRewardModal(daily);
            }
        } catch (e) {
            console.error('Error checking engagement rewards:', e);
        }
    }

    setupUpgradeListeners() {
        // Upgrade shop button in store
        const upgradeBtn = document.getElementById('btn-upgrades');
        if (upgradeBtn) {
            upgradeBtn.addEventListener('click', () => {
                this.audioManager.playSound('click');
                this.showUpgradeShop();
            });
        }
    }

    showUpgradeShop() {
        const modal = document.getElementById('upgrade-modal');
        if (!modal) {
            this.createUpgradeModal();
        }
        this.populateUpgradeShop();
        this.showModal('upgrade-modal');
    }

    createUpgradeModal() {
        const modal = document.createElement('div');
        modal.id = 'upgrade-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content upgrade-modal-content">
                <h2 class="modal-title">UPGRADES</h2>
                <p class="upgrade-subtitle">Required to access higher levels</p>
                <div id="upgrade-list" class="upgrade-list"></div>
                <button class="menu-btn" id="btn-close-upgrades">
                    <span class="btn-text">CLOSE</span>
                </button>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('btn-close-upgrades').addEventListener('click', () => {
            this.audioManager.playSound('click');
            this.hideModal('upgrade-modal');
        });
    }

    populateUpgradeShop() {
        const list = document.getElementById('upgrade-list');
        if (!list) return;

        const upgrades = this.upgradeManager.getAllUpgrades();
        const coins = this.storageManager.getCoins();

        list.innerHTML = upgrades.map(upgrade => {
            const isPurchased = this.upgradeManager.isPurchased(upgrade.id);
            const canAfford = coins >= upgrade.cost;

            return `
                <div class="upgrade-item ${isPurchased ? 'purchased' : ''} ${!canAfford && !isPurchased ? 'locked' : ''}">
                    <div class="upgrade-icon">${upgrade.icon}</div>
                    <div class="upgrade-info">
                        <div class="upgrade-name">${upgrade.name}</div>
                        <div class="upgrade-desc">${upgrade.description}</div>
                        <div class="upgrade-unlock">Unlocks Level ${upgrade.requiredForLevel}+</div>
                    </div>
                    <div class="upgrade-action">
                        ${isPurchased
                            ? '<span class="owned-badge">OWNED</span>'
                            : `<button class="buy-upgrade-btn ${canAfford ? '' : 'disabled'}" data-upgrade="${upgrade.id}">
                                <span class="coin-icon">$</span>${upgrade.cost}
                               </button>`
                        }
                    </div>
                </div>
            `;
        }).join('');

        // Add buy button listeners
        list.querySelectorAll('.buy-upgrade-btn:not(.disabled)').forEach(btn => {
            btn.addEventListener('click', () => {
                const upgradeId = btn.dataset.upgrade;
                this.purchaseUpgrade(upgradeId);
            });
        });
    }

    purchaseUpgrade(upgradeId) {
        const result = this.upgradeManager.purchase(upgradeId);

        if (result.success) {
            this.audioManager.playSound('star');
            this.showToast(`${result.upgrade.name} unlocked!`);
            this.populateUpgradeShop();
            this.updateCoinDisplays();
            this.populateLevelGrid(); // Refresh level availability
        } else {
            this.showToast(result.error);
        }
    }

    updateProgressDisplay() {
        const progressEl = document.getElementById('progress-display');
        if (progressEl) {
            const completed = this.levelManager.getCompletedCount();
            const total = this.levelManager.totalLevels;
            const stars = this.levelManager.getTotalStars();
            const maxStars = this.levelManager.getMaxPossibleStars();
            progressEl.innerHTML = `
                <span>Levels: ${completed}/${total}</span>
                <span>Stars: ${stars}/${maxStars}</span>
            `;
        }
    }

    setupMenuListeners() {
        // Play button - resume last level or start first
        document.getElementById('btn-play').addEventListener('click', () => {
            this.audioManager.playSound('click');
            const currentLevel = this.levelManager.getCurrentLevel();
            this.startGame(currentLevel);
        });

        // Levels button
        document.getElementById('btn-levels').addEventListener('click', () => {
            this.audioManager.playSound('click');
            this.showScreen('levels');
        });

        // Settings button
        document.getElementById('btn-settings').addEventListener('click', () => {
            this.audioManager.playSound('click');
            this.showScreen('settings');
        });

        // Store button
        document.getElementById('btn-store').addEventListener('click', () => {
            this.audioManager.playSound('click');
            this.showScreen('store');
        });

        // Help button
        document.getElementById('btn-help').addEventListener('click', () => {
            this.audioManager.playSound('click');
            this.showModal('help-modal');
        });

        // Close help modal
        document.getElementById('btn-close-help').addEventListener('click', () => {
            this.audioManager.playSound('click');
            this.hideModal('help-modal');
        });
    }

    setupLevelSelectListeners() {
        // Back button
        document.getElementById('btn-back-levels').addEventListener('click', () => {
            this.audioManager.playSound('click');
            this.showScreen('menu');
        });

        // Start level button
        document.getElementById('btn-start-level').addEventListener('click', () => {
            this.audioManager.playSound('click');
            this.startGame(this.selectedLevel);
        });
    }

    setupSettingsListeners() {
        // Back button
        document.getElementById('btn-back-settings').addEventListener('click', () => {
            this.audioManager.playSound('click');
            this.showScreen('menu');
        });

        // Sensitivity slider
        const sensitivitySlider = document.getElementById('sensitivity-slider');
        const sensitivityValue = document.getElementById('sensitivity-value');
        
        sensitivitySlider.value = this.storageManager.getSensitivity();
        sensitivityValue.textContent = `${sensitivitySlider.value}x`;
        
        sensitivitySlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            sensitivityValue.textContent = `${value.toFixed(1)}x`;
            this.storageManager.setSensitivity(value);
        });

        // Sound effects toggle
        const toggleSfx = document.getElementById('toggle-sfx');
        toggleSfx.classList.toggle('active', this.storageManager.isSfxEnabled());
        
        toggleSfx.addEventListener('click', () => {
            toggleSfx.classList.toggle('active');
            const enabled = toggleSfx.classList.contains('active');
            this.storageManager.setSfxEnabled(enabled);
            this.audioManager.setSfxEnabled(enabled);
            if (enabled) this.audioManager.playSound('click');
        });

        // Music toggle
        const toggleMusic = document.getElementById('toggle-music');
        toggleMusic.classList.toggle('active', this.storageManager.isMusicEnabled());
        
        toggleMusic.addEventListener('click', () => {
            toggleMusic.classList.toggle('active');
            const enabled = toggleMusic.classList.contains('active');
            this.storageManager.setMusicEnabled(enabled);
            this.audioManager.setMusicEnabled(enabled);
            this.audioManager.playSound('click');
        });

        // Vibration toggle
        const toggleVibration = document.getElementById('toggle-vibration');
        toggleVibration.classList.toggle('active', this.storageManager.isVibrationEnabled());

        toggleVibration.addEventListener('click', () => {
            toggleVibration.classList.toggle('active');
            const enabled = toggleVibration.classList.contains('active');
            this.storageManager.setVibrationEnabled(enabled);
            if (enabled && navigator.vibrate) navigator.vibrate(50);
            this.audioManager.playSound('click');
        });

        // Voice toggle
        const toggleVoice = document.getElementById('toggle-voice');
        const voiceEnabled = this.storageManager.getSetting('voiceEnabled') !== false;
        toggleVoice.classList.toggle('active', voiceEnabled);

        toggleVoice.addEventListener('click', () => {
            toggleVoice.classList.toggle('active');
            const enabled = toggleVoice.classList.contains('active');
            this.audioManager.setVoiceEnabled(enabled);
            this.audioManager.playSound('click');
            if (enabled) {
                this.audioManager.speak('Voice enabled');
            }
        });

        // Calibrate button
        document.getElementById('btn-calibrate').addEventListener('click', () => {
            this.audioManager.playSound('click');
            this.inputManager.calibrate();
            this.showToast('Calibrated! Hold your device at the desired neutral angle.');
        });

        // Reset progress button
        document.getElementById('btn-reset').addEventListener('click', () => {
            this.audioManager.playSound('click');
            if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
                this.levelManager.resetProgress();
                this.populateLevelGrid();
                this.showToast('Progress reset!');
            }
        });
    }

    setupGameListeners() {
        // Pause button
        document.getElementById('btn-pause').addEventListener('click', () => {
            this.audioManager.playSound('click');
            this.pauseGame();
        });

        // Restart button
        document.getElementById('btn-restart').addEventListener('click', () => {
            this.audioManager.playSound('click');
            this.gameEngine.restart();
        });

        // Time Warp button
        const timewarpBtn = document.getElementById('btn-timewarp');
        if (timewarpBtn) {
            timewarpBtn.addEventListener('click', () => {
                if (this.gameEngine.activateTimeWarp()) {
                    timewarpBtn.classList.add('used');
                    this.audioManager.playSound('powerup');
                }
            });
        }
    }

    // Update powerup buttons visibility based on upgrades
    updatePowerupButtons() {
        try {
            const timewarpBtn = document.getElementById('btn-timewarp');
            if (timewarpBtn && this.upgradeManager) {
                const effects = this.upgradeManager.getActiveEffects() || {};
                if (effects.slowMotion) {
                    timewarpBtn.classList.remove('hidden');
                    // Reset used state if can use
                    if (this.gameEngine && this.gameEngine.canUseTimeWarp()) {
                        timewarpBtn.classList.remove('used');
                    } else {
                        timewarpBtn.classList.add('used');
                    }
                } else {
                    timewarpBtn.classList.add('hidden');
                }
            }
        } catch (e) {
            console.error('Error updating powerup buttons:', e);
        }
    }

    setupModalListeners() {
        // Pause modal
        document.getElementById('btn-resume').addEventListener('click', () => {
            this.audioManager.playSound('click');
            this.resumeGame();
        });

        document.getElementById('btn-restart-modal').addEventListener('click', () => {
            this.audioManager.playSound('click');
            this.hideModal('pause-modal');
            this.gameEngine.restart();
        });

        document.getElementById('btn-quit').addEventListener('click', () => {
            this.audioManager.playSound('click');
            this.quitGame();
        });

        // Win modal - Next Level button
        document.getElementById('btn-next-level').addEventListener('click', () => {
            this.audioManager.playSound('click');
            this.handleNextLevel();
        });

        document.getElementById('btn-replay').addEventListener('click', () => {
            this.audioManager.playSound('click');
            this.hideModal('win-modal');
            this.gameEngine.restart();
        });

        document.getElementById('btn-win-quit').addEventListener('click', () => {
            this.audioManager.playSound('click');
            this.quitGame();
            this.hideModal('win-modal');
        });

        // Lose modal
        document.getElementById('btn-try-again').addEventListener('click', () => {
            this.audioManager.playSound('click');
            this.hideModal('lose-modal');
            this.gameEngine.restart();
        });

        document.getElementById('btn-lose-quit').addEventListener('click', () => {
            this.audioManager.playSound('click');
            this.quitGame();
            this.hideModal('lose-modal');
        });

        // Permission modal
        document.getElementById('btn-grant-permission').addEventListener('click', async () => {
            this.audioManager.playSound('click');
            const granted = await this.inputManager.requestMotionPermission();
            if (granted) {
                this.hideModal('permission-modal');
                this.continueToGame();
            } else {
                // Show detailed instructions for Safari
                this.showPermissionDeniedHelp();
            }
        });

        document.getElementById('btn-use-touch').addEventListener('click', () => {
            this.audioManager.playSound('click');
            this.inputManager.enableTouchControls();
            this.hideModal('permission-modal');
            this.continueToGame();
        });
    }

    setupGameCallbacks() {
        // Timer update
        this.gameEngine.onTimeUpdate = (elapsed) => {
            this.updateTimer(elapsed);
        };

        // Win callback - use enhanced version with engagement
        this.gameEngine.onWin = (data) => {
            this.showEnhancedWinModal(data);
        };

        // Lose callback (still has lives) - use enhanced version
        this.gameEngine.onLose = (remainingLives) => {
            this.showEnhancedLoseModal(remainingLives);
        };

        // Game over callback (no lives left)
        this.gameEngine.onGameOver = () => {
            this.showGameOverModal();
        };

        // Life lost callback - update HUD
        this.gameEngine.onLifeLost = (remainingLives) => {
            this.updateLivesDisplay();
        };

        // Life collected callback - update HUD
        this.gameEngine.onLifeCollected = (newLives) => {
            this.updateLivesDisplay();
            this.showToast('+1 Life!');
        };

        // Coin collected callback - update HUD and engagement
        this.gameEngine.onCoinCollected = (amount) => {
            this.updateCoinDisplays();
            this.engagementManager.updateDailyChallengeProgress('coins_collected', amount || 1);
        };

        // Wall hit callback
        this.gameEngine.onWallHit = () => {
            this.recordWallHit();
        };

        // Level start callback - reset tracking
        this.gameEngine.onLevelStart = () => {
            this.wallHitsThisLevel = 0;
            this.deathsThisLevel = 0;
        };
    }

    showScreen(screenName) {
        // Hide all screens
        Object.values(this.screens).forEach(screen => {
            screen.classList.remove('active');
        });

        // Show target screen
        const targetScreen = this.screens[screenName];
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenName;
        }

        // Update level grid if showing levels
        if (screenName === 'levels') {
            this.populateLevelGrid();
        }

        // Populate store if showing store
        if (screenName === 'store') {
            this.populateStore();
        }

        // Update coin display when showing menu
        if (screenName === 'menu') {
            this.updateCoinDisplays();
        }
    }

    populateLevelGrid() {
        try {
            const grid = document.getElementById('level-grid');
            if (!grid) return;
            grid.innerHTML = '';

            const levelsData = this.levelManager.getAllLevelsData();
            if (!levelsData || !Array.isArray(levelsData)) return;

            levelsData.forEach((data, index) => {
                if (!data) return; // Skip null entries
            const tile = document.createElement('div');
            tile.className = 'level-tile';
            tile.dataset.level = index;

            // Check if level needs upgrade
            const needsUpgrade = data.unlocked && !data.canAccess && data.requiredUpgrade;

            if (data.unlocked && data.canAccess) {
                tile.classList.add('unlocked');
                if (data.completed) {
                    tile.classList.add('completed');
                }
            } else if (needsUpgrade) {
                tile.classList.add('upgrade-locked');
            } else {
                tile.classList.add('locked');
            }

            // Level number
            const number = document.createElement('span');
            number.className = 'level-number';
            number.textContent = index + 1;
            tile.appendChild(number);

            // Stars display for accessible levels
            if (data.unlocked && data.canAccess) {
                const stars = document.createElement('div');
                stars.className = 'level-stars';
                for (let i = 0; i < 3; i++) {
                    const star = document.createElement('span');
                    star.className = 'star';
                    star.textContent = '★';
                    if (i < data.stars) {
                        star.classList.add('earned');
                    }
                    stars.appendChild(star);
                }
                tile.appendChild(stars);
            }

            // Upgrade lock icon for levels needing upgrade
            if (needsUpgrade) {
                const upgradeIcon = document.createElement('div');
                upgradeIcon.className = 'upgrade-lock-icon';
                upgradeIcon.textContent = data.requiredUpgrade.icon;
                upgradeIcon.title = `Requires ${data.requiredUpgrade.name}`;
                tile.appendChild(upgradeIcon);
            }

            // Click handler
            if (data.unlocked) {
                tile.addEventListener('click', () => {
                    this.selectLevel(index);
                });
            }

                grid.appendChild(tile);
            });

            // Select current level by default
            const currentLevel = this.levelManager.getCurrentLevel() || 0;
            this.selectLevel(currentLevel);
        } catch (error) {
            console.error('Error populating level grid:', error);
        }
    }

    selectLevel(index) {
        try {
            const data = this.levelManager.getLevelData(index);
            if (!data || !data.unlocked) return;

            this.selectedLevel = index;
            this.audioManager.playSound('click');

            // Update tile selection
            document.querySelectorAll('.level-tile').forEach(tile => {
                tile.classList.remove('selected');
                if (parseInt(tile.dataset.level) === index) {
                    tile.classList.add('selected');
                }
            });

            // Update info card with null safety
            const levelName = data.level?.name || `Stage ${index + 1}`;
            const infoLevelName = document.getElementById('info-level-name');
            if (infoLevelName) {
                infoLevelName.textContent = `Level ${index + 1}: ${levelName}`;
            }

            const infoBestTime = document.getElementById('info-best-time');
            if (infoBestTime) {
                infoBestTime.textContent = data.bestTime ? this.levelManager.formatTime(data.bestTime) : '--:--';
            }

            const stars = data.stars || 0;
            const starsDisplay = '★'.repeat(stars) + '☆'.repeat(3 - stars);
            const infoStars = document.getElementById('info-stars');
            if (infoStars) {
                infoStars.textContent = starsDisplay;
            }

            // Update start button based on upgrade requirements
            const startBtn = document.getElementById('btn-start-level');
            if (startBtn) {
                if (!data.canAccess && data.requiredUpgrade) {
                    const btnText = startBtn.querySelector('.btn-text');
                    if (btnText) {
                        btnText.textContent = `REQUIRES ${data.requiredUpgrade.name.toUpperCase()}`;
                    }
                    startBtn.classList.add('upgrade-required');
                } else {
                    const btnText = startBtn.querySelector('.btn-text');
                    if (btnText) {
                        btnText.textContent = 'START';
                    }
                    startBtn.classList.remove('upgrade-required');
                }
            }
        } catch (error) {
            console.error('Error in selectLevel:', error);
            // Still set the selected level even if UI update fails
            this.selectedLevel = index;
        }
    }

    async startGame(levelIndex) {
        // Check if level can be played (upgrade requirements)
        const canPlay = this.levelManager.canPlayLevel(levelIndex);
        if (!canPlay.canPlay) {
            if (canPlay.requiredUpgrade) {
                this.showUpgradeRequiredModal(canPlay.requiredUpgrade, canPlay.reason);
            } else {
                this.showToast(canPlay.reason);
            }
            return;
        }

        this.selectedLevel = levelIndex;
        this.levelManager.setCurrentLevel(levelIndex);

        // Check motion permission
        if (this.inputManager.getMode() === 'none') {
            const hasPermission = await this.inputManager.checkMotionPermission();

            if (hasPermission === 'unsupported-browser') {
                // Chrome/Firefox on iOS don't support motion sensors
                this.updatePermissionModalForUnsupportedBrowser();
                this.showModal('permission-modal');
                return;
            } else if (!hasPermission) {
                this.updatePermissionModalForSafari();
                this.showModal('permission-modal');
                return;
            } else if (hasPermission === 'maybe') {
                // Try to detect sensors
                const granted = await this.inputManager.requestMotionPermission();
                if (!granted) {
                    this.updatePermissionModalForSafari();
                    this.showModal('permission-modal');
                    return;
                }
            }
        }

        this.continueToGame();
    }

    // Handle next level button - ultra simplified and robust
    handleNextLevel() {
        console.log('handleNextLevel called');

        // First, ensure game is stopped
        try {
            if (this.gameEngine) {
                this.gameEngine.stop();
            }
        } catch (e) {
            console.error('Error stopping game:', e);
        }

        // Hide win modal
        try {
            this.hideModal('win-modal');
        } catch (e) {
            console.error('Error hiding win modal:', e);
        }

        // Get next level
        let nextLevel = null;
        try {
            nextLevel = this.levelManager.getNextLevelIndex(this.selectedLevel);
        } catch (e) {
            console.error('Error getting next level:', e);
            this.safeGoToMenu();
            return;
        }

        if (nextLevel === null) {
            this.showToast('Congratulations! All levels complete!');
            this.safeGoToMenu();
            return;
        }

        // Check if upgrade is required
        let canPlay = { canPlay: true };
        try {
            canPlay = this.levelManager.canPlayLevel(nextLevel);
        } catch (e) {
            console.error('Error checking level access:', e);
            this.safeGoToMenu();
            return;
        }

        if (!canPlay.canPlay && canPlay.requiredUpgrade) {
            // Show purchase prompt inline
            this.showUpgradePurchaseScreen(canPlay.requiredUpgrade);
        } else {
            // Can play - start the level
            try {
                this.startGame(nextLevel);
            } catch (e) {
                console.error('Error starting game:', e);
                this.safeGoToMenu();
            }
        }
    }

    // Safe navigation to menu
    safeGoToMenu() {
        try {
            // Clear any pending upgrade
            this.pendingUpgrade = null;

            // Hide all modals first
            document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));

            // Use setTimeout to ensure state is clean before navigation
            setTimeout(() => {
                try {
                    this.showScreen('menu');
                } catch (e) {
                    console.error('Error showing menu:', e);
                    window.location.reload();
                }
            }, 50);
        } catch (e) {
            console.error('Error going to menu:', e);
            // Last resort - reload
            window.location.reload();
        }
    }

    // Create persistent upgrade screen (called once at init)
    createUpgradeScreen() {
        if (document.getElementById('upgrade-screen')) return;

        const screen = document.createElement('div');
        screen.id = 'upgrade-screen';
        screen.className = 'screen';
        screen.innerHTML = `
            <div class="menu-background">
                <div class="bg-orb orb-1"></div>
                <div class="bg-orb orb-2"></div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 20px; text-align: center;">
                <div id="upgrade-screen-icon" style="font-size: 4rem; margin-bottom: 20px;"></div>
                <h2 style="color: #00f5ff; font-size: 1.5rem; margin-bottom: 10px;">UPGRADE REQUIRED</h2>
                <h3 id="upgrade-screen-name" style="color: white; font-size: 1.2rem; margin-bottom: 10px;"></h3>
                <p id="upgrade-screen-desc" style="color: #a0a0c0; font-size: 0.9rem; margin-bottom: 20px; max-width: 280px;"></p>
                <p id="upgrade-screen-cost" style="font-size: 1.2rem; margin-bottom: 30px;"></p>
                <button id="upgrade-screen-buy" class="menu-btn btn-primary" style="margin-bottom: 15px;">
                    <span class="btn-text">BUY & CONTINUE</span>
                </button>
                <button id="upgrade-screen-back" class="menu-btn btn-secondary">
                    <span class="btn-text">← BACK TO MENU</span>
                </button>
            </div>
        `;
        document.body.appendChild(screen);

        // Cache reference
        this.screens.upgrade = screen;

        // Set up listeners (only once)
        document.getElementById('upgrade-screen-buy').addEventListener('click', () => {
            this.handleUpgradePurchase();
        });

        document.getElementById('upgrade-screen-back').addEventListener('click', () => {
            if (this.audioManager) this.audioManager.playSound('click');
            this.showScreen('menu');
        });
    }

    // Handle the actual purchase
    handleUpgradePurchase() {
        if (!this.pendingUpgrade) {
            console.error('No pending upgrade');
            this.showScreen('menu');
            return;
        }

        const upgrade = this.pendingUpgrade;
        console.log('Purchasing upgrade:', upgrade.id);

        // Check affordability again
        let coins = 0;
        try {
            coins = this.storageManager.getCoins();
        } catch (e) {
            console.error('Error getting coins:', e);
            this.showToast('Error checking coins');
            return;
        }

        if (coins < upgrade.cost) {
            this.showToast('Not enough coins!');
            return;
        }

        // Attempt purchase
        let result = null;
        try {
            result = this.upgradeManager.purchase(upgrade.id);
            console.log('Purchase result:', result);
        } catch (e) {
            console.error('Purchase error:', e);
            this.showToast('Purchase failed');
            return;
        }

        if (result && result.success) {
            // Play sound safely
            try {
                if (this.audioManager) this.audioManager.playSound('star');
            } catch (e) {
                console.error('Audio error:', e);
            }

            // Clear pending upgrade
            this.pendingUpgrade = null;

            // Update UI safely
            try {
                this.updateCoinDisplays();
            } catch (e) {
                console.error('Display update error:', e);
            }

            // Show success
            this.showToast(`${upgrade.name} unlocked!`);

            // Navigate to menu after a short delay for stability
            setTimeout(() => {
                this.showScreen('menu');
            }, 100);
        } else {
            this.showToast(result?.error || 'Purchase failed');
        }
    }

    // Show upgrade purchase screen
    showUpgradePurchaseScreen(upgrade) {
        console.log('Showing upgrade purchase for:', upgrade.id);

        // Store pending upgrade
        this.pendingUpgrade = upgrade;

        // Create screen if needed
        this.createUpgradeScreen();

        // Update content
        const iconEl = document.getElementById('upgrade-screen-icon');
        const nameEl = document.getElementById('upgrade-screen-name');
        const descEl = document.getElementById('upgrade-screen-desc');
        const costEl = document.getElementById('upgrade-screen-cost');
        const buyBtn = document.getElementById('upgrade-screen-buy');

        if (iconEl) iconEl.textContent = upgrade.icon || '⬆️';
        if (nameEl) nameEl.textContent = upgrade.name || 'Upgrade';
        if (descEl) descEl.textContent = upgrade.description || '';

        // Get coins
        let coins = 0;
        try {
            coins = this.storageManager.getCoins();
        } catch (e) {
            console.error('Error getting coins:', e);
        }

        const canAfford = coins >= upgrade.cost;

        if (costEl) {
            costEl.style.color = canAfford ? '#ffd700' : '#ff3366';
            costEl.innerHTML = `Cost: ${upgrade.cost} coins<br><span style="font-size: 0.9rem;">You have: ${coins} coins</span>`;
        }

        if (buyBtn) {
            const btnText = buyBtn.querySelector('.btn-text');
            if (canAfford) {
                buyBtn.classList.remove('disabled');
                buyBtn.style.opacity = '1';
                if (btnText) btnText.textContent = '🔓 BUY & CONTINUE';
            } else {
                buyBtn.classList.add('disabled');
                buyBtn.style.opacity = '0.5';
                if (btnText) btnText.textContent = '❌ NOT ENOUGH COINS';
            }
        }

        // Show the screen
        this.showScreen('upgrade');
    }

    // Keep old method names for compatibility
    showUpgradeRequiredModal(upgrade, message) {
        this.showUpgradePurchaseScreen(upgrade);
    }

    showSimpleUpgradeModal(upgrade, targetLevel) {
        this.showUpgradePurchaseScreen(upgrade);
    }

    createUpgradeRequiredModal() {
        // No longer needed
    }

    updatePermissionModalForSafari() {
        const title = document.querySelector('#permission-modal .modal-title');
        const text = document.querySelector('#permission-modal .permission-text');
        const enableBtn = document.getElementById('btn-grant-permission');
        const copyBtn = document.getElementById('btn-copy-url');

        // Check if Android or iOS
        const isAndroid = /Android/i.test(navigator.userAgent);

        if (title) title.textContent = 'MOTION SENSORS';
        if (isAndroid) {
            if (text) text.innerHTML = 'This game uses your device\'s motion sensors for tilt controls.<br><br>Tap the button below to enable, or use touch controls.';
        } else {
            if (text) text.innerHTML = 'This game uses your device\'s motion sensors for tilt controls.<br><br>Please grant permission to continue.';
        }
        if (enableBtn) {
            enableBtn.style.display = '';
            enableBtn.querySelector('.btn-text').textContent = 'ENABLE TILT';
        }
        // Hide copy URL button
        if (copyBtn) copyBtn.style.display = 'none';
    }

    updatePermissionModalForUnsupportedBrowser() {
        const title = document.querySelector('#permission-modal .modal-title');
        const text = document.querySelector('#permission-modal .permission-text');
        const enableBtn = document.getElementById('btn-grant-permission');
        const copyBtn = document.getElementById('btn-copy-url');

        if (title) title.textContent = 'BROWSER NOT SUPPORTED';
        if (text) {
            text.innerHTML = `
                <strong>Chrome/Firefox on iOS does not support motion sensors.</strong><br><br>
                To use tilt controls, please open this game in <strong>Safari</strong>.<br><br>
                Or you can use touch controls instead.
            `;
        }
        // Hide the enable button since it won't work
        if (enableBtn) enableBtn.style.display = 'none';
        // Show copy URL button
        if (copyBtn) copyBtn.style.display = '';
    }

    setupCopyUrlButton() {
        const copyBtn = document.getElementById('btn-copy-url');
        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(window.location.href);
                    this.showToast('URL copied! Open Safari and paste it.');
                } catch (e) {
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea');
                    textArea.value = window.location.href;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    this.showToast('URL copied! Open Safari and paste it.');
                }
            });
        }
    }

    showPermissionDeniedHelp() {
        const title = document.querySelector('#permission-modal .modal-title');
        const text = document.querySelector('#permission-modal .permission-text');
        const enableBtn = document.getElementById('btn-grant-permission');

        const isAndroid = /Android/i.test(navigator.userAgent);

        if (title) title.textContent = 'PERMISSION DENIED';
        if (isAndroid) {
            if (text) {
                text.innerHTML = `
                    <strong>Motion sensors not available.</strong><br><br>
                    This may be because:<br>
                    - Sensors need HTTPS (except localhost)<br>
                    - Browser doesn't support sensors<br>
                    - Device has no gyroscope<br><br>
                    <em>Tap "USE TOUCH" to play with touch controls.</em>
                `;
            }
        } else {
            if (text) {
                text.innerHTML = `
                    <strong>Motion access was denied.</strong><br><br>
                    To enable tilt controls in Safari:<br><br>
                    1. Open <strong>Settings</strong> app<br>
                    2. Scroll to <strong>Safari</strong><br>
                    3. Find <strong>Motion & Orientation Access</strong><br>
                    4. Turn it <strong>ON</strong><br>
                    5. Come back and try again<br><br>
                    <em>Or tap "USE TOUCH" to play with touch controls.</em>
                `;
            }
        }
        if (enableBtn) {
            enableBtn.querySelector('.btn-text').textContent = 'TRY AGAIN';
        }
    }

    continueToGame() {
        // Update level display
        document.getElementById('current-level-display').textContent =
            `Level ${this.selectedLevel + 1}`;

        // Update coin display
        this.updateCoinDisplays();

        // Show game screen first so canvas gets proper dimensions
        this.showScreen('game');

        // Wait for screen to be visible, then resize and load level
        setTimeout(() => {
            // Force canvas resize now that container is visible
            this.gameEngine.resizeCanvas();

            // Load level after resize
            if (!this.gameEngine.loadLevel(this.selectedLevel)) {
                this.showToast('Failed to load level');
                return;
            }

            // Start game
            this.gameEngine.start();

            // Update powerup buttons visibility
            this.updatePowerupButtons();
        }, 100);
    }

    pauseGame() {
        this.gameEngine.pause();
        this.showModal('pause-modal');
    }

    resumeGame() {
        this.hideModal('pause-modal');
        setTimeout(() => {
            this.gameEngine.resume();
        }, 100);
    }

    quitGame() {
        this.gameEngine.stop();
        this.hideAllModals();
        this.showScreen('menu');
    }

    updateTimer(elapsed) {
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        this.timerElement.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    showWinModal(data) {
        const { time, stars, isNewBest, coinsEarned, coinsCollected, totalLevelCoins, streak, streakBonus, multiplier, milestone } = data;

        // Update stars display
        const starsContainer = document.getElementById('stars-earned');
        starsContainer.innerHTML = '';

        for (let i = 0; i < 3; i++) {
            const star = document.createElement('span');
            star.className = 'star';
            star.textContent = '★';

            if (i < stars) {
                // Animate stars appearing with delay
                setTimeout(() => {
                    star.classList.add('earned');
                    this.audioManager.playSound('star');
                }, 300 + i * 300);
            }

            starsContainer.appendChild(star);
        }

        // Update time
        document.getElementById('final-time').textContent =
            this.levelManager.formatTime(time);

        // Calculate total coins with bonuses
        const collectedBonus = (coinsCollected || 0) * 5;
        let totalCoins = (coinsEarned || 0) + collectedBonus;

        // Apply streak bonus
        if (streakBonus && streakBonus > 1) {
            totalCoins = Math.floor(totalCoins * streakBonus);
        }

        // Apply multiplier
        if (multiplier && multiplier > 1) {
            totalCoins = Math.floor(totalCoins * multiplier);
        }

        // Update coins earned
        const coinsEl = document.getElementById('coins-earned');
        if (coinsEl) {
            let coinsText = `🪙 +${totalCoins}`;
            const bonuses = [];
            if (coinsCollected > 0) {
                bonuses.push(`${coinsCollected} coins`);
            }
            if (streakBonus && streakBonus > 1) {
                bonuses.push(`${streak}x streak`);
            }
            if (multiplier && multiplier > 1) {
                bonuses.push(`${multiplier}x bonus`);
            }
            if (bonuses.length > 0) {
                coinsText += ` (${bonuses.join(' + ')})`;
            }
            coinsEl.querySelector('.coins-value').textContent = coinsText;
        }

        // Show streak display
        const streakEl = document.getElementById('win-streak-display');
        if (streakEl) {
            if (streak && streak >= 2) {
                streakEl.innerHTML = `<span class="streak-fire">🔥</span> ${streak} Win Streak! (${streakBonus}x bonus)`;
                streakEl.style.display = 'block';
            } else {
                streakEl.style.display = 'none';
            }
        } else if (streak && streak >= 2) {
            // Create streak display if it doesn't exist
            const modalContent = document.querySelector('#win-modal .modal-content');
            const newStreakEl = document.createElement('div');
            newStreakEl.id = 'win-streak-display';
            newStreakEl.className = 'win-streak-display';
            newStreakEl.innerHTML = `<span class="streak-fire">🔥</span> ${streak} Win Streak! (${streakBonus}x bonus)`;
            modalContent.insertBefore(newStreakEl, modalContent.querySelector('.modal-buttons'));
        }

        // Show milestone if achieved
        if (milestone) {
            setTimeout(() => {
                this.showToast(`🎉 ${milestone.message} +${milestone.coins} coins!`, 4000);
            }, 1500);
        }

        // Update coin displays
        this.updateCoinDisplays();
        this.updateStreakDisplay();

        // Show new best indicator
        const newBestEl = document.getElementById('new-best');
        newBestEl.style.display = isNewBest ? 'block' : 'none';

        // Check if this is the last level
        const nextLevel = this.levelManager.getNextLevelIndex(this.selectedLevel);
        const nextButton = document.getElementById('btn-next-level');
        
        if (nextLevel === null) {
            nextButton.querySelector('.btn-text').textContent = 'ALL DONE!';
        } else {
            nextButton.querySelector('.btn-text').textContent = 'NEXT LEVEL';
        }

        // Show confetti
        this.spawnConfetti();

        // Show modal
        this.showModal('win-modal');
    }

    showLoseModal(remainingLives) {
        // Update lives display in the lose modal
        const livesDisplay = document.querySelector('#lose-modal .lives-remaining');
        if (livesDisplay) {
            livesDisplay.innerHTML = `<span class="heart-icon">❤️</span> ${remainingLives} ${remainingLives === 1 ? 'life' : 'lives'} remaining`;
        }
        this.showModal('lose-modal');
    }

    showGameOverModal() {
        // Create game over modal if it doesn't exist
        if (!document.getElementById('gameover-modal')) {
            this.createGameOverModal();
        }

        // Update costs and coin display
        const coins = this.storageManager.getCoins();
        const buyLivesBtn = document.getElementById('btn-buy-lives');
        const continueBtn = document.getElementById('btn-continue-game');

        // 3 lives for 50 coins
        if (buyLivesBtn) {
            if (coins >= 50) {
                buyLivesBtn.classList.remove('disabled');
                buyLivesBtn.innerHTML = '<span class="btn-text">BUY 3 LIVES (50 coins)</span>';
            } else {
                buyLivesBtn.classList.add('disabled');
                buyLivesBtn.innerHTML = '<span class="btn-text">BUY 3 LIVES (Need ' + (50 - coins) + ' more)</span>';
            }
        }

        // Continue from current level for 100 coins
        if (continueBtn) {
            if (coins >= 100) {
                continueBtn.classList.remove('disabled');
                continueBtn.innerHTML = '<span class="btn-text">CONTINUE HERE (100 coins)</span>';
            } else {
                continueBtn.classList.add('disabled');
                continueBtn.innerHTML = '<span class="btn-text">CONTINUE (Need ' + (100 - coins) + ' more)</span>';
            }
        }

        this.showModal('gameover-modal');
    }

    createGameOverModal() {
        const modal = document.createElement('div');
        modal.id = 'gameover-modal';
        modal.className = 'modal hidden';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content gameover">
                <h2 class="modal-title gameover-title">GAME OVER</h2>
                <p class="gameover-message">You ran out of lives!</p>
                <div class="gameover-coins">
                    <span class="coin-icon">🪙</span>
                    <span class="coin-count">${this.storageManager.getCoins()}</span>
                </div>
                <div class="modal-buttons">
                    <button id="btn-buy-lives" class="menu-btn btn-primary">
                        <span class="btn-text">BUY 3 LIVES (50 coins)</span>
                    </button>
                    <button id="btn-continue-game" class="menu-btn btn-secondary">
                        <span class="btn-text">CONTINUE HERE (100 coins)</span>
                    </button>
                    <button id="btn-restart-game" class="menu-btn btn-secondary">
                        <span class="btn-text">START OVER (Level 1)</span>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Buy lives button
        document.getElementById('btn-buy-lives').addEventListener('click', () => {
            this.audioManager.playSound('click');
            const result = this.storageManager.purchaseLives(3, 50);
            if (result.success) {
                this.audioManager.playSound('coin');
                this.hideModal('gameover-modal');
                this.updateCoinDisplays();
                this.showToast('Purchased 3 lives!');
                // Restart current level
                this.gameEngine.restart();
            } else {
                this.showToast('Not enough coins!');
            }
        });

        // Continue button (resume from current level with 3 lives)
        document.getElementById('btn-continue-game').addEventListener('click', () => {
            this.audioManager.playSound('click');
            const coins = this.storageManager.getCoins();
            if (coins >= 100) {
                this.storageManager.addCoins(-100);
                this.storageManager.setLives(3);
                this.hideModal('gameover-modal');
                this.updateCoinDisplays();
                this.showToast('Continuing with 3 lives!');
                this.gameEngine.restart();
            } else {
                this.showToast('Not enough coins!');
            }
        });

        // Start over button
        document.getElementById('btn-restart-game').addEventListener('click', () => {
            this.audioManager.playSound('click');
            this.storageManager.resetLives();
            this.hideModal('gameover-modal');
            this.updateCoinDisplays();
            this.showScreen('levels');
            this.selectLevel(0);
            this.showToast('Starting fresh with 4 lives!');
        });
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    hideAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hidden');
        });
    }

    spawnConfetti() {
        const container = document.getElementById('confetti');
        container.innerHTML = '';

        const colors = ['#00f5ff', '#ff00aa', '#00ff88', '#ffd700', '#8b5cf6'];
        
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = `${Math.random() * 100}%`;
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = `${Math.random() * 0.5}s`;
            confetti.style.animationDuration = `${2 + Math.random() * 2}s`;
            container.appendChild(confetti);
        }

        // Clean up after animation
        setTimeout(() => {
            container.innerHTML = '';
        }, 4000);
    }

    setupStoreListeners() {
        // Back button
        document.getElementById('btn-back-store').addEventListener('click', () => {
            this.audioManager.playSound('click');
            this.showScreen('menu');
        });
    }

    populateStore() {
        this.populateBallSkins();
        this.populateTrailEffects();
        this.updateCoinDisplays();
    }

    populateBallSkins() {
        const grid = document.getElementById('ball-skins-grid');
        grid.innerHTML = '';

        SHOP_ITEMS.balls.forEach(item => {
            const owned = this.storageManager.hasPurchased(item.id);
            const equipped = this.storageManager.getEquipped('ball') === item.id;

            const itemEl = document.createElement('div');
            itemEl.className = `store-item ${owned ? 'owned' : 'locked'} ${equipped ? 'equipped' : ''}`;
            itemEl.dataset.id = item.id;
            itemEl.dataset.category = 'ball';
            itemEl.dataset.price = item.price;

            // Preview with custom colors
            const preview = document.createElement('div');
            preview.className = 'item-preview ball-preview';
            preview.style.setProperty('--preview-color-1', item.colors[0]);
            preview.style.setProperty('--preview-color-2', item.colors[1]);
            preview.style.setProperty('--preview-color-3', item.colors[2]);
            preview.style.setProperty('--preview-glow', item.glow);
            if (item.rainbow) {
                preview.style.animation = 'rainbowShift 2s linear infinite';
            }
            itemEl.appendChild(preview);

            // Name
            const name = document.createElement('div');
            name.className = 'item-name';
            name.textContent = item.name;
            itemEl.appendChild(name);

            // Price or status
            if (equipped) {
                const status = document.createElement('div');
                status.className = 'item-status equipped-status';
                status.textContent = 'Equipped';
                itemEl.appendChild(status);
            } else if (owned) {
                const status = document.createElement('div');
                status.className = 'item-status owned-status';
                status.textContent = 'Owned';
                itemEl.appendChild(status);
            } else {
                const price = document.createElement('div');
                price.className = 'item-price';
                price.innerHTML = `<span>🪙</span><span>${item.price}</span>`;
                itemEl.appendChild(price);
            }

            // Click handler
            itemEl.addEventListener('click', () => this.handleStoreItemClick(item, 'ball'));

            grid.appendChild(itemEl);
        });
    }

    populateTrailEffects() {
        const grid = document.getElementById('trail-effects-grid');
        grid.innerHTML = '';

        SHOP_ITEMS.trails.forEach(item => {
            const owned = this.storageManager.hasPurchased(item.id);
            const equipped = this.storageManager.getEquipped('trail') === item.id;

            const itemEl = document.createElement('div');
            itemEl.className = `store-item ${owned ? 'owned' : 'locked'} ${equipped ? 'equipped' : ''}`;
            itemEl.dataset.id = item.id;
            itemEl.dataset.category = 'trail';
            itemEl.dataset.price = item.price;

            // Preview
            const preview = document.createElement('div');
            preview.className = 'item-preview trail-preview';

            if (item.id === 'trail_none') {
                preview.innerHTML = '<span style="color: var(--text-muted); font-size: 0.75rem;">OFF</span>';
            } else {
                const dots = document.createElement('div');
                dots.className = 'trail-preview-dots';
                for (let i = 0; i < 3; i++) {
                    const dot = document.createElement('div');
                    dot.className = 'trail-preview-dot';
                    if (item.rainbow) {
                        dot.style.background = ['#ff0000', '#00ff00', '#0000ff'][i];
                    } else if (item.color) {
                        dot.style.background = item.color;
                    }
                    dots.appendChild(dot);
                }
                preview.appendChild(dots);
            }
            itemEl.appendChild(preview);

            // Name
            const name = document.createElement('div');
            name.className = 'item-name';
            name.textContent = item.name;
            itemEl.appendChild(name);

            // Price or status
            if (equipped) {
                const status = document.createElement('div');
                status.className = 'item-status equipped-status';
                status.textContent = 'Equipped';
                itemEl.appendChild(status);
            } else if (owned) {
                const status = document.createElement('div');
                status.className = 'item-status owned-status';
                status.textContent = 'Owned';
                itemEl.appendChild(status);
            } else {
                const price = document.createElement('div');
                price.className = 'item-price';
                price.innerHTML = `<span>🪙</span><span>${item.price}</span>`;
                itemEl.appendChild(price);
            }

            // Click handler
            itemEl.addEventListener('click', () => this.handleStoreItemClick(item, 'trail'));

            grid.appendChild(itemEl);
        });
    }

    handleStoreItemClick(item, category) {
        const owned = this.storageManager.hasPurchased(item.id);
        const equipped = this.storageManager.getEquipped(category) === item.id;

        if (equipped) {
            // Already equipped, do nothing
            return;
        }

        if (owned) {
            // Equip the item
            this.storageManager.equipItem(category, item.id);
            this.audioManager.playSound('click');
            this.showToast(`Equipped ${item.name}!`);
            this.populateStore();
        } else {
            // Try to purchase
            const coins = this.storageManager.getCoins();
            if (coins >= item.price) {
                if (this.storageManager.spendCoins(item.price)) {
                    this.storageManager.purchaseItem(item.id);
                    this.storageManager.equipItem(category, item.id);
                    this.audioManager.playSound('win');
                    this.showToast(`Purchased ${item.name}!`);
                    this.populateStore();
                }
            } else {
                this.audioManager.playSound('wall');
                this.showToast(`Not enough coins! Need ${item.price - coins} more.`);
            }
        }
    }

    updateCoinDisplays() {
        const coins = this.storageManager.getCoins();
        document.querySelectorAll('.coin-count').forEach(el => {
            el.textContent = coins;
        });
        this.updateLivesDisplay();
    }

    updateLivesDisplay() {
        const lives = this.storageManager.getLives();
        document.querySelectorAll('.lives-count').forEach(el => {
            el.textContent = lives;
        });
        // Also update heart icons if they exist
        document.querySelectorAll('.lives-display').forEach(el => {
            el.innerHTML = '<span class="heart-icon">❤️</span> <span class="lives-count">' + lives + '</span>';
        });
    }

    showToast(message, duration = 3000) {
        // Remove existing toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 245, 255, 0.9);
            color: #0a0a1a;
            padding: 12px 24px;
            border-radius: 8px;
            font-family: 'Exo 2', sans-serif;
            font-weight: 600;
            z-index: 200;
            animation: toastIn 0.3s ease;
        `;

        document.body.appendChild(toast);

        // Remove after duration
        setTimeout(() => {
            toast.style.animation = 'toastOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // ==================== ENGAGEMENT FEATURES ====================

    setupEngagementListeners() {
        // Daily challenge button in menu
        const challengeBtn = document.getElementById('btn-daily-challenge');
        if (challengeBtn) {
            challengeBtn.addEventListener('click', () => {
                this.audioManager.playSound('click');
                this.showDailyChallengeModal();
            });
        }

        // Achievements button
        const achievementsBtn = document.getElementById('btn-achievements');
        if (achievementsBtn) {
            achievementsBtn.addEventListener('click', () => {
                this.audioManager.playSound('click');
                this.showAchievementsModal();
            });
        }

        // Spin button in store
        const spinBtn = document.getElementById('btn-spin');
        if (spinBtn) {
            spinBtn.addEventListener('click', () => {
                this.audioManager.playSound('click');
                this.showSpinWheelModal();
            });
        }

        // Update streak display
        this.updateStreakDisplay();
    }

    updateStreakDisplay() {
        const stats = this.engagementManager.getStats();
        const streakEl = document.getElementById('streak-display');
        if (streakEl) {
            if (stats.winStreak >= 2) {
                streakEl.innerHTML = `<span class="streak-fire">🔥</span> ${stats.winStreak} Win Streak!`;
                streakEl.style.display = 'block';
            } else {
                streakEl.style.display = 'none';
            }
        }

        // Update free spins badge
        const spinBadge = document.getElementById('spin-badge');
        if (spinBadge) {
            if (stats.freeSpins > 0) {
                spinBadge.textContent = stats.freeSpins;
                spinBadge.style.display = 'flex';
            } else {
                spinBadge.style.display = 'none';
            }
        }
    }

    // ==================== DAILY REWARD MODAL ====================

    showDailyRewardModal(data) {
        if (!document.getElementById('daily-reward-modal')) {
            this.createDailyRewardModal();
        }

        const calendar = document.getElementById('daily-calendar');
        calendar.innerHTML = data.allRewards.map((reward, i) => {
            const day = i + 1;
            const isCurrent = day === data.day;
            const isPast = day < data.day;
            const isFuture = day > data.day;

            return `
                <div class="daily-day ${isCurrent ? 'current' : ''} ${isPast ? 'claimed' : ''} ${isFuture ? 'locked' : ''}">
                    <div class="day-number">Day ${day}</div>
                    <div class="day-reward">${reward.special ? '🎁' : '🪙'}</div>
                    <div class="day-label">${reward.label}</div>
                    ${isPast ? '<div class="day-check">✓</div>' : ''}
                </div>
            `;
        }).join('');

        const claimBtn = document.getElementById('btn-claim-daily');
        claimBtn.innerHTML = `<span class="btn-text">CLAIM DAY ${data.day} REWARD!</span>`;

        this.showModal('daily-reward-modal');
    }

    createDailyRewardModal() {
        const modal = document.createElement('div');
        modal.id = 'daily-reward-modal';
        modal.className = 'modal hidden';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content engagement-modal">
                <h2 class="modal-title">DAILY REWARDS</h2>
                <p class="modal-subtitle">Come back every day for bigger rewards!</p>
                <div id="daily-calendar" class="daily-calendar"></div>
                <button id="btn-claim-daily" class="menu-btn btn-primary pulse-btn">
                    <span class="btn-text">CLAIM REWARD!</span>
                </button>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('btn-claim-daily').addEventListener('click', () => {
            this.audioManager.playSound('win');
            const result = this.engagementManager.claimDailyReward();
            if (result.success) {
                this.hideModal('daily-reward-modal');
                this.updateCoinDisplays();

                if (result.special) {
                    if (result.special.type === 'spins') {
                        this.showToast(`🎰 You got ${result.special.amount} FREE SPINS!`, 4000);
                        this.updateStreakDisplay();
                    } else {
                        this.showToast(`🎁 Mystery Box: +${result.special.amount} ${result.special.type}!`, 4000);
                    }
                } else {
                    this.showToast(`+${result.reward.coins} coins claimed!`, 3000);
                }
            }
        });
    }

    // ==================== COMEBACK BONUS MODAL ====================

    showComebackModal(data) {
        if (!document.getElementById('comeback-modal')) {
            this.createComebackModal();
        }

        document.getElementById('comeback-hours').textContent = data.hours;
        document.getElementById('comeback-bonus').textContent = data.bonus;

        this.showModal('comeback-modal');
    }

    createComebackModal() {
        const modal = document.createElement('div');
        modal.id = 'comeback-modal';
        modal.className = 'modal hidden';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content engagement-modal">
                <h2 class="modal-title">WELCOME BACK!</h2>
                <div class="comeback-icon">👋</div>
                <p class="comeback-text">You've been away for <span id="comeback-hours">0</span> hours!</p>
                <p class="comeback-text">Here's a welcome back bonus:</p>
                <div class="comeback-reward">
                    <span class="coin-icon">🪙</span>
                    <span id="comeback-bonus">0</span> COINS
                </div>
                <button id="btn-claim-comeback" class="menu-btn btn-primary pulse-btn">
                    <span class="btn-text">CLAIM BONUS!</span>
                </button>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('btn-claim-comeback').addEventListener('click', () => {
            const bonus = parseInt(document.getElementById('comeback-bonus').textContent);
            this.audioManager.playSound('win');
            this.engagementManager.claimComebackBonus(bonus);
            this.hideModal('comeback-modal');
            this.updateCoinDisplays();
            this.showToast(`+${bonus} coins! Good to have you back!`, 3000);

            // Now check daily reward
            setTimeout(() => {
                const daily = this.engagementManager.checkDailyReward();
                if (daily.available && !daily.alreadyClaimed) {
                    this.showDailyRewardModal(daily);
                }
            }, 500);
        });
    }

    // ==================== SPIN WHEEL MODAL ====================

    showSpinWheelModal() {
        if (!document.getElementById('spin-modal')) {
            this.createSpinWheelModal();
        }

        const stats = this.engagementManager.getStats();
        document.getElementById('spins-available').textContent = stats.freeSpins;

        const spinBtn = document.getElementById('btn-spin-wheel');
        if (stats.freeSpins > 0) {
            spinBtn.classList.remove('disabled');
            spinBtn.innerHTML = '<span class="btn-text">SPIN!</span>';
        } else {
            spinBtn.classList.add('disabled');
            spinBtn.innerHTML = '<span class="btn-text">NO SPINS</span>';
        }

        this.showModal('spin-modal');
    }

    createSpinWheelModal() {
        const prizes = this.engagementManager.getSpinPrizes();
        const segmentAngle = 360 / prizes.length;

        const modal = document.createElement('div');
        modal.id = 'spin-modal';
        modal.className = 'modal hidden';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content engagement-modal spin-modal-content">
                <h2 class="modal-title">LUCKY SPIN</h2>
                <p class="modal-subtitle">Free Spins: <span id="spins-available">0</span></p>
                <div class="spin-wheel-container">
                    <div class="spin-pointer">▼</div>
                    <div id="spin-wheel" class="spin-wheel">
                        ${prizes.map((prize, i) => `
                            <div class="spin-segment" style="
                                transform: rotate(${i * segmentAngle}deg);
                                background: ${prize.color};
                            ">
                                <span class="segment-label">${prize.label}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <button id="btn-spin-wheel" class="menu-btn btn-primary">
                    <span class="btn-text">SPIN!</span>
                </button>
                <button id="btn-close-spin" class="menu-btn btn-secondary">
                    <span class="btn-text">CLOSE</span>
                </button>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('btn-spin-wheel').addEventListener('click', () => {
            this.doSpin();
        });

        document.getElementById('btn-close-spin').addEventListener('click', () => {
            this.audioManager.playSound('click');
            this.hideModal('spin-modal');
        });
    }

    doSpin() {
        if (!this.engagementManager.canSpin()) {
            this.showToast('No spins available! Win levels to earn more!');
            return;
        }

        const result = this.engagementManager.spin();
        if (!result.success) return;

        const wheel = document.getElementById('spin-wheel');
        const prizes = this.engagementManager.getSpinPrizes();
        const prizeIndex = prizes.findIndex(p => p.id === result.prize.id);
        const segmentAngle = 360 / prizes.length;

        // Calculate final rotation
        const spins = 5 + Math.random() * 3; // 5-8 full rotations
        const targetAngle = 360 - (prizeIndex * segmentAngle + segmentAngle / 2);
        const totalRotation = spins * 360 + targetAngle;

        // Animate
        wheel.style.transition = 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
        wheel.style.transform = `rotate(${totalRotation}deg)`;

        // Disable button during spin
        const spinBtn = document.getElementById('btn-spin-wheel');
        spinBtn.classList.add('disabled');

        this.audioManager.playSound('click');

        // Show result after animation
        setTimeout(() => {
            this.audioManager.playSound('win');
            this.showToast(`🎉 You won: ${result.prize.label}!`, 4000);
            this.updateCoinDisplays();
            this.updateStreakDisplay();

            // Update spins display
            document.getElementById('spins-available').textContent = result.spinsRemaining;

            // Reset wheel for next spin
            setTimeout(() => {
                wheel.style.transition = 'none';
                wheel.style.transform = 'rotate(0deg)';

                if (result.spinsRemaining > 0) {
                    spinBtn.classList.remove('disabled');
                    spinBtn.innerHTML = '<span class="btn-text">SPIN AGAIN!</span>';
                } else {
                    spinBtn.innerHTML = '<span class="btn-text">NO SPINS</span>';
                }
            }, 500);
        }, 4000);
    }

    // ==================== ACHIEVEMENTS MODAL ====================

    showAchievementsModal() {
        if (!document.getElementById('achievements-modal')) {
            this.createAchievementsModal();
        }

        this.populateAchievements();
        this.showModal('achievements-modal');
    }

    createAchievementsModal() {
        const modal = document.createElement('div');
        modal.id = 'achievements-modal';
        modal.className = 'modal hidden';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content engagement-modal achievements-modal-content">
                <h2 class="modal-title">ACHIEVEMENTS</h2>
                <p class="modal-subtitle" id="achievements-count">0 / 0 Unlocked</p>
                <div id="achievements-list" class="achievements-list"></div>
                <button id="btn-close-achievements" class="menu-btn btn-secondary">
                    <span class="btn-text">CLOSE</span>
                </button>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('btn-close-achievements').addEventListener('click', () => {
            this.audioManager.playSound('click');
            this.hideModal('achievements-modal');
        });
    }

    populateAchievements() {
        const achievements = this.engagementManager.getAchievements();
        const unlocked = achievements.filter(a => a.unlocked).length;

        document.getElementById('achievements-count').textContent = `${unlocked} / ${achievements.length} Unlocked`;

        const list = document.getElementById('achievements-list');
        list.innerHTML = achievements.map(a => `
            <div class="achievement-item ${a.unlocked ? 'unlocked' : 'locked'}">
                <div class="achievement-icon">${a.icon}</div>
                <div class="achievement-info">
                    <div class="achievement-name">${a.name}</div>
                    <div class="achievement-desc">${a.desc}</div>
                </div>
                <div class="achievement-reward">
                    ${a.unlocked ? '✓' : `🪙${a.coins}`}
                </div>
            </div>
        `).join('');
    }

    showAchievementUnlocked(achievement) {
        const popup = document.createElement('div');
        popup.className = 'achievement-popup';
        popup.innerHTML = `
            <div class="achievement-popup-content">
                <div class="achievement-popup-icon">${achievement.icon}</div>
                <div class="achievement-popup-text">
                    <div class="achievement-popup-title">Achievement Unlocked!</div>
                    <div class="achievement-popup-name">${achievement.name}</div>
                    <div class="achievement-popup-reward">+${achievement.coins} coins</div>
                </div>
            </div>
        `;
        document.body.appendChild(popup);

        this.audioManager.playSound('star');

        setTimeout(() => {
            popup.classList.add('fade-out');
            setTimeout(() => popup.remove(), 500);
        }, 3000);
    }

    // ==================== DAILY CHALLENGE MODAL ====================

    showDailyChallengeModal() {
        if (!document.getElementById('daily-challenge-modal')) {
            this.createDailyChallengeModal();
        }

        this.populateDailyChallenge();
        this.showModal('daily-challenge-modal');
    }

    createDailyChallengeModal() {
        const modal = document.createElement('div');
        modal.id = 'daily-challenge-modal';
        modal.className = 'modal hidden';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content engagement-modal">
                <h2 class="modal-title">DAILY CHALLENGE</h2>
                <p class="modal-subtitle">Complete for bonus rewards!</p>
                <div id="challenge-content" class="challenge-content"></div>
                <button id="btn-claim-challenge" class="menu-btn btn-primary" style="display: none;">
                    <span class="btn-text">CLAIM REWARD!</span>
                </button>
                <button id="btn-close-challenge" class="menu-btn btn-secondary">
                    <span class="btn-text">CLOSE</span>
                </button>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('btn-claim-challenge').addEventListener('click', () => {
            const result = this.engagementManager.claimDailyChallenge();
            if (result.success) {
                this.audioManager.playSound('win');
                this.showToast(`+${result.reward} coins earned!`, 3000);
                this.updateCoinDisplays();
                this.populateDailyChallenge();
            }
        });

        document.getElementById('btn-close-challenge').addEventListener('click', () => {
            this.audioManager.playSound('click');
            this.hideModal('daily-challenge-modal');
        });
    }

    populateDailyChallenge() {
        const challenge = this.engagementManager.getDailyChallenge();
        const progress = Math.min(challenge.progress, challenge.target);
        const percent = (progress / challenge.target) * 100;

        document.getElementById('challenge-content').innerHTML = `
            <div class="challenge-card">
                <div class="challenge-name">${challenge.name}</div>
                <div class="challenge-desc">${challenge.desc}</div>
                <div class="challenge-progress-bar">
                    <div class="challenge-progress-fill" style="width: ${percent}%"></div>
                </div>
                <div class="challenge-progress-text">${progress} / ${challenge.target}</div>
                <div class="challenge-reward">Reward: 🪙 ${challenge.reward}</div>
            </div>
        `;

        const claimBtn = document.getElementById('btn-claim-challenge');
        if (challenge.completed && !challenge.claimed) {
            claimBtn.style.display = '';
        } else if (challenge.claimed) {
            claimBtn.style.display = 'none';
            document.getElementById('challenge-content').innerHTML += `
                <div class="challenge-claimed">✓ Claimed!</div>
            `;
        } else {
            claimBtn.style.display = 'none';
        }
    }

    // ==================== WIN MODAL ENHANCEMENTS ====================

    showEnhancedWinModal(data) {
        let winResult = { streak: 0, bonus: 1 };
        let milestone = null;
        let multiplier = 1;

        // Safely record engagement data
        if (this.engagementManager) {
            try {
                winResult = this.engagementManager.recordWin();
                const level = this.levelManager.getLevelData(this.selectedLevel);

                // Record stars
                this.engagementManager.recordStars(data.stars, data.time, level?.level?.threeStarTime);

                // Record coins collected
                if (data.coinsCollected > 0) {
                    this.engagementManager.recordCoinsCollected(data.coinsCollected);
                }

                // Check for no-wall-hit achievement
                if (this.wallHitsThisLevel === 0) {
                    this.engagementManager.recordNoWallHit();
                }

                // Check for milestone
                milestone = this.engagementManager.checkMilestone(this.selectedLevel + 1);

                // Update daily challenge progress
                this.engagementManager.updateDailyChallengeProgress('levels', 1);
                this.engagementManager.updateDailyChallengeProgress('stars', data.stars);
                if (data.stars === 3) {
                    this.engagementManager.updateDailyChallengeProgress('perfect', 1);
                }
                if (this.deathsThisLevel === 0) {
                    this.engagementManager.recordNoDeathLevel();
                    this.engagementManager.updateDailyChallengeProgress('no_death', 1);
                }

                // Check for multiplier
                multiplier = this.engagementManager.getAndResetMultiplier();
            } catch (e) {
                console.error('Engagement error:', e);
            }
        }

        // Show regular win modal with enhancements
        this.showWinModal({
            ...data,
            streak: winResult.streak,
            streakBonus: winResult.bonus,
            multiplier,
            milestone
        });

        // Award free spin chance on 3 stars
        if (data.stars === 3 && Math.random() < 0.3) {
            setTimeout(() => {
                this.showToast('🎰 You earned a FREE SPIN!', 3000);
                this.updateStreakDisplay();
            }, 2000);
        }

        // Reset level tracking
        this.wallHitsThisLevel = 0;
        this.deathsThisLevel = 0;
    }

    showEnhancedLoseModal(remainingLives) {
        const lossResult = this.engagementManager.recordLoss();
        this.deathsThisLevel++;

        // Update lose modal with motivational message
        const messageEl = document.querySelector('#lose-modal .lose-message');
        if (messageEl) {
            messageEl.textContent = lossResult.message;
        } else {
            // Add message element if it doesn't exist
            const modalContent = document.querySelector('#lose-modal .modal-content');
            if (modalContent) {
                const msg = document.createElement('p');
                msg.className = 'lose-message motivational';
                msg.textContent = lossResult.message;
                modalContent.insertBefore(msg, modalContent.querySelector('.modal-buttons'));
            }
        }

        this.showLoseModal(remainingLives);
    }

    recordWallHit() {
        this.wallHitsThisLevel++;
    }
}

// Add toast animation styles when DOM is ready
function addToastStyles() {
    if (document.head) {
        const toastStyles = document.createElement('style');
        toastStyles.textContent = `
            @keyframes toastIn {
                from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
            @keyframes toastOut {
                from { opacity: 1; transform: translateX(-50%) translateY(0); }
                to { opacity: 0; transform: translateX(-50%) translateY(20px); }
            }
        `;
        document.head.appendChild(toastStyles);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addToastStyles);
} else {
    addToastStyles();
}
