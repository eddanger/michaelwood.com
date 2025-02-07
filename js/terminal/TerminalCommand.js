/**
 * @fileoverview Terminal command implementation for spawning new terminal processes.
 */

import Command from '../commands/Command.js';
import { Terminal } from './Terminal.js';

/**
 * Command for creating new terminal processes.
 * Allows spawning of new terminal instances with proper process management.
 */
export class TerminalCommand extends Command {
    /**
     * Creates a new TerminalCommand instance.
     */
    constructor() {
        super('terminal', 'Spawn a new terminal process');
    }

    /**
     * Executes the terminal command to create a new terminal process.
     * @param {Terminal} terminal - The terminal instance executing the command
     * @returns {string} Success message
     */
    execute(terminal) {
        // Create terminal process launcher
        const createTerminal = (container) => {
            // Create new terminal instance with same commands
            const newTerminal = new Terminal(container);
            newTerminal.processManager = terminal.processManager;
            return newTerminal;
        };

        // Launch new terminal process with current process as parent
        const currentProcessId = terminal.processManager.getActiveProcessId();
        terminal.processManager.launchProcess(createTerminal, currentProcessId);
        return "New terminal process created.";
    }
}