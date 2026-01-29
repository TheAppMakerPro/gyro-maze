/**
 * LevelGenerator.js
 * Procedurally generates 100 maze levels with increasing difficulty
 * Uses recursive backtracking algorithm for true maze generation
 */

export class LevelGenerator {
    constructor() {
        this.seed = 12345;
    }

    random(levelSeed) {
        this.seed = levelSeed;
        return () => {
            this.seed = (this.seed * 9301 + 49297) % 233280;
            return this.seed / 233280;
        };
    }

    generateAllLevels() {
        const levels = [];
        for (let i = 1; i <= 100; i++) {
            levels.push(this.generateLevel(i));
        }
        return levels;
    }

    generateLevel(levelNum) {
        const rng = this.random(levelNum * 7919);
        const difficulty = this.getDifficulty(levelNum);

        // Canvas dimensions
        const width = Math.floor(300 + difficulty.sizeBonus);
        const height = Math.floor(420 + difficulty.sizeBonus * 1.2);

        // Maze grid dimensions (cells) - wider corridors for better gameplay
        const cellSize = Math.max(50, 70 - difficulty.complexity * 2);
        const cols = Math.floor((width - 60) / cellSize);
        const rows = Math.floor((height - 60) / cellSize);

        // Generate the maze grid
        const maze = this.generateMazeGrid(cols, rows, rng);

        // Convert maze grid to wall rectangles
        const walls = this.mazeToWalls(maze, cols, rows, cellSize, width, height);

        // Ball size decreases with difficulty
        const ballRadius = Math.max(6, 12 - Math.floor(levelNum / 20));

        // Start at bottom-left, goal at top-right
        const startCell = { col: 0, row: rows - 1 };
        const goalCell = { col: cols - 1, row: 0 };

        const offsetX = (width - cols * cellSize) / 2;
        const offsetY = (height - rows * cellSize) / 2;

        const start = {
            x: offsetX + startCell.col * cellSize + cellSize / 2,
            y: offsetY + startCell.row * cellSize + cellSize / 2
        };

        const goal = {
            x: offsetX + goalCell.col * cellSize + cellSize / 2,
            y: offsetY + goalCell.row * cellSize + cellSize / 2,
            radius: Math.max(14, 22 - Math.floor(levelNum / 25))
        };

        // Generate holes in open areas
        const holes = this.generateHoles(levelNum, maze, cols, rows, cellSize, offsetX, offsetY, difficulty, start, goal, rng);
        console.log(`Level ${levelNum}: Generated ${holes.length} holes (difficulty: ${difficulty.holes})`);

        // Generate coins in dead ends and side paths
        const coins = this.generateCoins(levelNum, maze, cols, rows, cellSize, offsetX, offsetY, start, goal, rng);

        // Generate extra lives (rare, in hard-to-reach spots)
        const extraLives = this.generateExtraLives(levelNum, maze, cols, rows, cellSize, offsetX, offsetY, start, goal, coins, holes, rng);

        // Generate powerups (start appearing at level 6)
        const powerups = this.generatePowerups(levelNum, maze, cols, rows, cellSize, offsetX, offsetY, start, goal, coins, holes, rng);

        // Generate bounce pads (start appearing at level 11)
        const bouncePads = this.generateBouncePads(levelNum, maze, cols, rows, cellSize, offsetX, offsetY, start, goal, holes, rng);

        // Generate speed zones (start appearing at level 16)
        const speedZones = this.generateSpeedZones(levelNum, maze, cols, rows, cellSize, offsetX, offsetY, rng);

        // Generate moving walls (start appearing at level 21)
        const movingWalls = this.generateMovingWalls(levelNum, walls, rng);

        // Star times based on path length and difficulty
        const baseTime = 12000 + (levelNum * 600) + (difficulty.complexity * 1500);
        const starTimes = [
            Math.floor(baseTime),
            Math.floor(baseTime * 0.65),
            Math.floor(baseTime * 0.4)
        ];

        return {
            id: levelNum,
            name: this.getLevelName(levelNum),
            difficulty: difficulty.name,
            width,
            height,
            ballRadius,
            start,
            goal,
            walls,
            holes,
            coins,
            extraLives,
            powerups,
            bouncePads,
            speedZones,
            movingWalls,
            starTimes,
            generated: true
        };
    }

