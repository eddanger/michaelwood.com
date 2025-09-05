// Infinite pixel grid
const viewport = document.getElementById('viewport');
const grid = document.getElementById('grid');

let offsetX = 0;
let offsetY = 0;
const pixelSize = 20; // Change this value to adjust pixel block size (e.g., 10, 20, 50, 100)
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

// Store pixel data: Map<`${x},${y}`, color>
const pixelData = new Map();

// Creature
let creature = null;
let creatureInterval = null;
const CREATURE_EMOJIS = ['🐛', '🐞', '🐜', '🦋', '🐝', '🐌', '🦗'];
let currentEmoji = '🐛';
let eatenCount = 0;
let creatureSize = 16;
let defaultStreak = 0;

// Get viewport dimensions
function getViewportSize() {
  return {
    width: window.innerWidth,
    height: window.innerHeight
  };
}

// Convert screen coordinates to grid coordinates
function screenToGrid(screenX, screenY) {
  const gridX = Math.floor((screenX + offsetX) / pixelSize);
  const gridY = Math.floor((screenY + offsetY) / pixelSize);
  return { gridX, gridY };
}

// Convert grid coordinates to screen coordinates
function gridToScreen(gridX, gridY) {
  const screenX = gridX * pixelSize - offsetX;
  const screenY = gridY * pixelSize - offsetY;
  return { screenX, screenY };
}

// Generate random color
function getRandomColor() {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 70 + Math.floor(Math.random() * 30);
  const lightness = 40 + Math.floor(Math.random() * 30);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}



// Fade a color by reducing lightness
function fadeColor(color, factor) {
  // Assuming color is hsl(hue, sat%, light%)
  const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (match) {
    const hue = match[1];
    const sat = match[2];
    const light = Math.max(10, match[3] * factor); // Minimum 10% lightness
    return `hsl(${hue}, ${sat}%, ${light}%)`;
  }
  return color;
}

// Start creature movement
function startCreatureMovement() {
  creatureInterval = setInterval(() => {
    if (!creature) return;

    // Move to random adjacent tile
    const directions = [
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 }
    ];
    const dir = directions[Math.floor(Math.random() * directions.length)];
    const newX = creature.x + dir.dx;
    const newY = creature.y + dir.dy;

    // Move
    creature.x = newX;
    creature.y = newY;

    // Eat tiles based on creature size
    const eatRadius = Math.floor((creatureSize - 16) / 40) + 1; // Start with 1, increase with size
    let hadColor = false;
    for (let dx = -eatRadius; dx <= eatRadius; dx++) {
      for (let dy = -eatRadius; dy <= eatRadius; dy++) {
        const eatX = newX + dx;
        const eatY = newY + dy;
        const key = `${eatX},${eatY}`;
        if (pixelData.has(key)) {
          hadColor = true;
          pixelData.delete(key);
          eatenCount++;
          creatureSize += 1; // Grow 1px per eat
        }
      }
    }

    if (pixelData.size === 0) {
      // Disappear when no pixels left
      clearInterval(creatureInterval);
      creature = null;
      eatenCount = 0;
      creatureSize = 16;
      defaultStreak = 0;
    }

    keepCreatureInView();
    updateVisiblePixels();
  }, 500); // Move every 0.5 seconds
}

// Keep creature in view
function keepCreatureInView() {
  if (!creature) return;
  const { width, height } = getViewportSize();
  const creatureScreenX = creature.x * pixelSize - offsetX;
  const creatureScreenY = creature.y * pixelSize - offsetY;

  const margin = 100;
  if (creatureScreenX < margin) {
    offsetX = creature.x * pixelSize - margin;
  } else if (creatureScreenX > width - margin) {
    offsetX = creature.x * pixelSize - (width - margin);
  }
  if (creatureScreenY < margin) {
    offsetY = creature.y * pixelSize - margin;
  } else if (creatureScreenY > height - margin) {
    offsetY = creature.y * pixelSize - (height - margin);
  }
}

