const AbstractFileWriter = require('./index');

class MultiFileWriter {
    
    /**
     * @type {Array<AbstractFileWriter>}
     */
    #fileWriter = []

    /**
     * @type {(string) => void}
     */
    #callback

    /**
     * @type {string}
     */
    #filePath

    /**
     * 
     * @param {onCompletion?: (string) => void} onCompletion 
     */
    constructor(filePath, onCompletion) {
        this.#callback = onCompletion;
        this.#filePath = filePath;
    }

    #areAllWriteComplete() {
        for (let writer of this.#fileWriter) {
            if (!writer.isCompleted) {
                return;
            }
        }
        console.log('File Writing complete');
        this.#callback();
    }

    /**
     * 
     * @param {T} fileWriter 
     * @param {ConstructorParameters<T>} constructorParams
     */
    addFileWriter(fileWriter, constructorParams) {
        constructorParams[1].onCompletion = this.#areAllWriteComplete.bind(this);
        this.#fileWriter.push(new fileWriter(...constructorParams));
    }


    /**
     * 
     * @param {AbstractFileWriter} fileWriter 
     */
    removeFileWriter(fileWriter) {
        this.#fileWriter = this.#fileWriter.filter((element) => element !== fileWriter);
    }


    /**
     * @param {Blob} blob
     */
    write(blob) {
        this.#fileWriter.forEach(writer => writer.write(blob));
    }

    async writeAllChunks() {
        const promiseArray = [];
        this.#fileWriter.forEach(writer => {
            promiseArray.push(writer.writeAllChunks());
        });
        await Promise.all(promiseArray);
        console.log('File Writing Complete');
    }

    setWriteComplete() {
        this.#fileWriter.forEach(writer => writer.setWriteComplete());
    }
}

module.exports = MultiFileWriter;