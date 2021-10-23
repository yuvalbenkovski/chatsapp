const express = require('express')
const router = express.Router()
const authControllers = require('../controllers/express/authControllers')
const passport = require("passport");
const multer = require("multer");
const { storage } = require("../cloudinary/index");
const upload = multer({ storage });

router.route('/login')
    .get(authControllers.renderLoginPage)
    .post(passport.authenticate("local", { failureRedirect: "/login", failureFlash: true, }), authControllers.loginUser)
router.route('/logout')
    .get(authControllers.logoutUser);
router.route('/register')
    .get(authControllers.renderRegistrationPage)
    .post(upload.single("inpFile"), authControllers.registerUser)
module.exports = router