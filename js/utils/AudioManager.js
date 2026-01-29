/**
 * AudioManager.js
 * Handles all game audio using Web Audio API for procedural sound generation
 */

export class AudioManager {
    constructor(storageManager) {
        this.storageManager = storageManager;

        this.audioContext = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;

        this.sfxEnabled = true;
        this.musicEnabled = true;
        this.voiceEnabled = true;

        this.musicOscillators = [];
        this.musicPlaying = false;

        // Voice synthesis
        this.synth = window.speechSynthesis || null;
        this.voice = null;
    }

    async init() {
        // Load settings
        this.sfxEnabled = this.storageManager.isSfxEnabled();
        this.musicEnabled = this.storageManager.isMusicEnabled();
        this.voiceEnabled = this.storageManager.getSetting('voiceEnabled') !== false;

        // Initialize on user interaction - keep trying until successful
        const unlockAudio = () => {
            this.initAudioContext();
            this.unlockSpeechSynthesis();
        };

        // Try on multiple events to ensure it works
        document.addEventListener('click', unlockAudio);
        document.addEventListener('touchstart', unlockAudio);
        document.addEventListener('touchend', unlockAudio);

        // Initialize voice synthesis
        this.initVoice();

        console.log('AudioManager initialized');
    }

    // Call this explicitly when game starts
    ensureAudioReady() {
        this.initAudioContext();
        this.unlockSpeechSynthesis();
        // Resume if suspended
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    unlockSpeechSynthesis() {
        // Some devices require a user gesture to unlock speech synthesis
        if (this.synth && this.voiceEnabled) {
            try {
                // Create a silent utterance to unlock
                const unlock = new SpeechSynthesisUtterance('');
                unlock.volume = 0;
                this.synth.speak(unlock);
                this.synth.cancel();
                console.log('Speech synthesis unlocked');
            } catch (e) {
                console.warn('Could not unlock speech synthesis:', e);
            }
        }
    }

    initVoice() {
        if (!this.synth) return;

        // Get available voices
        const loadVoices = () => {
            const voices = this.synth.getVoices();
            // Prefer a clear English voice
            this.voice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Samantha')) ||
                         voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) ||
                         voices.find(v => v.lang.startsWith('en') && !v.localService) ||
                         voices.find(v => v.lang.startsWith('en')) ||
                         voices[0];
        };

        // Voices may load asynchronously
        if (this.synth.getVoices().length > 0) {
            loadVoices();
        } else {
            this.synth.addEventListener('voiceschanged', loadVoices, { once: true });
        }
    }

