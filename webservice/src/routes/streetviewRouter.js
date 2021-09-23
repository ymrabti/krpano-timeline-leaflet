const express = require('express');
const router = express.Router();


const user = require('@controllers/streetviewController.js');



router.get('/kgen.php', user.getXmlPano);

router.get('/mapspots.php', user.getSpots);

router.get('/timeline.php', user.getTimeline);

router.post('/panos', user.newSurveys);

router.delete('/users/:id', user.deleteUser);
router.put('/api/users', user.updateUser);

const all_routes = require('express-list-endpoints');
console.log("global routes :");
console.log(all_routes(router));

module.exports = router;