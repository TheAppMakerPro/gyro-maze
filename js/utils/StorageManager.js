/**
 * StorageManager - Handles persistent storage for game data
 * Uses localStorage with fallback for private browsing
 */

const STORAGE_KEYS = {
    SETTINGS: 'gyromaze_settings',
    PROGRESS: 'gyromaze_progress',
    CALIBRATION: 'gyromaze_calibration',
    SHOP: 'gyromaze_shop'
};

const DEFAULT_SETTINGS = {
    sensitivity: 1.0,
    sfxEnabled: true,
    musicEnabled: true,
    vibrationEnabled: true
};

const DEFAULT_PROGRESS = {
    highestUnlocked: 1,
    levelData: {}
};

const DEFAULT_SHOP = {
    coins: 0,
    totalCoinsEarned: 0,
    lives: 4,
    maxLives: 10,
    purchased: ['ball_default', 'trail_default'],
    equipped: {
        ball: 'ball_default',
        trail: 'trail_default'
    }
};

class StorageManager {
    constructor() {
        this.isAvailable = this.checkAvailability();
        this.memoryFallback = {
            settings: { ...DEFAULT_SETTINGS },
            progress: { ...DEFAULT_PROGRESS },
            calibration: null
        };
    }

    /**
     * Initialize storage manager (async for compatibility)
     */
    async init() {
        // Check storage on init
        this.isAvailable = this.checkAvailability();
        console.log('[StorageManager] Initialized, localStorage available:', this.isAvailable);
        return this;
    }

