const express = require('express');
const router = express.Router();
const path = require('path');
const settings = require('../../settings');
var json2xls = require('json2xls');
router.use(json2xls.middleware);

var favicon = require('serve-favicon');

router.use(favicon(path.join(settings.PROJECT_DIR, 'public', 'node.svg')));


express()
    .set('views', path.resolve(settings.PROJECT_DIR, 'views'))
    .set('view engine', 'ejs')
const { newSurveys, testUpload, json_upload, form } = require('@controllers/convertController');
const { getXmlPano, getSpots, getTimeline } = require('../controllers/streetviewController');

router.get('/kgen.php', getXmlPano);

router.get('/mapspots.php', getSpots);

router.get('/timeline.php', getTimeline);

router.post('/upload', newSurveys);
router.post('/tupload', testUpload);
router.post('/json_upload', json_upload);

router.get('/upload', form);


/* const all_routes = require('express-list-endpoints');
console.log("StreetView Routes :");
console.log(all_routes(router)); */

module.exports = router;