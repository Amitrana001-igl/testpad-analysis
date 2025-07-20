const { screen, session, desktopCapturer, app } = require('electron');
const fs = require('fs');
const path = require('path');

const config = require('../config/config')

/**
 * 
 * @param {string | null} link 
 * @returns 
 */
const parseLink = (link) => {
    const allowedUrl = config.allowedUrl;

    link = link?.trim()
	if (!link) {
		return null;
	}
    if (link.indexOf('/test/') === -1) {
		return null;
	}

    
    let linkParts = link.split('://');
    if (linkParts.length < 2) {
        linkParts = link.split('//');
    }
    if (linkParts.length < 2) {
        // no protocol
        if (link.startsWith('localhost') || link.startsWith('127.0.0.1')) {
            link = 'http:/' + link
        } else {
            link = 'https:/' + link
        }
    } else {
        link = linkParts.join('://');
    }
    for( let singleAllowedLink of allowedUrl) {
        if (link.startsWith(singleAllowedLink)) {
            if (link.includes('/invite/') && link.startsWith('https://tests.')) {
                const token = link.split('/invite/')[1];
                link = link.replace('tests.','');
                link = link.split('/test/')[0] + `/test/invite/${token}`
            }
            if (link.includes('/invite/') && link.startsWith('https://exam.')) {
                const token = link.split('/invite/')[1];
                link = link.replace('exam.', 'assess.');
                link = link.split('/test/')[0] + `/test/invite${token}`;
            }
            return link;
        }
    }
    return null;
}

/**
 * @param {string} folderPath
 */
const ensureDir = (folderPath) => {
    console.log(folderPath);
    if (fs.existsSync(folderPath)) {
        return;
    }
    fs.mkdirSync(folderPath);
}

/**
 * 
 * @param {{ quizId: string, userId: string } | undefined} config 
 */
const getPathForRecording = (config) => {
    const basePath = path.join(app.getPath('appData'), 'recording');
    ensureDir(basePath);
    if (config) {
        const finalPath = path.join(basePath, `recording-${config.quizId}-${config.userId}`);
        ensureDir(finalPath);
        return finalPath;
    }
    return basePath;
}

module.exports = {
    parseLink,
    ensureDir,
    getPathForRecording,
}