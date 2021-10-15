const status = require('http-status');
// const models = require('@models/streetviewModel.js');
const LatLon = require('geodesy/latlon-spherical');
const has = require('has-keys');
const Sequelize = require('sequelize');
const { Panos, Cercles } = require('../models/streetviewModel');
var xlstojson = require("xls-to-json-lc");
var xlsxtojson = require("xlsx-to-json-lc");
var formidable = require('formidable');


let excels = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
let jsons = ["application/json"]
const Op = Sequelize.Op;

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
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
    newSurveys: async function (req, res) {
        var exceltojson; let json = [];
        var form = new formidable.IncomingForm();
        form.parse(req, function (err, _fields, files) {
            if (err) {
                // res.write(err);
                res.json({ ERROR: "error" });
            }
            let type = files['file']['type'];
            let name = files['file']['name'];
            let lastModifiedDate = files['file']['lastModifiedDate'];
            let size = files['file']['size'];
            if (type === excels[1]) {
                exceltojson = xlsxtojson;
            } else if (type == excels[0]) {
                exceltojson = xlstojson;
            } else {
                res.json({ error: 'File must a /xlsx' })
            }
            try {
                exceltojson({
                    input: files.file.path,
                    output: null, //since we don't need output.json
                    lowerCaseHeaders: true
                }, function (err, result) {
                    if (err) {
                        return res.json({ error_code: 8, err_desc: err, data: null });
                    }
                    json = result;
                    let radios = 15;
                    let cercles = [];
                    let panos = [];
                    // let json = result.body;
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
                    /* await  */Cercles.bulkCreate(cercles);
                    /* await  */Panos.bulkCreate(panos);

                    res.json({
                        status: true, cercles,
                        panos, message: {

                            panosIn: finalData.reduce((a, c) => a + c.points.length, 0),
                            centers: finalData.length,
                            somme: finalData.reduce((a, c) => a + c.points.length, 0) + finalData.length,
                            expected: json.length
                        }
                    });
                });
            } catch (e) {
                res.json({ error_code: 6, err_desc: "Corupted excel file" });
            }
        });
    },
    testUpload: async function (req, res) {
        var exceltojson; let json = [];
        console.log(req.files);
        var form = new formidable.IncomingForm();
        form.parse(req, function (err, _fields, files) {
            if (err) {
                // res.write(err);
                res.json({ ERROR: "error" });
            }
            console.log(files['file']);
            let type = files['file']['type'];
            let name = files['file']['name'];
            let lastModifiedDate = files['file']['lastModifiedDate'];
            let size = files['file']['size'];
            if (type === excels[1]) {
                exceltojson = xlsxtojson;
            } else if (type == excels[0]) {
                exceltojson = xlstojson;
            } else {
                res.json({ error: 'File must a xls/xlsx' })
            }
            try {
                exceltojson({
                    input: files.file.path,
                    output: null, //since we don't need output.json
                    lowerCaseHeaders: true
                }, function (err, result) {
                    if (err) {
                        return res.json({ error_code: 8, err_desc: err, data: null });
                    }
                    res.json(result);
                });
            } catch (e) {
                res.json({ error_code: 6, err_desc: "Corupted excel file" });
            }
        });
    },
    json_upload: async function (req, res) {
        var exceltojson; let json = [];
        console.log(req.files);
        var form = new formidable.IncomingForm();
        form.parse(req, function (err, _fields, files) {
            if (err) {
                // res.write(err);
                res.json({ ERROR: "error" });
            }
            let type = files['file']['type'];
            let name = files['file']['name'];
            let lastModifiedDate = files['file']['lastModifiedDate'];
            let size = files['file']['size'];
            if (type == excels[0]) {
                exceltojson = xlstojson;
            } else {
                res.json({ error: 'File must a JSON!' })
            }
            try {
                exceltojson({
                    input: files.file.path,
                    output: null, //since we don't need output.json
                    lowerCaseHeaders: true
                }, function (err, result) {
                    if (err) {
                        return res.json({ error_code: 8, err_desc: err, data: null });
                    }
                    res.json(result);
                });
            } catch (e) {
                res.json({ error_code: 6, err_desc: "Corupted excel file" });
            }
        });
    },
    form: async function (req, res) {
        /* res.writeHead(200, { 'Content-Type': 'text/html' });
        res.write(``);
        return res.end(); */
        // if (!has(req.query, 'action')) throw { code: status.BAD_REQUEST, message: 'You must specify the action' };

        const settings = require('../../settings');
        let { action } = req.query, favicon = settings.PROJECT_DIR + "\\src\\controllers\\icon.png";

        var options_excel = {
            title: "Upload Excel File",
            action: "tupload",
            accept: excels.join(),
            favicon
        };
        var options_json = {
            title: "Upload JSON File",
            action: "json_upload",
            accept: jsons.join(),
            favicon
        };
        var options = {
            title: "Upload Random File",
            action: "json_upload",
            accept: "*",
            favicon
        };
        res.render(
            'pages/upload.ejs', action === "excel" ? options_excel : action === "json" ? options_json : options
        );
    },
    updateUser: async function (req, res) {
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
            prev_pano_1st: prev_pano_1st[0],
            next_pano_1st: next_pano_1st[0]
        });
    },
    deleteUser: async function (req, res) {
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
            return { ...e.dataValues, id: e.dataValues.ref_cercle, ...e.dataValues.Panos[0].dataValues, Panos: e.dataValues.Panos.length };
        }));
    }
}
