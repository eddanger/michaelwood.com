/**
 * @fileoverview Uptime command implementation for displaying time since birth.
 */

import Command from '../Command.js';

/**
 * Command for displaying uptime since birth.
 */
export default class UptimeCommand extends Command {
    #startDate;

    /**
     * Creates a new UptimeCommand instance.
     */
    constructor() {
        super('uptime', 'Display the uptime since my birthday');
        this.#startDate = new Date("1977-11-22T00:00:00");
    }

    /**
     * Executes the uptime command.
     * @returns {string} Time since birth
     */
    execute() {
        const now = new Date();
        const diffMs = now - this.#startDate; // difference in milliseconds

        // Convert milliseconds to seconds, minutes, hours, days.
        const totalSeconds = Math.floor(diffMs / 1000);
        const totalMinutes = Math.floor(totalSeconds / 60);
        const totalHours   = Math.floor(totalMinutes / 60);
        const days         = Math.floor(totalHours / 24);
        const hours        = totalHours % 24;
        const minutes      = totalMinutes % 60;
        const seconds      = totalSeconds % 60;

        return `Uptime since November 22, 1977: ${days} days, ${hours} hours, ${minutes} minutes, and ${seconds} seconds.`;
    }
}