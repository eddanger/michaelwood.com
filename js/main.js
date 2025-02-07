import { Terminal } from "./terminal/Terminal.js";
import { ProcessManager } from "./ProcessManager.js";

// Initialize ProcessManager
window.processManager = new ProcessManager();

// Create initial terminal process
window.processManager.launchProcess((container) => {
    return new Terminal(container);
});