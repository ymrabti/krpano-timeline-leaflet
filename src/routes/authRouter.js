const express = require('express');
const router = express.Router();
const path = require('path');
const settings = require('../../settings');


express()
    .set('views', path.resolve(settings.PROJECT_DIR, 'views'))
    .set('view engine', 'ejs')
const authController = require('../controllers/auhController');

router.post('/login', authController.Login);

router.get('/logout', authController.Logout);



const all_routes = require('express-list-endpoints');
console.log("StreetView Routes :");
console.log(all_routes(router));

module.exports = router;