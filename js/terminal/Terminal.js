import { TerminalUI } from './TerminalUI.js';
import { CommandHistory } from './CommandHistory.js';
import { CommandProcessor } from './CommandProcessor.js';

/**
 * Main terminal class that coordinates UI, command processing, and history.
 */
export class Terminal {
    /**
     * @param {HTMLElement} element - The terminal container element
     * @param {Object} commands - Available commands object
     * @param {Object} config - Configuration options
     * @param {string} [config.promptText='user:~$ '] - The prompt text to display
     */
    constructor(element, commands, config = {}) {
        this.ui = new TerminalUI(element, {
            promptText: config.promptText
        });
        
        this.history = new CommandHistory();
        
        this.processor = new CommandProcessor(commands, {
            onClear: () => this.ui.clear()
        });

        this.init();
    }

    /**
     * Initializes the terminal.
     */
    init() {
        // Display MOTD if available
        if (this.processor.hasCommand('motd')) {
            const motdOutput = this.processor.processCommand('motd');
            this.ui.displayOutput(motdOutput, 'motd');
        }

        // Create the first prompt
        this.createNewPrompt();
    }

    /**
     * Creates a new command prompt.
     */
    createNewPrompt() {
        this.ui.createPrompt((event, inputSpan) => this.handleInput(event, inputSpan));
    }

    /**
     * Handles keyboard input events.
     * @param {KeyboardEvent} event - The keyboard event
     * @param {HTMLElement} inputSpan - The input element
     */
    handleInput(event, inputSpan) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.handleCommand(inputSpan);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            const previousCommand = this.history.navigateUp();
            if (previousCommand !== null) {
                inputSpan.textContent = previousCommand;
                this.ui.placeCaretAtEnd(inputSpan);
            }
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            const nextCommand = this.history.navigateDown();
            if (nextCommand !== null) {
                inputSpan.textContent = nextCommand;
                this.ui.placeCaretAtEnd(inputSpan);
            }
        }
    }

    /**
     * Handles command execution.
     * @param {HTMLElement} inputSpan - The input element containing the command
     */
    handleCommand(inputSpan) {
        const command = inputSpan.textContent.trim();
        
        // Replace the prompt with a static command line
        this.ui.replacePromptWithCommand(inputSpan, command);

        // Process the command
        const output = this.processor.processCommand(command);
        
        // Display the output if any
        if (output) {
            this.ui.displayOutput(output);
        }

        // Add to history if not empty
        this.history.addCommand(command);

        // Create a new prompt
        this.createNewPrompt();
    }

    /**
     * Adds a new command to the terminal.
     * @param {string} name - The command name
     * @param {Function} handler - The command handler function
     */
    addCommand(name, handler) {
        this.processor.addCommand(name, handler);
    }

    /**
     * Removes a command from the terminal.
     * @param {string} name - The command name to remove
     */
    removeCommand(name) {
        this.processor.removeCommand(name);
    }

    /**
     * Gets the command history.
     * @returns {string[]} Array of command history
     */
    getHistory() {
        return this.history.getHistory();
    }

    /**
     * Clears the terminal.
     */
    clear() {
        this.ui.clear();
        this.createNewPrompt();
    }
}