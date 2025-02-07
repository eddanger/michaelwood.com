/**
 * @fileoverview Date command implementation for displaying current date and time.
 */

import Command from '../Command.js';

/**
 * Command for displaying current date and time.
 */
export default class DateCommand extends Command {
    /**
     * Creates a new DateCommand instance.
     */
    constructor() {
        super('date', 'Display current date and time');
    }

    /**
     * Executes the date command.
     * @returns {string} Current date and time
     */
    execute() {
        return new Date().toString();
    }
}