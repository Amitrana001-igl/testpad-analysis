const {
    ipcRenderer,
} = require('electron');

const dayjs = require('dayjs');

const logger = require('electron-log');
const Recorder = require('./singleRecord');
const fs = require('fs');
const path = require('path');
console = logger


const uploadTimeBufferInSecond = 2 * 60;

class RecorderManager {
    #devices
    /**
     * @type {MediaStream}
     */
    #stream
    /**
     * @type {MediaStream}
     */


    /**
     * @type {string}
     */
    #basePath 

    /**
     * @type {{maxVideoLengthInSec: number, checkLengthInSec: number}}
     */
    #config

    /**
     * @type {string}
     */
    #quizId

    /**
     * @type {string}
     */
    #userId


    /**
     * @type {Recorder}
     */
    #recorder

    /**
     * 
     * @param {string} deviceToRecord 
     * @param {string} quizId 
     * @param {string} userId 
     * @param {{ maxVideoLengthInSec: number, checkLengthInSec: number }} config 
     */
    constructor(deviceToRecord, quizId, userId, config) {
        // this.#devices = ipcRenderer.sendSync('listDevices');
        // this.#fileWriteStream = null;
        this.#quizId = quizId,
        this.#userId = userId,
        this.#config = config;
        try {
            const directoryPath = ipcRenderer.sendSync('getRecordingPath', quizId, userId);
            this.#basePath = directoryPath;
            const isDirectoryPresent = fs.existsSync(directoryPath);
            if (!isDirectoryPresent) {
                fs.mkdirSync(directoryPath);
            }
        } catch (error) {
            console.log(error);
        }
    }

    createNewFileStream() {
        const filePath = `${Date.now()}`;
        const streamPath = path.join(this.#basePath, filePath);
        this.#recorder = new Recorder(this.#stream, {
            path: `${streamPath}.webm`,
            checkLengthInSec: this.#config.checkLengthInSec,
            maxVideoLengthInSec: this.#config.maxVideoLengthInSec,
            startedAt: Date.now(),
            uploadId: ipcRenderer.sendSync('getUploadId', {
                quizId: this.#quizId,
                userId: this.#userId,
                path: `${streamPath}.webm`,
                weightTime: dayjs().add(this.#config.maxVideoLengthInSec + uploadTimeBufferInSecond, 'second').toDate().getTime(),
            }),
            bitRate: 100000,
        }, this.changeRecorder.bind(this));
    }
    
    /**
     * 
     * @param {MediaStream} stream 
     */
    async startRecording(stream) {
        if (this.#stream) {
            console.log('Stream is already going on.');
            return;
        }
        if (!stream) {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    write: 480,
                    height: 640,
                    frameRate: 15,
                    
                }
            });
        }
        this.#stream = stream;
        this.createNewFileStream();
    }

    stopRecording() {
        return this.#recorder?.stopRecording();
    }

    async changeRecorder() {
        console.log('Creating new Stream');
        this.createNewFileStream();
    }
}


module.exports = RecorderManager;