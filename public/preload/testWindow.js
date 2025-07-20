// boilerplate code for electron...
const {
    contextBridge,
    ipcRenderer,
    desktopCapturer,
} = require("electron");

const Recorder = require('./recordHandler');

const fs = require('fs');

// const configVar = require('../../config');
console.log('Render Process created');

// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector)
        if (element) element.innerText = text
    }

    for (const type of ['chrome', 'node', 'electron']) {
        replaceText(`${type}-version`, process.versions[type])
    }
})

/**
 * @type {Recorder | null}
 */
let recorder = null;

// end boilerplate code, on to your stuff..

/**
 * HERE YOU WILL EXPOSE YOUR 'myfunc' FROM main.js
 * TO THE FRONTEND.
 * (remember in main.js, you're putting preload.js
 * in the electron window? your frontend js will be able
 * to access this stuff as a result.
 */

contextBridge.exposeInMainWorld(
    "api", {
        invoke: (channel, data) => {
            let validChannels = ["myfunc","url","startQuiz"]; // list of ipcMain.handle channels you want access in frontend to
            if (validChannels.includes(channel)) {
                // ipcRenderer.invoke accesses ipcMain.handle channels like 'myfunc'
                // make sure to include this return statement or you won't get your Promise back
                return ipcRenderer.invoke(channel, data); 
            }
        },
        openUrl(url){
            try {
                ipcRenderer.send('open-url', url);
            } catch (err) {
                console.error(err);
            }
        },
        async record(quizId, userId, stream){
            try {
                if (!recorder) {
                    recorder = new Recorder('', quizId, userId, {
                        maxVideoLengthInSec: 2 * 60,
                        checkLengthInSec: 40,
                    });
                }
                await recorder.startRecording();
            } catch (error) {
                console.log(error);
            }
        },
        async stopRecording(quizId, userId, {forceUpload}) {
            console.log('Stopping recording');
            if (!recorder) {
                return;
            }
            await recorder.stopRecording();
            if (forceUpload) {
                const response = await ipcRenderer.invoke('upload-all-files', {
                    quizId: quizId,
                    userId: userId,
                });
                console.log(response);
            }
            return;
        },
        sendToMain: (channel, data) => {
            console.log('Sending to main');
            ipcRenderer.send(channel, data);
        },
        // Listen for messages from the main process
        receiveFromMain: (channel, listener) => {
            ipcRenderer.on(channel, (event, ...args) => {
                listener(...args);
            });
        },
        getJitsiMeetConstants: () => {
            return ipcRenderer.sendSync('jitsi-constants');
        },
        setJitsiMeetconstants: (data) => {
            return ipcRenderer.sendSync('set-jitsi-constants', data);
        },
        removeListener: (channel) => {
            ipcRenderer.removeAllListeners(channel);
        },
        getAppVersion: () => {
            return ipcRenderer.sendSync('app-version');
        },
        getCloseInstructions: () => {
            return ipcRenderer.sendSync('close-instructions');
        },
        quizURL: () => {
            return ipcRenderer.sendSync('quizURL');
        },
        getAppPath:() => {
            return ipcRenderer.sendSync('appPath');
        },
        checkIfVM: async () => {
            try {
                const isVM = await ipcRenderer.invoke('checkIfVM');
                return isVM;
            } catch (error) {
                console.error(error);
                return false;
            }
        },
        retryPageReload: () => {
            try {
                ipcRenderer.send('retry-page-load');
                return true;
            } catch (error) {
                console.error(error);
                return false;
            }
        }
    },

);
