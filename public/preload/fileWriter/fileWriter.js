const fs = require('fs');
const logger = require('electron-log');
const path = require('path');
const console = logger;

class FileWriter {

    /**
     * @type {string}
     */
    #filePath

    /**
     * @type {fs.WriteStream}
     */
    #fileStream

    /**
     * @type {Array<Blob>}
     */
    #arrayOfBlobToWrite

    /**
     * @type {boolean}
     */
    #writeComplete


    /**
     * @type {{ onCompletion?: (string) => void, intervalInSec: number }}
     */
    #config

    /**
     * @type {NodeJS.Timeout}
     */
    #interval

    /**
     * @type {boolean}
     */
    #currentlyProcessing

    /**
     * 
     * @param {string} fileName 
     * @param {{ onCompletion?: (string) => void }} config
     */
    constructor(filePath, config ) {
        this.#currentlyProcessing = false;
        this.#writeComplete = false;
        this.#filePath = filePath;
        this.#arrayOfBlobToWrite = [];
        this.#fileStream = fs.createWriteStream(this.#filePath);
        this.#config = {...config, intervalInSec: 1};
        this.#startWriter(this.#config.intervalInSec);
        
        if (!fs.existsSync(path.join(filePath, '../'))) {
            fs.mkdirSync(path.join(filePath, '../'));
        }

    }

    get isComplete() {
        return this.#fileStream.closed;
    }
    
    /**
     * 
     * @param {Blob} blob 
     */
    write(blob) {
        if (this.#writeComplete) {
            throw new Error('Writing not allowed after complete signal is given');
        }
        this.#arrayOfBlobToWrite.push(blob);
    }

    /**
     * 
     * @param {number} intervalInSec
     */
    #startWriter(intervalInSec) {
        this.#interval = setInterval(async () => {
            try {
                if (this.#currentlyProcessing) {
                    return false;
                }
                this.#currentlyProcessing = true;
                const toWrite = this.#arrayOfBlobToWrite.shift();
                if (toWrite) {
                    this.#writeToFile(toWrite);
                }
                if (!toWrite && this.#writeComplete) {
                    clearInterval(this.#interval);
                    this.#fileStream.end();
                    this.#config?.onCompletion(this.#filePath);
                }
            } catch (error) {
                console.log(error);
            } finally {
                this.#currentlyProcessing = false;
            }
        }, intervalInSec);
    }

    /**
     * 
     * @param {Blob} data 
     */
    async #writeToFile(data) {
        const arrayBuffer = await data.arrayBuffer(); 
        this.#fileStream.write(Buffer.from(arrayBuffer));
    }

    setWriteComplete() {
        this.#writeComplete = true;
    }

    async writeAllChunks() {
        await new Promise((resolve) => {
            clearInterval(this.#interval);
            const handler = () => {
                if (this.#currentlyProcessing) {
                    console.log('Currently Processing fileWriter: ', this.#currentlyProcessing);
                }
                resolve();
                
            }
            handler();
            setInterval(() => {
                handler()
            }, 100);
        })
        while(true) {
            try {
                const toWrite = this.#arrayOfBlobToWrite.shift();
                if (!toWrite) {
                    break;
                } 
                await this.#writeToFile(toWrite);
            } catch (error) {
                console.log(error);
            }
        }
        this.#startWriter(this.#config.intervalInSec);
    }
}

module.exports = FileWriter