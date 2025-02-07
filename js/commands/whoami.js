import Command from './Command.js';

/**
 * Command that displays information about the website's author
 */
export default class WhoamiCommand extends Command {
  constructor() {
    super('whoami', 'Display information about me');
  }

  execute() {
    return "Hi, I'm Michael Wood";
  }
}