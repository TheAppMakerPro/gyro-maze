/**
 * LevelManager.js
 * Manages level data, progression, and saves
 */

import { LevelGenerator } from './LevelGenerator.js';

export class LevelManager {
    constructor(storageManager, upgradeManager) {
        this.storageManager = storageManager;
        this.upgradeManager = upgradeManager;
        this.levels = [];
        this.progress = {};
        this.totalLevels = 100;
        this.generator = new LevelGenerator();
    }

    async init() {
        // Generate all 100 levels
        console.log('Generating 100 maze levels...');
        this.levels = this.generator.generateAllLevels();
        this.totalLevels = this.levels.length;

        // Load saved progress
        this.loadProgress();

        console.log(`LevelManager initialized with ${this.totalLevels} levels`);
    }

    loadProgress() {
        const saved = this.storageManager.getProgress();

        if (saved && saved.completedLevels) {
            this.progress = saved;
        } else if (saved && saved.levelData) {
            // Migrate from old format
            this.progress = {
                unlockedLevels: [0],
                completedLevels: saved.levelData || {},
                currentLevel: 0
            };
            Object.keys(this.progress.completedLevels).forEach(idx => {
                const nextLevel = parseInt(idx) + 1;
                if (!this.progress.unlockedLevels.includes(nextLevel)) {
                    this.progress.unlockedLevels.push(nextLevel);
                }
            });
        } else {
            this.progress = {
                unlockedLevels: [0],
                completedLevels: {},
                currentLevel: 0
            };
            this.saveProgress();
        }
    }

    saveProgress() {
        this.storageManager.saveProgress(this.progress);
    }

    getLevel(index) {
        if (index < 0 || index >= this.levels.length) {
            return null;
        }
        return { ...this.levels[index] };
    }

    getLevelData(index) {
        const completedLevels = this.progress?.completedLevels || {};
        const completed = completedLevels[index] || null;
        const level = this.levels[index];

        // Check upgrade requirements
        const accessCheck = this.upgradeManager.canAccessLevel(index + 1);

        return {
            level: level,
            unlocked: this.isLevelUnlocked(index),
            completed: !!completed,
            bestTime: completed?.bestTime || null,
            stars: completed?.stars || 0,
            coinsCollected: completed?.coinsCollected || 0,
            totalCoins: level?.coins?.length || 0,
            canAccess: accessCheck.canAccess,
            requiredUpgrade: accessCheck.requiredUpgrade || null
        };
    }

    getAllLevelsData() {
        return this.levels.map((level, index) => this.getLevelData(index));
    }

    isLevelUnlocked(index) {
        // First level always unlocked
        if (index === 0) return true;

        // Level unlocked if previous is completed
        const completedLevels = this.progress?.completedLevels || {};
        return completedLevels[index - 1] !== undefined;
    }

    canPlayLevel(index) {
        // Check if level is unlocked
        if (!this.isLevelUnlocked(index)) {
            return { canPlay: false, reason: 'Level is locked. Complete the previous level first.' };
        }

        // Check upgrade requirements
        const accessCheck = this.upgradeManager.canAccessLevel(index + 1);
        if (!accessCheck.canAccess) {
            return {
                canPlay: false,
                reason: accessCheck.message,
                requiredUpgrade: accessCheck.requiredUpgrade
            };
        }

        return { canPlay: true };
    }

    completeLevel(index, time, stars, coinsCollected = 0) {
        if (!this.progress.completedLevels) {
            this.progress.completedLevels = {};
        }
        if (!this.progress.unlockedLevels) {
            this.progress.unlockedLevels = [0];
        }

        const existing = this.progress.completedLevels[index];
        const level = this.levels[index];

        // Calculate bonus coins
        let bonusCoins = 0;

        // First time completion bonus
        if (!existing) {
            bonusCoins += 20 + (index * 2); // More for higher levels
        }

        // All coins collected bonus
        if (level && coinsCollected >= (level.coins?.length || 0)) {
            bonusCoins += 15;
        }

        // New best time bonus
        if (!existing || time < existing.bestTime) {
            bonusCoins += 10;
        }

        // Star bonuses
        bonusCoins += stars * 10;

        // Perfect run bonus (3 stars + all coins)
        if (stars === 3 && level && coinsCollected >= (level.coins?.length || 0)) {
            bonusCoins += 50;
        }

        // Award bonus coins
        if (bonusCoins > 0) {
            this.storageManager.addCoins(bonusCoins);
        }

        // Update completion record
        if (!existing || time < existing.bestTime) {
            this.progress.completedLevels[index] = {
                bestTime: time,
                stars: Math.max(stars, existing?.stars || 0),
                coinsCollected: Math.max(coinsCollected, existing?.coinsCollected || 0),
                completedAt: Date.now()
            };
        } else if (stars > existing.stars || coinsCollected > existing.coinsCollected) {
            this.progress.completedLevels[index].stars = Math.max(stars, existing.stars);
            this.progress.completedLevels[index].coinsCollected = Math.max(coinsCollected, existing.coinsCollected);
        }

        // Unlock next level
        if (index + 1 < this.levels.length) {
            if (!this.progress.unlockedLevels.includes(index + 1)) {
                this.progress.unlockedLevels.push(index + 1);
            }
        }

        this.saveProgress();

        return { bonusCoins };
    }

    getCurrentLevel() {
        return this.progress?.currentLevel || 0;
    }

    setCurrentLevel(index) {
        if (!this.progress) {
            this.progress = { unlockedLevels: [0], completedLevels: {}, currentLevel: 0 };
        }
        this.progress.currentLevel = index;
        this.saveProgress();
    }

    getNextLevelIndex(currentIndex) {
        const nextIndex = currentIndex + 1;
        if (nextIndex < this.levels.length) {
            return nextIndex;
        }
        return null;
    }

    getTotalStars() {
        let total = 0;
        const completedLevels = this.progress?.completedLevels || {};
        Object.values(completedLevels).forEach(data => {
            total += data.stars || 0;
        });
        return total;
    }

    getMaxPossibleStars() {
        return this.levels.length * 3;
    }

    getCompletedCount() {
        const completedLevels = this.progress?.completedLevels || {};
        return Object.keys(completedLevels).length;
    }

    getTotalCoinsCollected() {
        let total = 0;
        const completedLevels = this.progress?.completedLevels || {};
        Object.values(completedLevels).forEach(data => {
            total += data.coinsCollected || 0;
        });
        return total;
    }

    // Get levels by difficulty tier
    getLevelsByDifficulty(difficulty) {
        return this.levels.filter(level => level.difficulty === difficulty);
    }

    // Get completion percentage
    getCompletionPercentage() {
        const completed = this.getCompletedCount();
        return Math.round((completed / this.totalLevels) * 100);
    }

    resetProgress() {
        this.progress = {
            unlockedLevels: [0],
            completedLevels: {},
            currentLevel: 0
        };
        this.saveProgress();
        this.storageManager.resetProgress();
    }

    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const millis = Math.floor((ms % 1000) / 10);

        if (minutes > 0) {
            return `${minutes}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(2, '0')}`;
        }
        return `${secs}.${millis.toString().padStart(2, '0')}s`;
    }
}
