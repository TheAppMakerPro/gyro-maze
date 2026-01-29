/**
 * EngagementManager.js
 * Handles all psychological engagement mechanics to keep players hooked
 */

export class EngagementManager {
    constructor(storageManager) {
        this.storageManager = storageManager;

        // Daily rewards for 7 days (resets if missed)
        this.dailyRewards = [
            { day: 1, coins: 25, label: '25 Coins' },
            { day: 2, coins: 50, label: '50 Coins' },
            { day: 3, coins: 75, label: '75 Coins' },
            { day: 4, coins: 100, special: 'mystery_box', label: 'Mystery Box' },
            { day: 5, coins: 150, label: '150 Coins' },
            { day: 6, coins: 200, label: '200 Coins' },
            { day: 7, coins: 500, special: 'rare_spin', label: 'MEGA REWARD' }
        ];

        // Spin wheel prizes (weighted)
        this.spinPrizes = [
            { id: 'coins_10', label: '10 Coins', coins: 10, weight: 30, color: '#4ade80' },
            { id: 'coins_25', label: '25 Coins', coins: 25, weight: 25, color: '#22d3ee' },
            { id: 'coins_50', label: '50 Coins', coins: 50, weight: 20, color: '#a78bfa' },
            { id: 'coins_100', label: '100 Coins', coins: 100, weight: 10, color: '#f472b6' },
            { id: 'extra_life', label: '+1 Life', lives: 1, weight: 8, color: '#fb7185' },
            { id: 'coins_250', label: '250 Coins', coins: 250, weight: 5, color: '#fbbf24' },
            { id: 'double_next', label: '2X Next Win', multiplier: 2, weight: 2, color: '#f97316' }
        ];

        // Achievement definitions
        this.achievements = [
            // Progress achievements
            { id: 'first_win', name: 'First Victory', desc: 'Complete your first level', icon: '🏆', coins: 50 },
            { id: 'level_10', name: 'Getting Started', desc: 'Complete 10 levels', icon: '🌟', coins: 100 },
            { id: 'level_25', name: 'Apprentice', desc: 'Complete 25 levels', icon: '🎯', coins: 250 },
            { id: 'level_50', name: 'Skilled Player', desc: 'Complete 50 levels', icon: '🔥', coins: 500 },
            { id: 'level_100', name: 'Maze Master', desc: 'Complete all 100 levels', icon: '👑', coins: 1000 },

            // Performance achievements
            { id: 'speed_demon', name: 'Speed Demon', desc: 'Complete a level in under 10 seconds', icon: '⚡', coins: 75 },
            { id: 'perfectionist', name: 'Perfectionist', desc: 'Get 3 stars on any level', icon: '⭐', coins: 50 },
            { id: 'star_collector', name: 'Star Collector', desc: 'Earn 50 total stars', icon: '✨', coins: 150 },
            { id: 'star_hoarder', name: 'Star Hoarder', desc: 'Earn 150 total stars', icon: '🌠', coins: 300 },
            { id: 'triple_threat', name: 'Triple Threat', desc: 'Get 3 stars on 10 levels', icon: '💫', coins: 200 },

            // Streak achievements
            { id: 'streak_3', name: 'On Fire', desc: 'Win 3 levels in a row', icon: '🔥', coins: 30 },
            { id: 'streak_5', name: 'Unstoppable', desc: 'Win 5 levels in a row', icon: '💪', coins: 75 },
            { id: 'streak_10', name: 'Legendary', desc: 'Win 10 levels in a row', icon: '🏅', coins: 200 },

            // Collection achievements
            { id: 'coin_100', name: 'Penny Pincher', desc: 'Collect 100 coins total', icon: '🪙', coins: 25 },
            { id: 'coin_500', name: 'Coin Collector', desc: 'Collect 500 coins total', icon: '💰', coins: 50 },
            { id: 'coin_1000', name: 'Treasure Hunter', desc: 'Collect 1000 coins total', icon: '💎', coins: 100 },
            { id: 'coin_5000', name: 'Wealthy', desc: 'Collect 5000 coins total', icon: '🤑', coins: 250 },

            // Special achievements
            { id: 'comeback_kid', name: 'Comeback Kid', desc: 'Return after 24+ hours', icon: '👋', coins: 100 },
            { id: 'daily_7', name: 'Dedicated', desc: 'Login 7 days in a row', icon: '📅', coins: 200 },
            { id: 'no_walls', name: 'Untouchable', desc: 'Complete a level without hitting walls', icon: '🛡️', coins: 150 },
            { id: 'close_call', name: 'Close Call', desc: 'Win with less than 1 second to spare for 3 stars', icon: '😅', coins: 75 },
            { id: 'shopaholic', name: 'Shopaholic', desc: 'Purchase 5 items from the store', icon: '🛒', coins: 100 }
        ];

        // Daily challenges (rotate daily)
        this.dailyChallengeTemplates = [
            { id: 'complete_3', name: 'Triple Play', desc: 'Complete 3 levels today', target: 3, reward: 100, type: 'levels' },
            { id: 'complete_5', name: 'Five Alive', desc: 'Complete 5 levels today', target: 5, reward: 200, type: 'levels' },
            { id: 'stars_5', name: 'Star Gazer', desc: 'Earn 5 stars today', target: 5, reward: 75, type: 'stars' },
            { id: 'stars_10', name: 'Constellation', desc: 'Earn 10 stars today', target: 10, reward: 150, type: 'stars' },
            { id: 'coins_50', name: 'Coin Rush', desc: 'Collect 50 coins in levels', target: 50, reward: 100, type: 'coins_collected' },
            { id: 'perfect_1', name: 'Perfect Run', desc: 'Get 3 stars on any level', target: 1, reward: 125, type: 'perfect' },
            { id: 'streak_3', name: 'Hot Streak', desc: 'Win 3 levels in a row', target: 3, reward: 150, type: 'streak' },
            { id: 'no_death', name: 'Survivor', desc: 'Complete 3 levels without losing a life', target: 3, reward: 175, type: 'no_death' }
        ];

        // Motivational messages after losses
        this.motivationalMessages = [
            "So close! You've got this! 💪",
            "Almost there! One more try!",
            "Don't give up now! 🔥",
            "You're getting better every time!",
            "That was a tough one! Try again?",
            "Winners never quit! 🏆",
            "The maze can't beat you!",
            "Practice makes perfect! ⭐",
            "You're learning the path!",
            "Persistence is key! 🔑"
        ];

        // Near-miss messages
        this.nearMissMessages = [
            "Just {time} seconds away from 3 stars!",
            "SO CLOSE to a perfect run!",
            "You almost had it! {time}s faster = 3 stars!",
            "Incredible! Just a tiny bit faster!",
            "That was {time}s from perfection!"
        ];
    }

