const os = require('os');
const { exec, fork } = require('child_process');
const console = require('electron-log');
const path = require('path');
const checkDiskSpace = require('check-disk-space').default;
const config = require('../config/config');
const extraResourcesPath = config.extraResourcesPath ?? '';
const pathToTheDisplayCheck = path.join(extraResourcesPath, '/monitorDetect.exe');
const processes_to_stop = ['explorer', 'monica', 'whatsapp']
const VMs = ['virtual machine', 'virtualbox', 'qemu', 'vmware', 'parallel', 'utm', 'xen'];
const minimumRequiredMemory = 1024 * 1024 * 1024 * 2;

const vmConstants = {
    'vmware': 1,
    'virtualBox': 2,
    'hyperV': 3,
    'parallels': 4,
    'qemu': 5,
    'xen': 6,
    'docker': 7,
    'azure': 8,
    'aws': 9,
}

const vmNumberToName = Object.entries(vmConstants).reduce((result, [key, value]) => {
    result[value] = key;
    return result;
}, {});

const invalidMacAddressesMap =  new Map([
   [ '00:50:56', vmConstants.vmware], 
   [ '00:0C:29', vmConstants.vmware],
   [ '00:0F:69', vmConstants.vmware],
   [ '08:00:27', vmConstants.virtualBox],
   [ '00:15:5D', vmConstants.hyperV],
   [ '00:1C:42', vmConstants.parallels],
   [ '00:03:FF', vmConstants.parallels],
   [ '52:54:00', vmConstants.qemu],
   [ '00:16:3E', vmConstants.xen],
   [ '02:42:AC', vmConstants.docker],
   [ '00:22:48', vmConstants.azure],
   [ '02:0F:B5', vmConstants.aws],
]);

//TODO REMOVE __dirname from this file 

const ExitCodeToErrorMessage = {
    20: 'Please disconnect multiple display before starting App.',
    23: 'Please provide full file access to the app.',
}

const strictModeScript = (() => {
    switch(os.platform()) {
        case 'win32': {
            let command = '';         
            processes_to_stop.forEach((single_process) => {
                command += `if ((Get-Process -Name ${single_process} -ErrorAction SilentlyContinue)) {taskkill /im ${single_process}.exe /f 2>$null;};`
            })
            command = `powershell.exe -Command "${command}"`
            return command;
        }
        case 'darwin': {
            return command = `if [ $(system_profiler SPDisplaysDataType | grep -c Resolution) -gt 1 ]; then \nexit 20\nfi`
        }
    }
})()
const preStartCheckScript = (() => {
    switch (os.platform()) {
        case 'darwin': {
            return command = `if [ $(system_profiler SPDisplaysDataType | grep -c Resolution) -gt 1 ]; then \nexit 20\nfi`
        }
    }
})()
const removeStrictModeScript = (() => {
    switch(os.platform()) {
        case 'win32': {
            const command =`if (-not (Get-Process -Name explorer -ErrorAction SilentlyContinue)) {Start-Process explorer.exe};`
            return `powershell.exe -Command ${command}`
        }
    }
})() 

/** @returns {Promise<boolean>} */
const runner = (script) => {
    return new Promise((resolve, reject) => {
        console.log(script);
        if (!script) {
            return resolve(true);
        }
        exec(script, (error, stdout, stderr) => {
            if (stderr || error) console.error('Error while executing handler script ');
            if (error?.code) {
                console.error(error);
                const message = ExitCodeToErrorMessage[error.code];
                if (message) {
                    return reject(message);
                }
            }
            resolve(true);
        })

    })
}


const checkForMonitorCountForWindowsUsingC = () => {
    return new Promise((resolve, reject) => {
        exec(pathToTheDisplayCheck, (error, stdout, stderr) => {
            if (stderr || error) console.error(`Error while Checking For Monitor Count`);
            if (error?.code) {
                console.error(error);
                const message = ExitCodeToErrorMessage[error.code];
                if (message) {
                    return reject(message);
                }
            }
            resolve(true);
        })
    })
}
let countOfExecution = 13;


    
const checkForMonitorCountForWindowsUsingPowerShell = () => {
    return new Promise((resolve, reject) => {
        let command  = `(Get-CimInstance -Namespace root\wmi -ClassName WmiMonitorBasicDisplayParams).Length`;
        command = `powershell.exe -Command "${command}"`
        exec( command, (error, stdout, stderr) => {
            if (stderr || error) console.error(`Error while Checking For Monitor Count`);
            if (error?.code) {
                console.error(error);
                const message = ExitCodeToErrorMessage[error.code];
                if (message) {
                    return reject(message);
                }
            }
            resolve(true);
        })
    })
}


