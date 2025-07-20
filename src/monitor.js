const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const log = require('electron-log');
const { exec } = require('child_process');
const config = require('./config');
const { main, killLsofProcesses } = require('./worker/macOsScreenShareStop');
log.transports.console.format = 'Monitor:{h}:{i}:{s} {text}';
// PORT 8129;
const { createServer } = require('http');
const { promisify } = require('util');

console = log;
const execPromise = promisify(exec);

const exitCodes = {
    'explicit':  20,
    'stale': 10,
}

// TODO Make this better
let isProcessingMicDisable = false;

const autoCloseDurationMilliSeconds = 2 * 60  * 1000;
const checkIntervalMilliSeconds = 10 * 1000;

const createCloseTerminal = () => {
    return setTimeout(() => {
        app.exit(exitCodes.stale);
    }, autoCloseDurationMilliSeconds);
}

let autoCloseTimeout = createCloseTerminal();

const server = createServer((req,res) => {
    if (req.method !== 'GET') {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.write('{"Bad Request": "Something went wrong"}');
        return res.end();
    }
    if (req.url === "/isMonitoringAppRunning") {
        clearTimeout(autoCloseTimeout);
        autoCloseTimeout = createCloseTerminal();
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.write(`{"pid": ${process.pid}}`)
        return res.end();
    }
    if (req.url === "/exit") {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.write(`{"kill": 1}`);
        res.end();
        return app.quit();
    }
    res.statusCode = 404;
    res.write('NOT FOUND');
    res.end();
    return;
})

app.whenReady().then( async () => {
    try {
        app.dock.hide();
        // const isAllowed  =  await config.programManger.checkForFullDiskAccess();
        server.listen(process.monitorPort);

        // TODO: Make this code better
        setInterval(async () => {
            if (isProcessingMicDisable) {
                return;
            }
            isProcessingMicDisable = true;
            try {
                await execPromise('sudo killall coreaudiod');
                console.log('Mic turned off successfully.');
            } catch (error) {
                console.error('Mic Off failed, with error = ',error);
            }
            isProcessingMicDisable = false;
        }, 1 * 1000);
        // const isAllowed  =  await config.programManger.checkForFullDiskAccess();
        setInterval( async () => {
            try {
                await killLsofProcesses();
            } catch (error) {
                console.log(error);
            }
        }, checkIntervalMilliSeconds);
    } catch (error) {
        console.info('Access TO DB not present');
        console.log(error);
        app.exit();
    }
    app.on('quit', () => {
        app.exit();
    });
});