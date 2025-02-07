/**
 * Handles all DOM-related operations for the terminal interface.
 */
export class TerminalUI {
    /**
     * @param {HTMLElement} terminalElement - The terminal container element
     * @param {Object} config - Configuration options
     * @param {string} [config.promptText='user:~$ '] - The prompt text to display
     */
    constructor(terminalElement, config = {}) {
        this.terminal = terminalElement;
        this.config = {
            promptText: 'user:~$ ',
            ...config
        };
        this.bindTerminalClick();
    }

    /**
     * Helper function to place the caret at the end of a contentEditable element.
     */
    placeCaretAtEnd(el) {
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
     * Creates a new prompt line with a blinking caret.
     */
    createPrompt(inputHandler) {
        const promptLine = document.createElement('div');
        promptLine.className = 'prompt-line';

        // Static prompt text
        const promptText = document.createElement('span');
        promptText.className = 'prompt-text';
        promptText.textContent = this.config.promptText;

        // Editable input span for the command
        const inputSpan = document.createElement('span');
        inputSpan.className = 'cmd-input';
        inputSpan.contentEditable = true;

        promptLine.appendChild(promptText);
        promptLine.appendChild(inputSpan);
        this.terminal.appendChild(promptLine);
        this.terminal.scrollTop = this.terminal.scrollHeight;
        inputSpan.focus();

        // Attach the input handler
        if (inputHandler) {
            inputSpan.addEventListener('keydown', (event) => inputHandler(event, inputSpan));
        }

        return inputSpan;
    }

    /**
     * Displays output in the terminal with an optional className.
     */
    displayOutput(output, className = '') {
        if (output) {
            const outputLine = document.createElement('div');
            if (className) {
                outputLine.className = className;
            }
            outputLine.textContent = output;
            this.terminal.appendChild(outputLine);
        }
    }

    /**
     * Replaces the current input line with a static command line.
     */
    replacePromptWithCommand(inputSpan, command) {
        const commandLine = document.createElement('div');
        commandLine.textContent = this.config.promptText + command;
        const currentLine = inputSpan.parentElement;
        this.terminal.replaceChild(commandLine, currentLine);
    }

    /**
     * Clears the terminal content.
     */
    clear() {
        this.terminal.innerHTML = "";
    }

    /**
     * Binds the terminal click event to focus the current input.
     */
    bindTerminalClick() {
        this.terminal.addEventListener('click', () => {
            const currentInput = document.querySelector('.cmd-input');
            if (currentInput) {
                currentInput.focus();
            }
        });
    }
}