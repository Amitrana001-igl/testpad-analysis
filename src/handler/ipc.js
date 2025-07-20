const os = require('os');
const { ipcMain, app, desktopCapturer, powerMonitor, session } = require('electron');
const console = require('electron-log');

const libs = require('../libs');
const handler = require('../handler');
const { FlashScreen } = require('../libs/flash-screen');
const { pushIntoUploadQueue, getUploadId, forceUploadFiles } = require('../libs/upload');

const { programManger } = require('../config');
const config = require('../config');
const path = require('path');
const { TestWindow } = require('../screen');

ipcMain.handle('startQuiz', async (ev, link, ...args) => {
	link = libs.utils.parseLink(link);
	if (link && programManger.mainWindow) {
		programManger.quizLink = link;
		const newWindow = TestWindow(link);
		new FlashScreen(newWindow, {
			onLoadComplete: () => {
				console.info('Load complete should show the window and hide');
				programManger.mainWindow = newWindow;
			},
			onError: () => {
				console.info('Load complete should show the window and hide');
				programManger.mainWindow.webContents.send('window-load-failed');
			},
			onClose: () => {
				console.info('Closing Event Happend');
				app.exit();
			}
		}, programManger.mainWindow);
		return true;
	}
	return false;
})

ipcMain.on('quizURL', (ev) => {
	const url = config.config.QUIZ_SERVER;
	ev.returnValue = url;
})

ipcMain.on('close-instructions', (ev) => {
	const command = (os.platform() == 'darwin')?'Command+Q':'Alt+F4'
	let string = `To exit please press ${command}, only when test has not been started.`;
	ev.returnValue = string;
})

ipcMain.on('app-version', (ev) => {
	const version = app.getVersion();
	ev.returnValue = version;
})

ipcMain.on('jitsi-constants', (ev) => {
	const meetJsConstants = programManger.getJitsiConfig();
	ev.returnValue = meetJsConstants;
})

ipcMain.on('set-jitsi-constants', (ev, data) => {
	programManger.setJitsiConfig(data);
	ev.returnValue = true;
})

ipcMain.on('close', async () => {
	programManger.mainWindow?.close();
})

ipcMain.on('zoom-event', (event, value) => {
	programManger.zoomChange( (value + 100) / 100 );
})

ipcMain.on('quiz-status', (event, value) => {
	console.info('quiz status ', value);
})

ipcMain.on('pre-login-test', (event, value) => {
	try {
		if (typeof value == 'boolean') {
			programManger.preStartCheck(value);
		}
		console.debug(`Value got for pre-login-test:\t`, value);
	} catch (error) {
		console.info(error);
	}
})

ipcMain.on('change-closeable-state', async (event, value) => {
	try {
		if( typeof value === 'boolean') {
			programManger.strictMode = !value;
		}
		console.debug(value);
		console.debug(`Change closeable state to ${value}`)
		console.info(`AllowClose change: ${value}`);	
	} catch (error) {
		console.info(error);
	}
})


ipcMain.on('retryMultiScreen', async (event, value) => {
	try {
		await config.programManger.retry();
	} catch (error) {
		console.info(error);
	}
})

ipcMain.on('quizId', async (event, value) => {
	try {
		config.programManger.setQuizId(value);
	} catch (error) {
		console.error(error);
	}
});

ipcMain.on('appPath', (ev) => {
	ev.returnValue = app.getPath('exe');
	return;
})

ipcMain.handle('checkIfVM', async (ev) => {
	try {
		const result  = await programManger.checkIfVM();
		return result;
	} catch (error) {
		console.error(error);
		return error;
	}
})
ipcMain.on('listDevices', async (ev) => {
	const displayData = await desktopCapturer.getSources({
		types: ['screen'],
	})
	ev.returnValue = displayData;
})

ipcMain.on('getRecordingPath', async (ev, quizId, userId) => {
	ev.returnValue = libs.utils.getPathForRecording({quizId, userId});
	return ev.returnValue;
})

ipcMain.on('uploadFile', async (ev, id) => {
	pushIntoUploadQueue(id);
	return true;
})

ipcMain.on('getUploadId', async (ev, data) => {
	try {
		if (!data.quizId || !data.path || !data.userId || !data.weightTime) {
			throw new Error('Payload is not valid');
		}
		const id = await getUploadId(data);
		ev.returnValue = id;
		return id;
	} catch (error) {
		console.error(error);
		ev.returnValue = {error: error?.message ?? error};
		return {error: error?.message ?? error};
	}
});

ipcMain.on('open-url', async (ev, url) => {
	programManger.mainWindow.loadURL(url);
	return url;
});

ipcMain.handle('upload-all-files', async (ev, data) => {
	try {
		const { quizId, userId } = data;
		await forceUploadFiles(userId, quizId);
		return {message: 'success'}
	} catch (error) {
		console.error(error);
		ev.returnValue = {error: error?.message ?? error};
		return {error: error?.message ?? error};
	}
});

ipcMain.on('retry-page-load', async (ev, data) => {
	try {
		console.log('Retrying fetching page');
		programManger.retryPageLoad();
		return true;
	} catch (error) {
		console.error(error);
		return { error: error?.message ?? error };
	}
});

let lockedAt = null;

powerMonitor.on('lock-screen', (ev) => {
	const mainWindow = programManger.mainWindow;
	lockedAt = Date.now();
	if (mainWindow) {
		mainWindow.webContents.send('lock-screen');
	}
});

powerMonitor.on('suspend', (ev) => {
	console.log(ev);
	const mainWindow = programManger.mainWindow;
	lockedAt = Date.now();
	if (mainWindow) {
		mainWindow.webContents.send('lock-screen-event');
	}
});

powerMonitor.on('unlock-screen', (ev) => {
	const mainWindow = programManger.mainWindow;
	if (mainWindow) {
		if (lockedAt) {
			mainWindow.webContents.send('lock-screen-event', lockedAt);
			lockedAt = null;
		}
		mainWindow.webContents.send('unlock-screen-event');
	}
});

powerMonitor.on('resume', (ev) => {
	const mainWindow = programManger.mainWindow;
	if (mainWindow) {
		if (lockedAt) {
			mainWindow.webContents.send('lock-screen-event', lockedAt);
			lockedAt = null;
		}
		mainWindow.webContents.send('unlock-screen');
	}
});
