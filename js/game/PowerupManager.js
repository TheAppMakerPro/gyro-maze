/**
 * PowerupManager.js
 * Handles in-game powerups, hazards, and special effects
 */

export class PowerupManager {
    constructor(audioManager) {
        this.audioManager = audioManager;

        // Active powerup effects
        this.activeEffects = {
            speedBoost: false,
            slowMotion: false,
            shield: false,
            magnet: false,
            ghost: false,
            reverse: false,
            shrink: false,
            grow: false
        };

        // Effect timers
        this.effectTimers = {};

        // Powerup definitions
        this.powerupTypes = {
            speed_boost: {
                id: 'speed_boost',
                name: 'Speed Boost',
                icon: '⚡',
                color: '#ffff00',
                glowColor: 'rgba(255, 255, 0, 0.6)',
                duration: 3000,
                effect: 'speedBoost',
                multiplier: 1.8
            },
            slow_motion: {
                id: 'slow_motion',
                name: 'Slow Motion',
                icon: '🐌',
                color: '#00aaff',
                glowColor: 'rgba(0, 170, 255, 0.6)',
                duration: 4000,
                effect: 'slowMotion',
                multiplier: 0.4
            },
            shield: {
                id: 'shield',
                name: 'Shield',
                icon: '🛡️',
                color: '#00ff88',
                glowColor: 'rgba(0, 255, 136, 0.6)',
                duration: 5000,
                effect: 'shield',
                protectsFrom: ['holes', 'hazards']
            },
            magnet: {
                id: 'magnet',
                name: 'Coin Magnet',
                icon: '🧲',
                color: '#ff00aa',
                glowColor: 'rgba(255, 0, 170, 0.6)',
                duration: 6000,
                effect: 'magnet',
                range: 100
            },
            ghost: {
                id: 'ghost',
                name: 'Ghost Mode',
                icon: '👻',
                color: '#8b5cf6',
                glowColor: 'rgba(139, 92, 246, 0.6)',
                duration: 2500,
                effect: 'ghost',
                phaseThrough: true
            },
            shrink: {
                id: 'shrink',
                name: 'Shrink',
                icon: '🔽',
                color: '#00ffcc',
                glowColor: 'rgba(0, 255, 204, 0.6)',
                duration: 5000,
                effect: 'shrink',
                sizeMultiplier: 0.6
            },
            time_freeze: {
                id: 'time_freeze',
                name: 'Time Freeze',
                icon: '❄️',
                color: '#88ddff',
                glowColor: 'rgba(136, 221, 255, 0.8)',
                duration: 3000,
                effect: 'timeFreeze',
                freezesHazards: true
            },
            double_coins: {
                id: 'double_coins',
                name: 'Double Coins',
                icon: '💰',
                color: '#ffd700',
                glowColor: 'rgba(255, 215, 0, 0.6)',
                duration: 8000,
                effect: 'doubleCoins',
                multiplier: 2
            }
        };

        // Hazard definitions
        this.hazardTypes = {
            moving_wall: {
                id: 'moving_wall',
                name: 'Moving Wall',
                color: '#ff3366',
                pattern: 'horizontal', // or 'vertical', 'circular'
                speed: 40,
                range: 60
            },
            spinning_blade: {
                id: 'spinning_blade',
                name: 'Spinning Blade',
                color: '#ff0000',
                rotationSpeed: 2,
                radius: 30
            },
            speed_zone: {
                id: 'speed_zone',
                name: 'Speed Zone',
                color: '#ffaa00',
                multiplier: 2.0,
                direction: null // null = boost in current direction
            },
            slow_zone: {
                id: 'slow_zone',
                name: 'Slow Zone',
                color: '#0066ff',
                multiplier: 0.4
            },
            bounce_pad: {
                id: 'bounce_pad',
                name: 'Bounce Pad',
                color: '#00ff88',
                bounceForce: 15,
                direction: 'up' // 'up', 'down', 'left', 'right', 'reflect'
            },
            teleporter: {
                id: 'teleporter',
                name: 'Teleporter',
                color: '#8b5cf6',
                linkedTo: null // ID of paired teleporter
            },
            gravity_well: {
                id: 'gravity_well',
                name: 'Gravity Well',
                color: '#440066',
                pullStrength: 0.3,
                radius: 50
            },
            reverse_zone: {
                id: 'reverse_zone',
                name: 'Reverse Zone',
                color: '#ff00ff',
                duration: 3000
            }
        };
    }

    // Activate a powerup effect
    activateEffect(powerupId) {
        const powerup = this.powerupTypes[powerupId];
        if (!powerup) return;

        // Clear existing timer for this effect
        if (this.effectTimers[powerup.effect]) {
            clearTimeout(this.effectTimers[powerup.effect]);
        }

        // Activate effect
        this.activeEffects[powerup.effect] = true;

        // Set timer to deactivate
        this.effectTimers[powerup.effect] = setTimeout(() => {
            this.activeEffects[powerup.effect] = false;
            delete this.effectTimers[powerup.effect];
        }, powerup.duration);

        // Play sound
        if (this.audioManager) {
            this.audioManager.playSound('powerup');
        }

        return powerup;
    }

    // Check if an effect is active
    isEffectActive(effectName) {
        return this.activeEffects[effectName] === true;
    }

    // Get remaining time for an effect
    getEffectRemainingTime(effectName) {
        // This would need to track start times - simplified for now
        return this.activeEffects[effectName] ? 1000 : 0;
    }

    // Clear all effects (when level ends)
    clearAllEffects() {
        for (const key of Object.keys(this.activeEffects)) {
            this.activeEffects[key] = false;
        }
        for (const timer of Object.values(this.effectTimers)) {
            clearTimeout(timer);
        }
        this.effectTimers = {};
    }

    // Get speed multiplier from active effects
    getSpeedMultiplier() {
        let multiplier = 1.0;

        if (this.activeEffects.speedBoost) {
            multiplier *= this.powerupTypes.speed_boost.multiplier;
        }
        if (this.activeEffects.slowMotion) {
            multiplier *= this.powerupTypes.slow_motion.multiplier;
        }

        return multiplier;
    }

    // Get ball size multiplier
    getSizeMultiplier() {
        if (this.activeEffects.shrink) {
            return this.powerupTypes.shrink.sizeMultiplier;
        }
        if (this.activeEffects.grow) {
            return 1.4;
        }
        return 1.0;
    }

    // Check if ball is protected
    isProtected() {
        return this.activeEffects.shield;
    }

    // Check if ball can phase through walls
    canPhaseThrough() {
        return this.activeEffects.ghost;
    }

    // Get coin multiplier
    getCoinMultiplier() {
        if (this.activeEffects.doubleCoins) {
            return 2;
        }
        return 1;
    }

    // Get magnet range
    getMagnetRange() {
        if (this.activeEffects.magnet) {
            return this.powerupTypes.magnet.range;
        }
        return 0;
    }
}
