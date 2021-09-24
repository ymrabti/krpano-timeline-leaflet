const status = require('http-status');

const models = require('@models/streetviewModel.js');

const LatLon = require('geodesy/latlon-spherical');

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
const has = require('has-keys');
const Sequelize = require('sequelize');
const { Panos, Cercles } = require('../models/streetviewModel');
const Op = Sequelize.Op;
module.exports = {
    async getXmlPano(req, res) {
        if (!has(req.query, 'sv', 'rec_time')) throw { code: status.BAD_REQUEST, message: 'You must specify the streetview and rec_time' };

        let { sv, rec_time, new_batch, old_lat, old_lng } = req.query;
        if (('null' != sv) && new_batch && old_lat && old_lat) {
            where = {
                latitude: { [Op.eq]: parseFloat(old_lat) },
                longitude: { [Op.eq]: parseFloat(old_lng) }
            }
        }

        var dataf = await Panos.findOne({
            attributes: ['id', 'pano', 'latitude', 'longitude', 'heading', 'rec_time', 'cercle_id', 'dist'],
            where: { pano: sv/* , rec_time */ }
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
            <mapspot id="${dataValues.id}" pano="${panoname}" title="${panoname}" lat="${dataValues.latitude}" lng="${dataValues.longitude}" heading="${dataValues.heading}"/>
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
    async getSpots(req, res) {
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
        })).map(e => ({ ...e, id: e['ref_panorama'], ref_cercle: e['id'] }));

        /* let data = await Panos.findAll({
            attributes: ['id', 'pano', 'latitude', 'longitude', 'heading', 'rec_time', 'dist'],
            where, order: ['pano']
        }); */

        res.json(data);
    },
    async deleteUser(req, res) {
        // if (!has(req.params, 'id')) throw { code: status.BAD_REQUEST, message: 'You must specify the id' };
        let data = await Cercles.findAll({
            include: [{
                model: Panos,
                // where: { id: "cercle_id" },
                required: false,
                // where: { "latitude": { [Op.gte]: 34.93239} },
                attributes: [['id', 'ref_panorama'], 'pano', 'heading', 'rec_time', 'dist'],
                order: [['timestamp', 'ASC']],
                limit: 1000
            }],
            attributes: ['id', 'latitude', 'longitude'],
            // order: ['timestamp']
        });

        res.json(data.map((e, i) => {
            return { ...e.dataValues, ...e.dataValues.Panos[0].dataValues, Panos: e.dataValues.Panos.length };
        }));
    },
    async getTimeline(req, res) {
        // if (!has(req.query, ['sv', 'panoid'])) throw { code: status.BAD_REQUEST, message: 'You must specify the id, name and pano' };

        res.json([{ "id": "1", "value": "2017-06-20" }, { "id": "2", "value": "2016-03-10" }, { "id": "3", "value": "2015-05-18" }]);
    },
    async newSurveys(req, res) {
        let radios = 15;
        let cercles = [];
        let panos = [];
        let json = req.body;
        const finalData = json
            // transform the panos and their coordinates en list to add to the db
            // calculating heading, distance to the center, and timestamp
            .map((val, index, arr) => {
                let p1 = new LatLon(val.latitude, val.longitude);
                let next = arr[index + 1];
                let coords = next ? [next.latitude, next.longitude] : [0, 0];
                let pp2 = new LatLon(...coords);
                let heading = p1.bearingTo(pp2);
                let date = new Date("09/04/2021 11:47:26.100 GMT+01:00").getTime();
                return { ...val, heading, timestamp: date + 4 * index * 1000 }
            })
            .reduce((acc, curr) => {
                let p1 = new LatLon(curr.latitude, curr.longitude);
                let label = curr.pano;
                let proches = acc.filter(proche => {
                    let p2 = new LatLon(proche.latitude, proche.longitude);
                    let distance = p1.distanceTo(p2);
                    // check if the survey already exists
                    let _ksd = acc.reduce((cumul, element) => {
                        let exst = element.points.filter(ee => ee.pano === curr.pano).length;
                        return cumul + exst;
                    }, 0);
                    if (radios > distance && _ksd === 0) {
                        // add new pano
                        panos.push({
                            id: uuidv4(),
                            pano: curr.pano,
                            latitude: curr.latitude,
                            longitude: curr.longitude,
                            heading: curr.heading,
                            elevation: curr.elevation,
                            dist: distance,
                            rec_time: curr.REC_TIME,
                            timestamp: curr.timestamp,
                            cercle_id: proche.OBJECTID
                        });
                        cercles.find((val) => val.id == proche.OBJECTID).panoscount++;
                        // add new survey
                        proche.points.push(curr);
                        return true;
                    }
                    return false;
                });
                if (proches.length === 0) {
                    let uuid = uuidv4();
                    curr.OBJECTID = uuid;
                    // push new survey
                    acc.push({ ...curr, points: [] });
                    // push the center of cercle at the new survey
                    // acc.find(ac => ac.pano == label).points.push(curr);
                    // add new cercle
                    cercles.push({
                        id: curr.OBJECTID,
                        latitude: curr.latitude,
                        longitude: curr.longitude,
                        radios,
                        panoscount: 1
                    });
                    // add center of cercle as new pano
                    panos.push({
                        id: uuidv4(),
                        pano: curr.pano,
                        latitude: curr.latitude,
                        longitude: curr.longitude,
                        heading: curr.heading,
                        elevation: curr.elevation,
                        dist: 0,
                        rec_time: curr.REC_TIME,
                        timestamp: curr.timestamp,
                        cercle_id: curr.OBJECTID,
                    });
                }
                return acc;
            }, []);
        cercles = cercles.map((cercle, index, array) => ({
            ...cercle,
            next_pano: index !== array.length - 1 ? array[index + 1].id : null,
            prev_pano: index !== 0 ? array[index - 1].id : null,
            createdat: new Date().getTime(),
            updatedat: new Date().getTime(),
            stampuui: cercle.latitude.toString().replace('.', '') +
                cercle.longitude.toString().replace('.', '')
        }));
        panos = panos.map(element => ({
            ...element,
            createdat: new Date().getTime(),
            updatedat: new Date().getTime(),
            stampuui: element.latitude.toString().replace('.', '') +
                element.longitude.toString().replace('.', '') +
                element.pano
        }));
        await Cercles.bulkCreate(cercles);
        await Panos.bulkCreate(panos);

        res.json({
            status: true, cercles,
            panos, message: {

                panosIn: finalData.reduce((a, c) => a + c.points.length, 0),
                centers: finalData.length,
                somme: finalData.reduce((a, c) => a + c.points.length, 0) + finalData.length,
                expected: json.length
            }
        });
    },
    async updateUser(req, res) {
        if (!has(req.query, 'sv', 'rec_time')) throw { code: status.BAD_REQUEST, message: 'You must specify the streetview and rec_time' };

        let { sv, rec_time, new_batch, old_lat, old_lng } = req.query;
        if (('null' != sv) && new_batch && old_lat && old_lat) {
            where = {
                latitude: { [Op.eq]: parseFloat(old_lat) },
                longitude: { [Op.eq]: parseFloat(old_lng) }
            }
        }

        var dataf = await Panos.findOne({
            attributes: ['id', 'pano', 'latitude', 'longitude', 'heading', 'rec_time', 'cercle_id', 'dist'],
            where: { pano: sv/* , rec_time */ }
        });

        if (!dataf) throw { code: status.NOT_FOUND, message: 'Pano NOT FOUND 404' };

        let dataValues = dataf.dataValues;
        const cercle = await Cercles.findByPk(dataf['cercle_id']);

        let prev_pano = cercle.dataValues['prev_pano']; 
        let next_pano = cercle.dataValues['next_pano']; 

        let prev_pano_1st = await Panos.findAll({
            where: {'cercle_id':prev_pano},
            order: ['timestamp'],
            limit: 1
        });
        let next_pano_1st = await Panos.findAll({
            where: {'cercle_id':next_pano},
            order: ['timestamp'],
            limit: 1
        });

        let next_hotspot = cercle.dataValues['next_pano'] ? `<hotspot name="spot5" style="streetview_arrow" direction= "-7" linkedpano="${prev_pano_1st[0].pano}" description="" imagetype="normal"/>` : "";
        let prev_hotspot = cercle.dataValues['prev_pano'] ? `<hotspot name="spot6" style="streetview_arrow" direction="178" linkedpano="${next_pano_1st[0].pano}" description="" imagetype="normal"/>` : "";

        let panoname = dataValues.pano.replace(".JPG", '') + "_Stitch_XHC";
        var data = `
        <krpano>
            <mapspot id="${dataValues.id}" pano="${panoname}" title="${panoname}" lat="${dataValues.latitude}" lng="${dataValues.longitude}" heading="${dataValues.heading}"/>
            <preview url="https://berkane.xyz/vr/panos/preview_${panoname}.png"/>
            <image>
                <cube url="https://berkane.xyz/vr/panos/${panoname}%s.png" />
            </image>
            ${prev_hotspot}
            ${next_hotspot}
        </krpano>
        `;

        res.json({
            xml: data,
            prev_pano: prev_pano == null,
            next_pano,
            prev_pano_1st:prev_pano_1st[0],
            next_pano_1st:next_pano_1st[0]
        });
    }
}
