const status = require('http-status');
// const models = require('@models/streetviewModel.js');
const has = require('has-keys');
const Sequelize = require('sequelize');

const { Panos, Cercles } = require('../models/streetviewModel');

const Op = Sequelize.Op;



module.exports = {
    getXmlPano: async function (req, res) {
        if (!has(req.query, 'sv', 'rec_time')) throw { code: status.BAD_REQUEST, message: 'You must specify the streetview and rec_time' };

        let { sv, rec_time, new_batch, old_lat, old_lng } = req.query;
        /* if (('null' != sv) && new_batch && old_lat && old_lat) {
            where = {
                latitude: { [Op.eq]: parseFloat(old_lat) },
                longitude: { [Op.eq]: parseFloat(old_lng) }
            }
        }
 */
        var dataf = await Panos.findOne({
            attributes: ['id', 'pano', 'latitude', 'longitude', 'heading', 'rec_time', 'cercle_id', 'dist'],
            where: { pano: sv }
        });

        if (!dataf) throw { code: status.NOT_FOUND, message: 'Pano NOT FOUND 404' };

        let dataValues = dataf.dataValues;
        const cercle = await Cercles.findByPk(dataf['cercle_id']);

        let prev_pano = cercle.dataValues['prev_pano'];
        let next_pano = cercle.dataValues['next_pano'];

        let prev_pano_1st = await Panos.findAll({
            where: { 'cercle_id': prev_pano },
            order: ['timestamp'],
            limit: 1
        });
        let next_pano_1st = await Panos.findAll({
            where: { 'cercle_id': next_pano },
            order: ['timestamp'],
            limit: 1
        });
        let prev_length = prev_pano_1st.length;
        let next_length = next_pano_1st.length;

        let prev_hotspot = prev_length != 0 ? `<hotspot name="spot1" style="streetview_arrow" direction= "178" linkedpano="${prev_pano_1st[0].pano}" description="" imagetype="normal"/>` : "";
        let next_hotspot = next_length != 0 ? `<hotspot name="spot2" style="streetview_arrow" direction="-7" linkedpano="${next_pano_1st[0].pano}" description="" imagetype="normal"/>` : "";

        let panoname = dataValues.pano.replace(".JPG", '') + "_Stitch_XHC";
        var data = `
        <krpano>
            <mapspot id="${dataf['cercle_id']}" pano="${panoname}" title="${panoname}" lat="${dataValues.latitude}" lng="${dataValues.longitude}" heading="${dataValues.heading}"/>
            <preview url="https://berkane.xyz/vr/panos/preview_${panoname}.png"/>
            <image>
                <cube url="https://berkane.xyz/vr/panos/${panoname}%s.png" />
            </image>
            ${next_hotspot}
            ${prev_hotspot}
        </krpano>
        `;

        res.header("Content-Type", "application/xml");
        res.status(200).send(data);
    },
    getTimeline: async function (req, res) {
        if (!has(req.query, ['sv'])) throw { code: status.BAD_REQUEST, message: 'You must specify the streetview pano' };
        let { sv } = req.query;

        var dataf = await Panos.findOne({
            attributes: ['id', 'pano', 'latitude', 'longitude', 'heading', 'rec_time', 'cercle_id', 'dist'],
            where: { pano: sv/* , rec_time */ }
        });

        if (!dataf) throw { code: status.NOT_FOUND, message: 'Pano NOT FOUND 404' };

        let dataValues = dataf.dataValues;
        const dates = await Panos.findAll({
            where: {
                'cercle_id': dataValues['cercle_id']
            }
        });
        /* console.log('\n\n');
        console.log();
        console.log('\n\n'); */
        res.json(dates.map(e => ({ id: e.dataValues.pano, value: e.dataValues.rec_time, timestamp: e.dataValues.timestamp })));
    },
    getSpots: async function (req, res) {
        if (!has(req.query, ['lat1', 'lat2', 'lng1', 'lng2', 'rec_time']))
            throw { code: status.BAD_REQUEST, message: 'You must specify the Bounds' };
        let { lat1, lat2, lng1, lng2, rec_time } = req.query;
        let where = {
            latitude: { [Op.between]: [parseFloat(lat1), parseFloat(lat2)] },
            longitude: { [Op.between]: [parseFloat(lng1), parseFloat(lng2)] },
        };
        let include0 = {
            model: Panos,
            required: false,
            attributes: [['id', 'ref_panorama'], 'pano', 'heading', 'rec_time', 'dist'],
            order: [['timestamp', 'ASC']],
            limit: 1000
        };

        /*  */
        Panos.belongsTo(Cercles, { foreignKey: 'cercle_id' });
        Cercles.hasMany(Panos, { foreignKey: 'cercle_id' });

        let data = await Cercles.findAll({
            include: [include0], where,
            attributes: ['id', 'latitude', 'longitude'],
        }).map(e => ({
            ...e.dataValues,
            ...e.dataValues.Panos[0].dataValues,
            Panos: e.dataValues.Panos.length
        }))//.map(e => ({ ...e, id: e['ref_panorama'], ref_cercle: e['id'] }));

        /* let data = await Panos.findAll({
            attributes: ['id', 'pano', 'latitude', 'longitude', 'heading', 'rec_time', 'dist'],
            where, order: ['pano']
        }); */

        res.json(data);
    },
    
}
