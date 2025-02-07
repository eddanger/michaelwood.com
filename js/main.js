import { availableCommands } from "./commands.js";
import { Terminal } from "./terminal/Terminal.js";

// Initialize the terminal with the terminal element, available commands, and configuration
const terminal = new Terminal(
    document.getElementById('terminal'),
    availableCommands,
    {
        promptText: 'michaelwood:~$ '
    }
);

// When the user clicks anywhere in the terminal, the terminal class will handle focusing the input
// through its UI component's click handler, so we don't need any additional click handling here