/**
 * @fileoverview Handles command execution and management.
 * Processes user input and executes corresponding commands.
 */

/**
 * Processes and executes terminal commands.
 * Manages command registration and execution with proper error handling.
 */
export class CommandProcessor {
    /**
     * Creates a new CommandProcessor instance.
     * @param {Object.<string, Function>} commands - Map of command names to their handlers
     */
    constructor(commands) {
        /** @type {Object.<string, Function>} Map of available commands */
        this.commands = commands;
    }

    /**
     * Checks if a command exists.
     * @param {string} command - The command name to check
     * @returns {boolean} True if the command exists
     */
    hasCommand(command) {
        return command in this.commands;
    }

    /**
     * Executes a command with arguments.
     * @param {string} input - The full command input including arguments
     * @param {Terminal} terminal - The terminal instance executing the command
     * @returns {string} The command output
     * @throws {Error} If command execution fails
     */
    execute(input, terminal) {
        const [command, ...args] = input.trim().split(/\s+/);

        if (!command) {
            return '';
        }

        if (command === 'help') {
            return this.commands.help();
        }

        if (!this.hasCommand(command)) {
            return `Command not found: ${command}`;
        }

        try {
            return this.commands[command](terminal, ...args);
        } catch (error) {
            throw new Error(`Error executing command: ${error.message}`);
        }
    }
}