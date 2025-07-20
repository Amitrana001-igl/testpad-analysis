const { BrowserWindow, dialog, webFrame, systemPreferences } =  require('electron');
const log = require('electron-log');
const path = require('path');

console = log;

function macOsWindow() {
	/** @type {import('electron').BrowserWindowConstructorOptions} */
	const windowContructorConfig = {
		frame:false,
		closable: true,
		resizable: false,
		webPreferences: {
			width:  100,
			height: 100,
			nodeIntegration: true,
			devTools: false,
			preload: path.join( __dirname,"../../public/preload/testWindow.js"),
			contextIsolation: true
		},
	}
    const window = new BrowserWindow(windowContructorConfig);
    window.loadFile('public/html/macPrompt.html');
	window.setSize(500, 700, false);
}

module.exports = macOsWindow;