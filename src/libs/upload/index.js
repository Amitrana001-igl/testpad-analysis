const { app, ipcMain } = require('electron');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const config = require('../../config/config');
const {retry} = require('../retry');

const FormData = require('form-data');
const { programManger } = require('../../config');

const {db, initDataBase} = require('./db')

const sequelize = require('sequelize');

const {columns, uploadedStatus} = require('./db/constants');
const { getTimeStreamFilePath } = require('../ffmpeg');

let interval = null

let isProcessingData = null;


/**
 * 
 * @param { sequelize.Model<any, any> } record 
 */
async function handleUpload(record) {
    const obj = record;
    const metaData = JSON.parse(record[columns.data]);
    try {
        const isFilePresent = await fs.promises.stat(metaData.path);
        if (isFilePresent.size == 0) {
            throw new Error('Size 0bytes');
        }
    } catch (error) {
        console.error(error);
        obj.error = error?.message ?? error;
        record.update({
            [columns.uploaded]: uploadedStatus.error,
        })
        programManger.mainWindow?.webContents.send('upload-failed-file-not-present', record.quizId, record.userId, obj);
        throw error;
    }
    let actualFilePath = await getTimeStreamFilePath(metaData.path);
    actualFilePath = actualFilePath ?? metaData.path;
    const error = await retry(async () => {
        await uploadFile(metaData, actualFilePath, record.quizId, record.userId)
    }, 5);
    if (error) {
        console.error("ERROR WHILE UPLOADING==============================");
        for (let err of error) {
            console.error(err.message ?? err);
        }
        console.log('Details of the recording: ', record);
        console.error("ERROR WHILE UPLOADING==============================");
        isProcessingData = null;
        programManger.mainWindow?.webContents.send('upload-failed-server', record.quizId, record.userId, obj);
        return;
    }
    record.update({
        [columns.uploaded]: uploadedStatus.uploaded,
    });
    try {
        await fs.promises.rm(metaData.path);
        if (metaData.path !== actualFilePath) {
            await fs.promises.rm(actualFilePath);
        }
    } catch (error) {
        console.error('Error while removing file: ', metaData.path);
    }
    programManger.mainWindow?.webContents.send('video-uploaded', record.quizId, record.userId, obj);
}

function startUploadQueue() {
    interval = setInterval( async () => {
        try {
            if (isProcessingData) {
                console.log('Currently Processing: ', isProcessingData);
                return;
            }
            isProcessingData = true;
            const record = await db.findOne({
                where: {
                    [columns.uploaded]: uploadedStatus.pending,
                    [Op.or]: [
                        { [columns.max_wait]: { [Op.is]: null } },
                        { [columns.max_wait]: { [Op.lt]: Date.now() } },
                    ]
                }
            })
            if (!record) {
                isProcessingData = null; 
                return;
            }
            isProcessingData = record;
            if (record[columns.max_wait] > Date.now()) {
                return;
            }
            await handleUpload(record);
            isProcessingData = false;
        } catch (error) {
            console.log(error);
            isProcessingData = false;
        }
    }, 10000);
};

async function forceUploadFiles(userId, quizId) {
    clearInterval(interval);
    if (isProcessingData) {
        await new Promise((resolve, reject) => {
            const intervalId = setInterval(() => {
                if (!isProcessingData) {
                    clearInterval(intervalId);
                    return resolve();
                }
            }, 300)
        })
    }
    const condition = {
        [Op.and]: {
            [columns.quizId]: quizId,
            [columns.uploaded]: uploadedStatus.pending,
        }
    }
    if (userId) {
        condition[Op.and][columns.userId] = userId;       
    }
    const records = await db.findAll({
        where: condition,
        order: [
            [columns.id, 'ASC']
        ]
    });
    const promiseArray = [];
    for (let record of records) {
        promiseArray.push(handleUpload(record));
    }
    await Promise.all(promiseArray);
    programManger.mainWindow?.webContents.send('all-video-uploaded');
}

async function pushIntoUploadQueue(id) {
    db.update({
        [columns.max_wait]: null
    }, {
        where: {
            [columns.id]: id,
        }
    })
}

/**
 * 
 * @param {{path: string, quizId: string, userId: string, weightTime: number}} param0 
 * @returns 
 */
async function getUploadId({path, quizId, userId, weightTime}) {
    const result = await db.create({
        [columns.max_wait]: weightTime,
        [columns.data]: JSON.stringify({path}),
        [columns.quizId]: quizId,
        [columns.userId]: userId,
    })
    return result.id;
} 

/**
 * 
 * @param {{ path: string, quizId: string, userId: string }} data 
 */
async function uploadFile(data, filePath,quizId, userId) {
    const fileToUpload = filePath
    const uploadLocation = `${config.QUIZ_STATIC}/recording/get-presigned-url-upload-stream`;
    const url = new URL(uploadLocation);
    const stats = await fs.promises.stat(data.path);
    const fileName = data.path.split('/').pop();
    
    url.searchParams.set('quizId', quizId);
    url.searchParams.set('userId', userId);
    url.searchParams.set('fileName', fileName);
    url.searchParams.set('fileSize', stats.size);

    let response = null;
    try {
        response = await axios.default.get(url.toString());
        if (response.data.error) {
            throw new Error(response.data.error);
        }
    } catch (error) {
        if (error instanceof axios.AxiosError) {
            if (error?.response?.status == 409) {
                return 
            }
        }
        console.error('Fetch Axios Error');
        throw error;
    }

    response = response.data;
    const formData = new FormData();
    Object.keys(response.fields).forEach((value) => {
        formData.append(value, response.fields[value]);
    });

    formData.append('file', fs.createReadStream(fileToUpload));

    await axios.default.post(response.url, formData, {
        headers: {
            ...formData.getHeaders()
        }
    });
    console.log(`${data.path} File Uploaded..`)
}

module.exports = {
    getUploadId,
    initDataBase,
    startUploadQueue,
    forceUploadFiles,
    pushIntoUploadQueue,
}