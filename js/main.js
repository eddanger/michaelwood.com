import { availableCommands } from "./commands.js";

const terminal = document.getElementById('terminal');

// Command history array and pointer
let commandHistory = [];
let historyIndex = -1;

/**
 * Helper function to place the caret at the end of a contentEditable element.
 */
function placeCaretAtEnd(el) {
  el.focus();
  if (typeof window.getSelection != "undefined" &&
      typeof document.createRange != "undefined") {
    let range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    let sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

/**
 * Displays the Message-of-the-Day (MOTD) at startup.
 */
function displayMOTD() {
  // Display the MOTD before creating the first prompt.
  const motdOutput = availableCommands.motd();
  const motdDiv = document.createElement('div');
  motdDiv.className = 'motd';
  motdDiv.textContent = motdOutput;
  terminal.appendChild(motdDiv);
}

/**
 * Process the entered command and return the output.
 * If the command isn’t found, output an error message and suggest typing "help".
 */
function processCommand(cmd) {
  cmd = cmd.trim();
  if (cmd === "") return "";

  // Special handling for clear
  if (cmd === "clear") {
    terminal.innerHTML = "";
    return "";
  }

  if (availableCommands.hasOwnProperty(cmd)) {
    return availableCommands[cmd]();
  }

  return "command not found: " + cmd + "\nType help to list available commands.";
}

/**
 * Creates a new prompt line with a blinking caret.
 */
function createPrompt() {
  const promptLine = document.createElement('div');
  promptLine.className = 'prompt-line';

  // Static prompt text
  const promptText = document.createElement('span');
  promptText.className = 'prompt-text';
  promptText.textContent = 'michaelwood:~$ ';

  // Editable input span for the command
  const inputSpan = document.createElement('span');
  inputSpan.className = 'cmd-input';
  inputSpan.contentEditable = true;

  promptLine.appendChild(promptText);
  promptLine.appendChild(inputSpan);
  terminal.appendChild(promptLine);
  terminal.scrollTop = terminal.scrollHeight;
  inputSpan.focus();

  // Attach our keydown handler, passing the input element
  inputSpan.addEventListener('keydown', (event) => handleInput(event, inputSpan));
  
  return inputSpan;
}

/**
 * Handles key events on the current input prompt.
 */
function handleInput(event, inputSpan) {
  if (event.key === 'Enter') {
    event.preventDefault(); // Prevent newline insertion.
    const command = inputSpan.textContent.trim();

    // Replace the prompt line with a static line showing the command.
    const commandLine = document.createElement('div');
    commandLine.textContent = 'michaelwood:~$ ' + command;
    const currentLine = inputSpan.parentElement;
    terminal.replaceChild(commandLine, currentLine);

    // Process the command and output any result.
    const output = processCommand(command);
    if (output) {
      const outputLine = document.createElement('div');
      outputLine.textContent = output;
      terminal.appendChild(outputLine);
    }

    // Add the command to history if it's not empty.
    if (command !== "") {
      commandHistory.push(command);
    }
    // Reset history index.
    historyIndex = -1;

    // Create a new prompt.
    createPrompt();

  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (commandHistory.length > 0) {
      // On first press, set the index to the last command.
      if (historyIndex === -1) {
        historyIndex = commandHistory.length - 1;
      } else if (historyIndex > 0) {
        historyIndex--;
      }
      inputSpan.textContent = commandHistory[historyIndex];
      placeCaretAtEnd(inputSpan);
    }
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (commandHistory.length > 0) {
      if (historyIndex === -1) {
        // Nothing to do if no history is selected.
      } else if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        inputSpan.textContent = commandHistory[historyIndex];
        placeCaretAtEnd(inputSpan);
      } else {
        // If at the most recent command, clear the input.
        historyIndex = -1;
        inputSpan.textContent = "";
      }
    }
  }
}

// When the user clicks anywhere in the terminal, refocus the input.
terminal.addEventListener('click', () => {
  const currentInput = document.querySelector('.cmd-input');
  if (currentInput) {
    currentInput.focus();
  }
});

displayMOTD();
// Start the terminal by creating the first prompt.
createPrompt();
