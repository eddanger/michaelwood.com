/**
 * @fileoverview Clear command implementation for clearing terminal output.
 */

import Command from '../Command.js';

/**
 * Command for clearing terminal output.
 * Clears all content from the terminal display.
 */
export default class ClearCommand extends Command {
    /**
     * Creates a new ClearCommand instance.
     */
    constructor() {
        super('clear', 'Clear terminal output');
    }

    /**
     * Executes the clear command to clear terminal output.
     * @param {Terminal} terminal - The terminal instance executing the command
     * @returns {string} Empty string as terminal will be cleared
     */
    execute(terminal) {
        terminal.ui.clear();
        return '';
    }
}