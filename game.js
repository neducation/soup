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

// Tower configuration
const TOWER_ROWS = 5;
const TOWER_COLS = 4;

// Calculate optimal block size based on screen
function calculateBlockSize(screenWidth) {
  // Make blocks fit nicely on screen - aim for ~80% of width for the tower
  const availableWidth = screenWidth * 0.8;
  const blockSize = Math.floor(availableWidth / TOWER_COLS);

  // Clamp between reasonable min/max for mobile
  return Math.max(40, Math.min(blockSize, 80));
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

  // Add touch/click event
  canvas.addEventListener("touchstart", handleTap, { passive: false });
  canvas.addEventListener("click", handleTap);

  // Handle window resize and orientation change
  window.addEventListener("resize", handleResize);
  window.addEventListener("orientationchange", () => {
    setTimeout(handleResize, 100);
  });

  // Run the engine
  Engine.run(engine);
  Render.run(render);
}

// Create initial tower of blocks in a wall/pyramid formation
function createInitialTower() {
  const centerX = canvas.width / 2;
  const startY = canvas.height - 30; // Start just above ground

  // Create a 4x5 wall of blocks (4 wide, 5 tall)
  for (let row = 0; row < TOWER_ROWS; row++) {
    for (let col = 0; col < TOWER_COLS; col++) {
      const x =
        centerX - ((TOWER_COLS - 1) * BLOCK_SIZE) / 2 + col * BLOCK_SIZE;
      const y = startY - row * BLOCK_SIZE;

      createBlock(x, y);
    }
  }

  updateBlockCount();
}

// Create a single solid square block (1:1 ratio)
function createBlock(x, y) {
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
      lineWidth: 2,
    },
  });

  World.add(world, block);
  blocks.push(block);
  blockCount++;
}

// Handle tap/click to drop block
function handleTap(event) {
  event.preventDefault();

  if (!canDropBlock) return;

  let x;
  if (event.type === "touchstart") {
    x = event.touches[0].clientX;
  } else {
    x = event.clientX;
  }

  // Drop block from top of screen at tap position
  const y = BLOCK_SIZE / 2;

  createBlock(x, y);
  updateBlockCount();

  // Cooldown to prevent spam
  canDropBlock = false;
  setTimeout(() => {
    canDropBlock = true;
  }, dropCooldown);
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
