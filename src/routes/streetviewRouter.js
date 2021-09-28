const express = require('express');
const router = express.Router();

const streetViewController = require('../controllers/streetviewController');

router.get('/kgen.php', streetViewController.getXmlPano);

router.get('/mapspots.php', streetViewController.getSpots);

router.get('/timeline.php', streetViewController.getTimeline);

router.post('/upload', streetViewController.newSurveys);
router.post('/tupload', streetViewController.testUpload);

router.get('/upload', streetViewController.form);

router.delete('/users/:id', streetViewController.deleteUser);
router.put('/api/users', streetViewController.updateUser);

const all_routes = require('express-list-endpoints');
console.log("StreetView Routes :");
console.log(all_routes(router));

module.exports = router;