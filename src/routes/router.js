const router = require('express').Router();


// Users routes

router.use(require('@routes/streetviewRouter'));
router.use('/auth',require('@routes/authRouter'));


const all_routes = require('express-list-endpoints');
console.log("Global Routes :");
console.log(all_routes(router));
module.exports = router;