    init() {
        this.loadEngagementData();
        this.checkComebackBonus();
        console.log('EngagementManager initialized');
    }

    loadEngagementData() {
        const defaults = {
            // Daily login
            lastLoginDate: null,
            consecutiveLogins: 0,
            dailyRewardClaimed: false,

            // Streaks
            currentWinStreak: 0,
            bestWinStreak: 0,

            // Achievements
            unlockedAchievements: [],
            achievementProgress: {},

            // Daily challenge
            dailyChallengeDate: null,
            dailyChallenge: null,
            dailyChallengeProgress: 0,
            dailyChallengeClaimed: false,

            // Stats for achievements
            totalLevelsCompleted: 0,
            totalStarsEarned: 0,
            totalCoinsCollected: 0,
            perfectLevels: 0,
            itemsPurchased: 0,
            levelsWithoutWallHit: 0,
            levelsWithoutDeath: 0,

            // Multipliers
            nextWinMultiplier: 1,

            // Comeback
            lastPlayTime: Date.now(),
            comebackBonusClaimed: false,

            // Spins
            freeSpinsAvailable: 0,
            lastFreeSpin: null
        };

        this.data = this.storageManager.load('engagement_data', defaults);

        // Ensure all default fields exist
        for (const key in defaults) {
            if (this.data[key] === undefined) {
                this.data[key] = defaults[key];
            }
        }
    }

    saveEngagementData() {
        this.storageManager.save('engagement_data', this.data);
    }

    // ==================== DAILY LOGIN REWARDS ====================

