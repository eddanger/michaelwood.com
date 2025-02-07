/**
 * Handles command processing and execution for the terminal.
 */
export class CommandProcessor {
    /**
     * @param {Object} commands - Object containing available commands
     * @param {Object} config - Configuration options
     * @param {Function} [config.onClear] - Callback function for clear command
     */
    constructor(commands, config = {}) {
        this.commands = commands;
        this.config = {
            onClear: () => {},
            ...config
        };
    }

    /**
     * Process the entered command and return the output.
     * @param {string} input - The command input to process
     * @returns {string} The command output or error message
     */
    processCommand(input) {
        const cmd = input.trim();
        
        if (cmd === "") {
            return "";
        }

        // Special handling for clear command
        if (cmd === "clear") {
            this.config.onClear();
            return "";
        }

        // Execute the command if it exists
        if (this.commands.hasOwnProperty(cmd)) {
            try {
                return this.commands[cmd]();
            } catch (error) {
                return `Error executing command: ${error.message}`;
            }
        }

        return `command not found: ${cmd}\nType help to list available commands.`;
    }

    /**
     * Checks if a command exists.
     * @param {string} command - The command to check
     * @returns {boolean} Whether the command exists
     */
    hasCommand(command) {
        return this.commands.hasOwnProperty(command.trim());
    }

    /**
     * Gets the list of available commands.
     * @returns {string[]} Array of available command names
     */
    getAvailableCommands() {
        return Object.keys(this.commands);
    }

    /**
     * Adds a new command to the available commands.
     * @param {string} name - The command name
     * @param {Function} handler - The command handler function
     */
    addCommand(name, handler) {
        if (typeof handler !== 'function') {
            throw new Error('Command handler must be a function');
        }
        this.commands[name] = handler;
    }

    /**
     * Removes a command from the available commands.
     * @param {string} name - The command name to remove
     */
    removeCommand(name) {
        delete this.commands[name];
    }
}