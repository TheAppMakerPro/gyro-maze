/**
 * InputManager.js
 * Handles accelerometer (Capacitor Motion) and fallback touch controls
 */

export class InputManager {
    constructor(storageManager) {
        this.storageManager = storageManager;

        // Current tilt values (normalized -1 to 1)
        this.tilt = { x: 0, y: 0 };

        // Raw sensor values
        this.rawAccel = { x: 0, y: 0, z: 0 };

        // Calibration offset
        this.calibration = { x: 0, y: 0 };

        // Control mode
        this.mode = 'none'; // 'accelerometer', 'touch', 'none'
        this.hasMotionPermission = false;

        // Touch control state
        this.touchActive = false;
        this.touchStart = { x: 0, y: 0 };
        this.touchCurrent = { x: 0, y: 0 };
        this.touchSensitivity = 0.01;

        // Smoothing
        this.smoothingFactor = 0.3;

        // Status
        this.isListening = false;

        // Capacitor Motion plugin reference
        this.motionPlugin = null;
        this.motionHandle = null;

        // Bind methods
        this.handleDeviceMotion = this.handleDeviceMotion.bind(this);
        this.handleDeviceOrientation = this.handleDeviceOrientation.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
    }

    async init() {
        // Load calibration from storage
        const savedCalibration = this.storageManager.getCalibration();
        if (savedCalibration) {
            this.calibration = savedCalibration;
        }

        // Check for Capacitor Motion plugin
        if (window.Capacitor?.Plugins?.Motion) {
            this.motionPlugin = window.Capacitor.Plugins.Motion;
            console.log('Capacitor Motion plugin available');
        }

        return true;
    }

    // Detect if running in Chrome/Firefox on iOS (which don't support motion permissions)
    isNonSafariBrowserOniOS() {
        const ua = navigator.userAgent;
        const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isChrome = /CriOS/.test(ua);
        const isFirefox = /FxiOS/.test(ua);
        const isEdge = /EdgiOS/.test(ua);
        return isIOS && (isChrome || isFirefox || isEdge);
    }

    isSafariiOS() {
        const ua = navigator.userAgent;
        const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
        return isIOS && isSafari;
    }

    isAndroid() {
        return /Android/i.test(navigator.userAgent);
    }

