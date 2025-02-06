import motd from "./commands/motd.js";
import uptime from "./commands/uptime.js";
import whoami from "./commands/whoami.js";
import pwd from "./commands/pwd.js";
import exit from "./commands/exit.js";
import github from "./commands/github.js";
import date from "./commands/date.js";

export const availableCommands = {
  "motd": motd,
  "exit": exit, 
  "github": github,
  "pwd": pwd,
  "whoami": whoami,
  "date": date,
  "uptime": uptime,
}

availableCommands.help = function() {
  const cmds = Object.keys(availableCommands).sort();
  let output = "Available commands:\n";
  cmds.forEach(cmd => {
    output += "  " + cmd + "\n";
  });
  return output;
};