const typeOfExcution = {
    'cpp': 0,
    'powerShell': 1,
    'none': 2
}

class ExecCommand {
    /** @type { 0 | 1 | 2} */
    #typeOfExection 
    /**
     * @param {0 | 1 | 2} typeOfExction 
     */
    constructor(typeOfExction) {
        this.#typeOfExection = parseInt(typeOfExction) ?? 0;
    }

    setExectionType(typeOfExction) {
        this.#typeOfExection = parseInt(typeOfExction);
    }
    async strictMode() {
        if (os.platform() !== 'win32') {
            if (os.platform() == 'darwin') {
                countOfExecution++;
                if (countOfExecution > 15) {
                    countOfExecution = 0;
                    fork(path.join(__dirname, '../worker/macOsScreenShareStop.mjs'));
                }
            }
            return runner(strictModeScript);
        }
        try {
            await runner(strictModeScript);
        } catch (error) {
            console.log(error);
        }
        switch(this.#typeOfExection) {
            case 0: {
                return checkForMonitorCountForWindowsUsingC();
            }
            case 1: {
                return checkForMonitorCountForWindowsUsingPowerShell();
            }
            case 2: {
                return ;
            }
        }
    }
    removeStrictMode() {
        return runner(removeStrictModeScript);
    }
    checkForFullDiskAccess() {
        if (os.platform() == 'darwin') {
            return new Promise((resolve, reject) => {
                let processExitedSuccessFully = true;
                const process = fork(path.join(__dirname, '../worker/macOsScreenShareStop.mjs'))
                process.on('message', (...message) => {console.info('FROM WORKER',...message)});
                process.on('exit', (code) => {
                    if (code === 23) {
                        return reject(ExitCodeToErrorMessage[code]);
                    }
                    return resolve();
                });
            })

        }
    }
    async preStartCheck() {
        if (os.platform() !== 'win32') {
            if (os.platform() == 'darwin') {
                fork(path.join(__dirname, '../worker/macOsScreenShareStop.mjs')).on('error', () => {
                    throw new Error()
                });
            }
            return runner(preStartCheckScript);
        }
        switch(this.#typeOfExection) {
            case 0: {
                return checkForMonitorCountForWindowsUsingC();
            }
            case 1: {
                return checkForMonitorCountForWindowsUsingPowerShell();
            }
            case 2: {
                return ;
            }
        }
    }
}
/**
 * Get USB Devices
 */
async function getUSBDevices() {
    const command =
        os.platform() === 'win32'
        ? 'wmic path CIM_LogicalDevice where "Description like \'USB%\'" get /value'
        : os.platform() === 'darwin'
        ? 'system_profiler SPUSBDataType'
        : 'lsusb';

    const [error, stdout] = await new Promise((resolve, reject) => {
        exec(command, (error, stdout) => {
            if (error) {
                console.error('Error fetching USB devices:', error);
                resolve([error, '']);
                return;
            }
            resolve(['', stdout]);
        });
    })
    if (error) {
        throw new Error(error?.message ?? error);
    }
    return stdout.split('\n').filter((line) => line.trim());
}
  

/**
 * Get GPU Information
 */
async function getGPUInfo() {
    const command =
      os.platform() === 'win32'
        ? 'wmic path win32_videocontroller get name'
        : os.platform() === 'darwin'
        ? 'system_profiler SPDisplaysDataType'
        : 'lspci | grep -i vga';
    
    const [error, stdout] = await new Promise((resolve, reject) => {
        exec(command, (error, stdout) => {
            if (error) {
              console.error('Error fetching GPU info:', error);
              resolve([error, '']);
              return;
            }
            resolve(['', stdout]);
        })
    });
    if (error) {
        throw new Error('getGPUInfo failed');
    }
    const gpuList = stdout.split('\n').filter((line) => line.trim());

    // Virtual GPU identifiers for various platforms
    const virtualGpuKeywords = [
    'VirtualBox',          // Oracle VirtualBox
    'VMware',              // VMware
    'Microsoft Basic Display Adapter', // Hyper-V
    'QEMU',                // QEMU/KVM
    'UTM',                 // UTM/QEMU frontend
    'Parallels',           // Parallels Desktop
    'Xen',                 // Xen Project
    'VirGL',               // QEMU/KVM virtual GPU
    'GFX',                 // Generic emulated GPU
    ];

    // Check if any GPU matches known virtual GPU identifiers
    const detectedGPUs = gpuList.filter((gpu) =>
        virtualGpuKeywords.some((keyword) => gpu.toLowerCase().includes(keyword.toLowerCase()))
    );
    return [detectedGPUs, stdout];
}

