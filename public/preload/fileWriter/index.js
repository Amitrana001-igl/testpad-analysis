class AbstractFileWriter {

    /**
     * 
     * @param {string} filePath 
     * @param {{ onCompletion?: (string) => void }} config 
     */
    constructor(filePath, config) {}

    /**
     * @type {boolean}
     */
    isCompleted;

    /**
     * @param {Blob} blob
     */
    write(blob) {}

    writeAllChunks() {}
    setWriteComplete() {}
}


module.exports = AbstractFileWriter;