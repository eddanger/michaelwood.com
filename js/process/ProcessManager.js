/**
 * @fileoverview Process management system for handling multiple terminal instances.
 * Manages process creation, termination, and switching between processes.
 */

/**
 * Manages multiple processes and their lifecycle.
 * Handles process creation, termination, parent-child relationships,
 * and process switching.
 */
export class ProcessManager {
    /**
     * Creates a new ProcessManager instance.
     */
    constructor() {
        /** @type {Map<string, Object>} Map of process IDs to process instances */
        this.processes = new Map();
        
        /** @type {Map<string, string>} Map of process IDs to their parent process IDs */
        this.parentProcesses = new Map();
        
        /** @type {string|null} Currently active process ID */
        this.activeProcessId = null;
        
        /** @type {number} Counter for generating unique process IDs */
        this.lastProcessId = 0;
        
        /** @type {HTMLElement} Container element for all processes */
        this.processesContainer = document.getElementById('processes');
    }

    /**
     * Launches a new process.
     * @param {Function} processLauncher - Function that creates and returns the process
     * @param {string} [parentProcessId=null] - ID of the parent process
     * @returns {Object} The created process instance
     */
    launchProcess(processLauncher, parentProcessId = null) {
        // Create a new process container
        const processId = `process-${++this.lastProcessId}`;
        const container = document.createElement('div');
        container.id = processId;
        container.className = 'process';

        // Only hide if it's not the first process
        if (this.processes.size > 0) {
            container.style.display = 'none';
        }

        this.processesContainer.appendChild(container);

        // Launch the process
        const process = processLauncher(container);

        // Register the process and its parent
        this.processes.set(processId, process);
        if (parentProcessId || this.activeProcessId) {
            this.parentProcesses.set(processId, parentProcessId || this.activeProcessId);
        }

        // Switch to this process
        this.switchToProcess(processId);

        return process;
    }

    /**
     * Switches to a specific process.
     * @param {string} processId - The ID of the process to switch to
     */
    switchToProcess(processId) {
        if (!this.processes.has(processId)) return;

        // Hide all processes
        const allProcesses = this.processesContainer.querySelectorAll('.process');
        allProcesses.forEach(process => {
            process.style.display = 'none';
        });

        // Show and focus new process
        const container = document.getElementById(processId);
        if (container) {
            container.style.display = 'block';
            this.activeProcessId = processId;

            // Focus the input of the new active process
            const input = container.querySelector('.cmd-input');
            if (input) {
                input.focus();
                const range = document.createRange();
                range.selectNodeContents(input);
                range.collapse(false);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
    }

    /**
     * Terminates a process and switches to its parent if available.
     * @param {string} processId - The ID of the process to terminate
     * @returns {Object} Information about the termination
     */
    terminateProcess(processId) {
        if (!this.processes.has(processId)) return { shouldReload: false };

        // Get parent process before removing
        const parentProcessId = this.parentProcesses.get(processId);
        const parentProcess = parentProcessId ? this.processes.get(parentProcessId) : null;

        // Remove the process
        this.processes.delete(processId);
        this.parentProcesses.delete(processId);
        const container = document.getElementById(processId);
        if (container) {
            container.remove();
        }

        // If this was the last process, return true to trigger reload
        if (this.processes.size === 0) {
            return { shouldReload: true };
        }

        // Switch to parent process if available, otherwise to any remaining process
        if (parentProcess) {
            this.switchToProcess(parentProcessId);
            return { 
                shouldReload: false, 
                parentProcessId,
                parentProcess
            };
        } else {
            const nextProcessId = Array.from(this.processes.keys())[0];
            this.switchToProcess(nextProcessId);
            return { shouldReload: false };
        }
    }

    /**
     * Gets the active process ID.
     * @returns {string|null} The active process ID or null if none
     */
    getActiveProcessId() {
        return this.activeProcessId;
    }

    /**
     * Gets a process by its ID.
     * @param {string} processId - The process ID
     * @returns {Object|undefined} The process instance or undefined
     */
    getProcess(processId) {
        return this.processes.get(processId);
    }
}