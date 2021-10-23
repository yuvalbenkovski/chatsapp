const express = require('express')
const router = express.Router()
const main = require('../controllers/express/indexControllers')

router.route('/')
    .get(main.renderMain)


module.exports = router