    isIOS() {
        const ua = navigator.userAgent;
        return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    async checkMotionPermission() {
        // Check if using non-Safari browser on iOS
        if (this.isNonSafariBrowserOniOS()) {
            console.log('Motion: Non-Safari browser on iOS detected - motion sensors not supported');
            return 'unsupported-browser';
        }

        // iOS 13+ requires explicit permission
        if (typeof DeviceMotionEvent !== 'undefined' &&
            typeof DeviceMotionEvent.requestPermission === 'function') {
            return false; // Need to request
        }

        // Android and other platforms - sensors available without permission request
        if (window.DeviceMotionEvent || window.DeviceOrientationEvent) {
            return 'maybe'; // Available but need to test
        }

        return false;
    }

    async requestMotionPermission() {
        try {
            // Try Capacitor plugin first
            if (this.motionPlugin) {
                // Capacitor Motion automatically handles permissions
                this.hasMotionPermission = true;
                this.mode = 'accelerometer';
                console.log('Motion: Using Capacitor plugin');
                return true;
            }

            // iOS 13+ DeviceMotion permission
            if (typeof DeviceMotionEvent !== 'undefined' &&
                typeof DeviceMotionEvent.requestPermission === 'function') {
                console.log('Motion: Requesting iOS DeviceMotion permission...');
                try {
                    const permission = await DeviceMotionEvent.requestPermission();
                    console.log('Motion: Permission result:', permission);
                    if (permission === 'granted') {
                        this.hasMotionPermission = true;
                        this.mode = 'accelerometer';
                        return true;
                    }
                    console.log('Motion: Permission denied by user');
                    return false;
                } catch (permError) {
                    console.error('Motion: Permission request failed:', permError.message || permError);
                    // This can happen if:
                    // 1. Not in a secure context (need HTTPS, except localhost)
                    // 2. Not triggered by user gesture
                    // 3. Permission previously denied in browser settings
                    return false;
                }
            }

            // DeviceOrientation permission (some browsers)
            if (typeof DeviceOrientationEvent !== 'undefined' &&
                typeof DeviceOrientationEvent.requestPermission === 'function') {
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission === 'granted') {
                    this.hasMotionPermission = true;
                    this.mode = 'accelerometer';
                    return true;
                }
                return false;
            }

            // Check if sensors work without explicit permission
            return new Promise((resolve) => {
                let resolved = false;

                const testHandler = (event) => {
                    if (resolved) return;
                    
                    if (event.accelerationIncludingGravity?.x !== null ||
                        event.gamma !== null) {
                        resolved = true;
                        window.removeEventListener('devicemotion', testHandler);
                        window.removeEventListener('deviceorientation', testHandler);
                        this.hasMotionPermission = true;
                        this.mode = 'accelerometer';
                        resolve(true);
                    }
                };

                window.addEventListener('devicemotion', testHandler);
                window.addEventListener('deviceorientation', testHandler);

                // Timeout after 1 second
                setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        window.removeEventListener('devicemotion', testHandler);
                        window.removeEventListener('deviceorientation', testHandler);
                        console.log('Motion: Timeout - no sensor data received');
                        resolve(false);
                    }
                }, 1000);
            });

        } catch (error) {
            console.error('Motion permission error:', error);
            return false;
        }
    }

    enableTouchControls() {
        this.mode = 'touch';
        this.setupTouchControls();
        
        // Show touch controls UI
        const touchControls = document.getElementById('touch-controls');
        if (touchControls) {
            touchControls.classList.remove('hidden');
        }
    }

    setupTouchControls() {
        const canvas = document.getElementById('game-canvas');
        const gameScreen = document.getElementById('game-screen');
        
        canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', this.handleTouchEnd);
        canvas.addEventListener('touchcancel', this.handleTouchEnd);

        // Also listen on game screen for larger touch area
        gameScreen.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        gameScreen.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        gameScreen.addEventListener('touchend', this.handleTouchEnd);
        gameScreen.addEventListener('touchcancel', this.handleTouchEnd);
    }

    removeTouchControls() {
        const canvas = document.getElementById('game-canvas');
        const gameScreen = document.getElementById('game-screen');
        
        if (canvas) {
            canvas.removeEventListener('touchstart', this.handleTouchStart);
            canvas.removeEventListener('touchmove', this.handleTouchMove);
            canvas.removeEventListener('touchend', this.handleTouchEnd);
            canvas.removeEventListener('touchcancel', this.handleTouchEnd);
        }

        if (gameScreen) {
            gameScreen.removeEventListener('touchstart', this.handleTouchStart);
            gameScreen.removeEventListener('touchmove', this.handleTouchMove);
            gameScreen.removeEventListener('touchend', this.handleTouchEnd);
            gameScreen.removeEventListener('touchcancel', this.handleTouchEnd);
        }
    }

    start() {
        if (this.isListening) return;
        this.isListening = true;

        if (this.mode === 'accelerometer') {
            this.startAccelerometer();
        } else if (this.mode === 'touch') {
            this.setupTouchControls();
        }

        console.log(`InputManager started in ${this.mode} mode`);
    }

    stop() {
        if (!this.isListening) return;
        this.isListening = false;

        this.stopAccelerometer();
        this.removeTouchControls();

        // Reset tilt
        this.tilt = { x: 0, y: 0 };
        this.touchActive = false;

        console.log('InputManager stopped');
    }

    async startAccelerometer() {
        // Try Capacitor plugin first
        if (this.motionPlugin) {
            try {
                this.motionHandle = await this.motionPlugin.addListener(
                    'accel',
                    (event) => {
                        // Capacitor Motion provides acceleration values
                        this.rawAccel = {
                            x: event.acceleration?.x || 0,
                            y: event.acceleration?.y || 0,
                            z: event.acceleration?.z || 0
                        };
                        this.processAcceleration();
                    }
                );
                console.log('Using Capacitor Motion plugin');
                return;
            } catch (error) {
                console.warn('Capacitor Motion failed, falling back to Web API:', error);
            }
        }

        // Fallback to Web DeviceMotion API
        window.addEventListener('devicemotion', this.handleDeviceMotion);
        window.addEventListener('deviceorientation', this.handleDeviceOrientation);
    }

    stopAccelerometer() {
        // Remove Capacitor listener
        if (this.motionHandle) {
            this.motionHandle.remove();
            this.motionHandle = null;
        }

        // Remove Web API listeners
        window.removeEventListener('devicemotion', this.handleDeviceMotion);
        window.removeEventListener('deviceorientation', this.handleDeviceOrientation);
    }

    handleDeviceMotion(event) {
        const accel = event.accelerationIncludingGravity;
        if (!accel) return;

        this.rawAccel = {
            x: accel.x || 0,
            y: accel.y || 0,
            z: accel.z || 0
        };

        this.processAcceleration();
    }

    handleDeviceOrientation(event) {
        // Use orientation as fallback/complement
        if (event.gamma !== null && event.beta !== null) {
            // gamma: left-right tilt (-90 to 90)
            // beta: front-back tilt (-180 to 180)
            
            // Normalize to -1 to 1 range
            const x = Math.max(-1, Math.min(1, event.gamma / 45));
            const y = Math.max(-1, Math.min(1, (event.beta - 45) / 45));

            // Apply smoothing
            this.tilt.x = this.tilt.x * (1 - this.smoothingFactor) + (x - this.calibration.x) * this.smoothingFactor;
            this.tilt.y = this.tilt.y * (1 - this.smoothingFactor) + (y - this.calibration.y) * this.smoothingFactor;
        }
    }

    processAcceleration() {
        // Convert acceleration to tilt
        // On mobile, gravity affects x and y based on device orientation

        // Normalize (typical gravity is ~9.8)
        const maxAccel = 10;
        let x = this.rawAccel.x / maxAccel;
        let y = this.rawAccel.y / maxAccel;

        // Clamp values
        x = Math.max(-1, Math.min(1, x));
        y = Math.max(-1, Math.min(1, y));

        // Apply calibration offset
        x -= this.calibration.x;
        y -= this.calibration.y;

        // Invert both axes for Android (tilt right = ball moves right, tilt forward = ball moves up)
        x = -x;

        // Apply smoothing
        this.tilt.x = this.tilt.x * (1 - this.smoothingFactor) + x * this.smoothingFactor;
        this.tilt.y = this.tilt.y * (1 - this.smoothingFactor) + y * this.smoothingFactor;
    }

    handleTouchStart(event) {
        if (event.target.closest('.hud-btn, .menu-btn')) return;
        
        event.preventDefault();
        const touch = event.touches[0];
        
        this.touchActive = true;
        this.touchStart = { x: touch.clientX, y: touch.clientY };
        this.touchCurrent = { x: touch.clientX, y: touch.clientY };

        // Update touch indicator
        this.updateTouchIndicator(true);
    }

    handleTouchMove(event) {
        if (!this.touchActive) return;
        event.preventDefault();
        
        const touch = event.touches[0];
        this.touchCurrent = { x: touch.clientX, y: touch.clientY };

        // Calculate delta from start position
        const deltaX = (this.touchCurrent.x - this.touchStart.x) * this.touchSensitivity;
        const deltaY = (this.touchCurrent.y - this.touchStart.y) * this.touchSensitivity;

        // Clamp to -1 to 1
        this.tilt.x = Math.max(-1, Math.min(1, deltaX));
        this.tilt.y = Math.max(-1, Math.min(1, deltaY));
    }

    handleTouchEnd(event) {
        this.touchActive = false;
        
        // Gradually return to neutral
        this.tilt.x *= 0.5;
        this.tilt.y *= 0.5;

        this.updateTouchIndicator(false);
    }

    updateTouchIndicator(active) {
        const indicator = document.querySelector('.touch-indicator');
        if (indicator) {
            indicator.style.opacity = active ? '0.6' : '0.3';
        }
    }

    getTilt() {
        return { ...this.tilt };
    }

    calibrate() {
        // Set current position as neutral
        if (this.mode === 'accelerometer') {
            this.calibration = {
                x: this.rawAccel.x / 10,
                y: -this.rawAccel.y / 10
            };
        } else {
            this.calibration = { x: 0, y: 0 };
        }

        // Save calibration
        this.storageManager.saveCalibration(this.calibration);

        // Reset tilt
        this.tilt = { x: 0, y: 0 };

        console.log('Calibrated:', this.calibration);
    }

    getMode() {
        return this.mode;
    }

    isAccelerometerAvailable() {
        return this.mode === 'accelerometer' || this.hasMotionPermission;
    }
}
