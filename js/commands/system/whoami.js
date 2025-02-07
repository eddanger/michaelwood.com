/**
 * @fileoverview Whoami command implementation for displaying personal welcome.
 */

import Command from '../Command.js';

/**
 * Command for displaying personal welcome message.
 */
export default class WhoamiCommand extends Command {
    /**
     * Creates a new WhoamiCommand instance.
     */
    constructor() {
        super('whoami', 'Display welcome message');
    }

    /**
     * Executes the whoami command.
     * @returns {string} Welcome message
     */
    execute() {
        return "Hi, I'm Michael Wood, this is my website - thanks for visiting!";
    }
}