/**
 * GameEngine.js
 * Core game loop, physics simulation, and collision detection
 */

// Ball skin definitions
const BALL_SKINS = {
    ball_default: {
        gradient: ['#ffffff', '#00f5ff', '#0088aa'],
        glow: '#00f5ff'
    },
    ball_fire: {
        gradient: ['#ffffff', '#ff6b35', '#ff0000'],
        glow: '#ff6b35'
    },
    ball_toxic: {
        gradient: ['#ffffff', '#00ff88', '#00aa44'],
        glow: '#00ff88'
    },
    ball_purple: {
        gradient: ['#ffffff', '#8b5cf6', '#5b21b6'],
        glow: '#8b5cf6'
    },
    ball_gold: {
        gradient: ['#ffffff', '#ffd700', '#b8860b'],
        glow: '#ffd700'
    },
    ball_rainbow: {
        gradient: ['#ff0000', '#00ff00', '#0000ff'],
        glow: '#ffffff',
        rainbow: true
    }
};

// Trail effect definitions
const TRAIL_EFFECTS = {
    trail_default: { opacity: 0.5, size: 0.5, color: null },
    trail_none: { opacity: 0, size: 0, color: null },
    trail_fire: { opacity: 0.7, size: 0.6, color: '#ff6b35' },
    trail_sparkle: { opacity: 0.8, size: 0.4, color: '#ffd700', sparkle: true },
    trail_rainbow: { opacity: 0.6, size: 0.5, rainbow: true }
};

export class GameEngine {
    constructor(inputManager, levelManager, audioManager, storageManager, upgradeManager) {
        this.inputManager = inputManager;
        this.levelManager = levelManager;
        this.audioManager = audioManager;
        this.storageManager = storageManager;
        this.upgradeManager = upgradeManager;

        // Canvas setup
        this.canvas = null;
        this.ctx = null;
        this.width = 0;
        this.height = 0;
        this.scale = 1;

        // Game state
        this.isRunning = false;
        this.isPaused = false;
        this.currentLevel = null;
        this.levelIndex = 0;

        // Ball physics (pinball-style bounce)
        this.ball = {
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            radius: 15,
            mass: 1,
            friction: 0.98,
            bounce: 0.75  // Higher bounce for pinball feel
        };

        // Physics constants
        this.gravity = 0.5;  // Base acceleration from tilt
        this.maxSpeed = 12;

        // Timer
        this.startTime = 0;
        this.elapsedTime = 0;
        this.timerInterval = null;

        // Time Warp (slow motion) upgrade
        this.timeScale = 1.0;
        this.timeWarpActive = false;
        this.timeWarpUsed = false;
        this.timeWarpDuration = 3000; // 3 seconds

        // Animation frame
        this.animationFrameId = null;
        this.lastFrameTime = 0;

        // Callbacks
        this.onWin = null;
        this.onLose = null;
        this.onGameOver = null;
        this.onTimeUpdate = null;
        this.onCoinCollected = null;
        this.onLifeCollected = null;
        this.onLifeLost = null;
        this.onWallHit = null;
        this.onLevelStart = null;

        // Visual effects
        this.particles = [];
        this.trailPoints = [];
        this.maxTrailPoints = 20;

        // Collectible coins
        this.levelCoins = [];
        this.collectedCoins = [];
        this.coinRadius = 12;
        this.coinsCollectedThisLevel = 0;

        // Extra lives in level
        this.levelExtraLives = [];
        this.extraLifeRadius = 14;

        // New exciting elements
        this.levelPowerups = [];
        this.powerupRadius = 14;
        this.activePowerups = {}; // Active powerup effects

        this.levelBouncePads = [];
        this.levelSpeedZones = [];
        this.levelMovingWalls = [];

        // Bind methods
        this.gameLoop = this.gameLoop.bind(this);
    }

    init() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Handle canvas resize
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        console.log('GameEngine initialized');
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();

        // Use device pixel ratio for sharp rendering
        const dpr = window.devicePixelRatio || 1;

        // Get dimensions - fallback to window size if container not visible yet
        this.width = rect.width || window.innerWidth;
        this.height = rect.height || (window.innerHeight - 80); // Account for HUD

        // Ensure minimum dimensions
        if (this.width < 100 || this.height < 100) {
            this.width = window.innerWidth;
            this.height = window.innerHeight - 80;
        }

        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;