// Create explosion pattern around clicked pixel
function createExplosion(centerX, centerY) {
  const explosionRadius = 5; // Slightly bigger
  const affectedPixels = [];

  // Create circular explosion pattern
  for (let radius = 0; radius <= explosionRadius; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        // Only include pixels on the current radius (circular pattern)
        if (Math.abs(dx) + Math.abs(dy) === radius || radius === 0) {
          const gridX = centerX + dx;
          const gridY = centerY + dy;
          const key = `${gridX},${gridY}`;

          // Random chance to affect pixel (decreases with distance)
          const distance = Math.sqrt(dx * dx + dy * dy);
          const chance = Math.max(0.1, 1 - (distance / explosionRadius) * 0.7);

          if (Math.random() < chance) {
            affectedPixels.push({ gridX, gridY, key, distance });
          }
        }
      }
    }
  }

  // Spawn creature on first click
  if (!creature && affectedPixels.length > 0) {
    const randomIndex = Math.floor(Math.random() * affectedPixels.length);
    const spawnPixel = affectedPixels[randomIndex];
    creature = { x: spawnPixel.gridX, y: spawnPixel.gridY };
    currentEmoji = CREATURE_EMOJIS[Math.floor(Math.random() * CREATURE_EMOJIS.length)];
    startCreatureMovement();
  }

  // Apply colors to affected pixels, fading with distance
  affectedPixels.forEach(({ gridX, gridY, key, distance }) => {
    const baseColor = getRandomColor();
    const fadeFactor = 1 - (distance / explosionRadius);
    const fadedColor = fadeColor(baseColor, fadeFactor);
    pixelData.set(key, fadedColor);
  });

  // Add random fingers shooting out farther
  const numFingers = 3 + Math.floor(Math.random() * 3); // 3-5 fingers
  for (let i = 0; i < numFingers; i++) {
    const angle = Math.random() * 2 * Math.PI;
    const fingerLength = explosionRadius + 2 + Math.floor(Math.random() * 3); // 2-4 extra
    for (let r = explosionRadius + 1; r <= fingerLength; r++) {
      const dx = Math.round(Math.cos(angle) * r);
      const dy = Math.round(Math.sin(angle) * r);
      const gridX = centerX + dx;
      const gridY = centerY + dy;
      const key = `${gridX},${gridY}`;
      const distance = r;
      const fadeFactor = Math.max(0.2, 1 - (distance / (explosionRadius * 2)));
      const baseColor = getRandomColor();
      const fadedColor = fadeColor(baseColor, fadeFactor);
      pixelData.set(key, fadedColor);
    }
  }

  // Update display
  updateVisiblePixels();
}

// Update visible pixels
function updateVisiblePixels() {
  const { width, height } = getViewportSize();

  // Calculate visible grid range
  const startGridX = Math.floor(offsetX / pixelSize) - 1;
  const endGridX = Math.floor((offsetX + width) / pixelSize) + 1;
  const startGridY = Math.floor(offsetY / pixelSize) - 1;
  const endGridY = Math.floor((offsetY + height) / pixelSize) + 1;

  // Clear existing pixels
  grid.innerHTML = '';

  // Create visible pixels
  for (let gridY = startGridY; gridY <= endGridY; gridY++) {
    for (let gridX = startGridX; gridX <= endGridX; gridX++) {
      const { screenX, screenY } = gridToScreen(gridX, gridY);

      const pixel = document.createElement('div');
      pixel.className = 'pixel';
      pixel.style.left = `${screenX}px`;
      pixel.style.top = `${screenY}px`;

      // Set color from data or default
      const key = `${gridX},${gridY}`;
      let color = pixelData.get(key) || '#333';
      let text = '';

      // Show creature
      if (creature && creature.x === gridX && creature.y === gridY) {
        // Make div larger for big creature
        const size = Math.max(pixelSize, creatureSize);
        pixel.style.width = `${size}px`;
        pixel.style.height = `${size}px`;
        pixel.style.left = `${screenX - (size - pixelSize) / 2}px`;
        pixel.style.top = `${screenY - (size - pixelSize) / 2}px`;
        pixel.style.zIndex = '1000'; // On top
        pixel.style.background = 'none';
        pixel.style.border = 'none';
        pixel.textContent = currentEmoji;
        pixel.style.display = 'flex';
        pixel.style.alignItems = 'center';
        pixel.style.justifyContent = 'center';
        pixel.style.fontSize = `${creatureSize}px`;
      } else {
        pixel.style.width = `${pixelSize}px`;
        pixel.style.height = `${pixelSize}px`;
        pixel.style.zIndex = '1';
        pixel.style.background = color;
        pixel.style.border = '1px solid #222';
        pixel.textContent = '';
      }

      // Add click handler
      pixel.addEventListener('click', () => {
        createExplosion(gridX, gridY);
      });

      grid.appendChild(pixel);
    }
  }
}

// Mouse event handlers
viewport.addEventListener('mousedown', (e) => {
  isDragging = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  viewport.style.cursor = 'grabbing';
});

viewport.addEventListener('mousemove', (e) => {
  if (isDragging) {
    const deltaX = e.clientX - lastMouseX;
    const deltaY = e.clientY - lastMouseY;

    offsetX -= deltaX;
    offsetY -= deltaY;

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    updateVisiblePixels();
  }
});

viewport.addEventListener('mouseup', () => {
  isDragging = false;
  viewport.style.cursor = 'grab';
});

viewport.addEventListener('mouseleave', () => {
  isDragging = false;
  viewport.style.cursor = 'grab';
});

// Initialize
viewport.style.cursor = 'grab';
updateVisiblePixels();

// Handle window resize
window.addEventListener('resize', updateVisiblePixels);

