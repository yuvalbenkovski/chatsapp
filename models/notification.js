const mongoose = require('mongoose')
const { Schema } = mongoose

const notificationSchema = new Schema({
    counter: Number,
    reciever: String,
    room_name: String
})

module.exports.Notification = mongoose.model('Notification', notificationSchema)