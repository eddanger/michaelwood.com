/**
 * @fileoverview Github command implementation for opening GitHub profile.
 */

import Command from '../Command.js';

/**
 * Command for opening GitHub profile in a new tab.
 */
export default class GitHubCommand extends Command {
    /**
     * Creates a new GitHubCommand instance.
     */
    constructor() {
        super('github', 'Open GitHub profile');
    }

    /**
     * Executes the github command.
     * @returns {string} Success message
     */
    execute() {
        window.open('https://github.com/eddanger', '_blank');
        return 'Opening GitHub profile...';
    }
}