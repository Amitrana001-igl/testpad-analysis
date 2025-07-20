const {
    ipcRenderer,
} = require('electron');


const FileWriter = require("./fileWriter/fileWriter")
const MultiFileWriter = require("./fileWriter/multiFileWriter");

function uploadFile(id) {
    ipcRenderer.send('uploadFile', id);
}

class Recorder {

    /**
     * @type {MediaStream}
     */
    #stream
    
    #onRecordHandler
    
    /**
     * @type {{maxVideoLengthInSec: number, checkLengthInSec: number, path: string}}
     */
    #config
    
    /**
     * @type {MediaRecorder}
     */
    #mediaRecorder

    /**
     * @type {number | undefined}
     */
    #currentStreamStart

    /**
     * @type {FileWriter}
     */
    #fileWriter

    /**
     * @type {boolean}
     */
    #recordingStopped

    /**
     * 
     * @param {MediaStream} stream 
     * @param {{maxVideoLengthInSec: number, checkLengthInSec: number, path: string, bitRate: number, uploadId: number, startedAt: number}} config
     * @param {() => void} onRecordHandler
     */
    constructor(stream, config, onRecordHandler) {
        this.#stream = stream
        this.#onRecordHandler = onRecordHandler,
        this.#config = config;
        this.#mediaRecorder = new MediaRecorder(this.#stream, {
            mimeType: 'video/webm; codecs=vp9',
            videoBitsPerSecond: config.bitRate,
            audioBitsPerSecond: config.bitRate,
        })
        this.#mediaRecorder.ondataavailable = this.#handleStream.bind(this);
        this.#mediaRecorder.start(config.checkLengthInSec * 1000)
        this.#currentStreamStart =  Date.now();
        const multiFileWriter = new MultiFileWriter(this.#config.path, () => {
            uploadFile(config.uploadId)
        });
        multiFileWriter.addFileWriter(FileWriter, [config.path, {
            startTime: config.startedAt,
        }])
        this.#fileWriter = multiFileWriter;
        this.#recordingStopped = false;
    }

    async #stop() {
        try {
            this.#recordingStopped = true;
            await new Promise((resolve, reject) => {
                console.log('Stopping recording');
                this.#mediaRecorder.onstop = (ev) => {
                    console.log('Media Stream Stopped');
                    resolve();
                }
                this.#mediaRecorder.stop();
            })
            this.#fileWriter.setWriteComplete();
        } catch (error) {
            console.log(error);
        }
    }

    /**
     * 
     * @param {BlobEvent} event 
     */
    #handleStream(event) {
        if (event.data.size == 0) {
            return;
        }
        console.log({
            stopRecordingTime: this.#currentStreamStart + this.#config.maxVideoLengthInSec * 1000,
            currentTime: Date.now(),
            path: this.#config,
        })
        const blob = new Blob([event.data], {
            type: 'video/webm; codecs=vp9'
        });
        this.#fileWriter.write(blob);
        if ((this.#currentStreamStart + this.#config.maxVideoLengthInSec * 1000) < Date.now() ) {
            if (!this.#recordingStopped) {
                if (!this.#recordingStopped) {
                    this.#stop();
                    this.#onRecordHandler();
                }
            }
        }
    }

    /**
     * 
     * @param {boolean | undefined} lazy 
     * @returns 
     */
    async stopRecording(lazy) {
        await this.#stop();
        if (!lazy) {
            await this.#fileWriter.writeAllChunks();
            return;
        }
    }

}


module.exports = Recorder;