    checkDailyReward() {
        const today = this.getDateString();
        const lastLogin = this.data.lastLoginDate;

        if (lastLogin === today) {
            // Already logged in today
            return { available: false, alreadyClaimed: this.data.dailyRewardClaimed };
        }

        const yesterday = this.getDateString(new Date(Date.now() - 86400000));

        if (lastLogin === yesterday) {
            // Consecutive day!
            this.data.consecutiveLogins = Math.min(7, this.data.consecutiveLogins + 1);
        } else if (lastLogin !== null) {
            // Streak broken - reset
            this.data.consecutiveLogins = 1;
        } else {
            // First time
            this.data.consecutiveLogins = 1;
        }

        this.data.lastLoginDate = today;
        this.data.dailyRewardClaimed = false;
        this.saveEngagementData();

        return {
            available: true,
            day: this.data.consecutiveLogins,
            reward: this.dailyRewards[this.data.consecutiveLogins - 1],
            allRewards: this.dailyRewards
        };
    }

    claimDailyReward() {
        if (this.data.dailyRewardClaimed) {
            return { success: false, reason: 'Already claimed' };
        }

        const reward = this.dailyRewards[this.data.consecutiveLogins - 1];
        this.data.dailyRewardClaimed = true;

        // Give coins
        if (reward.coins) {
            this.storageManager.addCoins(reward.coins);
        }

        // Handle specials
        let special = null;
        if (reward.special === 'mystery_box') {
            special = this.openMysteryBox();
        } else if (reward.special === 'rare_spin') {
            this.data.freeSpinsAvailable += 3;
            special = { type: 'spins', amount: 3 };
        }

        // Check 7-day achievement
        if (this.data.consecutiveLogins >= 7) {
            this.unlockAchievement('daily_7');
        }

        this.saveEngagementData();

        return { success: true, reward, special };
    }

    openMysteryBox() {
        const prizes = [
            { type: 'coins', amount: 100, weight: 40 },
            { type: 'coins', amount: 200, weight: 30 },
            { type: 'coins', amount: 300, weight: 15 },
            { type: 'lives', amount: 2, weight: 10 },
            { type: 'coins', amount: 500, weight: 5 }
        ];

        const prize = this.weightedRandom(prizes);

        if (prize.type === 'coins') {
            this.storageManager.addCoins(prize.amount);
        } else if (prize.type === 'lives') {
            const current = this.storageManager.getLives();
            this.storageManager.setLives(Math.min(10, current + prize.amount));
        }

        return prize;
    }

    // ==================== SPIN WHEEL ====================

    canSpin() {
        return this.data.freeSpinsAvailable > 0;
    }

    getSpinPrizes() {
        return this.spinPrizes;
    }

    spin() {
        if (!this.canSpin()) {
            return { success: false, reason: 'No spins available' };
        }

        this.data.freeSpinsAvailable--;
        const prize = this.weightedRandom(this.spinPrizes);

        // Apply prize
        if (prize.coins) {
            this.storageManager.addCoins(prize.coins);
        }
        if (prize.lives) {
            const current = this.storageManager.getLives();
            this.storageManager.setLives(Math.min(10, current + prize.lives));
        }
        if (prize.multiplier) {
            this.data.nextWinMultiplier = prize.multiplier;
        }

        this.saveEngagementData();

        return {
            success: true,
            prize,
            spinsRemaining: this.data.freeSpinsAvailable
        };
    }

    awardFreeSpin() {
        this.data.freeSpinsAvailable++;
        this.saveEngagementData();
    }

    // ==================== WIN STREAKS ====================

    recordWin() {
        try {
            this.data.currentWinStreak++;
            this.data.totalLevelsCompleted++;

            if (this.data.currentWinStreak > this.data.bestWinStreak) {
                this.data.bestWinStreak = this.data.currentWinStreak;
            }

            // Check streak achievements
            if (this.data.currentWinStreak >= 3) this.unlockAchievement('streak_3');
            if (this.data.currentWinStreak >= 5) this.unlockAchievement('streak_5');
            if (this.data.currentWinStreak >= 10) this.unlockAchievement('streak_10');

            // Check level completion achievements
            if (this.data.totalLevelsCompleted >= 1) this.unlockAchievement('first_win');
            if (this.data.totalLevelsCompleted >= 10) this.unlockAchievement('level_10');
            if (this.data.totalLevelsCompleted >= 25) this.unlockAchievement('level_25');
            if (this.data.totalLevelsCompleted >= 50) this.unlockAchievement('level_50');
            if (this.data.totalLevelsCompleted >= 100) this.unlockAchievement('level_100');

            this.saveEngagementData();

            return {
                streak: this.data.currentWinStreak,
                bonus: this.getStreakBonus()
            };
        } catch (error) {
            console.error('Error in recordWin:', error);
            return { streak: 0, bonus: 1 };
        }
    }