const detectVMWindows = async () => {
    try {
        let log = '';
        let logsOfCommands = '';
        let isVM = false;
        const tryAll = true;
        const command = `Get-CimInstance Win32_ComputerSystemProduct | select Name`;
        logsOfCommands += 'Exec Platform Name Check: \n'
        const [error, platformNameOutput] = await new Promise((resolve, reject) => {
            exec(`powershell.exe -Command "${command}"`, (err, result) => {
                if (err) {
                    return resolve([err, '']);
                }
                return resolve(['', result?.toLowerCase()]);
            })
        });
        if (error) {
            logsOfCommands += `Command Failed with error: ${error}`;
        }
        logsOfCommands += `\nCommand Output: ${platformNameOutput}`;
        if (!error) {
            for (let vm of VMs) {
                isVM = platformNameOutput.includes(vm);
                if (isVM) {
                    logsOfCommands += `VM Detected by platform name: ${vm}`;
                    break;
                }
            }
        }
        if (!isVM || tryAll) {
            let gpuLogs = '';
            try {
                let vmByGPU = false;
                gpuLogs += `\n\nDetecting GPU: `
                const [gpuInfo, rowInfo] = await getGPUInfo();
                if (gpuInfo.some((gpu) => /VirtualBox|VMware/i.test(gpu))) {
                    vmByGPU = true;
                }
                gpuLogs += `\nGPU Detection Output: ${rowInfo}`;
                isVM = isVM || vmByGPU;
                gpuLogs += `\nResult:  ${vmByGPU?'true':'false'}\n\n`;
                logsOfCommands += gpuLogs;
            } catch (error) {
                logsOfCommands += `\nError while detecting gpu: ` + error?.message ?? error; 
            }
        }

        if (false && (!isVM || tryAll)) {
            try {
                logsOfCommands += `Detecting USB: `
                const usbDevices = await getUSBDevices();
                if (usbDevices.length === 0) {
                    isVM = true;
                    logsOfCommands += `No USB Devices found`;
                }
                logsOfCommands += `\nUSB Detection Output: ${JSON.stringify(usbDevices)}\n`;
                logsOfCommands += `\nResult:  ${(usbDevices?.length == 0)?'true':'false'}\n\n`
            } catch (error) {
                logsOfCommands += `\nError while detecting usb: ` + error?.message ?? error;
            }
        }

        const macAddresses = [];
        const networkInterface = os.networkInterfaces();
        Object.entries(networkInterface).forEach(([key, interface]) => {
            interface.forEach((interfaceInfo) => {
                macAddresses.push(interfaceInfo.mac);
            })
        });
        if (false && (!isVM || tryAll)) {
            logsOfCommands += `\n\nRunning VM Check through mac address. Having mac address not necessary mean user is using vm. Please check systemInfo to validate.\n`;
            logsOfCommands += `Mac Addresss: ${JSON.stringify(macAddresses)}`;
            const macAddressResult = macAddresses.reduce((result, current) => {
                let currentResult = false;
                if (current) {
                    const prefix = current.split(':').filter((_, index) => index < 3).join(':').toUpperCase();
                    if (invalidMacAddressesMap.has(prefix)) {
                        currentResult = true;
                        logsOfCommands += `\nMAC Address match found: ${vmNumberToName[vmConstants[invalidMacAddressesMap.get(prefix)]]}\n` 
                    }
                }
                return result || currentResult;
            }, false);
            logsOfCommands += `\nResult: ${macAddressResult}`;
            isVM = isVM || macAddressResult;
        }

        if (false && (!isVM || tryAll)) {
            const totalMemory = os.totalmem();
            if (totalMemory < minimumRequiredMemory) {
                isVM = true;
                logsOfCommands += `Memory Present ${totalMemory} required ${minimumRequiredMemory}`;
            }
        }

        logsOfCommands += `\n\n\nSystemInfo\n`;
        const [errSystemInfo, systemInfoOut] = await new Promise((resolve, reject) => {
            try {
                exec('systeminfo', (err, result) => {
                    if (err) {
                        return resolve([err, '']);
                    }
                    return resolve(['', result]);
                })
            } catch (error) {
                console.error(error);
                return [error, ''];
            }
        });

        if (errSystemInfo) {
            logsOfCommands += `Error while checking systemInfo: ${errSystemInfo}`;
        }
        logsOfCommands += `Stdout: ${systemInfoOut}`

        return {
            isVM: isVM,
            logs: log + logsOfCommands,
        }
    } catch (error) {
        console.error(error);
        return {
            isVM: false,
            logs: error?.message ?? error,
        }
    }
}

