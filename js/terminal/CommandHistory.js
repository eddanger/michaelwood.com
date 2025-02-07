/**
 * Manages command history and navigation for the terminal.
 */
export class CommandHistory {
    constructor() {
        this.history = [];
        this.historyIndex = -1;
    }

    /**
     * Adds a command to the history if it's not empty.
     * @param {string} command - The command to add to history
     */
    addCommand(command) {
        if (command.trim() !== "") {
            this.history.push(command);
            this.resetIndex();
        }
    }

    /**
     * Resets the history index to point after the last command.
     */
    resetIndex() {
        this.historyIndex = -1;
    }

    /**
     * Navigates up through command history.
     * @returns {string|null} The previous command or null if at the start
     */
    navigateUp() {
        if (this.history.length === 0) {
            return null;
        }

        // On first press, set the index to the last command
        if (this.historyIndex === -1) {
            this.historyIndex = this.history.length - 1;
        } else if (this.historyIndex > 0) {
            this.historyIndex--;
        }

        return this.history[this.historyIndex];
    }

    /**
     * Navigates down through command history.
     * @returns {string|null} The next command, empty string if at the end, or null if no history
     */
    navigateDown() {
        if (this.history.length === 0 || this.historyIndex === -1) {
            return null;
        }

        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            return this.history[this.historyIndex];
        } else {
            // If at the most recent command, clear the input
            this.resetIndex();
            return "";
        }
    }

    /**
     * Gets the current history as an array.
     * @returns {string[]} Array of command history
     */
    getHistory() {
        return [...this.history];
    }

    /**
     * Clears the command history.
     */
    clear() {
        this.history = [];
        this.resetIndex();
    }
}