    recordLoss() {
        const hadStreak = this.data.currentWinStreak >= 2;
        this.data.currentWinStreak = 0;
        this.data.levelsWithoutDeath = 0;
        this.saveEngagementData();

        return {
            lostStreak: hadStreak,
            message: this.getMotivationalMessage()
        };
    }

    getStreakBonus() {
        const streak = this.data.currentWinStreak;
        if (streak < 2) return 1;
        if (streak < 5) return 1.25;
        if (streak < 10) return 1.5;
        return 2.0;
    }

    getMotivationalMessage() {
        return this.motivationalMessages[Math.floor(Math.random() * this.motivationalMessages.length)];
    }

    // ==================== ACHIEVEMENTS ====================

    unlockAchievement(id) {
        try {
            if (!this.data || !this.data.unlockedAchievements) {
                return null;
            }
            if (this.data.unlockedAchievements.includes(id)) {
                return null;
            }

            const achievement = this.achievements.find(a => a.id === id);
            if (!achievement) return null;

            this.data.unlockedAchievements.push(id);

            // Award coins
            if (achievement.coins && this.storageManager) {
                this.storageManager.addCoins(achievement.coins);
            }

            this.saveEngagementData();

            return achievement;
        } catch (error) {
            console.error('Error unlocking achievement:', error);
            return null;
        }
    }

    getAchievements() {
        return this.achievements.map(a => ({
            ...a,
            unlocked: this.data.unlockedAchievements.includes(a.id)
        }));
    }

    getUnlockedCount() {
        return this.data.unlockedAchievements.length;
    }

    recordStars(stars, levelTime, threeStarTime) {
        this.data.totalStarsEarned += stars;

        // Check star achievements
        if (this.data.totalStarsEarned >= 50) this.unlockAchievement('star_collector');
        if (this.data.totalStarsEarned >= 150) this.unlockAchievement('star_hoarder');

        if (stars === 3) {
            this.data.perfectLevels++;
            this.unlockAchievement('perfectionist');
            if (this.data.perfectLevels >= 10) this.unlockAchievement('triple_threat');

            // Award a free spin for 3 stars sometimes
            if (Math.random() < 0.3) {
                this.awardFreeSpin();
            }
        }

        // Check speed achievement
        if (levelTime < 10000) {
            this.unlockAchievement('speed_demon');
        }

        // Close call achievement (within 1 second of 3 stars)
        if (stars === 2 && threeStarTime) {
            const diff = levelTime - threeStarTime;
            if (diff < 1000) {
                this.unlockAchievement('close_call');
            }
        }

        this.saveEngagementData();
    }

    recordCoinsCollected(amount) {
        this.data.totalCoinsCollected += amount;

        if (this.data.totalCoinsCollected >= 100) this.unlockAchievement('coin_100');
        if (this.data.totalCoinsCollected >= 500) this.unlockAchievement('coin_500');
        if (this.data.totalCoinsCollected >= 1000) this.unlockAchievement('coin_1000');
        if (this.data.totalCoinsCollected >= 5000) this.unlockAchievement('coin_5000');

        this.saveEngagementData();
    }

    recordNoWallHit() {
        this.unlockAchievement('no_walls');
    }

    recordPurchase() {
        this.data.itemsPurchased++;
        if (this.data.itemsPurchased >= 5) {
            this.unlockAchievement('shopaholic');
        }
        this.saveEngagementData();
    }

    recordNoDeathLevel() {
        this.data.levelsWithoutDeath++;
        this.saveEngagementData();
    }

    // ==================== DAILY CHALLENGES ====================

    getDailyChallenge() {
        const today = this.getDateString();

        if (this.data.dailyChallengeDate !== today) {
            // Generate new challenge
            const seed = this.dateToSeed(today);
            const index = seed % this.dailyChallengeTemplates.length;
            this.data.dailyChallenge = { ...this.dailyChallengeTemplates[index] };
            this.data.dailyChallengeDate = today;
            this.data.dailyChallengeProgress = 0;
            this.data.dailyChallengeClaimed = false;
            this.saveEngagementData();
        }

        return {
            ...this.data.dailyChallenge,
            progress: this.data.dailyChallengeProgress,
            completed: this.data.dailyChallengeProgress >= this.data.dailyChallenge.target,
            claimed: this.data.dailyChallengeClaimed
        };
    }

