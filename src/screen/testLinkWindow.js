const { BrowserWindow, dialog, webFrame, systemPreferences } =  require('electron');
const log = require('electron-log');
const path = require('path');

console = log;

const config = require('../config');
const libs = require('../libs');
const handler = require('../handler');

function testWindow() {
    /** @type {import('electron').BrowserWindowConstructorOptions} */
    const windowContractorConfig = {
        frame:false,
        alwaysOnTop:false,
        closable: true,
        resizable: true,
        fullscreen: false,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            devTools: false,
            preload: path.join( __dirname,"../../public/preload/testLinkWindow.js"),
        },
    }
    if (config.env == 'local' || config.env == 'testing') {
        windowContractorConfig.frame = true;
        windowContractorConfig.kiosk = false;
        windowContractorConfig.webPreferences.devTools = true;
    }
    const window = new BrowserWindow(windowContractorConfig);
    window.setContentProtection(true);
    if (config.env == 'local' || config.env === 'testing') {
        window.webContents.openDevTools();
    }
    window.webContents.on('did-finish-load', () => {
        window.maximize();
        window.show();
    });
    window.loadFile('public/html/index.html');
    return window;
}

module.exports = testWindow;