    generateMazeGrid(cols, rows, rng) {
        // Initialize grid - each cell has 4 walls: top, right, bottom, left
        const grid = [];
        for (let row = 0; row < rows; row++) {
            grid[row] = [];
            for (let col = 0; col < cols; col++) {
                grid[row][col] = {
                    visited: false,
                    walls: { top: true, right: true, bottom: true, left: true }
                };
            }
        }

        // Recursive backtracking maze generation
        const stack = [];
        const startRow = rows - 1;
        const startCol = 0;

        grid[startRow][startCol].visited = true;
        stack.push({ row: startRow, col: startCol });

        while (stack.length > 0) {
            const current = stack[stack.length - 1];
            const neighbors = this.getUnvisitedNeighbors(grid, current.row, current.col, rows, cols);

            if (neighbors.length === 0) {
                stack.pop();
            } else {
                // Pick random neighbor
                const next = neighbors[Math.floor(rng() * neighbors.length)];

                // Remove wall between current and next
                this.removeWallBetween(grid, current, next);

                grid[next.row][next.col].visited = true;
                stack.push(next);
            }
        }

        // Add some extra passages to make it less linear (creates loops)
        const extraPassages = Math.floor(cols * rows * 0.08);
        for (let i = 0; i < extraPassages; i++) {
            const row = Math.floor(rng() * rows);
            const col = Math.floor(rng() * cols);
            const dir = Math.floor(rng() * 4);

            if (dir === 0 && row > 0) {
                grid[row][col].walls.top = false;
                grid[row - 1][col].walls.bottom = false;
            } else if (dir === 1 && col < cols - 1) {
                grid[row][col].walls.right = false;
                grid[row][col + 1].walls.left = false;
            } else if (dir === 2 && row < rows - 1) {
                grid[row][col].walls.bottom = false;
                grid[row + 1][col].walls.top = false;
            } else if (dir === 3 && col > 0) {
                grid[row][col].walls.left = false;
                grid[row][col - 1].walls.right = false;
            }
        }

        return grid;
    }

    getUnvisitedNeighbors(grid, row, col, rows, cols) {
        const neighbors = [];

        if (row > 0 && !grid[row - 1][col].visited) {
            neighbors.push({ row: row - 1, col, dir: 'top' });
        }
        if (col < cols - 1 && !grid[row][col + 1].visited) {
            neighbors.push({ row, col: col + 1, dir: 'right' });
        }
        if (row < rows - 1 && !grid[row + 1][col].visited) {
            neighbors.push({ row: row + 1, col, dir: 'bottom' });
        }
        if (col > 0 && !grid[row][col - 1].visited) {
            neighbors.push({ row, col: col - 1, dir: 'left' });
        }

        return neighbors;
    }

    removeWallBetween(grid, current, next) {
        const rowDiff = next.row - current.row;
        const colDiff = next.col - current.col;

        if (rowDiff === -1) { // next is above
            grid[current.row][current.col].walls.top = false;
            grid[next.row][next.col].walls.bottom = false;
        } else if (rowDiff === 1) { // next is below
            grid[current.row][current.col].walls.bottom = false;
            grid[next.row][next.col].walls.top = false;
        } else if (colDiff === 1) { // next is right
            grid[current.row][current.col].walls.right = false;
            grid[next.row][next.col].walls.left = false;
        } else if (colDiff === -1) { // next is left
            grid[current.row][current.col].walls.left = false;
            grid[next.row][next.col].walls.right = false;
        }
    }

