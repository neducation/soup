// Matter.js module aliases
const Engine = Matter.Engine;
const Render = Matter.Render;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body;
const Composite = Matter.Composite;
const Events = Matter.Events;

// Game state
let engine;
let render;
let world;
let canvas;
let blocks = [];
let ground;
let walls = [];
let blockCount = 0;
let canDropBlock = true;
let dropCooldown = 300; // ms
let score = 0;
let highScore = 0;
let combo = 0;
let targetHeight = 0;
let gameStarted = false;
let fallenBlocksSet = new Set();
let cleanupInterval;
let towerCenterX;
let towerGroundY;
let nextBlockId = 0;

// Block properties - will be calculated based on screen size
let BLOCK_SIZE;
const BLOCK_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#FFA07A",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E2",
];

// Tower configuration - more blocks, smaller size
const TOWER_ROWS = 8;
const TOWER_COLS = 6;

// Calculate optimal block size based on screen
function calculateBlockSize(screenWidth) {
  // Much smaller blocks - aim for blocks to be ~20-30px
  const availableWidth = screenWidth * 0.6;
  const blockSize = Math.floor(availableWidth / TOWER_COLS);

  // Smaller clamp range for tiny blocks
  return Math.max(20, Math.min(blockSize, 35));
}

// Initialize the game
function init() {
  canvas = document.getElementById("game-canvas");
  const scorePanel = document.getElementById("score-panel");

  // Get accurate dimensions
  const width = window.innerWidth;
  const scorePanelHeight = scorePanel.offsetHeight;
  const height = window.innerHeight - scorePanelHeight;

  // Set canvas size with proper pixel ratio
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";

  // Calculate block size based on screen
  BLOCK_SIZE = calculateBlockSize(width);

  // Create engine with better physics settings
  engine = Engine.create({
    gravity: {
      x: 0,
      y: 0.8, // Slightly reduced gravity for better control
    },
  });

  world = engine.world;

  // Better physics settings
  engine.positionIterations = 10;
  engine.velocityIterations = 8;

  // Create renderer
  render = Render.create({
    canvas: canvas,
    engine: engine,
    options: {
      width: width,
      height: height,
      wireframes: false,
      background: "#1a1a2e",
      pixelRatio: 1, // Handle pixel ratio manually
    },
  });

  // Create ground
  ground = Bodies.rectangle(width / 2, height - 10, width, 20, {
    isStatic: true,
    render: {
      fillStyle: "#16213e",
    },
  });

  // Create walls
  const wallThickness = 20;
  const leftWall = Bodies.rectangle(10, height / 2, wallThickness, height, {
    isStatic: true,
    render: {
      fillStyle: "#16213e",
    },
  });

  const rightWall = Bodies.rectangle(
    width - 10,
    height / 2,
    wallThickness,
    height,
    {
      isStatic: true,
      render: {
        fillStyle: "#16213e",
      },
    }
  );

  walls = [leftWall, rightWall];

  World.add(world, [ground, ...walls]);

  // Create initial tower
  createInitialTower();

  // Load high score
  highScore = parseInt(localStorage.getItem("towerHighScore") || "0");
  updateScore();

  // Add touch/click event with better iOS handling
  canvas.addEventListener("touchstart", handleTap, { passive: false });
  canvas.addEventListener("click", handleTap);

  // Prevent default touch behaviors on iOS
  document.body.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
    },
    { passive: false }
  );

  document.body.addEventListener(
    "touchstart",
    (e) => {
      if (e.target === canvas) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  // Handle window resize and orientation change
  window.addEventListener("resize", handleResize);
  window.addEventListener("orientationchange", () => {
    setTimeout(handleResize, 100);
  });

  // Check for fallen blocks
  Events.on(engine, "afterUpdate", checkFallenBlocks);

  // Start cleanup interval to remove fallen blocks - run more frequently
  cleanupInterval = setInterval(cleanupFallenBlocks, 1000);

  // Draw tower zone guide
  Events.on(render, "afterRender", drawTowerZone);

  // Run the engine
  Engine.run(engine);
  Render.run(render);
}

// Create initial tower of blocks in a wall/pyramid formation
function createInitialTower() {
  const centerX = canvas.width / 2;
  const startY = canvas.height - 30; // Start just above ground

  // Store tower reference points
  towerCenterX = centerX;
  towerGroundY = startY;

  // Create a 6x8 wall of blocks (6 wide, 8 tall)
  for (let row = 0; row < TOWER_ROWS; row++) {
    for (let col = 0; col < TOWER_COLS; col++) {
      const x =
        centerX - ((TOWER_COLS - 1) * BLOCK_SIZE) / 2 + col * BLOCK_SIZE;
      const y = startY - row * BLOCK_SIZE;

      createBlock(x, y, true);
    }
  }

  // Calculate target height (top of tower + buffer)
  targetHeight = startY - TOWER_ROWS * BLOCK_SIZE - 50;

  updateBlockCount();
}

// Create a single solid square block (1:1 ratio)
function createBlock(x, y, isInitial = false) {
  const color = BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];

  const block = Bodies.rectangle(x, y, BLOCK_SIZE, BLOCK_SIZE, {
    density: 0.0008,
    friction: 0.6,
    restitution: 0.2,
    frictionAir: 0.01,
    slop: 0.05,
    render: {
      fillStyle: color,
      strokeStyle: "#000",
      lineWidth: 1,
    },
  });

  // Add custom properties
  block.customId = nextBlockId++;
  block.isInitial = isInitial;
  block.createdAt = Date.now();
  block.scored = false;
  block.markedForRemoval = false;

  World.add(world, block);
  blocks.push(block);

  if (!isInitial) {
    blockCount++;
  }

  return block;
}

