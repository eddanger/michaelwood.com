/**
 * Base Command class that all terminal commands should inherit from
 */
export default class Command {
  constructor(name, description = '') {
    this.name = name;
    this.description = description;
  }

  /**
   * Execute the command and return its output
   * @returns {string} The command output
   */
  execute() {
    throw new Error('Command must implement execute() method');
  }

  /**
   * Get the command name
   * @returns {string} The command name
   */
  getName() {
    return this.name;
  }

  /**
   * Get the command description
   * @returns {string} The command description
   */
  getDescription() {
    return this.description;
  }
}