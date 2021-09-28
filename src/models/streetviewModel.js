const Sequelize = require('sequelize');

const db = require('@models/database.js');

const Cercles = db.define('Cercles', {
    id: {
        primaryKey: true,
        type: Sequelize.STRING
    },
    latitude: {
        type: Sequelize.NUMBER
    },
    longitude: {
        type: Sequelize.NUMBER
    },
    next_pano: {
        type: Sequelize.STRING
    },
    prev_pano: {
        type: Sequelize.STRING
    },
    radios: {
        type: Sequelize.NUMBER
    },
    createdat: {
        type: Sequelize.DATE
    },
    updatedat: {
        type: Sequelize.DATE
    },
    stampuui:{
        type:Sequelize.STRING
    }
})
const Panos = db.define('Panos', {
    id:{
        primaryKey:true,
        type:Sequelize.STRING
    },
    pano:{
        type:Sequelize.STRING
    },
    latitude:{
        type:Sequelize.NUMBER
    },
    longitude:{
        type:Sequelize.NUMBER
    },
    heading:{
        type:Sequelize.NUMBER
    },
    elevation:{
        type:Sequelize.NUMBER
    },
    dist:{
        type:Sequelize.NUMBER
    },
    rec_time:{
        type:Sequelize.DATE
    },
    timestamp:{
        type:Sequelize.NUMBER
    },
    cercle_id:{
        type:Sequelize.STRING
    },
    createdat:{
        type:Sequelize.STRING
    },
    updatedat:{
        type:Sequelize.STRING
    },
    stampuui:{
        type:Sequelize.STRING
    }
})


Panos.belongsToMany(Cercles, {
    through: 'usergroups',
    sourceKey: 'cercle_id'
});




module.exports = { Cercles,Panos };