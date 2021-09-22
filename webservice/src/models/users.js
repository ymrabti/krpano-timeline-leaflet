
const Sequelize = require('sequelize');

const db = require('@models/database.js');


const StreetViewPanos = db.define('StreetViewPanos', {
    id: {
        primaryKey: true,
        type: Sequelize.NUMBER
    },
    geom: {
        type: Sequelize.GEOMETRY
    },
    REC_TIME: {
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


module.exports = {StreetViewPanos};