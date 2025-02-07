export class CommandProcessor {
    constructor(commands) {
        this.commands = commands;
    }

    hasCommand(command) {
        return command in this.commands;
    }

    execute(input, terminal) {
        const [command, ...args] = input.trim().split(/\s+/);

        if (!command) {
            return '';
        }

        if (command === 'help') {
            return this.commands.help();
        }

        if (!this.hasCommand(command)) {
            return `Command not found: ${command}`;
        }

        try {
            return this.commands[command](terminal, ...args);
        } catch (error) {
            return `Error executing command: ${error.message}`;
        }
    }
}