/**
 * @fileoverview Core terminal implementation providing command execution,
 * history management, and process integration.
 */

import { TerminalUI } from './TerminalUI.js';
import { CommandHistory } from './CommandHistory.js';
import { CommandProcessor } from './CommandProcessor.js';
import { TerminalCommand } from './TerminalCommand.js';
import MotdCommand from '../commands/system/motd.js';
import UptimeCommand from '../commands/system/uptime.js';
import WhoamiCommand from '../commands/system/whoami.js';
import PwdCommand from '../commands/filesystem/pwd.js';
import ExitCommand from '../commands/process/exit.js';
import GitHubCommand from '../commands/navigation/github.js';
import DateCommand from '../commands/system/date.js';
import ClearCommand from '../commands/terminal/clear.js';

/**
 * Terminal class that handles command execution, history, and process management.
 * Each terminal instance maintains its own state, command history, and UI.
 */
export class Terminal {
    /**
     * Creates a new Terminal instance.
     * @param {HTMLElement} container - The DOM element to render the terminal in
     */
    constructor(container) {
        // Initialize UI with custom prompt
        this.ui = new TerminalUI(container, {
            promptText: 'michaelwood:~$ '
        });

        // Initialize command history
        this.history = new CommandHistory();

        // Initialize commands
        const commandInstances = {
            "motd": new MotdCommand(),
            "exit": new ExitCommand(),
            "github": new GitHubCommand(),
            "pwd": new PwdCommand(),
            "whoami": new WhoamiCommand(),
            "date": new DateCommand(),
            "uptime": new UptimeCommand(),
            "terminal": new TerminalCommand(),
            "clear": new ClearCommand(),
        };

        // Create help command
        const commands = {
            ...commandInstances,
            help: () => {
                const cmds = Object.keys(commandInstances).sort();
                let output = "Available commands:\n";
                cmds.forEach(cmd => {
                    const command = commandInstances[cmd];
                    output += `  ${command.getName()} - ${command.getDescription()}\n`;
                });
                return output;
            }
        };

        // Wrap each command's execute method with terminal context
        Object.keys(commandInstances).forEach(cmd => {
            const command = commandInstances[cmd];
            commands[cmd] = (terminal) => command.execute(terminal);
        });

        // Initialize command processor
        this.processor = new CommandProcessor(commands);

        // Get process manager reference
        this.processManager = window.processManager;

        this.initialize();
    }

    /**
     * Initializes the terminal by displaying MOTD and creating the first prompt.
     * @private
     */
    initialize() {
        // Display MOTD if available
        if (this.processor.hasCommand('motd')) {
            const motd = this.processor.execute('motd', this);
            this.ui.displayOutput(motd);
        }

        // Create initial prompt
        this.createPrompt();
    }

    /**
     * Creates a new command prompt and sets up input handlers.
     * @private
     */
    createPrompt() {
        const inputSpan = this.ui.createPrompt((event, input) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.handleCommand(input);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                const previous = this.history.getPrevious();
                if (previous) input.textContent = previous;
            } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                const next = this.history.getNext();
                input.textContent = next || '';
            }
        });
    }

    /**
     * Handles command execution and output display.
     * @param {HTMLElement} inputSpan - The input element containing the command
     * @private
     */
    handleCommand(inputSpan) {
        const command = inputSpan.textContent.trim();

        if (!command) {
            this.createPrompt();
            return;
        }

        this.history.add(command);
        this.ui.replacePromptWithCommand(inputSpan, command);

        try {
            const output = this.processor.execute(command, this);
            if (output) {
                this.ui.displayOutput(output);
            }
        } catch (error) {
            this.ui.displayOutput(`Error executing command: ${error.message}`);
        }

        // Only create new prompt if we're still active (not terminated)
        if (this.processManager.getProcess(this.processManager.getActiveProcessId()) === this) {
            this.createPrompt();
        }
    }
}