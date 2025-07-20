const config = require('./config');
const ProgramManager = require('./programManager.js');
const path = require('path');

const notifiationIcon = path.resolve(__dirname, '../../public/images/logo-padded.png')
const workerBasePath = path.resolve(__dirname, '../worker');

const programManger = new ProgramManager(notifiationIcon);

const allowedUrl = config.allowedUrl;
Object.freeze(allowedUrl);

const pathForExtraResources = path.join(__dirname, '../../extra');
module.exports =  {
    config,
    programManger,
    logoPath: notifiationIcon,
    /** @type {'local' | 'production' | 'testing'} */
    env : process.env.NODE_ENV,
    allowedUrl: allowedUrl,
    minimumDiskSpaceRequired: 1024 * 1024 * 1024, 
    pathForExtraResources,
}