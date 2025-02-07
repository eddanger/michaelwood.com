/**
 * @fileoverview Base command class that all terminal commands extend.
 * Provides common functionality and structure for commands.
 */

/**
 * Base class for all terminal commands.
 * Provides common functionality and structure that all commands should follow.
 * @abstract
 */
export default class Command {
    /**
     * Creates a new Command instance.
     * @param {string} name - The name of the command
     * @param {string} description - A brief description of what the command does
     */
    constructor(name, description) {
        if (new.target === Command) {
            throw new TypeError('Cannot instantiate abstract Command class directly');
        }
        
        /** @type {string} The name of the command */
        this.name = name;
        
        /** @type {string} Description of what the command does */
        this.description = description;
    }

    /**
     * Gets the command name.
     * @returns {string} The command name
     */
    getName() {
        return this.name;
    }

    /**
     * Gets the command description.
     * @returns {string} The command description
     */
    getDescription() {
        return this.description;
    }

    /**
     * Executes the command.
     * @param {Terminal} terminal - The terminal instance executing the command
     * @param {...string} args - Command arguments
     * @returns {string} Command output
     * @abstract
     */
    execute(terminal, ...args) {
        throw new Error('Command subclass must implement execute() method');
    }
}