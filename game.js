// Matter.js module aliases
const Engine = Matter.Engine;
const Render = Matter.Render;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body;
const Constraint = Matter.Constraint;
const Composite = Matter.Composite;
const Mouse = Matter.Mouse;
const MouseConstraint = Matter.MouseConstraint;
const Events = Matter.Events;

// Game state
let engine;
let render;
let world;
let canvas;
let blocks = [];
let constraints = [];
let ground;
let walls = [];
let blockCount = 20;
let canDropBlock = true;
let dropCooldown = 500; // ms

// Block properties
const BLOCK_WIDTH = 60;
const BLOCK_HEIGHT = 30;
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

// Initialize the game
function init() {
  canvas = document.getElementById("game-canvas");

  // Set canvas size
  const width = window.innerWidth;
  const height = window.innerHeight - 60; // Account for score panel
  canvas.width = width;
  canvas.height = height;

  // Create engine
  engine = Engine.create({
    gravity: {
      x: 0,
      y: 1,
    },
  });
  world = engine.world;

  // Create renderer
  render = Render.create({
    canvas: canvas,
    engine: engine,
    options: {
      width: width,
      height: height,
      wireframes: false,
      background: "#1a1a2e",
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

  // Handle window resize
  window.addEventListener("resize", handleResize);

  // Run the engine
  Engine.run(engine);
  Render.run(render);

  // Update physics to make blocks more bouncy/jelly-like
  engine.timing.timeScale = 1;
}

// Create initial tower of blocks
function createInitialTower() {
  const centerX = canvas.width / 2;
  const startY = canvas.height - 40;
  const numBlocks = 20;

  for (let i = 0; i < numBlocks; i++) {
    const x = centerX + (Math.random() - 0.5) * 5; // Slight random offset
    const y = startY - i * BLOCK_HEIGHT;

    createBlock(x, y, true);
  }

  updateBlockCount();
}

// Create a single soft/jelly block
function createBlock(x, y, isInitial = false) {
  const color = BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];

  // Create a compound body with multiple segments for jelly effect
  const segmentWidth = BLOCK_WIDTH / 5;
  const segments = [];
  const segmentConstraints = [];

  // Create 5 segments
  for (let i = 0; i < 5; i++) {
    const segX = x - BLOCK_WIDTH / 2 + segmentWidth / 2 + i * segmentWidth;
    const segment = Bodies.rectangle(segX, y, segmentWidth, BLOCK_HEIGHT, {
      density: 0.001,
      friction: 0.8,
      restitution: 0.3,
      render: {
        fillStyle: color,
      },
    });
    segments.push(segment);
  }

  // Add segments to world
  World.add(world, segments);

  // Connect segments with soft constraints for jelly effect
  for (let i = 0; i < segments.length - 1; i++) {
    const constraint = Constraint.create({
      bodyA: segments[i],
      bodyB: segments[i + 1],
      stiffness: 0.5,
      damping: 0.1,
      length: 0,
      render: {
        visible: false,
      },
    });
    segmentConstraints.push(constraint);
    World.add(world, constraint);
  }

  // Add vertical constraints to maintain height
  for (let i = 0; i < segments.length; i++) {
    // Create invisible anchor points for vertical stability
    const topAnchor = { x: segments[i].position.x, y: y - BLOCK_HEIGHT / 2 };
    const bottomAnchor = { x: segments[i].position.x, y: y + BLOCK_HEIGHT / 2 };

    const topConstraint = Constraint.create({
      bodyA: segments[i],
      pointA: { x: 0, y: -BLOCK_HEIGHT / 2 },
      pointB: topAnchor,
      stiffness: 0.3,
      damping: 0.05,
      render: {
        visible: false,
      },
    });

    segmentConstraints.push(topConstraint);
    World.add(world, topConstraint);
  }

  // Store block data
  const block = {
    segments: segments,
    constraints: segmentConstraints,
    color: color,
    isLinked: isInitial,
  };

  blocks.push(block);

  // Link blocks that are touching
  if (!isInitial) {
    setTimeout(() => linkNearbyBlocks(block), 100);
  }
}

// Link blocks when they touch
function linkNearbyBlocks(newBlock) {
  const linkDistance = BLOCK_HEIGHT * 1.5;

  newBlock.segments.forEach((newSegment) => {
    blocks.forEach((existingBlock) => {
      if (existingBlock === newBlock || !existingBlock.isLinked) return;

      existingBlock.segments.forEach((existingSegment) => {
        const distance = Math.sqrt(
          Math.pow(newSegment.position.x - existingSegment.position.x, 2) +
            Math.pow(newSegment.position.y - existingSegment.position.y, 2)
        );

        if (distance < linkDistance) {
          // Create a link between touching blocks
          const link = Constraint.create({
            bodyA: newSegment,
            bodyB: existingSegment,
            stiffness: 0.4,
            damping: 0.1,
            render: {
              visible: false,
            },
          });

          World.add(world, link);
          newBlock.constraints.push(link);
          newBlock.isLinked = true;
        }
      });
    });
  });
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
  const y = 50;

  createBlock(x, y, false);
  blockCount++;
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
  const width = window.innerWidth;
  const height = window.innerHeight - 60;

  canvas.width = width;
  canvas.height = height;

  render.options.width = width;
  render.options.height = height;
  render.canvas.width = width;
  render.canvas.height = height;

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
