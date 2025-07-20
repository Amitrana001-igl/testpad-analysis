const { Notification, session, app } = require('electron');
const path = require('path');
const fs = require('fs');
const helperScript = require('./stateChangeScript');
const config = require('./config');
const os = require('os');
const { exec } = require('child_process');
const { default: axios } = require('axios');
const { utils } = require('../libs');

module.exports = class ProgramManager {
    /** @type { Electron.BrowserWindow | null } */
    #mainWindow

    /** @type {boolean} */
    #quizStarted
    /** @type {string | null} */
    #quizLink
    /** @type {string | null} */
    #notificationIconPath
    /** @type {boolean} */
    #strictMode
    /** @type {NodeJS.Timer} */
    #strictModeCheckIntervalId
    /** @type {NodeJS.Timer} */
    #preTestCheckIntervalId
    /** @type {boolean} */
    #childProcessLock
    /** @type {helperScript.ExecCommand} */
    #strictModeExecutor
    
    /** @type {string |  null} */
    #quizId

    /**
     * 
     * @type {number} 
     */
    #monitorAppPort 

    /**
     * 
     * @type {{darwin: { allowWithoutMonitor: number }, linux: {}, win32: {}}} 
     */
    #configFromServer

    /**
     * @type {Promise<any> | null}
     */
    #axiosPromiseForConfigFromServer

    /**
     * 
     * @type {string | null} iconPath 
     */
    #urlWhereLoadFailed

    constructor(iconPath) {
        this.#mainWindow = null
        this.#notificationIconPath = iconPath
        this.#strictMode = false;
        this.#preTestCheckIntervalId = null;
        this.#strictModeExecutor = new helperScript.ExecCommand();
        this.#quizId = null;
        this.#monitorAppPort = 8179;
        this.#configFromServer = {};
        this.#axiosPromiseForConfigFromServer = null;
        this.#init();
    }

    async #init() {
        if (this.#axiosPromiseForConfigFromServer) {
            await this.#axiosPromiseForConfigFromServer;
        }
        this.#axiosPromiseForConfigFromServer = new Promise( async (resolve, reject) => {
            try {
                const url = new URL('/app/config', config.QUIZ_SERVER);
                const response = await axios.get(url.toString());
                console.log(response.data);
                this.#configFromServer = response.data;
            } catch (error) {
                // console.error(error.me);
                this.#configFromServer = {darwin: {allowWithoutMonitor: 0}, linux: {}, win32: {}}
            } finally {
                resolve();
            }
        });
    }

    /** @param { import('electron').NotificationConstructorOptions  } options */
    notify (options) {
        if ( !options.icon ) options.icon = this.#notificationIconPath;
        new Notification(options)
    }
    
    getChildProcessLock() {
        if (this.#childProcessLock) {
            return null;
        }
        this.#childProcessLock = true;
        const timeoutForLock = setTimeout(() => {
            this.#childProcessLock = false;
        }, 10000);
        return () => {
            clearTimeout(timeoutForLock);
            this.#childProcessLock = false;
        };
    }

    beforeAppStart() {
        return this.#strictModeExecutor.preStartCheck();
    }

    /** @param {boolean | number} isIncrease */
    zoomChange (value) {
        if (!this.#mainWindow) {
            console.info(new Error('Window is empty not able to change zoom'));
            return;
        }
        const previousValue = this.mainWindow.webContents.getZoomFactor();
        
        let valueToSet = previousValue;


        let isIncrease;
        if (typeof value === 'boolean') {
            isIncrease = value;
            valueToSet  = previousValue  + ((isIncrease) ? 0.1 : -0.1);
            console.log(valueToSet); 
        }

        if (typeof value === 'number') {
            isIncrease = value > previousValue;
            valueToSet = value;
        }

        let setValue = false;
        if ( isIncrease === true ) {
            if ( valueToSet < 1.5 ) setValue = true;
        }
        if ( isIncrease === false ){
            if ( valueToSet > 0.5 ) setValue = true;
        }
        if(setValue) {
            console.info(`Set Zoom Factor: `, valueToSet);
            this.#mainWindow.webContents.setZoomFactor(valueToSet);
        }
    }

    closeActiveWindow () {
        if (this.#mainWindow) {
            this.#mainWindow.close();
            this.#mainWindow = null;
            this.#strictMode = false;
        }
    }

    sendStrictModeLockToFrontend (value) {
        if (this.#mainWindow) {
            this.#mainWindow.webContents.send('electron-strict-mode-lock', value);
        }
    }

    get mainWindow () {
        return this.#mainWindow
    }
    
    /**
     * @param { Electron.BrowserWindow | null }
     */
    set mainWindow (window) {
        if (window == null) {
            
        }
        if (window) {
            
        }
        if (this.#mainWindow) {
            this.#mainWindow.close()
        }
        this.#mainWindow = window;
    }

    get quizLink () {
        return this.#quizLink;
    }

    set quizLink (link) {
        if (this.#mainWindow && this.#quizLink) {
            this.#mainWindow.setAlwaysOnTop(true, 'screen-saver')
        }
        this.#quizLink = link;
    }

    get windowClosable() {
        return !this.#strictMode
    }

    async retry() {
        try{
            const result = await this.getCurrentTypeOfExecution();
            if (!isNaN(result)) {
                this.#strictModeExecutor.setExectionType(result);
            }
            await this.#strictModeExecutor.preStartCheck();
            this.sendStrictModeLockToFrontend(false);
        } catch (error) {
            console.log(error);
        }
    }

    async getCurrentTypeOfExecution() {
        try {
            const cookies = (await session.defaultSession.cookies.get({})).reduce((result, cookie) => {
                return result += `${cookie?.name}=${cookie.value};`
            },'')
            
            let url = `${config.QUIZ_SERVER}/api/getCurrentTypeOfExecution?`;
            if (this.#quizId) {
                url += `quizId=${this.#quizId}`;
            }
            const rawResponse = await fetch(url, {
                headers: {
                    'Cookie': cookies,
                }
            }); 
            const result = await rawResponse.json();
            return result.type;
        } catch (error) {
            console.log(error);
            return 3;
        }
    }

    /** @param {boolean} state */
    set strictMode (state) {
        this.preStartCheck(false);
        if (state === this.#strictMode) {
            return  ;
        }
        if (this.#strictModeCheckIntervalId) 
            clearInterval(this.#strictModeCheckIntervalId);
        if (state) {
            const funcToExec = async () => {
                const release = this.getChildProcessLock();
                if (!release) {
                    return;
                }
                const result = await this.getCurrentTypeOfExecution();
                if (!isNaN(result)) {
                    this.#strictModeExecutor.setExectionType(result);
                }
                if(!release) {
                    return ;
                }
                try {
                    await this.#strictModeExecutor.strictMode();
                    this.sendStrictModeLockToFrontend(false);
                } catch (error) {
                    this.sendStrictModeLockToFrontend(true);
                    console.log(error);
                }
                release();
            }
            setTimeout(funcToExec, 2000);
            this.#strictModeCheckIntervalId = setInterval(funcToExec, 30 * 1000);
            this.#strictMode = true;
            return ;
        }
        this.#strictMode = false;
        this.#strictModeExecutor.removeStrictMode().catch((error) => {
            console.error(`Error while removing strict mode`, error);
        });
    }

    endTest() {
        this.#quizLink = null;
        return this.#strictModeExecutor.removeStrictMode();
    }

    setQuizId(value) {
        if (!this.#quizId) {
            this.#quizId = value;
        }
    }

    preStartCheck (value) {
        if (!value) {
            if (this.#preTestCheckIntervalId) {
                clearInterval(this.#preTestCheckIntervalId);
                this.#preTestCheckIntervalId = null;
            }
            return;
        }
        if (this.#preTestCheckIntervalId) {
            return;
        }
        const funcToExec = async () => {
            const release = this.getChildProcessLock();
            if(!release) {
                return ;
            }
            const result = await this.getCurrentTypeOfExecution();
            if (!isNaN(result)) {
                this.#strictModeExecutor.setExectionType(result);
            }
            try {
                await this.#strictModeExecutor.preStartCheck();
                this.sendStrictModeLockToFrontend(false);
            } catch (error) {
                this.sendStrictModeLockToFrontend(true);
                console.log(error);
            }
            release();
        }
        setTimeout(funcToExec, 2000);
        this.#preTestCheckIntervalId = setInterval(funcToExec, 5 * 60 * 1000)
    }
    
    async closeMonitor(retryTimes = 2) {
        console.log('Platform ', os.platform());
        if (os.platform() !== 'darwin') {
            return true;
        }
        return new Promise( async (resolve, reject) => {
            const url = `http://localhost:${this.#monitorAppPort}/exit`;
            for (let index = 0; index < retryTimes; ++index) {
                try {
                    const rowResponse = await fetch(url);
                    if (rowResponse.ok) {
                        resolve(true);
                    }
                } catch (error) {
                    console.log(error);
                }
            }
            resolve(false);
        })
    }
    

    async checkForMonitor() {
        const url = `http://localhost:${this.#monitorAppPort}/isMonitoringAppRunning`;
        try {
            const rowResponse = await fetch(url);
            if (rowResponse.ok) {
                const response = await rowResponse.json();
                if (response.pid) {
                    return true;
                }
            }
        } catch (error) {
            console.log(error);
        }
        return false;
    }

    async continuouslyEmitMonitoringNotWorking() {
        setInterval(() => {
            if (this.#mainWindow) {
                this.#mainWindow.webContents.send('monitor-not-working');
            }
        }, 20000);
    }

    async startMonitoringApp() {
        return new Promise(async (resolve, reject) => {
            await this.#init();
            let isResolved = false;
            let appPath = app.getPath('exe').replaceAll(' ','\\\\ ');
            console.log("APP PATH", appPath);
            if (!app.isPackaged) {
                appPath = "/Applications/Testpad.app/Contents/MacOS/Testpad";
            }
            const isActive = await this.checkForMonitor();
            if (isActive) {
                const closed = await this.closeMonitor(2);
                if (!closed) {
                    return reject(`Some process is using port: ${this.#monitorAppPort}.\nPlease close this process to continue.`);
                }
            }
            let error = '';
            let monitoringRunning = false;
            const process = exec(`osascript -e 'do shell script "${appPath} monitoringMode ${this.#monitorAppPort}" with administrator privileges'`);
            process.stderr.on('data', (errorLine) => {
                error += errorLine;
                console.error(error);
            });
            process.stdout.on('data', (data) => {
                console.log(data);
            });
            process.on('exit', () => {
                if (error) {
                    if (error.includes('User cancelled')) {
                        if (!isResolved) {
                            isResolved = true;
                            return resolve(false);
                        }
                    };
                    console.error(error);
                    if (this.#configFromServer?.darwin?.allowWithoutMonitor) {
                        this.continuouslyEmitMonitoringNotWorking();
                        if (!isResolved) {
                            resolve(true);
                        }
                    } else {
                        if (!isResolved) {
                            resolve(false);
                        }
                    }
                }
                if (monitoringRunning) {
                    app.exit();
                }
            })
            const checkInterval = setInterval( async () => {
                try {
                    if (isResolved) {
                        clearInterval(checkInterval);
                        return;
                    }
                    const isWorking = await this.checkForMonitor();
                    if (isWorking) {
                        monitoringRunning = true;
                        if (!isResolved) {
                            isResolved = true;
                            return resolve(true);
                        }
                    }
                } catch (error) {
                    console.log(error);
                }
            }, 3 * 1000);
        })
    }

    async checkForFullDiskAccess() {
        try {
            await this.#strictModeExecutor.checkForFullDiskAccess();
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    /**
     * 
     * @returns {string | null}
     */
    getJitsiConfig() {
        try {
            const pathToJitsiConfig = path.join(app.getPath('userData'), 'jitsi');
            const data = fs.readFileSync(pathToJitsiConfig);
            if (data) {
                console.log(data);
                return JSON.parse(data.toString());
            }
            return 
        } catch (error) {
            console.log(error);
            return;
        }
    }

    setJitsiConfig(dataToSave) {
        try {
            const pathToJitsiConfig = path.join(app.getPath('userData'), 'jitsi');
            fs.writeFileSync(pathToJitsiConfig, JSON.stringify(dataToSave));
            return true;
        } catch (err) {
            console.log(err);
            return false;
        }
    }

    checkSudo() {
        try {
            const processId = process.getuid();
            console.log(processId);
            return processId === 0;
        } catch (err) {
            console.log(err);
            return false;
        }
    }

    async checkIfVM() {
        try {
            const data = await helperScript.checkIfVM();
            return data;
        } catch (error) {
            console.error(error);
            return error;
        }
    }
    /**
     * @param {number} minimumSpaceRequired
     */
    async checkForDiskSpaceForRecording(minimumSpaceRequired) {
        try {
            const space = await helperScript.checkForDeskSpace(utils.getPathForRecording());
            if (space.free < minimumSpaceRequired) {
                return false;
            }
            return true;
        } catch (error) {
            console.error('Error while Checking For Disk Space');
            console.error(error);
            return true;
        }
    }

    getPlatformName() {
        if (process.env.CHITKARA) {
            return 'TestPad'
        }
        return 'CQ TestApp'
    }

    get urlWhereLoadFailed() {
        return this.#urlWhereLoadFailed;
    }

    set urlWhereLoadFailed(url) {
        this.#urlWhereLoadFailed = url;
    }

    retryPageLoad() {
        if (this.mainWindow && this.#urlWhereLoadFailed) {
            this.mainWindow.loadURL(this.#urlWhereLoadFailed)
        }
    }
}