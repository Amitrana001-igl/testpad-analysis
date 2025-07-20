const { BrowserWindow, dialog, webFrame, systemPreferences } =  require('electron');
const log = require('electron-log');
const path = require('path');

console = log;

const config = require('../config');
const libs = require('../libs');
const handler = require('../handler');

function testWindow(link) {
	/** @type {import('electron').BrowserWindowConstructorOptions} */
	const windowContractorConfig = {
		frame:false,
		kiosk:true,
		alwaysOnTop:true,
		closable: true,
		resizable: false,
		fullscreen: true,
		show: false,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: true,
			devTools: false,
			preload: path.join( __dirname,"../../public/preload/testWindow.js"),
		},
	}	
	if (config.env == 'local' || config.env == 'testing') {
		windowContractorConfig.frame = true;
		windowContractorConfig.kiosk = false;
		windowContractorConfig.webPreferences.devTools = true;
	}
	const window = new BrowserWindow(windowContractorConfig);
	window.loadURL(link);
	window.setContentProtection(true);
	if (config.env == 'local' || config.env === 'testing') {
		window.webContents.openDevTools();
	}

	const intervalId = setInterval(() => {
		try {
			if (!window) {
				clearInterval(intervalId);
				return;
			}
			if (!window.isFullScreen()) {
				window.setFullScreen(true);
			}
		} catch (error) {
			console.error(error);
		}
	}, 5000);

	window.webContents.once('did-finish-load', () => {
		window.setAlwaysOnTop(true,'screen-saver');
	});

	try {
		handler.testHandler(window);
	} catch (error) {
		console.error("ERRRORRR: ", error?.message);
	}
	return window;
}

module.exports = testWindow;