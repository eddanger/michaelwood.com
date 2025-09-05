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



// Create explosion pattern around clicked pixel
function createExplosion(centerX, centerY) {
  const explosionRadius = 3; // 3 rings out
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
            affectedPixels.push({ gridX, gridY, key });
          }
        }
      }
    }
  }

  // Apply colors to affected pixels
  affectedPixels.forEach(({ gridX, gridY, key }) => {
    const color = getRandomColor();
    pixelData.set(key, color);
  });

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
      const color = pixelData.get(key) || '#333';
      pixel.style.background = color;

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

