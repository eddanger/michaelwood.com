import Command from './Command.js';

export default class ExitCommand extends Command {
    constructor() {
        super('exit', 'Say goodbye and get on with your day');
    }

    execute(terminal) {
        const processManager = terminal.processManager;
        const currentProcessId = processManager.getActiveProcessId();

        if (currentProcessId) {
            const result = processManager.terminateProcess(currentProcessId);
            if (result.shouldReload) {
                window.location.reload();
            } else if (result.parentProcess) {
                result.parentProcess.ui.displayOutput('Process terminated.');
                result.parentProcess.createPrompt();
            }
        }

        return '';
    }
}