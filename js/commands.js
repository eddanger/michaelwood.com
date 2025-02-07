import MotdCommand from "./commands/motd.js";
import UptimeCommand from "./commands/uptime.js";
import WhoamiCommand from "./commands/whoami.js";
import PwdCommand from "./commands/pwd.js";
import ExitCommand from "./commands/exit.js";
import GitHubCommand from "./commands/github.js";
import DateCommand from "./commands/date.js";

// Create instances of each command
const commandInstances = {
  "motd": new MotdCommand(),
  "exit": new ExitCommand(),
  "github": new GitHubCommand(),
  "pwd": new PwdCommand(),
  "whoami": new WhoamiCommand(),
  "date": new DateCommand(),
  "uptime": new UptimeCommand(),
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
  availableCommands[cmd] = function() {
    return command.execute();
  };
});