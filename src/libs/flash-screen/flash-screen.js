const { BrowserWindow } = require('electron');
const console = require('electron-log');

module.exports = class FlashScreen {

    /**
     * @type {BrowserWindow}
     */
    #window

    /**
     * @type {BrowserWindow}
     */
    #loadingWindow

    /**
     * @type {windowOpenedSuccessfully}
     */
    #isWindowLoaded = false;

    /**
     * 
     * @param {BrowserWindow} window 
     * @param {{ onError: ({ errorCode: number, errorDescription: string }) => void, onClose: () => void, onLoadComplete: () => void}, customFlashScreen?: import('electron').BrowserWindow}
     */
    constructor(window, { onError,onClose, onLoadComplete}, customFlashScreen) {
        this.#window = window;
        this.#window.hide();
        this.#loadingWindow = customFlashScreen ?? this.constructLoadingScreen();
        this.#window.webContents.once('did-fail-load', (ev, errorCode, errorDescription) => {
            if (this.#isWindowLoaded) {
                return
            }
            try {
                this.#loadingWindow?.close();
                ev.preventDefault();
                onError({
                    errorCode,
                    errorDescription,
                });
            } catch (error) {
                console.error(error);
            }
        });
        this.#window.webContents.once('did-finish-load', () => {
            try {
                if (onLoadComplete) {
                    onLoadComplete();
                }
                this.#window.show();
                this.#isWindowLoaded = true;
                this.#loadingWindow?.close();
            } catch (error) {
                console.error(error);
            }
        });
        if (!this.#window.webContents.isLoading()) {
            try {
                this.#loadingWindow?.close();
                this.#isWindowLoaded = true;
                this.#window.show();
                onLoadComplete();
                return;
            } catch (error) {
                console.error(error);
            }
        }
        this.#loadingWindow.once('closed', () => {
            if (!this.#isWindowLoaded) {
                onClose();
            }
        });
    }

    constructLoadingScreen() {
        const window = new BrowserWindow({
            frame: false,
            width: 300,
            height: 300,
            alwaysOnTop: false,
            show: false,
            webPreferences: {
                devTools: false,
                nodeIntegration: true,
                contextIsolation: false,
            }
        });

        window.webContents.on('did-finish-load', () => {
            window.show();
        });

        window.loadFile('public/html/loader.html');
        return window;
    }
}