const status = require('http-status');

const models = require('@models/users.js');

const LatLon = require('geodesy/latlon-spherical');

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
const has = require('has-keys');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
module.exports = {
    async getXmlPano(req, res) {
        if (!has(req.query, 'sv', 'REC_TIME')) throw { code: status.BAD_REQUEST, message: 'You must specify the streetview and REC_TIME' };

        var where = {};
        let { sv, REC_TIME, new_batch, old_lat, old_lng } = req.query;
        if (('null' != sv) && new_batch && old_lat && old_lat) {
            where = {
                y: { [Op.eq]: parseFloat(old_lat) },
                x: { [Op.eq]: parseFloat(old_lng) }
            }
        }

        var dataf = await models.StreetViewPanos.findOne({
            attributes: ['id', ['images', 'pano'], ['y', 'latitude'], ['x', 'longitude'], ['bearing', 'heading'], ['batch', 'REC_TIME'], 'dist'],
            where: { images: sv/* , REC_TIME */ }
        });

        if (!dataf) throw { code: status.BAD_REQUEST, message: 'not found' };

        let dataValues = dataf.dataValues;
        let panoname = dataValues.pano.replace(".JPG", '') + "_Stitch_XHC";
        var data = `
        <krpano>
            <mapspot id="${dataValues.id}" pano="${panoname}" title="${panoname}" lat="${dataValues.latitude}" lng="${dataValues.longitude}" heading="${dataValues.heading}"/>
            <preview url="https://berkane.xyz/vr/panos/preview_${panoname}.png"/>
            <image>
                <cube url="https://berkane.xyz/vr/panos/${panoname}%s.png" />
            </image>
            <hotspot name="spot1" style="streetview_arrow" direction="177" linkedpano="20160310-11140819" description="" imagetype="sequence"/>
            <hotspot name="spot2" style="streetview_arrow" direction= "-6" linkedpano="20160310-11140821" description="" imagetype="sequence"/>
            <hotspot name="spot3" style="streetview_arrow" direction="177" linkedpano="20160310-11140818" description="" imagetype="normal"/>
            <hotspot name="spot4" style="streetview_arrow" direction= "-6" linkedpano="20160310-11140822" description="" imagetype="normal"/>
            <hotspot name="spot5" style="streetview_arrow" direction= "-7" linkedpano="20160310-11140823" description="" imagetype="normal"/>
            <hotspot name="spot6" style="streetview_arrow" direction="178" linkedpano="20160310-11140817" description="" imagetype="normal"/>
        </krpano>
        `;

        res.header("Content-Type", "application/xml");
        res.status(200).send(data);
    },
    async getSpots(req, res) {
        if (!has(req.query, ['lat1', 'lat2', 'lng1', 'lng2', 'rec_time']))
            throw { code: status.BAD_REQUEST, message: 'You must specify the Bounds' };
        let { lat1, lat2, lng1, lng2, rec_time } = req.query;

        let data = await models.StreetViewPanos.findAll({
            attributes: ['id', ['images', 'pano'], ['y', 'latitude'], ['x', 'longitude'], ['bearing', 'heading'], ['batch', 'REC_TIME'], 'dist'],
            where: {
                y: { [Op.between]: [parseFloat(lat1), parseFloat(lat2)] },
                x: { [Op.between]: [parseFloat(lng1), parseFloat(lng2)] },
                // REC_TIME:REC_TIME
            },
            order: ['images']
        });
        res.json(data);
    },
    async getTimeline(req, res) {
        res.json([{ "id": "1", "value": "2016-06-20" }, { "id": "2", "value": "2016-03-10" }, { "id": "3", "value": "2015-05-18" }]);
    },
    /* async newSurveys(req, res) {
        let { name, email } = req.body;

        await modele.create({ name, email });

    }, */
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
                            id_pano: uuidv4(),
                            pano: curr.pano,
                            latitude: curr.latitude,
                            longitude: curr.longitude,
                            heading: curr.heading,
                            elevation: curr.elevation,
                            dist: distance,
                            REC_TIME: curr.REC_TIME,
                            timestamp: curr.timestamp,
                            cercle_id: proche.OBJECTID
                        });
                        cercles.find((val) => val.id_cercle == proche.OBJECTID).panoscount++;
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
                        id_cercle: curr.OBJECTID,
                        latitude: curr.latitude,
                        longitude: curr.longitude,
                        next: null,
                        prev: null,
                        radios,
                        panoscount: 1
                    });
                    // add center of cercle as new pano
                    panos.push({
                        id_pano: uuidv4(),
                        pano: curr.pano,
                        latitude: curr.latitude,
                        longitude: curr.longitude,
                        heading: curr.heading,
                        elevation: curr.elevation,
                        dist: 0,
                        REC_TIME: curr.REC_TIME,
                        timestamp: curr.timestamp,
                        cercle_id: curr.OBJECTID
                    });
                }
                return acc;
            }, []);
        cercles = cercles.map((cercle, index, array) => ({
            ...cercle,
            next: index !== array.length - 1 ? array[index + 1].id_cercle : null ,
            prev: index !== 0 ? array[index - 1].id_cercle: null
        }));
        res.json({
            status: true, message: {
                cercles,
                panos,
                panosIn: finalData.reduce((a, c) => a + c.points.length, 0),
                centers: finalData.length,
                somme: finalData.reduce((a, c) => a + c.points.length, 0) + finalData.length,
                expected: json.length
            }
        });
    },
    async updateUser(req, res) {
        if (!has(req.body, ['id', 'name', 'email']))
            throw { code: status.BAD_REQUEST, message: 'You must specify the id, name and email' };

        let { id, name, email } = req.body;

        await models.StreetViewPanos.updateUser({ name, email }, { where: { id } });

        res.json({ status: true, message: 'User updated' });
    },
    async deleteUser(req, res) {
        if (!has(req.params, 'id'))
            throw { code: status.BAD_REQUEST, message: 'You must specify the id' };

        let { id } = req.params;

        await models.StreetViewPanos.destroy({ where: { id } });

        res.json({ status: true, message: 'User deleted' });
    }
}