// Handle tap/click to drop block
function handleTap(event) {
  event.preventDefault();
  event.stopPropagation();

  if (!canDropBlock) return;

  gameStarted = true;

  let x;
  if (event.type === "touchstart") {
    x = event.touches[0].clientX;
  } else {
    x = event.clientX;
  }

  // Drop block from top of screen at tap position
  const y = BLOCK_SIZE / 2;
  const newBlock = createBlock(x, y, false);

  // Track when block lands for scoring
  let hasLanded = false;
  let landCheckCount = 0;
  const landCheck = setInterval(() => {
    // Check if block still exists
    if (!blocks.includes(newBlock)) {
      clearInterval(landCheck);
      return;
    }

    landCheckCount++;
    if ((newBlock.speed < 0.5 && !hasLanded) || landCheckCount > 50) {
      hasLanded = true;
      clearInterval(landCheck);
      if (landCheckCount <= 50) {
        calculateScore(newBlock);
      }
    }
  }, 100);

  updateBlockCount();

  // Cooldown to prevent spam
  canDropBlock = false;
  setTimeout(() => {
    canDropBlock = true;
  }, dropCooldown);
}

// Calculate score based on block placement
function calculateScore(block) {
  if (block.scored) return; // Already scored this block
  block.scored = true;

  const blockY = block.position.y;
  const blockX = block.position.x;

  // Define tower area (center zone)
  const towerWidth = TOWER_COLS * BLOCK_SIZE * 1.5;
  const towerLeft = towerCenterX - towerWidth / 2;
  const towerRight = towerCenterX + towerWidth / 2;

  // Check if block is in the tower zone and not at ground level
  const isInTowerZone = blockX >= towerLeft && blockX <= towerRight;
  const isAboveGround = blockY < towerGroundY - BLOCK_SIZE;

  if (isInTowerZone && isAboveGround) {
    // Height bonus - higher placement = more points
    const heightScore = Math.max(0, Math.floor((canvas.height - blockY) / 10));

    // Accuracy bonus - closer to center = more points
    const distanceFromCenter = Math.abs(blockX - towerCenterX);
    const accuracyScore = Math.max(
      0,
      Math.floor((100 - distanceFromCenter) / 5)
    );

    // Stack combo - consecutive successful placements
    combo++;
    const comboMultiplier = Math.min(combo, 10);

    const earnedPoints = (heightScore + accuracyScore) * comboMultiplier;
    score += earnedPoints;

    // Show score popup
    if (earnedPoints > 0) {
      showScorePopup(blockX, blockY, earnedPoints);
    }
  } else {
    // Block fell outside tower zone - reset combo but don't penalize
    combo = 0;
  }

  updateScore();
}

// Show floating score popup
function showScorePopup(x, y, points) {
  const popup = document.createElement("div");
  popup.className = "score-popup";
  popup.textContent = `+${points}`;
  popup.style.left = x + "px";
  popup.style.top = y + "px";
  document.body.appendChild(popup);

  setTimeout(() => {
    popup.remove();
  }, 1000);
}

