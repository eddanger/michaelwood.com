import Command from './Command.js';

export default class ClearCommand extends Command {
    constructor() {
        super('clear', 'Clear the terminal screen');
    }

    execute(terminal) {
        terminal.ui.clear();
        return '';
    }
}