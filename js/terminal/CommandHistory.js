export class CommandHistory {
    constructor() {
        this.history = [];
        this.currentIndex = -1;
    }

    add(command) {
        this.history.push(command);
        this.currentIndex = this.history.length;
    }

    getPrevious() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            return this.history[this.currentIndex];
        }
        return null;
    }

    getNext() {
        if (this.currentIndex < this.history.length - 1) {
            this.currentIndex++;
            return this.history[this.currentIndex];
        }
        return null;
    }

    clear() {
        this.history = [];
        this.currentIndex = -1;
    }
}