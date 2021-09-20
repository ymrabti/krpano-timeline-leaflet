
const Sequelize = require('sequelize');

const db = require('@models/database.js');


const users = db.define('StreetViewPanos', {
    id: {
        primaryKey: true,
        type: Sequelize.NUMBER
    },
    geom: {
        type: Sequelize.GEOMETRY
    },
    rec_time: {
        type: Sequelize.DATE
    },
    y: {
        type: Sequelize.NUMBER
    },
    x: {
        type: Sequelize.NUMBER
    },
    z: {
        type: Sequelize.NUMBER
    },
    images: {
        type: Sequelize.STRING
    },
    bearing: {
        type: Sequelize.NUMBER
    }
})


module.exports = users;