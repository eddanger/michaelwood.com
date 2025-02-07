/**
 * @fileoverview Exit command implementation for terminating terminal processes.
 */

import Command from '../Command.js';

/**
 * Command for terminating terminal processes.
 * Handles process termination and parent process switching.
 */
export default class ExitCommand extends Command {
    /**
     * Creates a new ExitCommand instance.
     */
    constructor() {
        super('exit', 'Exit the current terminal process');
    }

    /**
     * Executes the exit command to terminate the current process.
     * @param {Terminal} terminal - The terminal instance executing the command
     * @returns {string} Empty string as process will be terminated
     */
    execute(terminal) {
        const processManager = terminal.processManager;
        const currentProcessId = processManager.getActiveProcessId();
        
        if (currentProcessId) {
            const result = processManager.terminateProcess(currentProcessId);
            if (result.shouldReload) {
                window.location.reload();
            } else if (result.parentProcess) {
                result.parentProcess.ui.displayOutput('Process terminated.');
                result.parentProcess.createPrompt();
            }
        }
        
        return '';
    }
}