    initAudioContext() {
        if (this.audioContext) return;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Master gain
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = 0.5;
            this.masterGain.connect(this.audioContext.destination);

            // SFX gain
            this.sfxGain = this.audioContext.createGain();
            this.sfxGain.gain.value = this.sfxEnabled ? 1 : 0;
            this.sfxGain.connect(this.masterGain);

            // Music gain
            this.musicGain = this.audioContext.createGain();
            this.musicGain.gain.value = this.musicEnabled ? 0.3 : 0;
            this.musicGain.connect(this.masterGain);

            console.log('AudioContext initialized');
        } catch (error) {
            console.warn('Failed to initialize AudioContext:', error);
        }
    }

    playSound(type) {
        if (!this.sfxEnabled) return;

        // Initialize audio context if not already done
        if (!this.audioContext) {
            this.initAudioContext();
        }

        // Still no context? Can't play sounds
        if (!this.audioContext) return;

        // Resume context if suspended
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        switch (type) {
            case 'click':
                this.playClickSound();
                break;
            case 'wall':
                this.playWallSound();
                break;
            case 'fall':
                this.playFallSound();
                break;
            case 'win':
                this.playWinSound();
                break;
            case 'star':
                this.playStarSound();
                break;
            case 'coin':
                this.playCoinSound();
                break;
            case 'bumper':
                this.playBumperSound();
                break;
            case 'powerup':
                this.playPowerupSound();
                break;
        }
    }

    playPowerupSound() {
        // Magical whoosh sound for time warp
        const now = this.audioContext.currentTime;

        // Rising sweep
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.6);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.6);
    }

    playBumperSound() {
        // Pinball bumper sound - punchy electronic boing
        const baseTime = this.audioContext.currentTime;

        // Initial impact pop
        const pop = this.audioContext.createOscillator();
        const popGain = this.audioContext.createGain();

        pop.type = 'sine';
        pop.frequency.setValueAtTime(400, baseTime);
        pop.frequency.exponentialRampToValueAtTime(150, baseTime + 0.08);

        popGain.gain.setValueAtTime(0.4, baseTime);
        popGain.gain.exponentialRampToValueAtTime(0.01, baseTime + 0.1);

        pop.connect(popGain);
        popGain.connect(this.sfxGain);

        pop.start(baseTime);
        pop.stop(baseTime + 0.1);

        // Electronic boing/spring sound
        const boing = this.audioContext.createOscillator();
        const boingGain = this.audioContext.createGain();

        boing.type = 'triangle';
        boing.frequency.setValueAtTime(600, baseTime);
        boing.frequency.exponentialRampToValueAtTime(200, baseTime + 0.15);

        boingGain.gain.setValueAtTime(0.25, baseTime);
        boingGain.gain.exponentialRampToValueAtTime(0.01, baseTime + 0.15);

        boing.connect(boingGain);
        boingGain.connect(this.sfxGain);

        boing.start(baseTime);
        boing.stop(baseTime + 0.15);

        // High frequency ping
        const ping = this.audioContext.createOscillator();
        const pingGain = this.audioContext.createGain();

        ping.type = 'sine';
        ping.frequency.setValueAtTime(1200, baseTime + 0.01);

        pingGain.gain.setValueAtTime(0.15, baseTime + 0.01);
        pingGain.gain.exponentialRampToValueAtTime(0.01, baseTime + 0.08);

        ping.connect(pingGain);
        pingGain.connect(this.sfxGain);

        ping.start(baseTime + 0.01);
        ping.stop(baseTime + 0.08);
    }

    playCoinSound() {
        // Ka-ching! Cash register sound
        const baseTime = this.audioContext.currentTime;

        // First "ka" - metallic click
        const click1 = this.audioContext.createOscillator();
        const clickGain1 = this.audioContext.createGain();
        const clickFilter1 = this.audioContext.createBiquadFilter();

        click1.type = 'square';
        click1.frequency.setValueAtTime(1800, baseTime);
        click1.frequency.exponentialRampToValueAtTime(800, baseTime + 0.03);

        clickFilter1.type = 'bandpass';
        clickFilter1.frequency.value = 2000;
        clickFilter1.Q.value = 5;

        clickGain1.gain.setValueAtTime(0.3, baseTime);
        clickGain1.gain.exponentialRampToValueAtTime(0.01, baseTime + 0.05);

        click1.connect(clickFilter1);
        clickFilter1.connect(clickGain1);
        clickGain1.connect(this.sfxGain);

        click1.start(baseTime);
        click1.stop(baseTime + 0.05);

        // "Ching!" - bell/register ring
        const bell1 = this.audioContext.createOscillator();
        const bell2 = this.audioContext.createOscillator();
        const bellGain = this.audioContext.createGain();

        bell1.type = 'sine';
        bell1.frequency.setValueAtTime(2200, baseTime + 0.02);

        bell2.type = 'sine';
        bell2.frequency.setValueAtTime(3300, baseTime + 0.02);

        bellGain.gain.setValueAtTime(0, baseTime);
        bellGain.gain.linearRampToValueAtTime(0.35, baseTime + 0.03);
        bellGain.gain.exponentialRampToValueAtTime(0.01, baseTime + 0.25);

        bell1.connect(bellGain);
        bell2.connect(bellGain);
        bellGain.connect(this.sfxGain);

        bell1.start(baseTime + 0.02);
        bell1.stop(baseTime + 0.25);
        bell2.start(baseTime + 0.02);
        bell2.stop(baseTime + 0.25);

        // Second higher ching for sparkle
        const bell3 = this.audioContext.createOscillator();
        const bellGain2 = this.audioContext.createGain();

        bell3.type = 'sine';
        bell3.frequency.setValueAtTime(4400, baseTime + 0.05);

        bellGain2.gain.setValueAtTime(0, baseTime + 0.05);
        bellGain2.gain.linearRampToValueAtTime(0.15, baseTime + 0.07);
        bellGain2.gain.exponentialRampToValueAtTime(0.01, baseTime + 0.2);

        bell3.connect(bellGain2);
        bellGain2.connect(this.sfxGain);

        bell3.start(baseTime + 0.05);
        bell3.stop(baseTime + 0.2);

        // Voice feedback (occasional)
        this.speakCoin();
    }

    playClickSound() {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, this.audioContext.currentTime + 0.05);

        gain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start();
        osc.stop(this.audioContext.currentTime + 0.1);
    }

    playWallSound() {
        // Create a short impact sound
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.1);

        filter.type = 'lowpass';
        filter.frequency.value = 500;

        gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        osc.start();
        osc.stop(this.audioContext.currentTime + 0.15);

        // Add noise burst
        this.playNoiseBurst(0.1, 0.05);
    }

    playFallSound() {
        // Descending tone for falling
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.5);

        gain.gain.setValueAtTime(0.4, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start();
        osc.stop(this.audioContext.currentTime + 0.5);

        // Add second harmonic
        const osc2 = this.audioContext.createOscillator();
        const gain2 = this.audioContext.createGain();

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(400, this.audioContext.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(30, this.audioContext.currentTime + 0.6);

        gain2.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.6);

        osc2.connect(gain2);
        gain2.connect(this.sfxGain);

        osc2.start();
        osc2.stop(this.audioContext.currentTime + 0.6);
    }

    playWinSound() {
        // Victory fanfare - ascending arpeggio
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        const baseTime = this.audioContext.currentTime;

        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'sine';
            osc.frequency.value = freq;

            const startTime = baseTime + i * 0.1;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(startTime);
            osc.stop(startTime + 0.4);

            // Add harmonic
            const osc2 = this.audioContext.createOscillator();
            const gain2 = this.audioContext.createGain();

            osc2.type = 'triangle';
            osc2.frequency.value = freq * 2;

            gain2.gain.setValueAtTime(0, startTime);
            gain2.gain.linearRampToValueAtTime(0.1, startTime + 0.02);
            gain2.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

            osc2.connect(gain2);
            gain2.connect(this.sfxGain);

            osc2.start(startTime);
            osc2.stop(startTime + 0.3);
        });
    }

    playStarSound() {
        // Sparkle sound
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(2400, this.audioContext.currentTime + 0.1);
        osc.frequency.exponentialRampToValueAtTime(1800, this.audioContext.currentTime + 0.2);

        gain.gain.setValueAtTime(0, this.audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(0.25, this.audioContext.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start();
        osc.stop(this.audioContext.currentTime + 0.3);
    }

    // Voice synthesis methods
    // NOTE: Android WebView does NOT support Web Speech API
    // Voice is disabled on Android/Capacitor apps
    speak(text, options = {}) {
        // Skip voice on Android WebView (Capacitor)
        if (window.Capacitor) {
            return; // Voice not supported in Capacitor WebView
        }

        if (!this.voiceEnabled || !this.sfxEnabled) return;

        // Check if speech synthesis is available
        if (!this.synth) {
            return;
        }

        try {
            // Check if voices are available
            const voices = this.synth.getVoices();
            if (!voices || voices.length === 0) {
                return; // No voices available
            }

            // Cancel any ongoing speech
            this.synth.cancel();

            const utterance = new SpeechSynthesisUtterance(text);

            // Re-check for voices in case they loaded late
            if (!this.voice) {
                this.voice = voices.find(v => v.lang && v.lang.startsWith('en') && v.name && v.name.includes('Samantha')) ||
                             voices.find(v => v.lang && v.lang.startsWith('en') && v.name && v.name.includes('Google')) ||
                             voices.find(v => v.lang && v.lang.startsWith('en') && !v.localService) ||
                             voices.find(v => v.lang && v.lang.startsWith('en')) ||
                             voices[0];
            }

            if (this.voice) {
                utterance.voice = this.voice;
            }
            utterance.lang = 'en-US';
            utterance.rate = options.rate || 1.1;
            utterance.pitch = options.pitch || 1.0;
            utterance.volume = options.volume || 0.8;

            this.synth.speak(utterance);
        } catch (error) {
            // Silently fail - voice is optional
        }
    }

    speakLevelStart(levelNumber) {
        this.speak(`Level ${levelNumber}`, { rate: 1.0, pitch: 1.1 });
        // Always play musical jingle too for Android compatibility
        this.playLevelStartJingle();
    }

    playLevelStartJingle() {
        if (!this.sfxEnabled || !this.audioContext) return;

        const now = this.audioContext.currentTime;
        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 - ascending chord

        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'sine';
            osc.frequency.value = freq;

            const startTime = now + i * 0.1;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(startTime);
            osc.stop(startTime + 0.3);
        });
    }

    speakGo() {
        setTimeout(() => {
            this.speak('Go!', { rate: 1.2, pitch: 1.2 });
            this.playGoJingle();
        }, 300);
    }

    playGoJingle() {
        if (!this.sfxEnabled || !this.audioContext) return;

        const now = this.audioContext.currentTime;
        // Quick ascending blast
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.2);
    }

    speakInstructions() {
        setTimeout(() => {
            this.speak("Don't hit the walls!", { rate: 1.0, pitch: 1.0 });
        }, 800);
    }

    speakWallHit() {
        // Only speak occasionally to avoid spam
        if (Math.random() < 0.15) {
            const phrases = ['Ouch!', 'Careful!', 'Watch out!', 'Easy!'];
            const phrase = phrases[Math.floor(Math.random() * phrases.length)];
            this.speak(phrase, { rate: 1.2, pitch: 1.0, volume: 0.5 });
        }
    }

    speakWin() {
        const phrases = ['Level Complete!', 'Awesome!', 'Great job!', 'Amazing!'];
        const phrase = phrases[Math.floor(Math.random() * phrases.length)];
        this.speak(phrase, { rate: 1.0, pitch: 1.2 });
        // Always play victory fanfare for Android
        this.playVictoryFanfare();
    }

    playVictoryFanfare() {
        if (!this.sfxEnabled || !this.audioContext) return;

        const now = this.audioContext.currentTime;
        // Victory fanfare: C E G C (octave up)
        const notes = [523.25, 659.25, 783.99, 1046.5];
        const durations = [0.15, 0.15, 0.15, 0.4];

        let time = now;
        notes.forEach((freq, i) => {
            const osc1 = this.audioContext.createOscillator();
            const osc2 = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc1.type = 'sine';
            osc1.frequency.value = freq;
            osc2.type = 'triangle';
            osc2.frequency.value = freq * 2;

            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.2, time + 0.02);
            gain.gain.setValueAtTime(0.2, time + durations[i] - 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, time + durations[i]);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(this.sfxGain);

            osc1.start(time);
            osc1.stop(time + durations[i]);
            osc2.start(time);
            osc2.stop(time + durations[i]);

            time += durations[i];
        });
    }

    speakLose() {
        const phrases = ['Oh no!', 'Try again!', 'Oops!', 'So close!'];
        const phrase = phrases[Math.floor(Math.random() * phrases.length)];
        this.speak(phrase, { rate: 1.0, pitch: 0.9 });
        // Play sad sound for Android
        this.playLoseSound();
    }

    playLoseSound() {
        if (!this.sfxEnabled || !this.audioContext) return;

        const now = this.audioContext.currentTime;
        // Sad descending notes
        const notes = [392, 349.23, 293.66]; // G4, F4, D4

        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'sine';
            osc.frequency.value = freq;

            const startTime = now + i * 0.2;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.25);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(startTime);
            osc.stop(startTime + 0.25);
        });
    }

    speakCoin() {
        // Short "Nice!" for coin collection - but not every time to avoid spam
        if (Math.random() < 0.3) {
            const phrases = ['Nice!', 'Coin!', 'Yeah!'];
            const phrase = phrases[Math.floor(Math.random() * phrases.length)];
            this.speak(phrase, { rate: 1.3, pitch: 1.3, volume: 0.6 });
        }
    }

    speakNewBest() {
        this.speak('New record!', { rate: 1.0, pitch: 1.3 });
        // Play achievement jingle for Android
        this.playNewBestJingle();
    }

    playNewBestJingle() {
        if (!this.sfxEnabled || !this.audioContext) return;

        const now = this.audioContext.currentTime;
        // Celebratory arpeggio
        const notes = [783.99, 987.77, 1174.66, 1318.51]; // G5, B5, D6, E6

        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'sine';
            osc.frequency.value = freq;

            const startTime = now + i * 0.08;
            gain.gain.setValueAtTime(0.2, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(startTime);
            osc.stop(startTime + 0.3);
        });
    }

    speakAllStars() {
        this.speak('Perfect! Three stars!', { rate: 1.0, pitch: 1.2 });
        // Play perfect score jingle
        this.playPerfectJingle();
    }

    playPerfectJingle() {
        if (!this.sfxEnabled || !this.audioContext) return;

        const now = this.audioContext.currentTime;
        // Magical perfect score sound
        const baseNotes = [523.25, 659.25, 783.99, 1046.5, 1318.51]; // C5 to E6

        baseNotes.forEach((freq, i) => {
            const osc1 = this.audioContext.createOscillator();
            const osc2 = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc1.type = 'sine';
            osc1.frequency.value = freq;
            osc2.type = 'triangle';
            osc2.frequency.value = freq * 1.5; // Fifth harmony

            const startTime = now + i * 0.1;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
            gain.gain.setValueAtTime(0.2, startTime + 0.15);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(this.sfxGain);

            osc1.start(startTime);
            osc1.stop(startTime + 0.5);
            osc2.start(startTime);
            osc2.stop(startTime + 0.5);
        });
    }

    setVoiceEnabled(enabled) {
        this.voiceEnabled = enabled;
        this.storageManager.setSetting('voiceEnabled', enabled);
        if (!enabled && this.synth) {
            this.synth.cancel();
        }
    }

    playNoiseBurst(duration, volume) {
        const bufferSize = this.audioContext.sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
        }

        const source = this.audioContext.createBufferSource();
        const gain = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();

        source.buffer = buffer;
        filter.type = 'lowpass';
        filter.frequency.value = 2000;
        gain.gain.value = volume;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        source.start();
    }

    playMusic() {
        if (!this.musicEnabled || this.musicPlaying) return;

        // Initialize audio context if not already done
        if (!this.audioContext) {
            this.initAudioContext();
        }

        if (!this.audioContext) return;

        // Resume context if suspended
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        this.musicPlaying = true;
        this.playAmbientMusic();
    }

    playAmbientMusic() {
        // Create ambient synth pads
        const baseFreqs = [130.81, 164.81, 196.00, 261.63]; // C3, E3, G3, C4
        
        baseFreqs.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();

            osc.type = 'sine';
            osc.frequency.value = freq;

            filter.type = 'lowpass';
            filter.frequency.value = 800;
            filter.Q.value = 2;

            // Gentle LFO for movement
            const lfo = this.audioContext.createOscillator();
            const lfoGain = this.audioContext.createGain();
            
            lfo.type = 'sine';
            lfo.frequency.value = 0.1 + i * 0.05;
            lfoGain.gain.value = 10;

            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);

            gain.gain.value = 0.08;

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicGain);

            osc.start();
            lfo.start();

            this.musicOscillators.push({ osc, lfo, gain, filter });
        });
    }

    stopMusic() {
        this.musicPlaying = false;
        
        this.musicOscillators.forEach(({ osc, lfo, gain }) => {
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
            setTimeout(() => {
                osc.stop();
                lfo.stop();
            }, 600);
        });

        this.musicOscillators = [];
    }

    setSfxEnabled(enabled) {
        this.sfxEnabled = enabled;
        if (this.sfxGain) {
            this.sfxGain.gain.value = enabled ? 1 : 0;
        }
    }

    setMusicEnabled(enabled) {
        this.musicEnabled = enabled;
        if (this.musicGain) {
            this.musicGain.gain.value = enabled ? 0.3 : 0;
        }
        
        if (!enabled && this.musicPlaying) {
            this.stopMusic();
        } else if (enabled && !this.musicPlaying) {
            this.playMusic();
        }
    }

    setMasterVolume(value) {
        if (this.masterGain) {
            this.masterGain.gain.value = Math.max(0, Math.min(1, value));
        }
    }
}
