const mongoose = require('mongoose')
const { Schema } = mongoose

const messageSchema = new Schema({
    author: String,
    body: String,
    time: String
})

const roomSchema = new Schema({
    room_name: String,
    members: [String],
    messages: [messageSchema],
/*     notifications: [notificationSchema] */
})
module.exports.Room = mongoose.model('Room', roomSchema)
module.exports.Message = mongoose.model('Message', messageSchema)
