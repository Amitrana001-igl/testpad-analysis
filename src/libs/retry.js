
/**
 * 
 * @param {async () => {}} taskToPerform 
 * @param {number} retryTime 
 * @returns {Promise<Array<Error> | undefined>}
 */
const retry = async (taskToPerform, retryTime) => {
    let success = false;
    let errors = [];
    for (let index = 0; index < retryTime; ++index) {
        try {
            await taskToPerform();
            success = true;
            break;
        } catch (error) {
            errors.push(error);
        }
    }
    if (!success) {
        return errors;
    }
}

module.exports = {
    retry
}