import { TerminalUI } from './TerminalUI.js';
import { CommandHistory } from './CommandHistory.js';
import { CommandProcessor } from './CommandProcessor.js';
import MotdCommand from '../commands/motd.js';
import UptimeCommand from '../commands/uptime.js';
import WhoamiCommand from '../commands/whoami.js';
import PwdCommand from '../commands/pwd.js';
import ExitCommand from '../commands/exit.js';
import GitHubCommand from '../commands/github.js';
import DateCommand from '../commands/date.js';
import Command from '../commands/Command.js';

// Define Terminal Command class inline
class TerminalCommand extends Command {
    constructor() {
        super('terminal', 'Spawn a new terminal process');
    }

    execute(terminal) {
        // Create terminal process launcher
        const createTerminal = (container) => {
            // Create new terminal instance with same commands
            const newTerminal = new Terminal(container);
            newTerminal.processManager = terminal.processManager;
            return newTerminal;
        };

        // Launch new terminal process with current process as parent
        const currentProcessId = terminal.processManager.getActiveProcessId();
        terminal.processManager.launchProcess(createTerminal, currentProcessId);
        return "New terminal process created.";
    }
}

export class Terminal {
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

        // Wrap each command's execute method
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