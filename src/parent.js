require('dotenv').config();
const log = require('electron-log');
console = log;
const { app, dialog, Menu, globalShortcut, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const config = require('./config');
const libs = require('./libs');
const { startUploadQueue, initDataBase } = require('./libs/upload');


const screen = require('./screen');
const macOsWindow = require('./screen/macOsPermission');
const { FlashScreen } = require('./libs/flash-screen');
const { logger } = require('sequelize/lib/utils/logger');

const scheme = (config.config.isChitkara) ? 'testpad-chitkara' : 'test-codequotient';
app.commandLine.appendSwitch('disable-features', 'IOSurfaceCapturer', 'DesktopCaptureMacV2');

if (process.defaultApp) {
	if (process.argv.length >= 2) {
		app.setAsDefaultProtocolClient(scheme, process.execPath, [path.resolve(process.argv[1])])
	}
} else {
	app.setAsDefaultProtocolClient(scheme)
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
	console.error(new Error('Unable to get lock for the instance.'));
	return;
}

if (os.platform() !== 'darwin') {
	app.on('second-instance', (event, commandLine, workingDirectory) => {
		// Someone tried to run a second instance, we should focus our window.
		const window = config.programManger.mainWindow;
		if (window) {
			if (window.isMinimized()) window.restore();
		}
		const link = libs.utils.parseLink(commandLine.pop().split(`${scheme}://`)[1]);
		if (link && window) {
			window.webContents.send('url', link);
		}
	})
}

if (app.isPackaged && config.env !== 'testing') {
	Menu.setApplicationMenu(null);
}

console.info('App starting...');
// app.commandLine.appendSwitch('enable-features', 'SceenCaptureKitMac');
app.commandLine.appendSwitch('disable-features', 'IOSurfaceCapturer', 'DesktopCaptureMacV2');

app.whenReady().then(async () => {
	globalShortcut.register('Ctrl+=', () => {
		config.programManger.zoomChange(true);
	})

	globalShortcut.register('Ctrl+-', () => {
		config.programManger.zoomChange(false);
	})

	const dataPath = app.getPath('userData');

	startUploadQueue();
	const isMinimumSpaceRequiredAvailable = await config.programManger.checkForDiskSpaceForRecording(config.minimumDiskSpaceRequired);
	if (!isMinimumSpaceRequiredAvailable) {
		dialog.showMessageBoxSync(null, {
			title: 'Low Disk Space',
			buttons: ['ok'],
			message: `Your system does not have minimum space required at ${app.getPath('temp')}.\nPlease free some space there before opening app again.`,
			icon: path.join(config.logoPath),
		});
		process.exit();
	}

	try {
		if (app.isPackaged) {
			try {
				const isUpdated = await screen.UpdateWindow();
				if (!isUpdated) {
					return;
				}
			} catch (error) {
				console.info(error);
				let message = error?.message ?? error;
				if (os.platform() == 'darwin') {
					message += '\nPlease install the app in the application folder for automatic updates to function properly.'
				}
				throw new Error(message)
			}
		}
		await initDataBase();
		if (os.platform() === 'darwin' && app.isPackaged) {
			const isMonitorOn = await config.programManger.startMonitoringApp();
			if (!isMonitorOn) {
				dialog.showMessageBoxSync(null, {
					title: 'Please Provide Required Permission',
					buttons: ['ok'],
					message: `Without required permission ${app.name} will not start`,
					icon: path.join(config.logoPath),
				})
				return app.quit();
			}
			setInterval(async () => {
				try {
					const isWorking = await config.programManger.checkForMonitor();
					console.info(`Monitoring App check run at ${new Date().toISOString()} with result ${isWorking}`);
				} catch (error) {
					console.error(error);
				}
			}, 10 * 1000);
		}

		if (!config.programManger.quizLink) {
			config.programManger.quizLink = libs.utils.parseLink(process.argv[process.argv.length - 1].split(`${scheme}://`)?.[1]);
		}

		if (os.platform() === 'darwin') {
			const isCameraAvailable = await systemPreferences.askForMediaAccess('camera');
			console.info('Camera Permission', isCameraAvailable);
			if (!isCameraAvailable) {
				dialog.showMessageBoxSync(null, {
					title: 'Please Provide Access To Camera.',
					buttons: ['ok'],
					message: `Without camera access the app will not start.\nYou can allow by going to the Privacy Setting/Camera and allow ${app.name}`,
					icon: path.join(config.logoPath)
				});
				return app.quit();
			}
		}

		const filePath = path.join(dataPath, 'config.json');
		if (!fs.existsSync(filePath)) {
			console.info("APP INSTALLED FOR FIRST TIME");
			fs.writeFileSync(filePath, 'App installed');
			dialog.showMessageBoxSync(null, {
				title: 'App installed successfully.',
				buttons: ['ok'],
				message: 'App has been installed successfully.\nPlease refresh test window to open test in app.',
				icon: path.join(config.logoPath)
			});
			return app.quit();
		}

		try {
			await config.programManger.beforeAppStart();
		} catch (error) {
			config.programManger.notify({
				title: 'Please Note',
				body: `${error?.message ?? 'Something went wrong.'}`
			})
			dialog.showMessageBoxSync(null, {
				title: 'Multiple windows detected.',
				buttons: ['ok'],
				message: 'Some test can show error if multiple windows are connected.',
				icon: path.join(config.logoPath)
			});
		}

		if (app.isPackaged && !config.programManger.quizLink) {
			const linkPath = path.join(dataPath, 'previouslink.txt');
			if (fs.existsSync(linkPath)) {
				config.programManger.quizLink = fs.readFileSync(linkPath).toString();
				fs.rmSync(linkPath);
			}
		}

		if (config.env !== 'production') {
			config.programManger.notify({
				title: config.programManger.getPlatformName(),
				body: `Running app in ${config.env}`
			})
		}
		console.log("APP LOADED");
		if (config.programManger.quizLink) {
			const testWindow = screen.TestWindow(config.programManger.quizLink);
			config.programManger.mainWindow = testWindow;
			new FlashScreen(testWindow, {
				onError: () => {
					console.error(`Error while loading the window.`);
					const response = dialog.showMessageBoxSync({
						title: "Internet connectivity problem",
						message: "Unable to load application, please check your internet connection.",
						buttons: ["cancel", "retry"],
						icon: path.join(config.logoPath),
					});
					if (response === 1) {
						const linkPath = path.join(app.getPath('userData'), 'previouslink.txt');
						fs.writeFileSync(linkPath, config.programManger.quizLink);
						app.relaunch();
					}
					app.quit();
				},
				onClose: () => {
					app.exit();
				}
			});
		} else {
			const testLinkWindow = screen.TestLinkWindow();
			config.programManger.mainWindow = testLinkWindow;
		}

	} catch (error) {
		dialog.showErrorBox('Something went wrong', error?.message);
		console.info(error);
		app.quit()
	}

	Menu.setApplicationMenu(Menu.buildFromTemplate([
		{
			label: "Application",
			submenu: [
				{ type: "separator" },
				{ label: "Quit", accelerator: "Command+Q", click: function () { app.quit(); } }
			]
		}, {
			label: "Edit",
			submenu: [
				{ label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
				{ label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
				{ type: "separator" },
				{ label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
				{ label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
				{ label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
				{ label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:" }
			]
		}
	])
	)
})

app.on('open-url', (event, url) => {
	const window = config.programManger.mainWindow;
	const link = libs.utils.parseLink(url.split(`${scheme}://`)[1]);
	console.info('URL', link, url);
	if (window) {
		console.info('Window Exists Maximizing');
		if (window.isMinimized()) window.restore();
		window.focus();
		if (link && window) {
			window.webContents.send('url', link);
		}
	}
	if (link && !config.programManger.quizLink) {
		// process.argv.push(url)
		config.programManger.quizLink = link;
	}

})

app.on('will-quit', async () => {
	try {
		if ('closeMonitor' in config.programManger) {
			await config.programManger.closeMonitor();
		}
	} catch (error) {
		console.log(error);
	}
})

app.on('window-all-closed', () => {
	if ('removeConfig' in config.programManger) {
		config.programManger.removeConfig();
	}
	app.quit();
});


require('./handler/ipc');