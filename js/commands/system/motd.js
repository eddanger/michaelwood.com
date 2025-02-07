/**
 * @fileoverview Message of the day command with ASCII art and random jokes.
 */

import Command from '../Command.js';

/**
 * Command for displaying message of the day with ASCII art and random content.
 */
export default class MotdCommand extends Command {
    /**
     * Creates a new MotdCommand instance.
     */
    constructor() {
        super('motd', 'Display message of the day');
        this.asciiArts = [
            `
███▄ ▄███▓ ██▓ ▄████▄   ██░ ██  ▄▄▄      ▓█████  ██▓        █     █░ ▒█████   ▒█████  ▓█████▄
▓██▒▀█▀ ██▒▓██▒▒██▀ ▀█  ▓██░ ██▒▒████▄    ▓█   ▀ ▓██▒       ▓█░ █ ░█░▒██▒  ██▒▒██▒  ██▒▒██▀ ██▌
▓██    ▓██░▒██▒▒▓█    ▄ ▒██▀▀██░▒██  ▀█▄  ▒███   ▒██░       ▒█░ █ ░█ ▒██░  ██▒▒██░  ██▒░██   █▌
▒██    ▒██ ░██░▒▓▓▄ ▄██▒░▓█ ░██ ░██▄▄▄▄██ ▒▓█  ▄ ▒██░       ░█░ █ ░█ ▒██   ██░▒██   ██░░▓█▄   ▌
▒██▒   ░██▒░██░▒ ▓███▀ ░░▓█▒░██▓ ▓█   ▓██▒░▒████▒░██████▒   ░░██▒██▓ ░ ████▓▒░░ ████▓▒░░▒████▓
░ ▒░   ░  ░░▓  ░ ░▒ ▒  ░ ▒ ░░▒░▒ ▒▒   ▓▒█░░░ ▒░ ░░ ▒░▓  ░   ░ ▓░▒ ▒  ░ ▒░▒░▒░ ░ ▒░▒░▒░  ▒▒▓  ▒
░  ░      ░ ▒ ░  ░  ▒    ▒ ░▒░ ░  ▒   ▒▒ ░ ░ ░  ░░ ░ ▒  ░     ▒ ░ ░    ░ ▒ ▒░   ░ ▒ ▒░  ░ ▒  ▒
░      ░    ▒ ░░         ░  ░░ ░  ░   ▒      ░     ░ ░        ░   ░  ░ ░ ░ ▒  ░ ░ ░ ▒   ░ ░  ░
       ░    ░  ░ ░       ░  ░  ░      ░  ░   ░  ░    ░  ░       ░        ░ ░      ░ ░     ░
               ░                                                                        ░
`,
            `
███╗   ███╗██╗ ██████╗██╗  ██╗ █████╗ ███████╗██╗         ██╗    ██╗ ██████╗  ██████╗ ██████╗
████╗ ████║██║██╔════╝██║  ██║██╔══██╗██╔════╝██║         ██║    ██║██╔═══██╗██╔═══██╗██╔══██╗
██╔████╔██║██║██║     ███████║███████║█████╗  ██║         ██║ █╗ ██║██║   ██║██║   ██║██║  ██║
██║╚██╔╝██║██║██║     ██╔══██║██╔══██║██╔══╝  ██║         ██║███╗██║██║   ██║██║   ██║██║  ██║
██║ ╚═╝ ██║██║╚██████╗██║  ██║██║  ██║███████╗███████╗    ╚███╔███╔╝╚██████╔╝╚██████╔╝██████╔╝
╚═╝     ╚═╝╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝     ╚══╝╚══╝  ╚═════╝  ╚═════╝ ╚═════╝
`,
            String.raw`
 _____ ______   ___  ________  ___  ___  ________  _______   ___               ___       __   ________  ________  ________
|\   _ \  _   \|\  \|\   ____\|\  \|\  \|\   __  \|\  ___ \ |\  \             |\  \     |\  \|\   __  \|\   __  \|\   ___ \
\ \  \\\__\ \  \ \  \ \  \___|\ \  \\\  \ \  \|\  \ \   __/|\ \  \            \ \  \    \ \  \ \  \|\  \ \  \|\  \ \  \_|\ \
 \ \  \\|__| \  \ \  \ \  \    \ \   __  \ \   __  \ \  \_|/_\ \  \            \ \  \  __\ \  \ \  \\\  \ \  \\\  \ \  \ \\ \
  \ \  \    \ \  \ \  \ \  \____\ \  \ \  \ \  \ \  \ \  \_|\ \ \  \____        \ \  \|\__\_\  \ \  \\\  \ \  \\\  \ \  \_\\ \
   \ \__\    \ \__\ \__\ \_______\ \__\ \__\ \__\ \__\ \_______\ \_______\       \ \____________\ \_______\ \_______\ \_______\
    \|__|     \|__|\|__|\|_______|\|__|\|__|\|__|\|__|\|_______|\|_______|        \|____________|\|_______|\|_______|\|_______|
 `
        ];

        this.jokes = [
            "Why do programmers prefer dark mode? Because light attracts bugs!",
            "What's a programmer's favorite place? The Terminal-ator!",
            "Why did the developer go broke? Because he used up all his cache!",
            "What do you call a programmer from Finland? Nerdic!",
            "Why do programmers always mix up Halloween and Christmas? Because Oct 31 == Dec 25!"
        ];
    }

    /**
     * Gets a random item from an array.
     * @param {Array} arr - Array to pick from
     * @returns {*} Random item from array
     * @private
     */
    getRandomItem(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    /**
     * Executes the motd command.
     * @returns {string} Message of the day with ASCII art and random joke
     */
    execute() {
        const art = this.getRandomItem(this.asciiArts);
        const joke = this.getRandomItem(this.jokes);

        return `${art}\n\nWelcome to my website!\nType 'help' to see available commands.\n\nToday's random nerdy joke:\n${joke}`;
    }
}