const ffmpegPath = require('ffmpeg-static').path;
const ffmpeg_static = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked')
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const stream = require('stream');

ffmpeg.setFfmpegPath(ffmpeg_static)
ffmpeg.setFfprobePath(ffmpegPath);


class FileWriter {

    /**
     * @type {string}
     */
    #filePath

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
     * @type {ffmpeg.FfmpegCommand}
     */
    #ffmpegInstance

    /**
     * @type {stream.PassThrough}
     */
    #readableAndWriteableStream
    #ffmpegFailed = false
    

    /**
     * @type {boolean}
     */
    #ffmpegFinished = false

    /**
     * @param {string} filePath
     */
    static ffmpegTimeStampPath(filePath) {
        const extension = path.extname(filePath);
        return filePath.replace(`${extension}`, `-with-timestamp${extension}`);
    }

    /**
     * 
     * @param {string} fileName 
     * @param {{ startTime: number, onCompletion?: (string) => void }} config
     */
    constructor(filePath, config ) {
        this.#currentlyProcessing = false;
        this.#writeComplete = false;
        this.#filePath = filePath;
        this.#arrayOfBlobToWrite = [];
        this.#config = {...config, intervalInSec: 1};
        this.#startWriter(this.#config.intervalInSec);
        
        if (!fs.existsSync(path.join(filePath, '../'))) {
            fs.mkdirSync(path.join(filePath, '../'));
        }
        this.#readableAndWriteableStream = new stream.PassThrough();
        this.#ffmpegInstance = ffmpeg()
            .input(this.#readableAndWriteableStream)
            .inputOptions("-f webm")
            .videoFilter([
                {
                    filter: "drawtext",
                    options: {
                        text: `'%{pts\\:gmtime\\:${Math.floor((config.startTime /1000) + (5 * 60 + 30) * 60)}\\:%Y-%m-%d %I\\\\\\:%M\\\\\\:%S %p IST}'`,//\\:%Y-%m-%d //%I\\\\\\:%M\\\\\\:%S %p}",
                        fontcolor: "white",
                        fontsize: 24,
                        box: 1,
                        boxcolor: "0x00000088",
                        boxborderw:10,
                        x: 10,
                        y: 10
                    }
                }
            ])
            .output(FileWriter.ffmpegTimeStampPath(this.#filePath))
            .on('end',  ()  => {
                this.#ffmpegFinished = true;
                this.#config?.onCompletion(this.#filePath);

            })
            .on('error', async (error) => {
                try {
                    await fs.promises.rm(FileWriter.ffmpegTimeStampPath(this.#filePath));
                } catch (error) {
                }
                this.#ffmpegFailed = true;
                this.#readableAndWriteableStream.end();
                console.log('FFMPEG Failed shifting to default stream', error);
            }).run();
    }

    get isComplete() {
        return this.#ffmpegFailed || this.#ffmpegFinished;
    }

    /**
     * 
     * @param {Blob} data 
     */
    async #writeToFile(data) {
        const arrayBuffer = await data.arrayBuffer(); 
        this.#readableAndWriteableStream.write(Buffer.from(arrayBuffer));
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
                    await this.#writeToFile(toWrite);
                }
                if (this.#writeComplete && !toWrite) {
                    clearInterval(this.#interval);
                    this.#readableAndWriteableStream.end();
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
     * @param {Blob} blob 
     */
    write(blob) {
        console.log('Writing to ffmpeg');
        if (this.#writeComplete) {
            throw new Error('Writing not allowed after complete signal is given');
        }
        this.#arrayOfBlobToWrite.push(blob);
    }

    setWriteComplete() {
        this.#writeComplete = true;
    }

    async writeAllChunks() {
        await new Promise((resolve) => {
            clearInterval(this.#interval);
            const handler = () => {
                if (this.#currentlyProcessing) {
                    console.log('Currently Processing ffmpeg: ', this.#currentlyProcessing);
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
        this.#readableAndWriteableStream.end()
        return new Promise((resolve, reject) => {
            console.log('ffmpeg status: ', this.#ffmpegFinished);
            if (this.#ffmpegFinished || this.#ffmpegFailed) {
                resolve();
            }
            this.#ffmpegInstance
                .on("end", resolve)
                .on("error", resolve);
        });
    }
}

module.exports = FileWriter