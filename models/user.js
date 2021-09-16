const mongoose = require('mongoose')
const { Schema } = mongoose
const passportLocalMongoose = require('passport-local-mongoose');


const notificationSchema = new Schema({
    count: {
        type: Number,
        default: 0
    },
    from_room: String,
})
const userSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    is_active: {
        type: Boolean
    },
    last_online: {
        type: String
    },
    name: {
        type: String
    },
    profile_picture: {
        path: {
            type: String
        },
    },
    about: {
        type: String,
        default: 'Hey there ! I am using ChatsApp.'
    },
    contacts_list: {
        type: [String]
    },
    socket_id: {
        type: String
    },
    rooms: {
        type: [String]
    },
    notifications: {
        type: [notificationSchema],
    }
})
userSchema.plugin(passportLocalMongoose);
userSchema.set('autoIndex', false);
module.exports.User = mongoose.model('User', userSchema)
module.exports.Notification = mongoose.model('Notification', notificationSchema)