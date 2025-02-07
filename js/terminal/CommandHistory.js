/**
 * @fileoverview Manages command history for terminal instances.
 * Provides navigation through previous commands.
 */

/**
 * Manages command history for a terminal instance.
 * Provides functionality to store and navigate through command history.
 */
export class CommandHistory {
    /**
     * Creates a new CommandHistory instance.
     */
    constructor() {
        /** @type {string[]} Array of command history entries */
        this.history = [];
        
        /** @type {number} Current position in history when navigating */
        this.currentIndex = -1;
    }

    /**
     * Adds a command to the history.
     * @param {string} command - The command to add
     */
    add(command) {
        this.history.push(command);
        this.currentIndex = this.history.length;
    }

    /**
     * Gets the previous command in history.
     * @returns {string|null} The previous command or null if at start
     */
    getPrevious() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            return this.history[this.currentIndex];
        }
        return null;
    }

    /**
     * Gets the next command in history.
     * @returns {string|null} The next command or null if at end
     */
    getNext() {
        if (this.currentIndex < this.history.length - 1) {
            this.currentIndex++;
            return this.history[this.currentIndex];
        }
        return null;
    }

    /**
     * Clears the command history.
     */
    clear() {
        this.history = [];
        this.currentIndex = -1;
    }
}