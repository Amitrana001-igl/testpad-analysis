const { app } = require('electron');
const path = require('path');
let isMonitoringApp = false;

// For Caching
require('v8-compile-cache');

for (let index = 0; index < process.argv.length; ++index) {
	console.log(process.argv[index]);
	if (process.argv[index].trim() === 'monitoringMode') {
		if (process.argv?.[index +1] && !isNaN(Number(process.argv[index + 1]))) {
			process.monitorPort = Number(process.argv[index + 1]);
		} else {
			process.monitorPort = 8179;
		}
		process.argv.splice(0, index);
		isMonitoringApp = true;
		process.argv = [process.argv.slice(0, index), ...process.argv.splice(index + 1)];
		break;
	}
}

if (app.name === 'testpad') {
	app.name = 'Testpad';
}

if (isMonitoringApp) {

	require('./monitor');
} else {
	require('./parent');
}
