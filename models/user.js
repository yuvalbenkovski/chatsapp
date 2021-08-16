const mongoose = require('mongoose')
const { Schema } = mongoose
const passportLocalMongoose = require('passport-local-mongoose');

const userSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    is_active: {
        type: Boolean
    },
    name: {
        type: String
    },
    status: {
        type: String
    },
    profile_picture: {
        path: {
            type: String
        },
    },
    about: {
        type: String
    }
})
userSchema.plugin(passportLocalMongoose);
module.exports.User = mongoose.model('User', userSchema)