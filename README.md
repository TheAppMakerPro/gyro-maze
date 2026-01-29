# 🎮 GyroMaze - Tilt Ball Puzzle PWA

A mobile-first Progressive Web App game where players tilt their device to roll a ball through challenging mazes. Built with vanilla JavaScript, HTML5 Canvas, and Capacitor for native device features.

## 🎯 Features

- **Tilt Controls**: Use your device's accelerometer to control the ball
- **Touch Fallback**: Alternative touch controls for devices without motion sensors
- **12 Progressive Levels**: Increasing difficulty from tutorial to expert
- **Star Rating System**: Earn up to 3 stars per level based on completion time
- **Offline Support**: Full PWA with service worker caching
- **Native Experience**: Fullscreen gameplay, haptic feedback, and splash screens

## 📁 Project Structure

```
gyro-maze/
├── index.html              # Main HTML with all screens
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker
├── capacitor.config.json   # Capacitor configuration
├── package.json            # NPM dependencies
├── css/
│   └── styles.css          # All styling with cyberpunk theme
├── js/
│   ├── main.js             # App entry point
│   ├── game/
│   │   ├── GameEngine.js   # Core game loop & physics
│   │   ├── InputManager.js # Accelerometer & touch controls
│   │   └── LevelManager.js # Level definitions & progress
│   ├── ui/
│   │   └── UIManager.js    # Screen management & modals
│   └── utils/
│       ├── AudioManager.js  # Procedural sound synthesis
│       └── StorageManager.js # localStorage persistence
├── icons/
│   ├── icon.svg            # Source vector icon
│   └── icon-*.png          # Generated PNG icons
└── scripts/
    └── generate-icons.js   # Icon generation script
```

## 🚀 Quick Start

### Web Development (No Capacitor)

```bash
# Navigate to project
cd gyro-maze

# Start local server (any of these work)
npx http-server . -p 3000
# or
python3 -m http.server 3000
# or
php -S localhost:3000

# Open in browser
# http://localhost:3000
```

### Generate PWA Icons

```bash
# Option 1: Using Sharp (recommended)
npm install sharp
node scripts/generate-icons.js

# Option 2: Using ImageMagick
for size in 72 96 128 144 152 192 384 512; do
  convert -background none icons/icon.svg -resize ${size}x${size} icons/icon-${size}.png
done

# Option 3: Using Inkscape
for size in 72 96 128 144 152 192 384 512; do
  inkscape -w $size -h $size icons/icon.svg -o icons/icon-${size}.png
done
```

### Native Mobile Apps (Capacitor)

```bash
# Install dependencies
npm install

# Initialize Capacitor (first time only)
npx cap init GyroMaze com.gyromaze.app --web-dir .

# Add platforms
npx cap add ios
npx cap add android

# Sync web assets to native
npx cap sync

# Open in native IDE
npx cap open ios      # Opens Xcode
npx cap open android  # Opens Android Studio

# Run on device (requires connected device)
npx cap run ios
npx cap run android
```

## 🎮 Game Controls

### Tilt Mode (Recommended)
- Tilt device forward: Ball rolls up
- Tilt device backward: Ball rolls down
- Tilt device left/right: Ball rolls sideways
- Use Settings > Calibrate to set your preferred neutral position

### Touch Mode (Fallback)
- Touch and drag on screen to control ball direction
- The ball accelerates in the direction you drag
- Release to let the ball coast with friction

## 🏆 Levels Overview

| # | Name | Difficulty | Description |
|---|------|------------|-------------|
| 1 | First Roll | Tutorial | Learn the basics |
| 2 | Mind the Gap | Easy | Introduces holes |
| 3 | Zigzag | Easy | Alternating barriers |
| 4 | Tight Squeeze | Medium | Narrow corridors |
| 5 | Spiral Down | Medium | Spiral maze |
| 6 | Minefield | Medium | Dense hole grid |
| 7 | Classic Maze | Hard | Traditional labyrinth |
| 8 | Speed Run | Hard | Time pressure |
| 9 | Chamber of Holes | Hard | Room navigation |
| 10 | The Gauntlet | Boss | Multi-section challenge |
| 11 | Precision Path | Expert | Requires precise control |
| 12 | Ultimate Maze | Expert | Final challenge |

## ⚙️ Technical Details

### Physics System
- Custom physics with velocity, friction (0.98), and bounce (0.5)
- Tilt input normalized to -1 to 1 range
- Maximum ball speed capped at 12 units/frame
- 60 FPS target with requestAnimationFrame

### Collision Detection
- Circle-rectangle collision for walls
- Circle-circle collision for holes and goal
- Bounce response with velocity dampening

### Audio
- Web Audio API for procedural sound generation
- Synthesized effects: click, wall bounce, fall, win fanfare
- Ambient music with oscillator-based pads

### Storage
- LocalStorage for settings and progress
- Memory fallback for private browsing
- Settings: sensitivity, SFX, music, vibration
- Progress: level completion, best times, stars

## 🔧 Configuration

### Capacitor Plugins Used
- `@capacitor/motion` - Device accelerometer
- `@capacitor/haptics` - Vibration feedback
- `@capacitor/status-bar` - Status bar styling
- `@capacitor/splash-screen` - Launch screen

### PWA Configuration
- Fullscreen display mode
- Portrait orientation lock
- Dark theme (#0a0a1a)
- Offline caching strategy

## 🎨 Design System

### Colors
- Background: `#0a0a1a` (deep navy)
- Primary: `#00ffff` (cyan)
- Accent: `#ff0066` (pink)
- Success: `#00ff66` (green)
- Wall: `#2a2a5a` (purple-grey)

### Typography
- Display: Orbitron (futuristic)
- Body: Exo 2 (clean technical)

### Visual Effects
- Ball glow based on speed
- Motion trail particles
- Confetti on level completion
- Animated backgrounds

## 📱 Browser Compatibility

| Browser | Tilt | Touch | PWA |
|---------|------|-------|-----|
| Chrome (Android) | ✅ | ✅ | ✅ |
| Safari (iOS 13+) | ✅* | ✅ | ✅ |
| Firefox (Android) | ✅ | ✅ | ✅ |
| Samsung Internet | ✅ | ✅ | ✅ |
| Desktop browsers | ❌ | ✅ | ✅ |

*iOS requires permission prompt for motion sensors

## 🐛 Troubleshooting

### Tilt controls not working
1. Check if your device has an accelerometer
2. On iOS, grant motion sensor permission when prompted
3. Try using Settings > Calibrate
4. Use touch controls as fallback

### Game not loading offline
1. Visit the game online at least once
2. Wait for service worker to install
3. Check browser console for caching errors

### Sound not playing
1. Tap screen to initialize audio context (browser requirement)
2. Check if SFX is enabled in Settings
3. Ensure device is not in silent mode

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on multiple devices
5. Submit a pull request

---

Built with ❤️ using vanilla JavaScript, HTML5 Canvas, and Capacitor
