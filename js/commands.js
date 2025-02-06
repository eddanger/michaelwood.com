import motd from "./commands/motd.js";

export const availableCommands = {
  "motd": motd,
  "exit": function() {
    window.close();
    return "Bye...";
  },
  "github": function() {
    window.open("https://github.com/eddanger", "_blank");
    return "Opening GitHub...";
  },
  "pwd": function() {
    return "https://michaelwood.com";
  },
  "whoami": function() {
    return "Hi, I'm Michael Wood";
  },
  "su": function() {
    return "Permission denied: Superuser mode is not available on this terminal.";
  },
  "date": function() {
    return new Date().toString();
  },
  "uptime": function() {
    // Calculate uptime since November 22, 1977 (starting at midnight)
    const startDate = new Date("1977-11-22T00:00:00");
    const now = new Date();
    const diffMs = now - startDate; // difference in milliseconds

    // Convert milliseconds to seconds, minutes, hours, days.
    const totalSeconds = Math.floor(diffMs / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours   = Math.floor(totalMinutes / 60);
    const days         = Math.floor(totalHours / 24);
    const hours        = totalHours % 24;
    const minutes      = totalMinutes % 60;
    const seconds      = totalSeconds % 60;

    return `Uptime since November 22, 1977: ${days} days, ${hours} hours, ${minutes} minutes, and ${seconds} seconds.`;
  }
};

// Now add the "help" command so it programmatically lists all available commands.
availableCommands.help = function() {
  const cmds = Object.keys(availableCommands).sort();
  let output = "Available commands:\n";
  cmds.forEach(cmd => {
    output += "  " + cmd + "\n";
  });
  return output;
};

