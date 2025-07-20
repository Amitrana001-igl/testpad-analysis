const { app, BrowserWindow, ipcMain, dialog } =  require('electron');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
const os = require('os');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const config = require('../config');

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

/**
 * 
 * @returns {Promise<boolean | null>}
 */
async function checkIfDoUp() {
	try {
		const response = await axios.get(`${config.config.QUIZ_SERVER}/isDOUp`);
		return response.data.status;
	} catch (error) {
		console.error(error);
		return null;
	}
}

async function updateWindow() {
	let updateBrowserWindow = null;
	const isDOUp = await checkIfDoUp();
	if (isDOUp === false) {
		return true;
	}
	try {
		await new Promise((resolve, reject) => {
			try {
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
				updateBrowserWindow = window;
				window.webContents.on('did-finish-load', () => {
					if (window) {
						window.show();
					}
				});
	
				config.programManger.mainWindow = window;
				
				window.loadFile('public/html/version.html');
				log.info('Update Window open');
				log.info('Platform: ', os.platform());
				switch (os.platform()) {
					// In case of windows auto update will work
					case 'darwin':
					case 'linux' :
					case 'win32' : {
						autoUpdater.checkForUpdatesAndNotify();
						autoUpdater.on('update-available', (info) => {
							log.info('Update Available');
							config.programManger.notify({
								'title': `New version of ${config.programManger.getPlatformName()} available`,
								'body': `Hay, user new version of  ${config.programManger.getPlatformName()} is available, downloading in background
									\nWhen app is downloaded it will restart itself.
									\nPlease do not close the app.
								`
							})
						})
						autoUpdater.on('update-not-available', (info) => {
							log.info('Update Not Available opening app...');
							return resolve();
						})
						autoUpdater.on('error', (error) => {
							log.info('Error Occured while updating');
							return reject(new Error(`Unable to update app due to unstable internet connection.`));
						})
						autoUpdater.on('download-progress', (progressObj) => {
							log.info('Downloading...');
							let log_message = "Download speed: " + progressObj.bytesPerSecond;
							log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
							log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
							log.info(log_message);
							window?.webContents.send('update-progress', progressObj.percent, progressObj.bytesPerSecond, progressObj.total);
						})
						autoUpdater.on('update-downloaded', (info) => {
							try{
								log.info('downloaded restarting...');
								if(config.programManger.quizLink) {
									const linkPath = path.join(app.getPath('userData'), 'previouslink.txt');
									fs.writeFileSync(linkPath, config.programManger.quizLink);
								}
							} catch (error) {
								log.error(error);
							}
							setTimeout(() => {
								autoUpdater.quitAndInstall()
							},800)
						});
						break;
					}
					default : {
						throw new Error(`How did you installed app on ${os.platform()} platform`);
					}
				}
			} catch (error) {
				return reject(error?.message ?? error);
			}
		});
		return true;
	} catch (error) {
		console.error(error);
		const response = dialog.showMessageBoxSync(null, {
			title: `Internet connectivity problem.`,
			buttons: ['close', 'retry'],
			message:  error?.message,
			icon: path.join(config.logoPath),
		});
		try {
			await updateBrowserWindow?.close();
		} catch (error) {
			console.error(error);
		}
		if (response === 1) {
			app.relaunch();
		}
		app.exit(0);
		return false;
	}

}

module.exports = updateWindow;