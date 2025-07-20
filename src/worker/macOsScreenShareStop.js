const { exec, execSync } = require('child_process');
const sql = require('sqlite3');
const fs = require('fs');
const path = require('path');
const console = require('electron-log');
const { app } = require('electron');
const filePath = '/Library/Application Support/com.apple.TCC/TCC.db';
const serviceToCheck = 'kTCCServiceScreenCapture';


/**
 * @type {sql.Database}
 */
let accessDB;
async function getAccessToDB() {
    try {
        const result = await fs.promises.readFile(filePath);
        if (!result) {
            return false;
        }
        const db = await new Promise((resolve, reject) => {
            const db = new sql.Database(filePath);
            db.on('open', () => {
                resolve(db);
            })
            db.on('error', (err) => {
                console.log(err);
                resolve(false);
            })
        });
        if (db === false) {
            return false;
        }
        accessDB = db;
        return true;
    } catch (error) {
        console.log(error);
        return false;
    }
}

/**
 * 
 * @param {{applicationName: string, location: string}} bundleId 
 * @returns 
 */
function getApplicationDetailsFromBundleId(bundleId) {
    try {
        const command = `mdfind kMDItemCFBundleIdentifier = ${bundleId}`;
        const result = execSync(command).toString();
        return {
            location: result.replace('\n', ''),
            name: result.split('/').pop().replace('.app', '').split(' ').join('\\ ').replace('\n', ''),
        }
    } catch (error) {
        throw new Error(`Unable to get the application name against bundleId: ${bundleId}, ErrorMessage: ${error.message ?? error}`);
    }
}

function tccUtilReset() {
    try {
        const command = `tccutil reset ScreenCapture`;
        return execSync(command).toString();
    } catch (error) {
        console.log(error);
    }
}

async function killProcessesWithProcessId(processId) {
    try {
        execSync(`kill -9 ${processId}`);
    } catch (error) {
        console.log(error);
    }
}

function killLsofProcesses() {
    try {
        let appName = app.name;
        if (appName === 'test_codequotient') {
            appName = 'CQ';
        }
        const processThatAreUsingConnections = `kill -9 $(lsof -i |  grep -Ev '${appName}' | grep 'ESTABLISHED' | awk '{print $2}')`;
        const processesGoingToBeStopped = execSync(`lsof -i |  grep -Ev '${appName}' | grep 'ESTABLISHED'`).toString();
        console.info(`
            -------------------------Processing Going To Be Stopped----------------------------
            $Command Used: ${processThatAreUsingConnections}\n\n\n${processesGoingToBeStopped}
            -----------------------------------------------------------------------------------
        `);
        execSync(processThatAreUsingConnections).toString();
    } catch (error) {
        console.error('Error happened while kill program: ',error);
    }
}

function getChildProcessFromGivenProcessId(processId, childProcessSet = new Set()) {
    const ids = new Set();
    const command = `ps -o pid $(pgrep ${processId})`;
    try {
        const result = execSync(command).toString();
        console.log(result);
        result.split('\n').forEach((element, index) => {
            if (element && !isNaN(Number(element))) {
                element = Number(element);
                if (!childProcessSet.has(element)) {
                    console.log('Checking For Process: ', element);
                    childProcessSet.add(element);
                    // const childProcessIds = getChildProcessFromGivenProcessId(element, childProcessSet);
                }
            }
        });
    } catch (error) {
        console.log(error);
        return [];
    }
    return Array.from(childProcessSet);
}

/**
 * 
 * @param {{name: string, location: string}} applicationName 
 * @returns 
 */
function getProcessIdFromApplicationDetails(applicationName) {
    let processIds;
    try {
        processIds = execSync(`ps aux | grep "${applicationName.location}\\|${applicationName.name}" | awk '{print $2}'`).toString();
        processIds = processIds.split('\n').reduce((result, current) => {
            if (current && !isNaN(Number(current))) {
                result.push(Number(current))
            }
            return result;
        }, []);
        console.log(processIds);
        return processIds;
    } catch (error) {
        console.log(error);
        resolve([]);
    }
    return processIds;
}

/**
 * @returns {Promise<Array<string>>}
 */
async function getAppHavingStreamPermission() {
    const bundleIds = await new Promise((resolve, reject) => {
        try {
            accessDB.all(`SELECT * from access where service = '${serviceToCheck}';`, (error, rows) => {
                if (error) throw new Error(error);
                const servicesToStop = new Set();
                try {
                    rows.forEach((row) => {
                        servicesToStop.add(row.client);
                    })
                    resolve(Array.from(servicesToStop));
                } catch (error) {
                    console.error(error);
                    reject(error?.message ?? error);
                }
            })
        } catch (error) {
            console.error(error);
        }
    })
    return bundleIds;
}


async function main() {
    console.log('Getting DB Access');
    if (!accessDB) {
        await getAccessToDB();
    }
    console.log('Access acquired');
    const appsHavingStreamPermission = await getAppHavingStreamPermission();
    const appDetails = [];
    for (let currentProcessUnderInvestigation of appsHavingStreamPermission) {
        try {
            const appInfo = await getApplicationDetailsFromBundleId(currentProcessUnderInvestigation);
            console.log(appInfo);
            appDetails.push(appInfo);
        } catch (error) {
            console.log(error);
        }
    }

    for (let singleAppDetails of appDetails) {
        console.log(singleAppDetails);
        const processIds = getProcessIdFromApplicationDetails(singleAppDetails);
        console.log(`Process Name: ${singleAppDetails.name} processIds: `, processIds);
        let childProcessIds = [...processIds];
        for (let processId of processIds) {
            const currentProcessChildIds = getChildProcessFromGivenProcessId(processId);
            childProcessIds = [...childProcessIds, ...currentProcessChildIds]
        }
        singleAppDetails.processesToKill = childProcessIds;
        childProcessIds.forEach((processId) => {
            killProcessesWithProcessId(processId);
        })
    }
    tccUtilReset();
}

module.exports = {
    main,
    tccUtilReset,
    getAccessToDB,
    killLsofProcesses,
}