    /**
     * Check if localStorage is available
     */
    checkAvailability() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            console.warn('localStorage not available, using memory fallback');
            return false;
        }
    }

    /**
     * Save data to storage
     */
    save(key, data) {
        try {
            if (this.isAvailable) {
                localStorage.setItem(key, JSON.stringify(data));
            } else {
                // Memory fallback
                if (key === STORAGE_KEYS.SETTINGS) {
                    this.memoryFallback.settings = data;
                } else if (key === STORAGE_KEYS.PROGRESS) {
                    this.memoryFallback.progress = data;
                } else if (key === STORAGE_KEYS.CALIBRATION) {
                    this.memoryFallback.calibration = data;
                }
            }
            return true;
        } catch (e) {
            console.error('Storage save error:', e);
            return false;
        }
    }

    /**
     * Load data from storage
     */
    load(key, defaultValue = null) {
        try {
            if (this.isAvailable) {
                const data = localStorage.getItem(key);
                return data ? JSON.parse(data) : defaultValue;
            } else {
                // Memory fallback
                if (key === STORAGE_KEYS.SETTINGS) {
                    return this.memoryFallback.settings;
                } else if (key === STORAGE_KEYS.PROGRESS) {
                    return this.memoryFallback.progress;
                } else if (key === STORAGE_KEYS.CALIBRATION) {
                    return this.memoryFallback.calibration;
                }
                return defaultValue;
            }
        } catch (e) {
            console.error('Storage load error:', e);
            return defaultValue;
        }
    }

    /**
     * Clear specific key from storage
     */
    clear(key) {
        try {
            if (this.isAvailable) {
                localStorage.removeItem(key);
            } else {
                if (key === STORAGE_KEYS.SETTINGS) {
                    this.memoryFallback.settings = { ...DEFAULT_SETTINGS };
                } else if (key === STORAGE_KEYS.PROGRESS) {
                    this.memoryFallback.progress = { ...DEFAULT_PROGRESS };
                } else if (key === STORAGE_KEYS.CALIBRATION) {
                    this.memoryFallback.calibration = null;
                }
            }
            return true;
        } catch (e) {
            console.error('Storage clear error:', e);
            return false;
        }
    }

    /**
     * Clear all game data
     */
    clearAll() {
        this.clear(STORAGE_KEYS.SETTINGS);
        this.clear(STORAGE_KEYS.PROGRESS);
        this.clear(STORAGE_KEYS.CALIBRATION);
    }

    // ============================================
    // Settings Methods
    // ============================================

    getSettings() {
        return this.load(STORAGE_KEYS.SETTINGS, { ...DEFAULT_SETTINGS });
    }

    saveSettings(settings) {
        return this.save(STORAGE_KEYS.SETTINGS, settings);
    }

    getSensitivity() {
        return this.getSettings().sensitivity;
    }

    setSensitivity(value) {
        const settings = this.getSettings();
        settings.sensitivity = Math.max(0.5, Math.min(2, value));
        return this.saveSettings(settings);
    }

    isSfxEnabled() {
        return this.getSettings().sfxEnabled;
    }

    setSfxEnabled(enabled) {
        const settings = this.getSettings();
        settings.sfxEnabled = enabled;
        return this.saveSettings(settings);
    }

    isMusicEnabled() {
        return this.getSettings().musicEnabled;
    }

    setMusicEnabled(enabled) {
        const settings = this.getSettings();
        settings.musicEnabled = enabled;
        return this.saveSettings(settings);
    }

    isVibrationEnabled() {
        return this.getSettings().vibrationEnabled;
    }

    setVibrationEnabled(enabled) {
        const settings = this.getSettings();
        settings.vibrationEnabled = enabled;
        return this.saveSettings(settings);
    }

    // Generic setting getter/setter for additional settings
    getSetting(key) {
        const settings = this.getSettings();
        return settings[key];
    }

    setSetting(key, value) {
        const settings = this.getSettings();
        settings[key] = value;
        return this.saveSettings(settings);
    }

    // ============================================
    // Progress Methods
    // ============================================

    getProgress() {
        return this.load(STORAGE_KEYS.PROGRESS, { ...DEFAULT_PROGRESS });
    }

    saveProgress(progress) {
        return this.save(STORAGE_KEYS.PROGRESS, progress);
    }

    getHighestUnlocked() {
        return this.getProgress().highestUnlocked;
    }

    unlockLevel(levelNumber) {
        const progress = this.getProgress();
        if (levelNumber > progress.highestUnlocked) {
            progress.highestUnlocked = levelNumber;
            return this.saveProgress(progress);
        }
        return true;
    }

    getLevelData(levelNumber) {
        const progress = this.getProgress();
        return progress.levelData[levelNumber] || {
            completed: false,
            bestTime: null,
            stars: 0
        };
    }

    saveLevelCompletion(levelNumber, time, stars) {
        const progress = this.getProgress();
        const existing = progress.levelData[levelNumber] || {
            completed: false,
            bestTime: null,
            stars: 0
        };

        // Update if better or first completion
        const isNewBest = !existing.bestTime || time < existing.bestTime;

        progress.levelData[levelNumber] = {
            completed: true,
            bestTime: isNewBest ? time : existing.bestTime,
            stars: Math.max(existing.stars, stars)
        };

        // Unlock next level
        if (levelNumber >= progress.highestUnlocked) {
            progress.highestUnlocked = levelNumber + 1;
        }

        this.saveProgress(progress);
        return isNewBest;
    }

    getTotalStars() {
        const progress = this.getProgress();
        let total = 0;
        for (const levelNum in progress.levelData) {
            total += progress.levelData[levelNum].stars || 0;
        }
        return total;
    }

    getCompletedLevels() {
        const progress = this.getProgress();
        let count = 0;
        for (const levelNum in progress.levelData) {
            if (progress.levelData[levelNum].completed) {
                count++;
            }
        }
        return count;
    }

    resetProgress() {
        return this.save(STORAGE_KEYS.PROGRESS, { ...DEFAULT_PROGRESS });
    }

    // ============================================
    // Calibration Methods
    // ============================================

    getCalibration() {
        return this.load(STORAGE_KEYS.CALIBRATION, null);
    }

    saveCalibration(calibrationData) {
        return this.save(STORAGE_KEYS.CALIBRATION, calibrationData);
    }

    clearCalibration() {
        return this.clear(STORAGE_KEYS.CALIBRATION);
    }

    // ============================================
    // Shop & Coins Methods
    // ============================================

    getShopData() {
        return this.load(STORAGE_KEYS.SHOP, { ...DEFAULT_SHOP });
    }

    saveShopData(shopData) {
        return this.save(STORAGE_KEYS.SHOP, shopData);
    }

    getCoins() {
        return this.getShopData().coins;
    }

    addCoins(amount) {
        const shop = this.getShopData();
        shop.coins += amount;
        // Only track positive earnings in totalCoinsEarned
        if (amount > 0) {
            shop.totalCoinsEarned += amount;
        }
        this.saveShopData(shop);
        return shop.coins;
    }

    spendCoins(amount) {
        const shop = this.getShopData();
        if (shop.coins >= amount) {
            shop.coins -= amount;
            this.saveShopData(shop);
            return true;
        }
        return false;
    }

    purchaseItem(itemId) {
        const shop = this.getShopData();
        if (!shop.purchased.includes(itemId)) {
            shop.purchased.push(itemId);
            this.saveShopData(shop);
        }
    }

    hasPurchased(itemId) {
        return this.getShopData().purchased.includes(itemId);
    }

    equipItem(category, itemId) {
        const shop = this.getShopData();
        shop.equipped[category] = itemId;
        this.saveShopData(shop);
    }

    getEquipped(category) {
        return this.getShopData().equipped[category];
    }

    resetShop() {
        return this.save(STORAGE_KEYS.SHOP, { ...DEFAULT_SHOP });
    }

    // ============================================
    // Lives Methods
    // ============================================

    getLives() {
        const shop = this.getShopData();
        return shop.lives !== undefined ? shop.lives : 4;
    }

    setLives(lives) {
        const shop = this.getShopData();
        shop.lives = Math.max(0, Math.min(lives, shop.maxLives || 10));
        this.saveShopData(shop);
        return shop.lives;
    }

    loseLife() {
        const shop = this.getShopData();
        shop.lives = Math.max(0, (shop.lives || 4) - 1);
        this.saveShopData(shop);
        return shop.lives;
    }

    addLife(count = 1) {
        const shop = this.getShopData();
        const maxLives = shop.maxLives || 10;
        shop.lives = Math.min((shop.lives || 0) + count, maxLives);
        this.saveShopData(shop);
        return shop.lives;
    }

    getMaxLives() {
        const shop = this.getShopData();
        return shop.maxLives || 10;
    }

    resetLives() {
        const shop = this.getShopData();
        shop.lives = 4;
        this.saveShopData(shop);
        return 4;
    }

    // Purchase lives with coins
    purchaseLives(count, cost) {
        const shop = this.getShopData();
        if (shop.coins >= cost) {
            shop.coins -= cost;
            const maxLives = shop.maxLives || 10;
            shop.lives = Math.min((shop.lives || 0) + count, maxLives);
            this.saveShopData(shop);
            return { success: true, lives: shop.lives, coins: shop.coins };
        }
        return { success: false, error: 'Not enough coins' };
    }
}

// Export class for instantiation
export { StorageManager, STORAGE_KEYS, DEFAULT_SETTINGS, DEFAULT_PROGRESS, DEFAULT_SHOP };
