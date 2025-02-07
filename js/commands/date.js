import Command from './Command.js';

/**
 * Command that displays the current date and time
 */
export default class DateCommand extends Command {
  constructor() {
    super('date', 'Display the current date and time');
  }

  execute() {
    return new Date().toString();
  }
}