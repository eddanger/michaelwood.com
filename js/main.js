/**
 * @fileoverview Main entry point for the terminal application.
 * Initializes process manager and creates the initial terminal process.
 */

import { Terminal } from "./terminal/Terminal.js";
import { ProcessManager } from "./process/ProcessManager.js";

// Initialize ProcessManager globally for process management
window.processManager = new ProcessManager();

// Create initial terminal process
window.processManager.launchProcess((container) => {
    return new Terminal(container);
});