// Check for blocks that have fallen off screen or to the sides
function checkFallenBlocks() {
  if (!towerCenterX || !towerGroundY) return;

  const towerWidth = TOWER_COLS * BLOCK_SIZE * 1.5;
  const towerLeft = towerCenterX - towerWidth / 2;
  const towerRight = towerCenterX + towerWidth / 2;

  blocks.forEach((block) => {
    // Skip initial tower blocks
    if (block.isInitial) return;

    const isOutsideTowerZone =
      block.position.x < towerLeft - BLOCK_SIZE ||
      block.position.x > towerRight + BLOCK_SIZE;
    const isLow = block.position.y > towerGroundY - BLOCK_SIZE;
    const isFallenOff = block.position.y > canvas.height + 50;
    const isWayOutside =
      block.position.x < -100 || block.position.x > canvas.width + 100;

    // Mark blocks that have fallen to the sides or off screen
    if ((isOutsideTowerZone && isLow) || isFallenOff || isWayOutside) {
      if (!block.markedForRemoval) {
        block.markedForRemoval = true;
        block.removalMarkedAt = Date.now();
        fallenBlocksSet.add(block.customId);
      }
    }
  });
}

// Clean up fallen blocks periodically
function cleanupFallenBlocks() {
  const now = Date.now();
  const blocksToRemove = [];

  blocks.forEach((block) => {
    // Don't remove initial tower blocks
    if (block.isInitial) return;

    // Remove blocks marked for removal after 2 seconds
    if (block.markedForRemoval) {
      const timeSinceMarked = now - block.removalMarkedAt;
      if (timeSinceMarked > 2000) {
        blocksToRemove.push(block);
      }
    }

    // Always remove blocks way off screen immediately
    if (
      block.position.y > canvas.height + 300 ||
      block.position.x < -200 ||
      block.position.x > canvas.width + 200
    ) {
      blocksToRemove.push(block);
    }
  });

  // Remove blocks from world and array
  blocksToRemove.forEach((block) => {
    try {
      World.remove(world, block);
      const index = blocks.indexOf(block);
      if (index > -1) {
        blocks.splice(index, 1);
      }
      fallenBlocksSet.delete(block.customId);
    } catch (e) {
      console.log("Error removing block:", e);
    }
  });

  // Debug log
  if (blocksToRemove.length > 0) {
    console.log(
      `Removed ${blocksToRemove.length} blocks. Total blocks: ${blocks.length}`
    );
  }
}

// Draw tower zone guide
function drawTowerZone() {
  if (!towerCenterX || !towerGroundY) return;

  const context = render.context;
  const towerWidth = TOWER_COLS * BLOCK_SIZE * 1.5;
  const towerLeft = towerCenterX - towerWidth / 2;

  // Draw subtle zone indicator
  context.strokeStyle = "rgba(102, 126, 234, 0.3)";
  context.lineWidth = 2;
  context.setLineDash([5, 5]);
  context.beginPath();
  context.moveTo(towerLeft, towerGroundY);
  context.lineTo(towerLeft, 0);
  context.moveTo(towerLeft + towerWidth, towerGroundY);
  context.lineTo(towerLeft + towerWidth, 0);
  context.stroke();
  context.setLineDash([]);

  // Fade out blocks marked for removal
  blocks.forEach((block) => {
    if (block.markedForRemoval) {
      const timeSinceMarked = Date.now() - block.removalMarkedAt;
      const fadeProgress = Math.min(timeSinceMarked / 2000, 1);
      const opacity = 1 - fadeProgress * 0.7; // Fade to 30% opacity

      // Update block render opacity
      block.render.opacity = opacity;
    }
  });
}

// Update score display
function updateScore() {
  document.getElementById("score-value").textContent = score;
  document.getElementById("combo-value").textContent =
    combo > 1 ? `x${combo}` : "";

  if (score > highScore) {
    highScore = score;
    localStorage.setItem("towerHighScore", highScore);
  }
  document.getElementById("high-score-value").textContent = highScore;
}

// Update block count display
function updateBlockCount() {
  document.getElementById("block-count").textContent = blockCount;
}

// Handle window resize
function handleResize() {
  const scorePanel = document.getElementById("score-panel");
  const width = window.innerWidth;
  const scorePanelHeight = scorePanel.offsetHeight;
  const height = window.innerHeight - scorePanelHeight;

  canvas.width = width;
  canvas.height = height;
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";

  render.options.width = width;
  render.options.height = height;
  render.canvas.width = width;
  render.canvas.height = height;

  // Recalculate block size
  BLOCK_SIZE = calculateBlockSize(width);

  // Update ground and walls
  Body.setPosition(ground, { x: width / 2, y: height - 10 });
  Body.setVertices(ground, [
    { x: 0, y: height - 20 },
    { x: width, y: height - 20 },
    { x: width, y: height },
    { x: 0, y: height },
  ]);

  Body.setPosition(walls[0], { x: 10, y: height / 2 });
  Body.setPosition(walls[1], { x: width - 10, y: height / 2 });
}

// Start the game when page loads
window.addEventListener("load", init);
