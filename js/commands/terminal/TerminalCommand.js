import Command from "../Command.js";
import { Terminal } from "./Terminal.js";

export default class TerminalCommand extends Command {
    constructor() {
        super('terminal', 'Spawn a new terminal process');
    }

    execute(terminal) {
        // Create terminal process launcher
        const createTerminal = (container) => {
            // Create new terminal instance
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