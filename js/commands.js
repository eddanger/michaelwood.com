import MotdCommand from "./commands/motd.js";
import UptimeCommand from "./commands/uptime.js";
import WhoamiCommand from "./commands/whoami.js";
import PwdCommand from "./commands/pwd.js";
import ExitCommand from "./commands/exit.js";
import GitHubCommand from "./commands/github.js";
import DateCommand from "./commands/date.js";
import ClearCommand from "./commands/clear.js";
import TerminalCommand from "./commands/terminal/TerminalCommand.js";

// Create command instances
const commandInstances = {
    motd: new MotdCommand(),
    exit: new ExitCommand(),
    github: new GitHubCommand(),
    pwd: new PwdCommand(),
    whoami: new WhoamiCommand(),
    date: new DateCommand(),
    uptime: new UptimeCommand(),
    terminal: new TerminalCommand(),
    clear: new ClearCommand()
};

// Export commands as functions that call execute()
export const availableCommands = {
    ...Object.entries(commandInstances).reduce((acc, [name, cmd]) => ({
        ...acc,
        [name]: (terminal, ...args) => cmd.execute(terminal, ...args)
    }), {}),
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