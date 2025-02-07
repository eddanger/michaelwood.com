import Command from './Command.js';

/**
 * Command that attempts to close the browser window
 */
export default class ExitCommand extends Command {
  constructor() {
    super('exit', 'Say goodbye and get on with your day');
  }

  execute() {
    window.close();
    return "Bye...";
  }
}