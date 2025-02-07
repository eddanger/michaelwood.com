import MotdCommand from "./commands/motd.js";
import UptimeCommand from "./commands/uptime.js";
import WhoamiCommand from "./commands/whoami.js";
import PwdCommand from "./commands/pwd.js";
import ExitCommand from "./commands/exit.js";
import GitHubCommand from "./commands/github.js";
import DateCommand from "./commands/date.js";
import Command from "./commands/Command.js";
import { Terminal } from "./terminal/Terminal.js";

// Define Terminal Command class inline
class TerminalCommand extends Command {
    constructor() {
        super('terminal', 'Spawn a new terminal process');
    }

    execute(terminal) {
        // Create terminal process launcher
        const createTerminal = (container) => {
            // Create new terminal instance with same commands
            const newTerminal = new Terminal(container, availableCommands);
            newTerminal.processManager = terminal.processManager;
            return newTerminal;
        };

        // Launch new terminal process
        terminal.processManager.launchProcess(createTerminal);
        return "New terminal process created.";
    }
}

// Create instances of each command
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

export const availableCommands = {
    ...commandInstances,
    help: function() {
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
    availableCommands[cmd] = function(terminal) {
        return command.execute(terminal);
    };
});