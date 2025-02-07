import Command from './Command.js';

/**
 * Command that displays the current website URL
 */
export default class PwdCommand extends Command {
  constructor() {
    super('pwd', 'What website am I on?');
  }

  execute() {
    return "https://michaelwood.com";
  }
}