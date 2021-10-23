const moment = require('moment');

module.exports.formatMessage = function (text) {
    return {
        text,
        time: moment().format('H:mm')
    }
}