import { TerminalUI } from './TerminalUI.js';
import { CommandHistory } from './CommandHistory.js';
import { CommandProcessor } from './CommandProcessor.js';
import { availableCommands } from '../../commands.js';

export class Terminal {
    constructor(container) {
        // Initialize UI with custom prompt
        this.ui = new TerminalUI(container, {
            promptText: 'michaelwood:~$ '
        });

        // Initialize command history
        this.history = new CommandHistory();

        // Initialize command processor with available commands
        this.processor = new CommandProcessor(availableCommands);

        // Get process manager reference
        this.processManager = window.processManager;

        this.initialize();
    }

    initialize() {
        // Display MOTD if available
        if (this.processor.hasCommand('motd')) {
            const motd = this.processor.execute('motd', this);
            this.ui.displayOutput(motd);
        }

        // Create initial prompt
        this.createPrompt();
    }

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