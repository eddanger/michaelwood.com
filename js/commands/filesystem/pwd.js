/**
 * @fileoverview Print working directory command implementation.
 */

import Command from '../Command.js';

/**
 * Command for displaying current website URL.
 */
export default class PwdCommand extends Command {
    /**
     * Creates a new PwdCommand instance.
     */
    constructor() {
        super('pwd', 'Print current website URL');
    }

    /**
     * Executes the pwd command.
     * @returns {string} Current website URL
     */
    execute() {
        return 'https://michaelwood.com';
    }
}