/**
 * @fileoverview Handles all DOM-related operations for the terminal interface.
 * Manages input handling, display, and visual feedback.
 */

/**
 * Handles all DOM-related operations for the terminal interface.
 * Manages terminal display, input handling, and visual feedback.
 */
export class TerminalUI {
    /**
     * Creates a new TerminalUI instance.
     * @param {HTMLElement} terminalElement - The terminal container element
     * @param {Object} config - Configuration options
     * @param {string} [config.promptText='user:~$ '] - The prompt text to display
     */
    constructor(terminalElement, config = {}) {
        if (!terminalElement) {
            throw new Error('Terminal element is required');
        }
        this.terminal = terminalElement;
        this.terminal.classList.add('terminal');
        this.config = {
            promptText: 'user:~$ ',
            ...config
        };

        // Initialize event handlers
        this.initializeEventHandlers();
    }

    /**
     * Initialize all event handlers for the terminal.
     * @private
     */
    initializeEventHandlers() {
        // Handle clicks on the terminal container
        this.terminal.addEventListener('click', (event) => {
            // Only handle clicks directly on the terminal container
            if (event.target === this.terminal) {
                const currentInput = this.terminal.querySelector('.cmd-input');
                if (currentInput) {
                    this.placeCaretAtEnd(currentInput);
                }
            }
        });

        // Handle focus events
        this.terminal.addEventListener('focusin', (event) => {
            if (event.target.classList.contains('cmd-input')) {
                const promptLine = event.target.closest('.prompt-line');
                if (promptLine) {
                    promptLine.classList.add('active');
                }
            }
        });

        this.terminal.addEventListener('focusout', (event) => {
            if (event.target.classList.contains('cmd-input')) {
                const promptLine = event.target.closest('.prompt-line');
                if (promptLine) {
                    promptLine.classList.remove('active');
                }
            }
        });

        // Prevent focus loss and handle special keys
        document.addEventListener('keydown', (event) => {
            const activeInput = this.terminal.querySelector('.cmd-input:focus');
            if (activeInput) {
                if (event.key === 'Tab') {
                    event.preventDefault();
                } else if (event.key === 'l' && event.ctrlKey) {
                    event.preventDefault();
                    this.clear();
                }
            }
        });
    }

    /**
     * Places the caret at the end of a contentEditable element.
     * @param {HTMLElement} el - The element to place the caret in
     * @private
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
     * Creates a new prompt line with input handling.
     * @param {Function} inputHandler - Callback for handling input events
     * @returns {HTMLElement} The input element
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
        inputSpan.spellcheck = false;
        inputSpan.autocomplete = 'off';
        inputSpan.autocapitalize = 'off';

        promptLine.appendChild(promptText);
        promptLine.appendChild(inputSpan);
        this.terminal.appendChild(promptLine);

        // Force reflow to ensure proper rendering
        this.terminal.offsetHeight;

        this.terminal.scrollTop = this.terminal.scrollHeight;
        this.placeCaretAtEnd(inputSpan);

        // Attach the input handler
        if (inputHandler) {
            inputSpan.addEventListener('keydown', (event) => inputHandler(event, inputSpan));
        }

        return inputSpan;
    }

    /**
     * Displays output in the terminal.
     * @param {string} output - The text to display
     * @param {string} [className=''] - Optional CSS class for styling
     */
    displayOutput(output, className = '') {
        if (output) {
            const outputLine = document.createElement('div');
            if (className) {
                outputLine.className = className;
            }
            outputLine.textContent = output;
            this.terminal.appendChild(outputLine);
            this.terminal.scrollTop = this.terminal.scrollHeight;
        }
    }

    /**
     * Replaces the current input line with a static command line.
     * @param {HTMLElement} inputSpan - The input element to replace
     * @param {string} command - The command text to display
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
}