/**
 * UpgradeManager.js
 * Handles upgrades, unlocks, and progression gates
 * REBUILT - Simplified and robust version
 */

export class UpgradeManager {
    constructor(storageManager) {
        this.storageManager = storageManager;

        // Define upgrade tiers - every 10 levels requires an upgrade
        this.upgrades = {
            steady_hand: {
                id: 'steady_hand',
                name: 'Steady Hand',
                description: 'Smoother ball control with reduced wobble',
                icon: '🎯',
                cost: 100,
                tier: 1,
                requiredForLevel: 11
            },
            compact_ball: {
                id: 'compact_ball',
                name: 'Compact Ball',
                description: 'Smaller ball fits through tight spaces',
                icon: '⚫',
                cost: 200,
                tier: 2,
                requiredForLevel: 21
            },
            feather_touch: {
                id: 'feather_touch',
                name: 'Feather Touch',
                description: 'Precise control with gentle acceleration',
                icon: '🪶',
                cost: 350,
                tier: 3,
                requiredForLevel: 31
            },
            safety_shield: {
                id: 'safety_shield',
                name: 'Safety Shield',
                description: 'Survive one hole fall per level',
                icon: '🛡️',
                cost: 500,
                tier: 4,
                requiredForLevel: 41
            },
            pathfinder: {
                id: 'pathfinder',
                name: 'Pathfinder',
                description: 'Shows optimal path at level start',
                icon: '🧭',
                cost: 700,
                tier: 5,
                requiredForLevel: 51
            },
            time_control: {
                id: 'time_control',
                name: 'Time Control',
                description: 'Tap screen to slow time briefly',
                icon: '⏱️',
                cost: 900,
                tier: 6,
                requiredForLevel: 61
            },
            ghost_phase: {
                id: 'ghost_phase',
                name: 'Ghost Phase',
                description: 'Pass through one wall per level',
                icon: '👻',
                cost: 1200,
                tier: 7,
                requiredForLevel: 71
            },
            coin_magnet: {
                id: 'coin_magnet',
                name: 'Coin Magnet',
                description: 'Coins attracted from further away',
                icon: '🧲',
                cost: 1500,
                tier: 8,
                requiredForLevel: 81
            },
            speed_surge: {
                id: 'speed_surge',
                name: 'Speed Surge',
                description: 'Double-tap for speed boost',
                icon: '⚡',
                cost: 2000,
                tier: 9,
                requiredForLevel: 91
            }
        };

        // Purchased upgrades
        this.purchased = new Set();
        this.loadPurchased();
    }

    loadPurchased() {
        try {
            const saved = this.storageManager.load('gyromaze_upgrades', []);
            this.purchased = new Set(Array.isArray(saved) ? saved : []);
        } catch (e) {
            console.error('Error loading upgrades:', e);
            this.purchased = new Set();
        }
    }

    savePurchased() {
        try {
            this.storageManager.save('gyromaze_upgrades', Array.from(this.purchased));
        } catch (e) {
            console.error('Error saving upgrades:', e);
        }
    }

    getUpgrade(id) {
        return this.upgrades[id] || null;
    }

    getAllUpgrades() {
        return Object.values(this.upgrades).sort((a, b) => a.tier - b.tier);
    }

    isPurchased(upgradeId) {
        return this.purchased.has(upgradeId);
    }

    canAfford(upgradeId) {
        const upgrade = this.upgrades[upgradeId];
        if (!upgrade) return false;
        return this.storageManager.getCoins() >= upgrade.cost;
    }

    purchase(upgradeId) {
        try {
            const upgrade = this.upgrades[upgradeId];
            if (!upgrade) {
                return { success: false, error: 'Upgrade not found' };
            }

            if (this.isPurchased(upgradeId)) {
                return { success: true, upgrade, alreadyOwned: true };
            }

            const coins = this.storageManager.getCoins();
            if (coins < upgrade.cost) {
                return { success: false, error: 'Not enough coins', needed: upgrade.cost - coins };
            }

            // Deduct coins
            this.storageManager.addCoins(-upgrade.cost);

            // Add to purchased
            this.purchased.add(upgradeId);
            this.savePurchased();

            console.log(`Upgrade purchased: ${upgradeId}`);
            return { success: true, upgrade };
        } catch (e) {
            console.error('Error purchasing upgrade:', e);
            return { success: false, error: e.message };
        }
    }

    // Get the upgrade required for a specific level number (1-based)
    getRequiredUpgradeForLevel(levelNum) {
        if (levelNum <= 10) return null;

        // Find which upgrade tier this level falls into
        const tier = Math.ceil((levelNum - 10) / 10);

        for (const upgrade of Object.values(this.upgrades)) {
            if (upgrade.tier === tier) {
                return upgrade;
            }
        }
        return null;
    }

    // Check if player can access a level (1-based level number)
    canAccessLevel(levelNum) {
        // First 10 levels always accessible
        if (levelNum <= 10) {
            return { canAccess: true };
        }

        // Get required upgrade for this level
        const requiredUpgrade = this.getRequiredUpgradeForLevel(levelNum);

        if (requiredUpgrade && !this.isPurchased(requiredUpgrade.id)) {
            return {
                canAccess: false,
                requiredUpgrade: requiredUpgrade,
                message: `Requires ${requiredUpgrade.name} to unlock levels ${requiredUpgrade.requiredForLevel}-${requiredUpgrade.requiredForLevel + 9}`
            };
        }

        // Also check all previous tiers
        for (const upgrade of Object.values(this.upgrades)) {
            if (upgrade.requiredForLevel <= levelNum && !this.isPurchased(upgrade.id)) {
                return {
                    canAccess: false,
                    requiredUpgrade: upgrade,
                    message: `Requires ${upgrade.name} first`
                };
            }
        }

        return { canAccess: true };
    }

    // Get the next upgrade that should be purchased
    getNextUpgrade() {
        const sorted = this.getAllUpgrades();
        for (const upgrade of sorted) {
            if (!this.isPurchased(upgrade.id)) {
                return upgrade;
            }
        }
        return null;
    }

    // Get player's upgrade progress
    getProgress() {
        const total = Object.keys(this.upgrades).length;
        const purchased = this.purchased.size;
        return {
            purchased,
            total,
            percentage: Math.round((purchased / total) * 100)
        };
    }

    // Reset all upgrades (for testing)
    resetProgress() {
        this.purchased = new Set();
        this.savePurchased();
    }

    // Get active upgrade effects (for game mechanics)
    getActiveEffects() {
        const effects = {
            steadyHand: false,
            compactBall: false,
            featherTouch: false,
            shield: false,
            pathfinder: false,
            slowMotion: false,
            ghost: false,
            magnetRadius: 0,
            speedSurge: false
        };

        if (this.isPurchased('steady_hand')) {
            effects.steadyHand = true;
        }
        if (this.isPurchased('compact_ball')) {
            effects.compactBall = true;
        }
        if (this.isPurchased('feather_touch')) {
            effects.featherTouch = true;
        }
        if (this.isPurchased('safety_shield')) {
            effects.shield = true;
        }
        if (this.isPurchased('pathfinder')) {
            effects.pathfinder = true;
        }
        if (this.isPurchased('time_control')) {
            effects.slowMotion = true;
        }
        if (this.isPurchased('ghost_phase')) {
            effects.ghost = true;
        }
        if (this.isPurchased('coin_magnet')) {
            effects.magnetRadius = 80;
        }
        if (this.isPurchased('speed_surge')) {
            effects.speedSurge = true;
        }

        return effects;
    }
}