    mazeToWalls(grid, cols, rows, cellSize, canvasWidth, canvasHeight) {
        const walls = [];
        const W = 8; // Wall thickness

        const offsetX = (canvasWidth - cols * cellSize) / 2;
        const offsetY = (canvasHeight - rows * cellSize) / 2;

        // Add outer boundary walls
        walls.push({ x: 0, y: 0, width: canvasWidth, height: W }); // Top
        walls.push({ x: 0, y: canvasHeight - W, width: canvasWidth, height: W }); // Bottom
        walls.push({ x: 0, y: 0, width: W, height: canvasHeight }); // Left
        walls.push({ x: canvasWidth - W, y: 0, width: W, height: canvasHeight }); // Right

        // Convert each cell's walls to rectangles
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const cell = grid[row][col];
                const x = offsetX + col * cellSize;
                const y = offsetY + row * cellSize;

                // Top wall
                if (cell.walls.top && row > 0) {
                    walls.push({
                        x: x,
                        y: y - W / 2,
                        width: cellSize,
                        height: W
                    });
                }

                // Left wall
                if (cell.walls.left && col > 0) {
                    walls.push({
                        x: x - W / 2,
                        y: y,
                        width: W,
                        height: cellSize
                    });
                }

                // Add corner posts for cleaner look
                if ((cell.walls.top || cell.walls.left) && row > 0 && col > 0) {
                    // Check if we need a corner post
                    const topCell = grid[row - 1][col];
                    const leftCell = grid[row][col - 1];
                    if (cell.walls.top || cell.walls.left || topCell.walls.left || leftCell.walls.top) {
                        walls.push({
                            x: x - W / 2,
                            y: y - W / 2,
                            width: W,
                            height: W
                        });
                    }
                }
            }
        }

        // Right edge walls
        for (let row = 0; row < rows; row++) {
            const cell = grid[row][cols - 1];
            if (cell.walls.right) {
                walls.push({
                    x: offsetX + cols * cellSize - W / 2,
                    y: offsetY + row * cellSize,
                    width: W,
                    height: cellSize
                });
            }
        }

        // Bottom edge walls
        for (let col = 0; col < cols; col++) {
            const cell = grid[rows - 1][col];
            if (cell.walls.bottom) {
                walls.push({
                    x: offsetX + col * cellSize,
                    y: offsetY + rows * cellSize - W / 2,
                    width: cellSize,
                    height: W
                });
            }
        }

        return walls;
    }

    generateHoles(levelNum, maze, cols, rows, cellSize, offsetX, offsetY, difficulty, start, goal, rng) {
        const holes = [];
        const numHoles = difficulty.holes;

        for (let i = 0; i < numHoles; i++) {
            let attempts = 0;
            while (attempts < 30) {
                attempts++;

                // Pick a random cell
                const col = Math.floor(rng() * cols);
                const row = Math.floor(rng() * rows);

                const x = offsetX + col * cellSize + cellSize / 2;
                const y = offsetY + row * cellSize + cellSize / 2;
                const radius = 10 + Math.floor(rng() * 4);

                // Check distance from start and goal
                const distStart = Math.sqrt((x - start.x) ** 2 + (y - start.y) ** 2);
                const distGoal = Math.sqrt((x - goal.x) ** 2 + (y - goal.y) ** 2);

                if (distStart < cellSize * 1.5 || distGoal < cellSize * 1.5) continue;

                // Check distance from other holes
                let tooClose = false;
                for (const hole of holes) {
                    const dist = Math.sqrt((x - hole.x) ** 2 + (y - hole.y) ** 2);
                    if (dist < cellSize) {
                        tooClose = true;
                        break;
                    }
                }
                if (tooClose) continue;

                holes.push({ x, y, radius });
                break;
            }
        }

        return holes;
    }

    generateCoins(levelNum, maze, cols, rows, cellSize, offsetX, offsetY, start, goal, rng) {
        const coins = [];
        const numCoins = Math.min(3 + Math.floor(levelNum / 12), 10);

        // Find dead ends (cells with 3 walls) - good places for coins
        const deadEnds = [];
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const cell = maze[row][col];
                const wallCount = Object.values(cell.walls).filter(w => w).length;
                if (wallCount >= 3) {
                    deadEnds.push({ row, col });
                }
            }
        }

        // Shuffle dead ends
        for (let i = deadEnds.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [deadEnds[i], deadEnds[j]] = [deadEnds[j], deadEnds[i]];
        }

        // Place coins in dead ends first
        for (let i = 0; i < Math.min(numCoins, deadEnds.length); i++) {
            const cell = deadEnds[i];
            const x = offsetX + cell.col * cellSize + cellSize / 2;
            const y = offsetY + cell.row * cellSize + cellSize / 2;

            // Check not too close to start/goal
            const distStart = Math.sqrt((x - start.x) ** 2 + (y - start.y) ** 2);
            const distGoal = Math.sqrt((x - goal.x) ** 2 + (y - goal.y) ** 2);

            if (distStart > cellSize && distGoal > cellSize) {
                coins.push({ x: Math.round(x), y: Math.round(y) });
            }
        }

        // Fill remaining with random positions
        while (coins.length < numCoins) {
            const col = Math.floor(rng() * cols);
            const row = Math.floor(rng() * rows);

            const x = offsetX + col * cellSize + cellSize / 2;
            const y = offsetY + row * cellSize + cellSize / 2;

            // Check distance from start, goal, and other coins
            const distStart = Math.sqrt((x - start.x) ** 2 + (y - start.y) ** 2);
            const distGoal = Math.sqrt((x - goal.x) ** 2 + (y - goal.y) ** 2);

            if (distStart < cellSize || distGoal < cellSize) continue;

            let tooClose = false;
            for (const coin of coins) {
                const dist = Math.sqrt((x - coin.x) ** 2 + (y - coin.y) ** 2);
                if (dist < cellSize * 0.8) {
                    tooClose = true;
                    break;
                }
            }
            if (tooClose) continue;

            coins.push({ x: Math.round(x), y: Math.round(y) });
        }

        return coins;
    }

    generateExtraLives(levelNum, maze, cols, rows, cellSize, offsetX, offsetY, start, goal, coins, holes, rng) {
        const lives = [];

        // Extra lives appear starting from level 5, chance increases with difficulty
        // They're rare - about 1 per 5-10 levels on average
        const chanceForLife = Math.min(0.3, 0.05 + (levelNum * 0.003));

        if (rng() > chanceForLife) {
            return lives; // No extra life this level
        }

        // Find dead ends that don't have coins (harder to reach spots)
        const deadEnds = [];
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const cell = maze[row][col];
                const wallCount = Object.values(cell.walls).filter(w => w).length;
                if (wallCount >= 3) {
                    const x = offsetX + col * cellSize + cellSize / 2;
                    const y = offsetY + row * cellSize + cellSize / 2;

                    // Check not near start/goal
                    const distStart = Math.sqrt((x - start.x) ** 2 + (y - start.y) ** 2);
                    const distGoal = Math.sqrt((x - goal.x) ** 2 + (y - goal.y) ** 2);
                    if (distStart < cellSize * 2 || distGoal < cellSize * 2) continue;

                    // Check not where a coin already is
                    let hasCoin = false;
                    for (const coin of coins) {
                        const dist = Math.sqrt((x - coin.x) ** 2 + (y - coin.y) ** 2);
                        if (dist < cellSize * 0.5) {
                            hasCoin = true;
                            break;
                        }
                    }
                    if (hasCoin) continue;

                    // Check not where a hole is
                    let hasHole = false;
                    for (const hole of holes) {
                        const dist = Math.sqrt((x - hole.x) ** 2 + (y - hole.y) ** 2);
                        if (dist < cellSize * 0.5) {
                            hasHole = true;
                            break;
                        }
                    }
                    if (hasHole) continue;

                    deadEnds.push({ x, y });
                }
            }
        }

        if (deadEnds.length > 0) {
            // Pick a random dead end for the extra life
            const spot = deadEnds[Math.floor(rng() * deadEnds.length)];
            lives.push({ x: Math.round(spot.x), y: Math.round(spot.y) });
        }

        return lives;
    }

    getDifficulty(levelNum) {
        if (levelNum <= 5) {
            return { name: 'Easy', complexity: 1, holes: 1, sizeBonus: 0 };
        } else if (levelNum <= 10) {
            return { name: 'Easy', complexity: 1, holes: 2, sizeBonus: 0 };
        } else if (levelNum <= 20) {
            return { name: 'Easy', complexity: 2, holes: 3, sizeBonus: 15 };
        } else if (levelNum <= 30) {
            return { name: 'Medium', complexity: 3, holes: 4, sizeBonus: 30 };
        } else if (levelNum <= 40) {
            return { name: 'Medium', complexity: 4, holes: 5, sizeBonus: 50 };
        } else if (levelNum <= 50) {
            return { name: 'Hard', complexity: 5, holes: 6, sizeBonus: 70 };
        } else if (levelNum <= 60) {
            return { name: 'Hard', complexity: 6, holes: 7, sizeBonus: 90 };
        } else if (levelNum <= 70) {
            return { name: 'Expert', complexity: 7, holes: 8, sizeBonus: 110 };
        } else if (levelNum <= 80) {
            return { name: 'Expert', complexity: 8, holes: 9, sizeBonus: 130 };
        } else if (levelNum <= 90) {
            return { name: 'Master', complexity: 9, holes: 10, sizeBonus: 150 };
        } else {
            return { name: 'Master', complexity: 10, holes: 12, sizeBonus: 170 };
        }
    }

    getLevelName(levelNum) {
        const names = [
            'First Steps', 'Getting Started', 'Easy Does It', 'Rolling Along', 'Simple Path',
            'Learning Curve', 'Basic Maze', 'Warm Up', 'Foundation', 'Ready Set Go',
            'The Journey', 'Winding Road', 'Twist & Turn', 'Maze Runner', 'Path Finder',
            'Navigate', 'Explore', 'Discovery', 'Adventure', 'Challenge Ahead',
            'Tight Squeeze', 'Narrow Passage', 'Compact', 'Dense Path', 'Crowded',
            'Complex Route', 'Intricate', 'Detailed', 'Elaborate', 'Sophisticated',
            'Precision', 'Careful Steps', 'Delicate', 'Fine Control', 'Steady',
            'Concentration', 'Focus Zone', 'Attention', 'Mindful', 'Deliberate',
            'Danger Zone', 'Risk Taker', 'Perilous', 'Hazardous', 'Treacherous',
            'Risky Business', 'High Stakes', 'Edge Walker', 'Cliff Hanger', 'Survivor',
            'Labyrinth', 'Deep Maze', 'Lost Ways', 'Confusion', 'Bewildering',
            'Perplexing', 'Enigma', 'Mystery', 'Puzzle Box', 'Riddle',
            'Time Trial', 'Speed Demon', 'Quick Reflex', 'Fast Lane', 'Rapid',
            'Swift', 'Velocity', 'Momentum', 'Acceleration', 'Turbo',
            'Ghost Walk', 'Phase Shift', 'Ethereal', 'Phantom', 'Spirit',
            'Spectral', 'Astral', 'Dimensional', 'Void Walker', 'Shadow',
            'Magnetic', 'Attraction', 'Pull Force', 'Gravity Well', 'Force Field',
            'Energy', 'Power Core', 'Dynamo', 'Generator', 'Reactor',
            'Ultimate', 'Supreme', 'Pinnacle', 'Apex', 'Zenith',
            'Summit', 'Crown', 'Throne', 'Glory', 'Legendary'
        ];
        return names[levelNum - 1] || `Level ${levelNum}`;
    }

    generatePowerups(levelNum, maze, cols, rows, cellSize, offsetX, offsetY, start, goal, coins, holes, rng) {
        const powerups = [];

        // Powerups start appearing at level 6
        if (levelNum < 6) return powerups;

        // Available powerup types based on level
        const availableTypes = [];
        if (levelNum >= 6) availableTypes.push('speed_boost', 'slow_motion');
        if (levelNum >= 15) availableTypes.push('shield');
        if (levelNum >= 25) availableTypes.push('magnet', 'shrink');
        if (levelNum >= 35) availableTypes.push('ghost');
        if (levelNum >= 45) availableTypes.push('time_freeze');
        if (levelNum >= 55) availableTypes.push('double_coins');

        // Number of powerups increases with level
        const numPowerups = Math.min(3, Math.floor((levelNum - 5) / 15) + 1);

        for (let i = 0; i < numPowerups; i++) {
            // Try to find a valid position
            for (let attempt = 0; attempt < 20; attempt++) {
                const col = Math.floor(rng() * cols);
                const row = Math.floor(rng() * rows);

                const x = offsetX + col * cellSize + cellSize / 2;
                const y = offsetY + row * cellSize + cellSize / 2;

                // Check distance from start, goal
                const distStart = Math.sqrt((x - start.x) ** 2 + (y - start.y) ** 2);
                const distGoal = Math.sqrt((x - goal.x) ** 2 + (y - goal.y) ** 2);
                if (distStart < cellSize * 2 || distGoal < cellSize) continue;

                // Check not too close to holes
                let tooCloseToHole = false;
                for (const hole of holes) {
                    const dist = Math.sqrt((x - hole.x) ** 2 + (y - hole.y) ** 2);
                    if (dist < cellSize) {
                        tooCloseToHole = true;
                        break;
                    }
                }
                if (tooCloseToHole) continue;

                // Check not too close to other powerups
                let tooCloseToPowerup = false;
                for (const p of powerups) {
                    const dist = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2);
                    if (dist < cellSize * 1.5) {
                        tooCloseToPowerup = true;
                        break;
                    }
                }
                if (tooCloseToPowerup) continue;

                // Pick a random powerup type
                const type = availableTypes[Math.floor(rng() * availableTypes.length)];

                powerups.push({
                    x: Math.round(x),
                    y: Math.round(y),
                    type: type,
                    radius: 14
                });
                break;
            }
        }

        return powerups;
    }

    generateBouncePads(levelNum, maze, cols, rows, cellSize, offsetX, offsetY, start, goal, holes, rng) {
        const bouncePads = [];

        // Bounce pads start at level 11
        if (levelNum < 11) return bouncePads;

        // Number of bounce pads
        const numPads = Math.min(4, Math.floor((levelNum - 10) / 12) + 1);

        const directions = ['up', 'down', 'left', 'right'];

        for (let i = 0; i < numPads; i++) {
            for (let attempt = 0; attempt < 20; attempt++) {
                const col = Math.floor(rng() * cols);
                const row = Math.floor(rng() * rows);

                const x = offsetX + col * cellSize + cellSize / 2;
                const y = offsetY + row * cellSize + cellSize / 2;

                // Check distance from start, goal
                const distStart = Math.sqrt((x - start.x) ** 2 + (y - start.y) ** 2);
                const distGoal = Math.sqrt((x - goal.x) ** 2 + (y - goal.y) ** 2);
                if (distStart < cellSize * 1.5 || distGoal < cellSize * 1.5) continue;

                // Check not on a hole
                let onHole = false;
                for (const hole of holes) {
                    const dist = Math.sqrt((x - hole.x) ** 2 + (y - hole.y) ** 2);
                    if (dist < cellSize * 0.8) {
                        onHole = true;
                        break;
                    }
                }
                if (onHole) continue;

                // Check not too close to other bounce pads
                let tooClose = false;
                for (const pad of bouncePads) {
                    const dist = Math.sqrt((x - pad.x) ** 2 + (y - pad.y) ** 2);
                    if (dist < cellSize * 2) {
                        tooClose = true;
                        break;
                    }
                }
                if (tooClose) continue;

                const direction = directions[Math.floor(rng() * directions.length)];

                bouncePads.push({
                    x: Math.round(x),
                    y: Math.round(y),
                    width: 25,
                    height: 10,
                    direction: direction,
                    force: 12 + Math.floor(rng() * 6)
                });
                break;
            }
        }

        return bouncePads;
    }

    generateSpeedZones(levelNum, maze, cols, rows, cellSize, offsetX, offsetY, rng) {
        const speedZones = [];

        // Speed zones start at level 16
        if (levelNum < 16) return speedZones;

        // Number of zones
        const numZones = Math.min(3, Math.floor((levelNum - 15) / 15) + 1);

        for (let i = 0; i < numZones; i++) {
            for (let attempt = 0; attempt < 15; attempt++) {
                const col = Math.floor(rng() * (cols - 1));
                const row = Math.floor(rng() * (rows - 1));

                const x = offsetX + col * cellSize;
                const y = offsetY + row * cellSize;

                // Check not too close to other zones
                let tooClose = false;
                for (const zone of speedZones) {
                    const dist = Math.sqrt((x - zone.x) ** 2 + (y - zone.y) ** 2);
                    if (dist < cellSize * 2) {
                        tooClose = true;
                        break;
                    }
                }
                if (tooClose) continue;

                // Alternate between speed boost and slow zones
                const isSlowZone = rng() > 0.5;

                speedZones.push({
                    x: Math.round(x),
                    y: Math.round(y),
                    width: cellSize,
                    height: cellSize,
                    type: isSlowZone ? 'slow' : 'fast',
                    multiplier: isSlowZone ? 0.4 : 2.0
                });
                break;
            }
        }

        return speedZones;
    }

    generateMovingWalls(levelNum, walls, rng) {
        const movingWalls = [];

        // Moving walls start at level 21
        if (levelNum < 21) return movingWalls;

        // Number of moving walls
        const numMoving = Math.min(3, Math.floor((levelNum - 20) / 15) + 1);

        // Get some walls that could move
        const candidateWalls = walls.filter(w =>
            w.width > 30 || w.height > 30
        );

        if (candidateWalls.length === 0) return movingWalls;

        // Shuffle and pick some
        for (let i = candidateWalls.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [candidateWalls[i], candidateWalls[j]] = [candidateWalls[j], candidateWalls[i]];
        }

        for (let i = 0; i < Math.min(numMoving, candidateWalls.length); i++) {
            const wall = candidateWalls[i];

            // Determine movement direction based on wall shape
            const isHorizontal = wall.width > wall.height;

            movingWalls.push({
                originalX: wall.x,
                originalY: wall.y,
                width: wall.width,
                height: wall.height,
                direction: isHorizontal ? 'vertical' : 'horizontal',
                range: 30 + Math.floor(rng() * 30),
                speed: 20 + Math.floor(rng() * 30),
                phase: rng() * Math.PI * 2
            });
        }

        return movingWalls;
    }
}
