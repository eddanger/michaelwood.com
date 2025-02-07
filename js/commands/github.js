import Command from './Command.js';

/**
 * Command that opens the GitHub profile in a new tab
 */
export default class GitHubCommand extends Command {
  constructor() {
    super('github', 'Open GitHub profile in a new browser tab');
  }

  execute() {
    window.open("https://github.com/eddanger", "_blank");
    return "Opening GitHub...";
  }
}