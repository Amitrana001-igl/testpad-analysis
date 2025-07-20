const ffmpegPath = require('ffmpeg-static').path;
const ffmpeg_static = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked')
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const stream = require('stream');

ffmpeg.setFfmpegPath(ffmpeg_static)
ffmpeg.setFfprobePath(ffmpegPath);

class FileWriter {
    #filePath;
    #arrayOfBlobToWrite;
    #writeComplete;
    #config;r
    #interval;
    #currentlyProcessing;
    #ffmpegInstance;
    #readableAndWriteableStream;
    #ffmpegFailed = false;
    #ffmpegFinished = false;

    static ffmpegTimeStampPath(filePath) {
        const extension = path.extname(filePath);
        return filePath.replace(extension, `-with-timestamp${extension}`);
    }

    /**
     * 
     * @param {string} fileName 
     * @param {{ onCompletion?: (string) => void }} config
     */
    constructor(filePath, config) {
        this.#currentlyProcessing = false;
        this.#writeComplete = false;
        this.#filePath = filePath;
        this.#arrayOfBlobToWrite = [];
        this.#config = { ...config, intervalInSec: 1 };
        this.#startWriter(this.#config.intervalInSec);

        if (!fs.existsSync(path.dirname(filePath))) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }

        this.#readableAndWriteableStream = new stream.PassThrough();
        this.#ffmpegInstance = ffmpeg()
            .input(this.#readableAndWriteableStream)
            .inputOptions("-f webm")
            .videoFilter([
                {
                    filter: "drawtext",
                    options: {
                        text: `'%{pts\\:gmtime\\:${Math.floor(
                            config.startTime / 1000
                        )}\\:%Y-%m-%d %I\\\\\\:%M\\\\\\:%S %p}'`,
                        fontcolor: "white",
                        fontsize: 24,
                        box: 1,
                        boxcolor: "0x00000088",
                        boxborderw: 10,
                        x: 10,
                        y: 10,
                    },
                },
            ])
            .output(FileWriter.ffmpegTimeStampPath(this.#filePath))
            .on("end", () => {
                this.#ffmpegFinished = true;
            })
            .on("error", (error) => {
                this.#ffmpegFailed = true;
                this.#readableAndWriteableStream.end();
                console.error("FFMPEG Failed:", error);
            })
            .run();
    }

    get isComplete() {
        return this.#ffmpegFailed || this.#ffmpegFinished;
    }

    async #writeToFile(blob) {
        const arrayBuffer = await blob.arrayBuffer();
        this.#readableAndWriteableStream.write(Buffer.from(arrayBuffer));
    }

    #startWriter(intervalInSec) {
        this.#interval = setInterval(() => {
            if (!this.#currentlyProcessing) {
                this.#currentlyProcessing = true;
                this.#processChunks().finally(() => {
                    this.#currentlyProcessing = false;
                    if (this.#writeComplete) {
                        clearInterval(this.#interval);
                        this.#config?.onCompletion(this.#filePath);
                    }
                });
            }
        }, intervalInSec * 1000);
    }

    async #processChunks() {
        while (this.#arrayOfBlobToWrite.length > 0) {
            const toWrite = this.#arrayOfBlobToWrite.shift();
            if (toWrite) await this.#writeToFile(toWrite);
        }
        if (this.#writeComplete) {
            this.#readableAndWriteableStream.end();
        }
    }

    setWriteComplete() {
        this.#writeComplete = true;
    }

    write(blob) {
        if (this.#writeComplete) {
            throw new Error("Writing not allowed after completion signal.");
        }
        this.#arrayOfBlobToWrite.push(blob);
    }

    async writeAllChunks() {
        clearInterval(this.#interval);
        await this.#processChunks();
        this.#readableAndWriteableStream.end();

        return new Promise((resolve, reject) => {
            this.#ffmpegInstance
                .on("end", resolve)
                .on("error", reject);
        });
    }

    markWriteComplete() {
        this.#writeComplete = true;
    }
}

module.exports = FileWriter;