    updateDailyChallengeProgress(type, amount = 1) {
        if (!this.data.dailyChallenge) return false;
        if (this.data.dailyChallenge.type !== type) return false;
        if (this.data.dailyChallengeClaimed) return false;

        this.data.dailyChallengeProgress += amount;
        this.saveEngagementData();

        return this.data.dailyChallengeProgress >= this.data.dailyChallenge.target;
    }

    claimDailyChallenge() {
        if (!this.data.dailyChallenge) return { success: false };
        if (this.data.dailyChallengeProgress < this.data.dailyChallenge.target) {
            return { success: false, reason: 'Not completed' };
        }
        if (this.data.dailyChallengeClaimed) {
            return { success: false, reason: 'Already claimed' };
        }

        const reward = this.data.dailyChallenge.reward;
        this.storageManager.addCoins(reward);
        this.data.dailyChallengeClaimed = true;
        this.saveEngagementData();

        return { success: true, reward };
    }

    // ==================== COMEBACK BONUS ====================

    checkComebackBonus() {
        const now = Date.now();
        const lastPlay = this.data.lastPlayTime || now;
        const hoursSinceLastPlay = (now - lastPlay) / (1000 * 60 * 60);

        this.data.lastPlayTime = now;

        if (hoursSinceLastPlay >= 24 && !this.data.comebackBonusClaimed) {
            // Eligible for comeback bonus
            return {
                eligible: true,
                hours: Math.floor(hoursSinceLastPlay),
                bonus: Math.min(200, Math.floor(hoursSinceLastPlay * 5)) // 5 coins per hour, max 200
            };
        }

        this.data.comebackBonusClaimed = false;
        this.saveEngagementData();
        return { eligible: false };
    }

    claimComebackBonus(bonus) {
        this.storageManager.addCoins(bonus);
        this.data.comebackBonusClaimed = true;
        this.unlockAchievement('comeback_kid');
        this.saveEngagementData();
        return { success: true, coins: bonus };
    }

    // ==================== NEAR MISS FEEDBACK ====================

    getNearMissMessage(actualTime, threeStarTime) {
        const diff = (actualTime - threeStarTime) / 1000;
        if (diff <= 0 || diff > 3) return null;

        const message = this.nearMissMessages[Math.floor(Math.random() * this.nearMissMessages.length)];
        return message.replace('{time}', diff.toFixed(1));
    }

    // ==================== MILESTONE REWARDS ====================

    checkMilestone(levelCompleted) {
        try {
            const milestones = {
                10: { coins: 100, message: '10 Levels Completed!' },
                25: { coins: 250, message: 'Quarter Way There!' },
                50: { coins: 500, message: 'Halfway Champion!' },
                75: { coins: 750, message: 'Almost There!' },
                100: { coins: 1000, message: 'MAZE MASTER!' }
            };

            if (milestones[levelCompleted]) {
                const reward = milestones[levelCompleted];
                if (this.storageManager) {
                    this.storageManager.addCoins(reward.coins);
                }
                return reward;
            }
            return null;
        } catch (error) {
            console.error('Error checking milestone:', error);
            return null;
        }
    }

    // ==================== MULTIPLIERS ====================

    getAndResetMultiplier() {
        const mult = this.data.nextWinMultiplier;
        this.data.nextWinMultiplier = 1;
        this.saveEngagementData();
        return mult;
    }

    hasActiveMultiplier() {
        return this.data.nextWinMultiplier > 1;
    }

    // ==================== UTILITY FUNCTIONS ====================

    getDateString(date = new Date()) {
        return date.toISOString().split('T')[0];
    }

    dateToSeed(dateString) {
        let hash = 0;
        for (let i = 0; i < dateString.length; i++) {
            hash = ((hash << 5) - hash) + dateString.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    weightedRandom(items) {
        const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
        let random = Math.random() * totalWeight;

        for (const item of items) {
            random -= item.weight;
            if (random <= 0) {
                return item;
            }
        }
        return items[items.length - 1];
    }

    // Get engagement stats for display
    getStats() {
        return {
            winStreak: this.data.currentWinStreak,
            bestStreak: this.data.bestWinStreak,
            totalLevels: this.data.totalLevelsCompleted,
            totalStars: this.data.totalStarsEarned,
            achievements: this.data.unlockedAchievements.length,
            totalAchievements: this.achievements.length,
            consecutiveLogins: this.data.consecutiveLogins,
            freeSpins: this.data.freeSpinsAvailable
        };
    }
}
