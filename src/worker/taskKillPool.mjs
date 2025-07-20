import {execSync} from 'child_process';
import { parentPort } from 'worker_threads';

class Executer{
    #elementsToEnd;
    #interval;

    constructor() {
        this.#elementsToEnd = [];
        this.#interval = null;
    }

    /**
     * 
     * @param {{name: string, priority: boolean}} process 
     */
    addTask(process, priority) {
        if (priority) {
            return this.#elementsToEnd.unshift(process);
        }
        return this.#elementsToEnd.push(process.name);
    }

    startInterval() {
        this.#interval = setInterval(() => {
            const processToKill = this.#elementsToEnd.shift();
            if (processToKill) {
                try {
                    console.log('Process To Kill: ', processToKill);
                    const command = `powershell.exe -Command "wmic process where \"name='${processToKill}'\" delete;taskkill /IM \"${processToKill}.exe\" /f /t"`;
                    const result = execSync(command);
                } catch (error) {
                }
            }
        }, 2000);
    }
}

const taskKill = new Executer();
taskKill.startInterval()

parentPort.on("message", (data) => {
    try{
        data = JSON.parse(data);
    } catch (error) { }
    if (data.processName) {
        taskKill.addTask({
            name: data.processName,
            priority: !!data.priority
        });
    }
})