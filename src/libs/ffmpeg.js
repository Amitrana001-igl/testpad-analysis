const ffmpegPath = require('ffmpeg-static').path;
const ffmpeg_static = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked')
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpeg_static)
ffmpeg.setFfprobePath(ffmpegPath);

const defaultTimeOffset = (5 * 60 + 30) * 60;

const getTimeStreamFilePath = async (filePath) => {
    const extension = path.extname(filePath);
    const timeStampVideoPath = filePath.replace(`${extension}`, `-with-timestamp${extension}`);
    try {
        const stats = await fs.promises.stat(timeStampVideoPath);
        if (!stats.size) {
            return null;
        }
        return timeStampVideoPath;
    } catch (error) {
        console.error(error);
        return null;
    }
}

const addTimeStampToVideo = async (filePath) => {
    const time = Math.floor(parseInt((path.basename(filePath)))/1000) + defaultTimeOffset;
    const uploadFileName = path.join(filePath, `../${time}-with-timestamp.webm`)
    const ffmpegInstance = ffmpeg({
        logger: console,
    });
    try {
        const isFilePresent = await fs.promises.stat(uploadFileName);
        if (isFilePresent) return uploadFileName;
    } catch (error) {}
    console.log(`${filePath} process started at ${new Date().toString()}`);
    ffmpegInstance.input(filePath)
    .videoFilter([
        {
            filter: "drawtext",
            options: {
                text: `'%{pts\\:gmtime\\:${time}\\:%Y-%m-%d %I\\\\\\:%M\\\\\\:%S %p IST}'`,//\\:%Y-%m-%d //%I\\\\\\:%M\\\\\\:%S %p}",
                fontcolor: "white",
                fontsize: 24,
                box: 1,
                boxcolor: "0x00000088",
                boxborderw:10,
                x: 10,
                y: 10
            }
        }
    ]).output(uploadFileName);
    await new Promise((resolve, reject) => {
        ffmpegInstance.on('end', () => {
            resolve();
        })
        ffmpegInstance.on('error', (error) => {
            reject(error);
        });
        ffmpegInstance.run();
    });
    console.log(`${filePath} process ended at ${new Date().toString()}`);
    return uploadFileName;
}


module.exports = {
    addTimeStampToVideo,
    getTimeStreamFilePath,
}