        // Reset transform and apply scale
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);

        // Calculate scale for maze rendering
        if (this.currentLevel) {
            this.calculateScale();
        }

        console.log(`Resized canvas to ${this.width}x${this.height}`);
    }

    calculateScale() {
        if (!this.currentLevel) return;

        const mazeWidth = this.currentLevel.width;
        const mazeHeight = this.currentLevel.height;

        // Minimal padding for mobile - maximize play area
        const padding = 20;
        const availableWidth = this.width - padding * 2;
        const availableHeight = this.height - padding * 2;

        // Scale to fill available space
        this.scale = Math.min(
            availableWidth / mazeWidth,
            availableHeight / mazeHeight
        );

        // Calculate offset to center maze
        this.offsetX = (this.width - mazeWidth * this.scale) / 2;
        this.offsetY = (this.height - mazeHeight * this.scale) / 2;

        console.log(`Canvas: ${this.width}x${this.height}, Maze: ${mazeWidth}x${mazeHeight}, Scale: ${this.scale.toFixed(2)}`);
    }

    loadLevel(levelIndex) {
        this.levelIndex = levelIndex;
        this.currentLevel = this.levelManager.getLevel(levelIndex);

        if (!this.currentLevel) {
            console.error('Level not found:', levelIndex);
            return false;
        }

        // Reset time warp for new level
        this.timeScale = 1.0;
        this.timeWarpActive = false;
        this.timeWarpUsed = false;

        // Calculate rendering scale
        this.calculateScale();

        // Reset ball to start position
        this.resetBall();

        // Clear particles and trail
        this.particles = [];
        this.trailPoints = [];

        // Load level coins
        this.levelCoins = (this.currentLevel.coins || []).map(c => ({ ...c }));
        this.collectedCoins = [];
        this.coinsCollectedThisLevel = 0;

        // Load extra lives
        this.levelExtraLives = (this.currentLevel.extraLives || []).map(l => ({ ...l }));

        // Load new exciting elements
        this.levelPowerups = (this.currentLevel.powerups || []).map(p => ({ ...p, collected: false }));
        this.levelBouncePads = (this.currentLevel.bouncePads || []).map(b => ({ ...b }));
        this.levelSpeedZones = (this.currentLevel.speedZones || []).map(z => ({ ...z }));
        this.levelMovingWalls = (this.currentLevel.movingWalls || []).map(w => ({
            ...w,
            currentX: w.originalX,
            currentY: w.originalY,
            time: 0
        }));

        // Clear active powerups
        this.activePowerups = {};

        console.log(`Loaded level ${levelIndex + 1}: ${this.currentLevel.name}`);
        console.log(`  - ${this.levelCoins.length} coins, ${this.levelExtraLives.length} extra lives`);
        console.log(`  - ${this.levelPowerups.length} powerups, ${this.levelBouncePads.length} bounce pads`);
        console.log(`  - ${this.levelSpeedZones.length} speed zones, ${this.levelMovingWalls.length} moving walls`);
        return true;
    }

    resetBall() {
        if (!this.currentLevel) return;

        const start = this.currentLevel.start;
        this.ball.x = start.x;
        this.ball.y = start.y;
        this.ball.vx = 0;
        this.ball.vy = 0;
        this.ball.radius = this.currentLevel.ballRadius || 15;

        this.trailPoints = [];

        // Reset coins to original positions
        this.levelCoins = (this.currentLevel.coins || []).map(c => ({ ...c }));
        this.coinsCollectedThisLevel = 0;

        // Reset extra lives
        this.levelExtraLives = (this.currentLevel.extraLives || []).map(l => ({ ...l }));

        // Reset powerups
        this.levelPowerups = (this.currentLevel.powerups || []).map(p => ({ ...p, collected: false }));
        this.activePowerups = {};

        // Reset moving walls
        this.levelMovingWalls = (this.currentLevel.movingWalls || []).map(w => ({
            ...w,
            currentX: w.originalX,
            currentY: w.originalY,
            time: 0
        }));
    }

    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.isPaused = false;
        this.elapsedTime = 0;
        this.startTime = performance.now();

        // Ensure audio is ready
        this.audioManager.ensureAudioReady();

        // Notify level start for tracking
        if (this.onLevelStart) this.onLevelStart();

        // Start timer
        this.startTimer();

        // Start game loop
        this.lastFrameTime = performance.now();
        this.animationFrameId = requestAnimationFrame(this.gameLoop);

        // Start listening to input
        this.inputManager.start();

        this.audioManager.playMusic();

        // Voice announcement
        this.audioManager.speakLevelStart(this.levelIndex + 1);
        this.audioManager.speakGo();
        this.audioManager.speakInstructions();

        console.log('Game started');
    }

    pause() {
        if (!this.isRunning || this.isPaused) return;

        this.isPaused = true;
        this.stopTimer();
        cancelAnimationFrame(this.animationFrameId);
        this.inputManager.stop();

        console.log('Game paused');
    }

    resume() {
        if (!this.isRunning || !this.isPaused) return;

        this.isPaused = false;
        this.startTimer();
        this.lastFrameTime = performance.now();
        this.animationFrameId = requestAnimationFrame(this.gameLoop);
        this.inputManager.start();

        console.log('Game resumed');
    }

    stop() {
        this.isRunning = false;
        this.isPaused = false;
        this.stopTimer();
        
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        this.inputManager.stop();

        console.log('Game stopped');
    }

    restart() {
        this.stop();
        this.resetBall();
        this.particles = [];
        this.trailPoints = [];
        this.start();
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            const now = performance.now();
            this.elapsedTime = now - this.startTime;
            
            if (this.onTimeUpdate) {
                this.onTimeUpdate(this.elapsedTime);
            }
        }, 100);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    gameLoop(timestamp) {
        if (!this.isRunning || this.isPaused) return;

        // Calculate delta time
        const deltaTime = Math.min((timestamp - this.lastFrameTime) / 1000, 0.05);
        this.lastFrameTime = timestamp;

        // Update physics
        this.update(deltaTime);

        // Render frame
        this.render();

        // Continue loop
        this.animationFrameId = requestAnimationFrame(this.gameLoop);
    }

    update(deltaTime) {
        // Apply time scale (for Time Warp slow motion)
        const scaledDelta = deltaTime * this.timeScale;

        // Get tilt input
        const input = this.inputManager.getTilt();
        const sensitivity = this.storageManager.getSensitivity() || 1;

        // Apply tilt as acceleration (use scaled delta for physics)
        const ax = input.x * this.gravity * sensitivity * 60 * deltaTime;
        const ay = input.y * this.gravity * sensitivity * 60 * deltaTime;

        // Update velocity
        this.ball.vx += ax;
        this.ball.vy += ay;

        // Apply friction
        this.ball.vx *= Math.pow(this.ball.friction, deltaTime * 60);
        this.ball.vy *= Math.pow(this.ball.friction, deltaTime * 60);

        // Clamp velocity
        const speed = Math.sqrt(this.ball.vx ** 2 + this.ball.vy ** 2);
        if (speed > this.maxSpeed) {
            this.ball.vx = (this.ball.vx / speed) * this.maxSpeed;
            this.ball.vy = (this.ball.vy / speed) * this.maxSpeed;
        }

        // Store previous position for trail
        if (speed > 0.5) {
            this.trailPoints.push({ x: this.ball.x, y: this.ball.y, alpha: 1 });
            if (this.trailPoints.length > this.maxTrailPoints) {
                this.trailPoints.shift();
            }
        }

        // Update position
        const newX = this.ball.x + this.ball.vx * deltaTime * 60;
        const newY = this.ball.y + this.ball.vy * deltaTime * 60;

        // Check collisions with walls
        const collision = this.checkWallCollisions(newX, newY);
        
        if (collision.x) {
            // Pinball-style bounce - more elastic with speed boost
            this.ball.vx *= -this.ball.bounce * 1.2;
            // Add slight random deflection for pinball feel
            this.ball.vy += (Math.random() - 0.5) * 2;
            this.ball.x = collision.newX;
            this.audioManager.playSound('bumper');
            this.audioManager.speakWallHit();
            this.spawnParticles(this.ball.x, this.ball.y, 'wall', 5);
            // Vibrate feedback
            if (this.storageManager.isVibrationEnabled() && navigator.vibrate) {
                navigator.vibrate(20);
            }
            // Notify for achievement tracking
            if (this.onWallHit) this.onWallHit();
        } else {
            this.ball.x = newX;
        }

        if (collision.y) {
            // Pinball-style bounce - more elastic with speed boost
            this.ball.vy *= -this.ball.bounce * 1.2;
            // Add slight random deflection for pinball feel
            this.ball.vx += (Math.random() - 0.5) * 2;
            this.ball.y = collision.newY;
            this.audioManager.playSound('bumper');
            this.audioManager.speakWallHit();
            this.spawnParticles(this.ball.x, this.ball.y, 'wall', 5);
            // Vibrate feedback
            if (this.storageManager.isVibrationEnabled() && navigator.vibrate) {
                navigator.vibrate(20);
            }
            // Notify for achievement tracking
            if (this.onWallHit) this.onWallHit();
        } else {
            this.ball.y = newY;
        }

        // Check hole collisions
        if (this.checkHoleCollision()) {
            this.handleLose();
            return;
        }

        // Check goal collision
        if (this.checkGoalCollision()) {
            this.handleWin();
            return;
        }

        // Check coin collection
        this.checkCoinCollision();

        // Check extra life collection
        this.checkExtraLifeCollision();

        // Check powerup collection
        this.checkPowerupCollision();

        // Check bounce pad collision
        this.checkBouncePadCollision();

        // Apply speed zone effects
        this.applySpeedZoneEffects();

        // Update moving walls
        this.updateMovingWalls(deltaTime);

        // Update active powerup timers
        this.updateActivePowerups(deltaTime);

        // Update particles
        this.updateParticles(deltaTime);

        // Fade trail
        this.trailPoints.forEach(point => {
            point.alpha -= deltaTime * 3;
        });
        this.trailPoints = this.trailPoints.filter(p => p.alpha > 0);
    }

    checkWallCollisions(newX, newY) {
        const result = { x: false, y: false, newX: this.ball.x, newY: this.ball.y };
        const walls = this.currentLevel.walls;
        const r = this.ball.radius;

        for (const wall of walls) {
            // Wall boundaries
            const left = wall.x;
            const right = wall.x + wall.width;
            const top = wall.y;
            const bottom = wall.y + wall.height;

            // Check X collision
            const nearestX = Math.max(left, Math.min(newX, right));
            const nearestY = Math.max(top, Math.min(this.ball.y, bottom));
            const distX = newX - nearestX;
            const distY = this.ball.y - nearestY;
            const distanceX = Math.sqrt(distX ** 2 + distY ** 2);

            if (distanceX < r) {
                result.x = true;
                if (newX < left) {
                    result.newX = left - r;
                } else if (newX > right) {
                    result.newX = right + r;
                }
            }

            // Check Y collision
            const nearestX2 = Math.max(left, Math.min(this.ball.x, right));
            const nearestY2 = Math.max(top, Math.min(newY, bottom));
            const distX2 = this.ball.x - nearestX2;
            const distY2 = newY - nearestY2;
            const distanceY = Math.sqrt(distX2 ** 2 + distY2 ** 2);

            if (distanceY < r) {
                result.y = true;
                if (newY < top) {
                    result.newY = top - r;
                } else if (newY > bottom) {
                    result.newY = bottom + r;
                }
            }
        }

        // Check moving wall collisions
        for (const wall of this.levelMovingWalls) {
            const left = wall.currentX;
            const right = wall.currentX + wall.width;
            const top = wall.currentY;
            const bottom = wall.currentY + wall.height;

            // Check X collision
            const nearestX = Math.max(left, Math.min(newX, right));
            const nearestY = Math.max(top, Math.min(this.ball.y, bottom));
            const distX = newX - nearestX;
            const distY = this.ball.y - nearestY;
            const distanceX = Math.sqrt(distX ** 2 + distY ** 2);

            if (distanceX < r) {
                result.x = true;
                if (newX < left) {
                    result.newX = left - r;
                } else if (newX > right) {
                    result.newX = right + r;
                }
            }

            // Check Y collision
            const nearestX2 = Math.max(left, Math.min(this.ball.x, right));
            const nearestY2 = Math.max(top, Math.min(newY, bottom));
            const distX2 = this.ball.x - nearestX2;
            const distY2 = newY - nearestY2;
            const distanceY = Math.sqrt(distX2 ** 2 + distY2 ** 2);

            if (distanceY < r) {
                result.y = true;
                if (newY < top) {
                    result.newY = top - r;
                } else if (newY > bottom) {
                    result.newY = bottom + r;
                }
            }
        }

        // Check boundary collisions
        const mazeWidth = this.currentLevel.width;
        const mazeHeight = this.currentLevel.height;

        if (newX - r < 0) {
            result.x = true;
            result.newX = r;
        } else if (newX + r > mazeWidth) {
            result.x = true;
            result.newX = mazeWidth - r;
        }

        if (newY - r < 0) {
            result.y = true;
            result.newY = r;
        } else if (newY + r > mazeHeight) {
            result.y = true;
            result.newY = mazeHeight - r;
        }

        return result;
    }

    checkHoleCollision() {
        const holes = this.currentLevel.holes || [];

        for (const hole of holes) {
            const dx = this.ball.x - hole.x;
            const dy = this.ball.y - hole.y;
            const distance = Math.sqrt(dx ** 2 + dy ** 2);

            // Ball falls in if center is within 85% of hole radius (fair collision)
            if (distance < hole.radius * 0.85) {
                return true;
            }
        }

        return false;
    }

    checkGoalCollision() {
        const goal = this.currentLevel.goal;
        const dx = this.ball.x - goal.x;
        const dy = this.ball.y - goal.y;
        const distance = Math.sqrt(dx ** 2 + dy ** 2);

        // Win when ball center reaches goal
        return distance < goal.radius;
    }

    checkCoinCollision() {
        // Get upgrade effects for coin magnet
        const effects = this.upgradeManager?.getActiveEffects() || {};
        const magnetRadius = effects.magnetRadius || 0;

        for (let i = this.levelCoins.length - 1; i >= 0; i--) {
            const coin = this.levelCoins[i];
            const dx = this.ball.x - coin.x;
            const dy = this.ball.y - coin.y;
            const distance = Math.sqrt(dx ** 2 + dy ** 2);

            // Coin Magnet: Attract coins within magnet radius
            if (magnetRadius > 0 && distance < magnetRadius && distance > this.ball.radius + this.coinRadius) {
                const pullStrength = 0.15; // How fast coins are attracted
                const pullX = dx / distance * pullStrength * (magnetRadius - distance);
                const pullY = dy / distance * pullStrength * (magnetRadius - distance);
                coin.x += pullX;
                coin.y += pullY;
            }

            // Collect coin when ball touches it
            if (distance < this.ball.radius + this.coinRadius) {
                // Remove coin from level
                this.levelCoins.splice(i, 1);
                this.coinsCollectedThisLevel++;

                // Award coin immediately
                this.storageManager.addCoins(5);

                // Play ka-ching! sound and spawn particles
                this.audioManager.playSound('coin');
                this.spawnParticles(coin.x, coin.y, 'coin', 8);

                // Vibrate feedback
                if (this.storageManager.isVibrationEnabled() && navigator.vibrate) {
                    navigator.vibrate(30);
                }

                // Notify UI of coin collection
                if (this.onCoinCollected) {
                    this.onCoinCollected(this.coinsCollectedThisLevel);
                }
            }
        }
    }

    checkExtraLifeCollision() {
        for (let i = this.levelExtraLives.length - 1; i >= 0; i--) {
            const life = this.levelExtraLives[i];
            const dx = this.ball.x - life.x;
            const dy = this.ball.y - life.y;
            const distance = Math.sqrt(dx ** 2 + dy ** 2);

            // Collect extra life when ball touches it
            if (distance < this.ball.radius + this.extraLifeRadius) {
                // Remove from level
                this.levelExtraLives.splice(i, 1);

                // Add life
                const newLives = this.storageManager.addLife(1);

                // Play special sound and spawn particles
                this.audioManager.playSound('win'); // Use win sound for extra life
                this.audioManager.speak('Extra life!', { rate: 1.2, pitch: 1.3 });
                this.spawnParticles(life.x, life.y, 'life', 15);

                // Vibrate feedback
                if (this.storageManager.isVibrationEnabled() && navigator.vibrate) {
                    navigator.vibrate([50, 30, 50]);
                }

                // Notify UI
                if (this.onLifeCollected) {
                    this.onLifeCollected(newLives);
                }
            }
        }
    }

    checkPowerupCollision() {
        const r = this.ball.radius;

        for (let i = this.levelPowerups.length - 1; i >= 0; i--) {
            const powerup = this.levelPowerups[i];
            if (powerup.collected) continue;

            const dx = this.ball.x - powerup.x;
            const dy = this.ball.y - powerup.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < r + powerup.radius) {
                powerup.collected = true;

                // Activate the powerup
                this.activatePowerup(powerup.type);

                // Effects
                this.audioManager.playSound('powerup');
                this.spawnParticles(powerup.x, powerup.y, 'powerup', 12);

                if (this.storageManager.isVibrationEnabled() && navigator.vibrate) {
                    navigator.vibrate([30, 20, 60]);
                }
            }
        }
    }

    activatePowerup(type) {
        const durations = {
            speed_boost: 3000,
            slow_motion: 4000,
            shield: 5000,
            magnet: 6000,
            ghost: 2500,
            shrink: 5000,
            time_freeze: 3000,
            double_coins: 8000
        };

        const duration = durations[type] || 3000;

        // Clear existing timer for this powerup
        if (this.activePowerups[type]) {
            clearTimeout(this.activePowerups[type].timer);
        }

        this.activePowerups[type] = {
            active: true,
            endTime: Date.now() + duration,
            timer: setTimeout(() => {
                if (this.activePowerups[type]) {
                    this.activePowerups[type].active = false;
                }
            }, duration)
        };

        console.log(`Powerup activated: ${type} for ${duration}ms`);
    }

    updateActivePowerups(deltaTime) {
        // Apply powerup effects
        if (this.activePowerups.slow_motion?.active) {
            this.timeScale = 0.4;
        } else if (this.activePowerups.speed_boost?.active) {
            // Speed boost is handled in velocity
        } else {
            this.timeScale = 1.0;
        }

        // Magnet effect - attract nearby coins
        if (this.activePowerups.magnet?.active) {
            const magnetRange = 100;
            for (const coin of this.levelCoins) {
                const dx = this.ball.x - coin.x;
                const dy = this.ball.y - coin.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < magnetRange && dist > 0) {
                    const force = 0.1 * (1 - dist / magnetRange);
                    coin.x += dx * force;
                    coin.y += dy * force;
                }
            }
        }

        // Shrink effect
        if (this.activePowerups.shrink?.active) {
            this.ball.radius = (this.currentLevel.ballRadius || 15) * 0.6;
        } else {
            this.ball.radius = this.currentLevel.ballRadius || 15;
        }
    }

    checkBouncePadCollision() {
        for (const pad of this.levelBouncePads) {
            const padLeft = pad.x - pad.width / 2;
            const padRight = pad.x + pad.width / 2;
            const padTop = pad.y - pad.height / 2;
            const padBottom = pad.y + pad.height / 2;

            // Check if ball overlaps with bounce pad
            if (this.ball.x + this.ball.radius > padLeft &&
                this.ball.x - this.ball.radius < padRight &&
                this.ball.y + this.ball.radius > padTop &&
                this.ball.y - this.ball.radius < padBottom) {

                // Apply bounce force based on direction
                const force = pad.force || 15;
                switch (pad.direction) {
                    case 'up':
                        this.ball.vy = -force;
                        break;
                    case 'down':
                        this.ball.vy = force;
                        break;
                    case 'left':
                        this.ball.vx = -force;
                        break;
                    case 'right':
                        this.ball.vx = force;
                        break;
                }

                this.audioManager.playSound('bumper');
                this.spawnParticles(pad.x, pad.y, 'bounce', 8);

                if (this.storageManager.isVibrationEnabled() && navigator.vibrate) {
                    navigator.vibrate(40);
                }
            }
        }
    }

    applySpeedZoneEffects() {
        for (const zone of this.levelSpeedZones) {
            // Check if ball is in zone
            if (this.ball.x > zone.x && this.ball.x < zone.x + zone.width &&
                this.ball.y > zone.y && this.ball.y < zone.y + zone.height) {

                if (zone.type === 'fast') {
                    // Speed boost zone
                    this.ball.vx *= 1.02;
                    this.ball.vy *= 1.02;
                } else if (zone.type === 'slow') {
                    // Slow zone
                    this.ball.vx *= 0.95;
                    this.ball.vy *= 0.95;
                }
            }
        }
    }

    updateMovingWalls(deltaTime) {
        const gameTime = performance.now() / 1000;

        for (const wall of this.levelMovingWalls) {
            // Calculate position based on sine wave
            const offset = Math.sin(gameTime * (wall.speed / 50) + wall.phase) * wall.range;

            if (wall.direction === 'horizontal') {
                wall.currentX = wall.originalX + offset;
            } else {
                wall.currentY = wall.originalY + offset;
            }
        }
    }

    isPowerupActive(type) {
        return this.activePowerups[type]?.active === true;
    }

    handleWin() {
        try {
            this.stop();

            const time = this.elapsedTime || 0;
            const stars = this.calculateStars(time) || 0;

            let levelData = null;
            let isNewBest = false;

            try {
                levelData = this.levelManager.getLevelData(this.levelIndex);
                isNewBest = !levelData?.bestTime || time < levelData.bestTime;
            } catch (e) {
                console.error('Error getting level data in handleWin:', e);
            }

            // Calculate coins earned
            const baseCoins = 10 + (this.levelIndex * 5);
            const starBonus = stars * 5;
            const newBestBonus = isNewBest ? 10 : 0;
            const coinsEarned = baseCoins + starBonus + newBestBonus;

            // Award coins
            try {
                this.storageManager.addCoins(coinsEarned);
            } catch (e) {
                console.error('Error adding coins:', e);
            }

            // Save progress
            try {
                this.levelManager.completeLevel(this.levelIndex, time, stars);
            } catch (e) {
                console.error('Error completing level:', e);
            }

            // Audio and visual feedback
            try {
                this.audioManager.playSound('win');
                this.spawnParticles(this.ball.x, this.ball.y, 'win', 30);

                if (stars === 3) {
                    this.audioManager.speakAllStars();
                } else if (isNewBest) {
                    this.audioManager.speakNewBest();
                } else {
                    this.audioManager.speakWin();
                }
            } catch (e) {
                console.error('Error with win feedback:', e);
            }

            // Notify UI
            if (this.onWin) {
                try {
                    this.onWin({
                        time,
                        stars,
                        isNewBest,
                        coinsEarned,
                        coinsCollected: this.coinsCollectedThisLevel || 0,
                        totalLevelCoins: (this.currentLevel?.coins || []).length
                    });
                } catch (e) {
                    console.error('Error in onWin callback:', e);
                }
            }
        } catch (e) {
            console.error('Error in handleWin:', e);
            // Try to at least stop the game
            try { this.stop(); } catch (e2) {}
        }
    }

    handleLose() {
        this.stop();
        this.audioManager.playSound('fall');

        // Voice feedback
        this.audioManager.speakLose();

        // Vibrate if enabled and supported
        if (this.storageManager.isVibrationEnabled() && navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
        }

        // Lose a life
        const remainingLives = this.storageManager.loseLife();

        // Notify UI of life lost
        if (this.onLifeLost) {
            this.onLifeLost(remainingLives);
        }

        if (remainingLives <= 0) {
            // Game over - no lives left
            if (this.onGameOver) {
                this.onGameOver();
            }
        } else {
            // Still have lives - notify for restart
            if (this.onLose) {
                this.onLose(remainingLives);
            }
        }
    }

    calculateStars(time) {
        const targets = this.currentLevel?.starTimes;
        // Safeguard: ensure targets is valid array with 3 entries
        if (!targets || !Array.isArray(targets) || targets.length < 3) {
            return 1; // Fallback: always at least 1 star for completing
        }
        if (time <= targets[2]) return 3;
        if (time <= targets[1]) return 2;
        if (time <= targets[0]) return 1;
        return 1; // Always at least 1 star for completing
    }

    // Time Warp upgrade activation
    activateTimeWarp() {
        const effects = this.upgradeManager?.getActiveEffects() || {};
        if (!effects.slowMotion) return false; // Upgrade not purchased
        if (this.timeWarpUsed) return false; // Already used this level
        if (this.timeWarpActive) return false; // Already active

        this.timeWarpActive = true;
        this.timeWarpUsed = true;
        this.timeScale = 0.4; // 40% speed (slow motion)

        // Visual feedback
        this.audioManager.playSound('powerup');

        // Auto-deactivate after duration
        setTimeout(() => {
            this.deactivateTimeWarp();
        }, this.timeWarpDuration);

        return true;
    }

    deactivateTimeWarp() {
        this.timeWarpActive = false;
        this.timeScale = 1.0;
    }

    canUseTimeWarp() {
        const effects = this.upgradeManager?.getActiveEffects() || {};
        return effects.slowMotion && !this.timeWarpUsed && !this.timeWarpActive;
    }

    spawnParticles(x, y, type, count = 10) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
            const speed = 2 + Math.random() * 3;
            
            let color;
            switch (type) {
                case 'wall':
                    color = '#00f5ff';
                    break;
                case 'win':
                    color = ['#00ff88', '#ffd700', '#00f5ff'][Math.floor(Math.random() * 3)];
                    break;
                case 'coin':
                    color = ['#ffd700', '#ffec00', '#ffaa00'][Math.floor(Math.random() * 3)];
                    break;
                case 'life':
                    color = ['#ff3366', '#ff6699', '#ff0044'][Math.floor(Math.random() * 3)];
                    break;
                default:
                    color = '#ffffff';
            }

            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                color,
                size: 2 + Math.random() * 3
            });
        }
    }

    updateParticles(deltaTime) {
        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.95;
            p.vy *= 0.95;
            p.life -= deltaTime * 2;
        });

        this.particles = this.particles.filter(p => p.life > 0);
    }

    render() {
        const ctx = this.ctx;
        
        // Clear canvas
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, this.width, this.height);

        // Save context for transformations
        ctx.save();
        
        // Apply offset to center maze
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.scale, this.scale);

        // Draw maze background
        this.drawMazeBackground();

        // Draw holes (render first so they're behind ball)
        this.drawHoles();

        // Draw walls
        this.drawWalls();

        // Draw coins
        this.drawCoins();

        // Draw extra lives
        this.drawExtraLives();

        // Draw new exciting elements
        this.drawSpeedZones();
        this.drawBouncePads();
        this.drawMovingWalls();
        this.drawPowerups();

        // Draw goal
        this.drawGoal();

        // Draw trail
        this.drawTrail();

        // Draw ball
        this.drawBall();

        // Draw particles
        this.drawParticles();

        ctx.restore();

        // Draw Time Warp visual effect (blue tint overlay)
        if (this.timeWarpActive) {
            ctx.fillStyle = 'rgba(0, 100, 255, 0.15)';
            ctx.fillRect(0, 0, this.width, this.height);

            // Draw "SLOW MOTION" text
            ctx.save();
            ctx.font = 'bold 24px Orbitron, sans-serif';
            ctx.fillStyle = 'rgba(0, 200, 255, 0.8)';
            ctx.textAlign = 'center';
            ctx.fillText('⏱️ SLOW MOTION', this.width / 2, 80);
            ctx.restore();
        }

        // Draw debug info if enabled
        // this.drawDebugInfo();
    }

    drawMazeBackground() {
        const ctx = this.ctx;
        const w = this.currentLevel.width;
        const h = this.currentLevel.height;

        // Deep floor gradient for 3D depth
        const floorGradient = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w, h) * 0.7);
        floorGradient.addColorStop(0, '#1a1a3d');
        floorGradient.addColorStop(0.5, '#12122a');
        floorGradient.addColorStop(1, '#0a0a1a');
        ctx.fillStyle = floorGradient;
        ctx.fillRect(0, 0, w, h);

        // Subtle tile pattern for floor texture
        const tileSize = 40;
        for (let x = 0; x < w; x += tileSize) {
            for (let y = 0; y < h; y += tileSize) {
                // Alternating tile shading
                const shade = ((x / tileSize) + (y / tileSize)) % 2 === 0 ? 0.03 : 0;
                ctx.fillStyle = `rgba(0, 245, 255, ${shade})`;
                ctx.fillRect(x, y, tileSize, tileSize);
            }
        }

        // Grid pattern with gradient fade
        ctx.strokeStyle = 'rgba(0, 245, 255, 0.04)';
        ctx.lineWidth = 1 / this.scale;

        const gridSize = 30;
        for (let x = 0; x <= w; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = 0; y <= h; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // 3D beveled maze border - outer shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(-8, -8, w + 16, 8); // top shadow
        ctx.fillRect(-8, -8, 8, h + 16); // left shadow
        ctx.fillRect(-8, h, w + 16, 8);  // bottom shadow
        ctx.fillRect(w, -8, 8, h + 16);  // right shadow

        // Glowing inner border
        ctx.shadowColor = '#00f5ff';
        ctx.shadowBlur = 15;
        ctx.strokeStyle = '#00f5ff';
        ctx.lineWidth = 3 / this.scale;
        ctx.strokeRect(0, 0, w, h);
        ctx.shadowBlur = 0;

        // Inner highlight border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1 / this.scale;
        ctx.strokeRect(2, 2, w - 4, h - 4);
    }

    drawWalls() {
        const ctx = this.ctx;
        const walls = this.currentLevel.walls;
        const depth = 6; // 3D extrusion depth

        walls.forEach(wall => {
            // Deep shadow for 3D effect
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(wall.x + depth, wall.y + depth, wall.width, wall.height);

            // 3D side faces (right side)
            const rightGradient = ctx.createLinearGradient(wall.x + wall.width, wall.y, wall.x + wall.width + depth, wall.y);
            rightGradient.addColorStop(0, '#1a1a3a');
            rightGradient.addColorStop(1, '#0a0a1a');
            ctx.fillStyle = rightGradient;
            ctx.beginPath();
            ctx.moveTo(wall.x + wall.width, wall.y);
            ctx.lineTo(wall.x + wall.width + depth, wall.y + depth);
            ctx.lineTo(wall.x + wall.width + depth, wall.y + wall.height + depth);
            ctx.lineTo(wall.x + wall.width, wall.y + wall.height);
            ctx.closePath();
            ctx.fill();

            // 3D side faces (bottom)
            const bottomGradient = ctx.createLinearGradient(wall.x, wall.y + wall.height, wall.x, wall.y + wall.height + depth);
            bottomGradient.addColorStop(0, '#151530');
            bottomGradient.addColorStop(1, '#080815');
            ctx.fillStyle = bottomGradient;
            ctx.beginPath();
            ctx.moveTo(wall.x, wall.y + wall.height);
            ctx.lineTo(wall.x + depth, wall.y + wall.height + depth);
            ctx.lineTo(wall.x + wall.width + depth, wall.y + wall.height + depth);
            ctx.lineTo(wall.x + wall.width, wall.y + wall.height);
            ctx.closePath();
            ctx.fill();

            // Main wall top face with metallic gradient
            const topGradient = ctx.createLinearGradient(wall.x, wall.y, wall.x + wall.width, wall.y + wall.height);
            topGradient.addColorStop(0, '#3a3a6a');
            topGradient.addColorStop(0.3, '#2a2a5a');
            topGradient.addColorStop(0.7, '#252550');
            topGradient.addColorStop(1, '#1a1a3a');
            ctx.fillStyle = topGradient;
            ctx.fillRect(wall.x, wall.y, wall.width, wall.height);

            // Inner bevel highlight (top-left)
            ctx.fillStyle = 'rgba(100, 150, 255, 0.25)';
            ctx.fillRect(wall.x, wall.y, wall.width, 2);
            ctx.fillRect(wall.x, wall.y, 2, wall.height);

            // Inner bevel shadow (bottom-right)
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(wall.x, wall.y + wall.height - 2, wall.width, 2);
            ctx.fillRect(wall.x + wall.width - 2, wall.y, 2, wall.height);

            // Glowing edge outline
            ctx.strokeStyle = 'rgba(0, 200, 255, 0.4)';
            ctx.lineWidth = 1.5 / this.scale;
            ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);

            // Subtle specular highlight
            if (wall.width > 20 && wall.height > 20) {
                const specGradient = ctx.createRadialGradient(
                    wall.x + wall.width * 0.3, wall.y + wall.height * 0.3, 0,
                    wall.x + wall.width * 0.3, wall.y + wall.height * 0.3, Math.min(wall.width, wall.height) * 0.4
                );
                specGradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
                specGradient.addColorStop(1, 'transparent');
                ctx.fillStyle = specGradient;
                ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
            }
        });
    }

    drawHoles() {
        const ctx = this.ctx;
        const holes = this.currentLevel.holes || [];
        const time = performance.now() / 1000;

        holes.forEach(hole => {
            const r = hole.radius;

            // Danger zone outer glow (pulsing)
            const pulseIntensity = 0.3 + Math.sin(time * 4) * 0.1;
            const dangerGlow = ctx.createRadialGradient(
                hole.x, hole.y, r * 0.5,
                hole.x, hole.y, r * 2.5
            );
            dangerGlow.addColorStop(0, `rgba(255, 30, 60, ${pulseIntensity})`);
            dangerGlow.addColorStop(0.5, 'rgba(255, 0, 50, 0.15)');
            dangerGlow.addColorStop(1, 'transparent');
            ctx.fillStyle = dangerGlow;
            ctx.beginPath();
            ctx.arc(hole.x, hole.y, r * 2.5, 0, Math.PI * 2);
            ctx.fill();

            // 3D pit outer ring (beveled edge)
            const rimGradient = ctx.createRadialGradient(
                hole.x - r * 0.2, hole.y - r * 0.2, 0,
                hole.x, hole.y, r * 1.15
            );
            rimGradient.addColorStop(0, '#4a2030');
            rimGradient.addColorStop(0.6, '#3a1525');
            rimGradient.addColorStop(0.8, '#2a0a15');
            rimGradient.addColorStop(1, '#1a0510');
            ctx.fillStyle = rimGradient;
            ctx.beginPath();
            ctx.arc(hole.x, hole.y, r * 1.15, 0, Math.PI * 2);
            ctx.fill();

            // Inner pit shadow ring (3D depth)
            const innerRim = ctx.createRadialGradient(
                hole.x + r * 0.1, hole.y + r * 0.1, r * 0.3,
                hole.x, hole.y, r
            );
            innerRim.addColorStop(0, '#000000');
            innerRim.addColorStop(0.5, '#080008');
            innerRim.addColorStop(0.8, '#150515');
            innerRim.addColorStop(1, '#2a0a1a');
            ctx.fillStyle = innerRim;
            ctx.beginPath();
            ctx.arc(hole.x, hole.y, r, 0, Math.PI * 2);
            ctx.fill();

            // Abyss center (pure black with depth)
            const abyssGradient = ctx.createRadialGradient(
                hole.x, hole.y, 0,
                hole.x, hole.y, r * 0.7
            );
            abyssGradient.addColorStop(0, '#000000');
            abyssGradient.addColorStop(0.7, '#000000');
            abyssGradient.addColorStop(1, '#0a0005');
            ctx.fillStyle = abyssGradient;
            ctx.beginPath();
            ctx.arc(hole.x, hole.y, r * 0.7, 0, Math.PI * 2);
            ctx.fill();

            // Top-left highlight (3D rim lighting)
            ctx.strokeStyle = 'rgba(255, 100, 130, 0.5)';
            ctx.lineWidth = 2 / this.scale;
            ctx.beginPath();
            ctx.arc(hole.x, hole.y, r, Math.PI * 0.8, Math.PI * 1.3);
            ctx.stroke();

            // Bottom-right shadow edge
            ctx.strokeStyle = 'rgba(80, 0, 20, 0.8)';
            ctx.lineWidth = 3 / this.scale;
            ctx.beginPath();
            ctx.arc(hole.x, hole.y, r, Math.PI * 0.0, Math.PI * 0.6);
            ctx.stroke();

            // Danger glow ring
            ctx.shadowColor = '#ff1a40';
            ctx.shadowBlur = 10;
            ctx.strokeStyle = '#ff3366';
            ctx.lineWidth = 2 / this.scale;
            ctx.beginPath();
            ctx.arc(hole.x, hole.y, r * 1.1, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Rotating danger markers
            const markers = 6;
            for (let i = 0; i < markers; i++) {
                const angle = (i / markers) * Math.PI * 2 + time * 0.5;
                const mx = hole.x + Math.cos(angle) * r * 1.25;
                const my = hole.y + Math.sin(angle) * r * 1.25;
                ctx.fillStyle = `rgba(255, 50, 80, ${0.3 + Math.sin(time * 3 + i) * 0.2})`;
                ctx.beginPath();
                ctx.arc(mx, my, 3 / this.scale, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }

    drawGoal() {
        const ctx = this.ctx;
        const goal = this.currentLevel.goal;
        const r = goal.radius;
        const time = performance.now() / 1000;

        // Outer pulsing energy ring
        const pulseScale = 1 + Math.sin(time * 3) * 0.15;
        const energyGlow = ctx.createRadialGradient(
            goal.x, goal.y, r * 0.5,
            goal.x, goal.y, r * 3 * pulseScale
        );
        energyGlow.addColorStop(0, 'rgba(0, 255, 150, 0.5)');
        energyGlow.addColorStop(0.3, 'rgba(0, 255, 100, 0.25)');
        energyGlow.addColorStop(0.6, 'rgba(0, 200, 100, 0.1)');
        energyGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = energyGlow;
        ctx.beginPath();
        ctx.arc(goal.x, goal.y, r * 3 * pulseScale, 0, Math.PI * 2);
        ctx.fill();

        // Rotating particle ring
        const particles = 8;
        for (let i = 0; i < particles; i++) {
            const angle = (i / particles) * Math.PI * 2 + time * 2;
            const dist = r * 1.8 + Math.sin(time * 4 + i) * 5;
            const px = goal.x + Math.cos(angle) * dist;
            const py = goal.y + Math.sin(angle) * dist;
            const alpha = 0.5 + Math.sin(time * 3 + i) * 0.3;
            ctx.fillStyle = `rgba(150, 255, 200, ${alpha})`;
            ctx.beginPath();
            ctx.arc(px, py, 4 / this.scale, 0, Math.PI * 2);
            ctx.fill();
        }

        // 3D base platform shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(goal.x + 3, goal.y + 5, r * 1.1, r * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        // 3D platform ring (outer)
        const platformGradient = ctx.createRadialGradient(
            goal.x - r * 0.2, goal.y - r * 0.2, 0,
            goal.x, goal.y, r * 1.2
        );
        platformGradient.addColorStop(0, '#40ffa0');
        platformGradient.addColorStop(0.5, '#00cc66');
        platformGradient.addColorStop(0.8, '#008844');
        platformGradient.addColorStop(1, '#004422');
        ctx.fillStyle = platformGradient;
        ctx.beginPath();
        ctx.arc(goal.x, goal.y, r * 1.15, 0, Math.PI * 2);
        ctx.fill();

        // Inner goal surface with glow
        const goalGradient = ctx.createRadialGradient(
            goal.x - r * 0.3, goal.y - r * 0.3, 0,
            goal.x, goal.y, r
        );
        goalGradient.addColorStop(0, '#80ffcc');
        goalGradient.addColorStop(0.3, '#00ff88');
        goalGradient.addColorStop(0.7, '#00dd66');
        goalGradient.addColorStop(1, '#00aa44');
        ctx.fillStyle = goalGradient;
        ctx.beginPath();
        ctx.arc(goal.x, goal.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Specular highlight
        const specGradient = ctx.createRadialGradient(
            goal.x - r * 0.35, goal.y - r * 0.35, 0,
            goal.x - r * 0.35, goal.y - r * 0.35, r * 0.5
        );
        specGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        specGradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.3)');
        specGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = specGradient;
        ctx.beginPath();
        ctx.arc(goal.x - r * 0.25, goal.y - r * 0.25, r * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Glowing border
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 15;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3 / this.scale;
        ctx.beginPath();
        ctx.arc(goal.x, goal.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Star icon with 3D emboss
        ctx.save();
        ctx.font = `bold ${r * 1.1}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Star shadow
        ctx.fillStyle = 'rgba(0, 80, 40, 0.5)';
        ctx.fillText('★', goal.x + 1.5, goal.y + 3);

        // Star main
        ctx.fillStyle = '#ffffff';
        ctx.fillText('★', goal.x, goal.y + 1);

        // Star highlight
        ctx.fillStyle = 'rgba(255, 255, 200, 0.8)';
        ctx.fillText('★', goal.x - 0.5, goal.y + 0.5);
        ctx.restore();
    }

    drawCoins() {
        const ctx = this.ctx;
        const time = performance.now() / 1000;
        const r = this.coinRadius;

        this.levelCoins.forEach(coin => {
            const bobOffset = Math.sin(time * 3 + coin.x) * 2;
            const cx = coin.x;
            const cy = coin.y + bobOffset;

            // Outer golden glow
            const glowGradient = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2.5);
            glowGradient.addColorStop(0, 'rgba(255, 200, 50, 0.5)');
            glowGradient.addColorStop(0.5, 'rgba(255, 180, 0, 0.2)');
            glowGradient.addColorStop(1, 'transparent');
            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(cx, cy, r * 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Drop shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.ellipse(cx + 2, cy + 3, r * 0.9, r * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();

            // Coin outer rim (dark edge)
            const rimGradient = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
            rimGradient.addColorStop(0, '#8B6914');
            rimGradient.addColorStop(0.3, '#CD950C');
            rimGradient.addColorStop(0.5, '#8B6914');
            rimGradient.addColorStop(0.7, '#CD950C');
            rimGradient.addColorStop(1, '#6B4E0A');
            ctx.fillStyle = rimGradient;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();

            // Coin face (main gold surface)
            const faceGradient = ctx.createLinearGradient(cx - r * 0.8, cy - r * 0.8, cx + r * 0.5, cy + r * 0.8);
            faceGradient.addColorStop(0, '#FFF8DC');      // Light gold highlight
            faceGradient.addColorStop(0.15, '#FFD700');   // Pure gold
            faceGradient.addColorStop(0.4, '#FFCC00');    // Bright gold
            faceGradient.addColorStop(0.6, '#DAA520');    // Goldenrod
            faceGradient.addColorStop(0.85, '#B8860B');   // Dark goldenrod
            faceGradient.addColorStop(1, '#8B6914');      // Dark edge
            ctx.fillStyle = faceGradient;
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2);
            ctx.fill();

            // Inner raised ring
            ctx.strokeStyle = '#B8860B';
            ctx.lineWidth = 1.5 / this.scale;
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
            ctx.stroke();

            // Inner ring highlight
            ctx.strokeStyle = 'rgba(255, 248, 220, 0.4)';
            ctx.lineWidth = 1 / this.scale;
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.70, Math.PI * 0.8, Math.PI * 1.8);
            ctx.stroke();

            // Dollar sign embossed
            ctx.save();
            ctx.font = `bold ${r * 1.1}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Dollar sign shadow (embossed effect)
            ctx.fillStyle = 'rgba(139, 105, 20, 0.7)';
            ctx.fillText('$', cx + 1, cy + 1);

            // Dollar sign highlight
            ctx.fillStyle = 'rgba(255, 248, 200, 0.8)';
            ctx.fillText('$', cx - 0.5, cy - 0.5);

            // Dollar sign main
            ctx.fillStyle = '#B8860B';
            ctx.fillText('$', cx, cy);
            ctx.restore();

            // Top-left shine highlight
            const shineGradient = ctx.createRadialGradient(
                cx - r * 0.4, cy - r * 0.4, 0,
                cx - r * 0.4, cy - r * 0.4, r * 0.5
            );
            shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
            shineGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
            shineGradient.addColorStop(1, 'transparent');
            ctx.fillStyle = shineGradient;
            ctx.beginPath();
            ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.45, 0, Math.PI * 2);
            ctx.fill();

            // Small specular highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.beginPath();
            ctx.ellipse(cx - r * 0.45, cy - r * 0.45, r * 0.12, r * 0.08, -Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();

            // Subtle rim light on bottom right
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
            ctx.lineWidth = 2 / this.scale;
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.95, Math.PI * 0.1, Math.PI * 0.6);
            ctx.stroke();
        });
    }

    drawExtraLives() {
        const ctx = this.ctx;
        const time = performance.now() / 1000;
        const r = this.extraLifeRadius;

        this.levelExtraLives.forEach(life => {
            const bobOffset = Math.sin(time * 2 + life.x * 0.1) * 3;
            const pulse = 1 + Math.sin(time * 4) * 0.1;
            const lx = life.x;
            const ly = life.y + bobOffset;

            // Outer glow (pink/red)
            const glowGradient = ctx.createRadialGradient(lx, ly, r * 0.5, lx, ly, r * 3);
            glowGradient.addColorStop(0, 'rgba(255, 50, 100, 0.6)');
            glowGradient.addColorStop(0.5, 'rgba(255, 0, 80, 0.2)');
            glowGradient.addColorStop(1, 'transparent');
            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(lx, ly, r * 3 * pulse, 0, Math.PI * 2);
            ctx.fill();

            // Heart shape background
            ctx.fillStyle = '#ff1a5c';
            ctx.beginPath();
            const heartSize = r * 0.9;
            const hx = lx;
            const hy = ly;
            ctx.moveTo(hx, hy + heartSize * 0.3);
            ctx.bezierCurveTo(hx, hy - heartSize * 0.5, hx - heartSize, hy - heartSize * 0.5, hx - heartSize, hy + heartSize * 0.1);
            ctx.bezierCurveTo(hx - heartSize, hy + heartSize * 0.6, hx, hy + heartSize, hx, hy + heartSize);
            ctx.bezierCurveTo(hx, hy + heartSize, hx + heartSize, hy + heartSize * 0.6, hx + heartSize, hy + heartSize * 0.1);
            ctx.bezierCurveTo(hx + heartSize, hy - heartSize * 0.5, hx, hy - heartSize * 0.5, hx, hy + heartSize * 0.3);
            ctx.fill();

            // Heart highlight
            ctx.fillStyle = 'rgba(255, 150, 180, 0.5)';
            ctx.beginPath();
            ctx.ellipse(lx - r * 0.3, ly - r * 0.1, r * 0.25, r * 0.2, -Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();

            // "+1" text
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${r * 0.7}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('+1', lx, ly + r * 0.2);
        });
    }

    drawTrail() {
        const ctx = this.ctx;

        // Get equipped trail effect
        const equippedTrail = this.storageManager.getEquipped('trail') || 'trail_default';
        const trail = TRAIL_EFFECTS[equippedTrail] || TRAIL_EFFECTS.trail_default;

        if (trail.opacity === 0) return; // No trail

        this.trailPoints.forEach((point, i) => {
            const alpha = point.alpha * trail.opacity;
            const size = this.ball.radius * trail.size * point.alpha;

            let color;
            if (trail.rainbow) {
                const hue = ((performance.now() / 10) + i * 20) % 360;
                color = `hsla(${hue}, 100%, 50%, ${alpha})`;
            } else if (trail.color) {
                color = trail.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
                if (!color.includes('rgba')) {
                    // Handle hex colors
                    const hex = trail.color;
                    const r = parseInt(hex.slice(1, 3), 16);
                    const g = parseInt(hex.slice(3, 5), 16);
                    const b = parseInt(hex.slice(5, 7), 16);
                    color = `rgba(${r}, ${g}, ${b}, ${alpha})`;
                }
            } else {
                color = `rgba(0, 245, 255, ${alpha})`;
            }

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
            ctx.fill();

            // Sparkle effect
            if (trail.sparkle && Math.random() > 0.7) {
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
                ctx.beginPath();
                ctx.arc(
                    point.x + (Math.random() - 0.5) * size * 2,
                    point.y + (Math.random() - 0.5) * size * 2,
                    size * 0.3,
                    0, Math.PI * 2
                );
                ctx.fill();
            }
        });
    }

    drawBall() {
        const ctx = this.ctx;
        const { x, y, radius } = this.ball;
        const r = radius;

        // Get equipped ball skin
        const equippedSkin = this.storageManager.getEquipped('ball') || 'ball_default';
        const skin = BALL_SKINS[equippedSkin] || BALL_SKINS.ball_default;
        const time = performance.now() / 1000;

        // Ground contact shadow (elliptical, offset based on position)
        const shadowOffsetX = 4;
        const shadowOffsetY = 8;
        const shadowGradient = ctx.createRadialGradient(
            x + shadowOffsetX, y + shadowOffsetY, 0,
            x + shadowOffsetX, y + shadowOffsetY, r * 1.2
        );
        shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
        shadowGradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.25)');
        shadowGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = shadowGradient;
        ctx.beginPath();
        ctx.ellipse(x + shadowOffsetX, y + shadowOffsetY, r * 1.1, r * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ambient occlusion ring (where ball meets floor)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(x, y + r * 0.8, r * 0.6, r * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();

        // Base sphere color
        let baseColor, midColor, darkColor;
        if (skin.rainbow) {
            const hue = (time * 60) % 360;
            baseColor = `hsl(${hue}, 100%, 70%)`;
            midColor = `hsl(${hue}, 100%, 50%)`;
            darkColor = `hsl(${(hue + 30) % 360}, 100%, 25%)`;
        } else {
            baseColor = skin.gradient[0];
            midColor = skin.gradient[1];
            darkColor = skin.gradient[2];
        }

        // Main sphere gradient (3D lit from top-left)
        const sphereGradient = ctx.createRadialGradient(
            x - r * 0.4, y - r * 0.4, 0,
            x, y, r
        );
        sphereGradient.addColorStop(0, baseColor);
        sphereGradient.addColorStop(0.3, midColor);
        sphereGradient.addColorStop(0.7, darkColor);
        sphereGradient.addColorStop(1, '#000000');

        ctx.fillStyle = sphereGradient;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // Rim light (back lighting effect)
        ctx.strokeStyle = 'rgba(150, 200, 255, 0.4)';
        ctx.lineWidth = 3 / this.scale;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.95, Math.PI * 0.6, Math.PI * 1.4);
        ctx.stroke();

        // Primary specular highlight (bright spot)
        const specGradient = ctx.createRadialGradient(
            x - r * 0.35, y - r * 0.35, 0,
            x - r * 0.35, y - r * 0.35, r * 0.5
        );
        specGradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        specGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
        specGradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.2)');
        specGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = specGradient;
        ctx.beginPath();
        ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, Math.PI * 2);
        ctx.fill();

        // Secondary specular (smaller, sharper)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.ellipse(x - r * 0.45, y - r * 0.4, r * 0.12, r * 0.08, -Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();

        // Fresnel rim highlight (edge glow)
        const fresnelGradient = ctx.createRadialGradient(x, y, r * 0.8, x, y, r);
        fresnelGradient.addColorStop(0, 'transparent');
        fresnelGradient.addColorStop(0.7, 'transparent');
        fresnelGradient.addColorStop(1, 'rgba(200, 230, 255, 0.3)');
        ctx.fillStyle = fresnelGradient;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // Speed-based motion glow
        const speed = Math.sqrt(this.ball.vx ** 2 + this.ball.vy ** 2);
        const glowAlpha = Math.min(speed / this.maxSpeed, 1) * 0.6;

        if (glowAlpha > 0.05) {
            const glowColor = skin.rainbow
                ? `hsla(${(time * 180) % 360}, 100%, 50%, ${glowAlpha})`
                : skin.glow.replace('rgb', 'rgba').replace(')', `, ${glowAlpha})`);

            ctx.shadowColor = skin.rainbow ? `hsl(${(time * 180) % 360}, 100%, 50%)` : skin.glow;
            ctx.shadowBlur = 25 * glowAlpha;
            ctx.strokeStyle = glowColor;
            ctx.lineWidth = 3 / this.scale;
            ctx.beginPath();
            ctx.arc(x, y, r * 1.05, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Subtle inner edge definition
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1 / this.scale;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
    }

    drawParticles() {
        const ctx = this.ctx;

        this.particles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.globalAlpha = 1;
    }

    drawPowerups() {
        const ctx = this.ctx;
        const time = performance.now() / 1000;

        const powerupColors = {
            speed_boost: { main: '#ffff00', glow: 'rgba(255, 255, 0, 0.5)', icon: '⚡' },
            slow_motion: { main: '#00aaff', glow: 'rgba(0, 170, 255, 0.5)', icon: '🐌' },
            shield: { main: '#00ff88', glow: 'rgba(0, 255, 136, 0.5)', icon: '🛡️' },
            magnet: { main: '#ff00aa', glow: 'rgba(255, 0, 170, 0.5)', icon: '🧲' },
            ghost: { main: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.5)', icon: '👻' },
            shrink: { main: '#00ffcc', glow: 'rgba(0, 255, 204, 0.5)', icon: '🔽' },
            time_freeze: { main: '#88ddff', glow: 'rgba(136, 221, 255, 0.5)', icon: '❄️' },
            double_coins: { main: '#ffd700', glow: 'rgba(255, 215, 0, 0.5)', icon: '💰' }
        };

        this.levelPowerups.forEach(powerup => {
            if (powerup.collected) return;

            const colors = powerupColors[powerup.type] || powerupColors.speed_boost;
            const pulse = 1 + Math.sin(time * 4) * 0.15;
            const r = powerup.radius * pulse;

            // Outer glow
            const glowGradient = ctx.createRadialGradient(
                powerup.x, powerup.y, r * 0.5,
                powerup.x, powerup.y, r * 2.5
            );
            glowGradient.addColorStop(0, colors.glow);
            glowGradient.addColorStop(1, 'transparent');
            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(powerup.x, powerup.y, r * 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Main circle
            const mainGradient = ctx.createRadialGradient(
                powerup.x - r * 0.3, powerup.y - r * 0.3, 0,
                powerup.x, powerup.y, r
            );
            mainGradient.addColorStop(0, '#ffffff');
            mainGradient.addColorStop(0.3, colors.main);
            mainGradient.addColorStop(1, colors.main.replace('ff', '88'));
            ctx.fillStyle = mainGradient;
            ctx.beginPath();
            ctx.arc(powerup.x, powerup.y, r, 0, Math.PI * 2);
            ctx.fill();

            // Icon
            ctx.font = `${r * 1.2}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(colors.icon, powerup.x, powerup.y);

            // Rotating sparkles
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2 + time * 3;
                const sx = powerup.x + Math.cos(angle) * r * 1.5;
                const sy = powerup.y + Math.sin(angle) * r * 1.5;
                ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + Math.sin(time * 5 + i) * 0.3})`;
                ctx.beginPath();
                ctx.arc(sx, sy, 2 / this.scale, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }

    drawBouncePads() {
        const ctx = this.ctx;
        const time = performance.now() / 1000;

        this.levelBouncePads.forEach(pad => {
            const pulse = 1 + Math.sin(time * 6) * 0.1;

            // Shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.beginPath();
            ctx.ellipse(pad.x + 2, pad.y + 3, pad.width / 2, pad.height / 2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Main pad
            const padGradient = ctx.createLinearGradient(
                pad.x - pad.width / 2, pad.y,
                pad.x + pad.width / 2, pad.y
            );
            padGradient.addColorStop(0, '#00cc66');
            padGradient.addColorStop(0.5, '#00ff88');
            padGradient.addColorStop(1, '#00cc66');
            ctx.fillStyle = padGradient;
            ctx.beginPath();
            ctx.ellipse(pad.x, pad.y, pad.width / 2 * pulse, pad.height / 2 * pulse, 0, 0, Math.PI * 2);
            ctx.fill();

            // Direction arrow
            ctx.fillStyle = '#ffffff';
            ctx.font = `${pad.width * 0.6}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const arrows = { up: '⬆️', down: '⬇️', left: '⬅️', right: '➡️' };
            ctx.fillText(arrows[pad.direction] || '↑', pad.x, pad.y);

            // Glow
            ctx.shadowColor = '#00ff88';
            ctx.shadowBlur = 10 * pulse;
            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 2 / this.scale;
            ctx.beginPath();
            ctx.ellipse(pad.x, pad.y, pad.width / 2, pad.height / 2, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        });
    }

    drawSpeedZones() {
        const ctx = this.ctx;
        const time = performance.now() / 1000;

        this.levelSpeedZones.forEach(zone => {
            const isFast = zone.type === 'fast';
            const baseColor = isFast ? 'rgba(255, 170, 0, 0.3)' : 'rgba(0, 100, 255, 0.3)';
            const lineColor = isFast ? '#ffaa00' : '#0066ff';

            // Zone fill
            ctx.fillStyle = baseColor;
            ctx.fillRect(zone.x, zone.y, zone.width, zone.height);

            // Animated lines
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 2 / this.scale;
            const lineSpacing = 10;
            const offset = (time * (isFast ? 50 : -30)) % lineSpacing;

            ctx.beginPath();
            if (isFast) {
                // Fast zone - diagonal lines going right
                for (let i = -zone.height; i < zone.width + zone.height; i += lineSpacing) {
                    ctx.moveTo(zone.x + i + offset, zone.y);
                    ctx.lineTo(zone.x + i + offset + zone.height, zone.y + zone.height);
                }
            } else {
                // Slow zone - horizontal wavy lines
                for (let y = 0; y < zone.height; y += lineSpacing) {
                    ctx.moveTo(zone.x, zone.y + y);
                    for (let x = 0; x < zone.width; x += 5) {
                        ctx.lineTo(zone.x + x, zone.y + y + Math.sin((x + time * 20) * 0.1) * 3);
                    }
                }
            }
            ctx.stroke();

            // Border
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 1 / this.scale;
            ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);

            // Icon
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = lineColor;
            ctx.fillText(isFast ? '⚡' : '🐌', zone.x + zone.width / 2, zone.y + zone.height / 2);
        });
    }

    drawMovingWalls() {
        const ctx = this.ctx;

        this.levelMovingWalls.forEach(wall => {
            // Shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(wall.currentX + 4, wall.currentY + 4, wall.width, wall.height);

            // Wall gradient with warning color
            const gradient = ctx.createLinearGradient(
                wall.currentX, wall.currentY,
                wall.currentX + wall.width, wall.currentY + wall.height
            );
            gradient.addColorStop(0, '#aa3355');
            gradient.addColorStop(0.5, '#ff5577');
            gradient.addColorStop(1, '#aa3355');
            ctx.fillStyle = gradient;
            ctx.fillRect(wall.currentX, wall.currentY, wall.width, wall.height);

            // Highlight
            ctx.fillStyle = 'rgba(255, 100, 150, 0.3)';
            ctx.fillRect(wall.currentX, wall.currentY, wall.width, 2);

            // Border
            ctx.strokeStyle = '#ff3366';
            ctx.lineWidth = 2 / this.scale;
            ctx.strokeRect(wall.currentX, wall.currentY, wall.width, wall.height);

            // Warning stripes
            ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
            const stripeWidth = 5;
            for (let i = 0; i < wall.width + wall.height; i += stripeWidth * 2) {
                ctx.beginPath();
                ctx.moveTo(wall.currentX + i, wall.currentY);
                ctx.lineTo(wall.currentX + i + stripeWidth, wall.currentY);
                ctx.lineTo(wall.currentX + i + stripeWidth - wall.height, wall.currentY + wall.height);
                ctx.lineTo(wall.currentX + i - wall.height, wall.currentY + wall.height);
                ctx.closePath();
                ctx.fill();
            }
        });
    }

    drawDebugInfo() {
        const ctx = this.ctx;
        ctx.fillStyle = '#00ff88';
        ctx.font = '12px monospace';
        ctx.fillText(`Ball: (${this.ball.x.toFixed(1)}, ${this.ball.y.toFixed(1)})`, 10, 20);
        ctx.fillText(`Vel: (${this.ball.vx.toFixed(2)}, ${this.ball.vy.toFixed(2)})`, 10, 35);
        ctx.fillText(`Tilt: (${this.inputManager.getTilt().x.toFixed(2)}, ${this.inputManager.getTilt().y.toFixed(2)})`, 10, 50);
    }
}
