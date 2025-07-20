const { app, globalShortcut, dialog, session } = require('electron');
const config = require('../config');
const console = require('electron-log');

/** @param { import('electron').BrowserWindow} window */
module.exports = (window) => {
    window.on("close", async function(e) {
		e.preventDefault();
		console.info('Close Event occured: ', config.programManger.windowClosable);
		if( !config.programManger.windowClosable ) {
			return false;
		}
		try {
			await config.programManger.endTest();
			window.webContents.setZoomFactor(1);
			await window.webContents.session.clearStorageData()
			config.programManger.closeActiveWindow();
			if ('closeMonitor' in config.programManger) {
				await config.programManger.closeMonitor();
			}
		} catch (error) {
			console.error('Error  in closing:', error)
		}
		app.exit();
	});

	window.on('minimize',(event) => {
		event.preventDefault();
		setTimeout(() => {
			if (window.isMinimized) window.restore();
			window.focus();
		},100);
		return false;
	})

	window.on('focus', () => {
		window.webContents.send('tab-switched-in', 'Tab is switched in');
	});

	window.webContents.on('did-fail-load', (ev, errorCode, errorDescription, url, isMainFrame, fProcessId) => {
		console.info('Failed To Load Script',JSON.stringify(ev, errorCode, errorDescription, url, isMainFrame, fProcessId));
		console.info('Loading URL Again: ', url);
		url = url ?? window.webContents.getURL();
		window.loadFile(config.config.retryPagePath);
		config.programManger.urlWhereLoadFailed = url;
		config.programManger.strictMode = false;
	});

	window.on('blur', (ev) => {
		if (ev.preventDefault) {
			ev.preventDefault();
		}
		window.webContents.send('tab-switched-out', 'Tab Switched Out');
		return false;
	});

	window.webContents.on('did-navigate', (ev, url) => {
		console.info('url Change ', url);
		window.setAlwaysOnTop(true,'screen-saver');
		if(url.indexOf('login') !== -1 && url.indexOf('/test/') === -1) {
			app.quit();
			return ;
		}

		if( url.indexOf('/test/completed') !== -1 ) {
			config.programManger.strictMode = false;
			return ;
		}
		const key = 'electronApp';
		const value = true;
		config.programManger.mainWindow?.webContents.executeJavaScript(`
			localStorage.setItem('${key}', '${value}');
		`);
	});
}