const detectVMLinux = async () => {
    return new Promise((resolve, reject) => {
        exec('echo -n "product_name: "; cat /sys/devices/virtual/dmi/id/product_name 2>/dev/null; echo;', (err, result) => {
            if (err) {
                return resolve({
                    isVM: false,
                    logs: err,
                })
            }
            const name = (result.toString()?.split(':')?.[1] ?? '').trim().replaceAll('\n','').toLowerCase();
            console.log(`Platform Name: ${name}`);
            resolve({
                isVM: VMs.includes(name),
                logs: result,
            });
        })
    })
}

const detectMacOs = async () => {
    return new Promise( async (resolve, reject) => {
        try {
            let logsOfCommands = "";
            let log = "";
            const tryAll = true;
            let isVM = await new Promise((resolve, reject) => {
                exec("system_profiler SPHardwareDataType", (err, result) => {
                    logsOfCommands += `\n\nCommand Used: system_profiler SPHardwareDataType\n`;
                    if (err) {
                        logsOfCommands += '\n\nError In Command system_profiler SPHardwareDataType | grep -i virtual: ' + err; 
                    }
                    const isVM = (result?.includes('virtual')) ?? false;
                    logsOfCommands += `\noutput: ${result}`;
                    logsOfCommands += `\nResult:  ${isVM?'true':'false'}\n\n`
                    resolve(isVM);
                });
            });
            const macAddresses = [];
            const networkInterface = os.networkInterfaces();
            Object.entries(networkInterface).forEach(([key, interface]) => {
                interface.forEach((interfaceInfo) => {
                    macAddresses.push(interfaceInfo.mac);
                })
            });

            if (!isVM || tryAll) {
                try {
                    let vmByGPU = false;
                    logsOfCommands += `\n\n\nDetecting GPU:\n`
                    const [gpuInfo, rowInfo] = await getGPUInfo();
                    if (gpuInfo.some((gpu) => /VirtualBox|VMware/i.test(gpu))) {
                        vmByGPU = true;
                    }
                    logsOfCommands += `\nGPU Detection Output: ${rowInfo}`;
                    isVM = isVM || vmByGPU;
                    logsOfCommands += `\nResult:  ${vmByGPU?'true':'false'}\n\n`
                } catch (error) {
                    logsOfCommands += `\nError while detecting gpu: ` + error?.message ?? error; 
                }
            }

            if (!isVM || tryAll) {
                try {
                    logsOfCommands += `Detecting USB: `
                    const usbDevices = await getUSBDevices();
                    if (usbDevices.length === 0) {
                        isVM = true;
                        logsOfCommands += `No USB Devices found`;
                    }
                    logsOfCommands += `\nUSB Detection Output: ${JSON.stringify(usbDevices)}\n`;
                    logsOfCommands += `\nResult:  ${JSON.stringify(usbDevices ?? '')}\n\n`
                } catch (error) {
                    logsOfCommands += `\nError while detecting usb: ` + error?.message ?? error;
                }
            }

            if (!isVM || tryAll) {
                logsOfCommands += `\n\nRunning VM Check through mac address\n`;
                isVM = macAddresses.reduce((result, current) => {
                    let currentResult = false;
                    if (current) {
                        const prefix = current.split(':').filter((_, index) => index < 3).join(':').toUpperCase();
                        if (invalidMacAddressesMap.has(prefix)) {
                            currentResult = true;
                            logsOfCommands += `MAC Address match found: ${invalidMacAddressesMap.get(prefix)}` 
                        }
                    }
                    return result || currentResult;
                }, false);
            }
            
            if (!isVM || tryAll) {
                const totalMemory = os.totalmem();
                if (totalMemory < minimumRequiredMemory) {
                    isVM = true;
                    logsOfCommands += `Memory Present ${totalMemory} required ${minimumRequiredMemory}`;
                }
            }

            if (isVM) {
                await new Promise((resolve, reject) => {
                    exec('system_profiler', {
                        maxBuffer: 10000000000000,
                    }, (err, result) => {
                        log += "\n\nResult Of System Profiler:\n\n";
                        log += result;
                        resolve();
                    })
                });
            }
            return resolve({
                isVM: isVM,
                logs: log + logsOfCommands,
            });
        } catch (error) {
            console.error(error);
            resolve({
                isVM: false,
                logs: error?.message ?? error,
            });
        }
    }) 
}


const checkIfVM = () => {
    switch(os.platform()) {
        case 'win32': {
            return detectVMWindows();
        }
        case 'linux': {
            return detectVMLinux();
        }
        case 'darwin': {
            return detectMacOs();
        }
    }
    return false;
}

/**
 * @param {string}
 */
const checkForDeskSpace = (location) => {
    return checkDiskSpace(location);
}

module.exports = {
    ExecCommand,
    typeOfExcution,
    checkForDeskSpace,
    checkIfVM,
}