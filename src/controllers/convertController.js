
var xlstojson = require("xls-to-json-lc");
var xlsxtojson = require("xlsx-to-json-lc");
var formidable = require('formidable');
const fs = require("fs");
const { newSurveysFun, merge, ordering } = require("@root/functions");


let excels = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
let jsons = ["application/json"]
module.exports = {

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
                    let newSurv = newSurveysFun(result);
                    /* await  */Cercles.bulkCreate(newSurv.cercles);
                    /* await  */Panos.bulkCreate(newSurv.panos);

                    res.json({
                        status: true, cercles,
                        panos, message: {

                            panosIn: newSurv.finalData.reduce((a, c) => a + c.points.length, 0),
                            centers: newSurv.finalData.length,
                            somme: newSurv.finalData.reduce((a, c) => a + c.points.length, 0) + newSurv.finalData.length,
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
        // console.log(req.files);
        var form = new formidable.IncomingForm();
        form.parse(req, function (err, fields, files) {
            console.log(fields);
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
                    // res.json(merge_result);
                    var merge_result = merge(result);
                    var { indice, check } = fields;
                    indice = parseInt(indice);
                    if (check === 'on') {
                        console.log(check);
                        let order_lines = ordering(merge_result);
                        Object.keys(order_lines).forEach((key, ind) => {
                            if (indice > Object.keys(order_lines).length - 1) {
                                res.xls('order_lines.xlsx', order_lines)
                            } else {
                                ind === indice && res.xls(
                                    key + '.xlsx',
                                    order_lines[key].sort((a, b) => b.latitude - a.latitude)
                                        .map((e, index) => ({
                                            ...e, order: index + 1,
                                            latitude: parseFloat(e.latitude), longitude: parseFloat(e.longitude)
                                        }))
                                );
                            }
                        });
                    } else {
                        res.xls('ArretsBusUrbainOptimXlsx' /* + new Date().toString() */ + '.xlsx', merge_result);
                    }
                    // res.xls('key' + '.xlsx', order_lines);
                });
            } catch (e) {
                res.json({ error_code: 6, err_desc: "Corupted excel file" });
            }
        });
    },
    json_upload: async function (req, res) {
        var form = new formidable.IncomingForm();
        form.parse(req, function (err, fields, files) {
            if (err) {
                // res.write(err);
                res.json({ ERROR: "error" });
            }
            try {
                if (!fields['textarea']) {
                    let type = files['file']['type'];
                    let name = files['file']['name'];
                    let lastModifiedDate = files['file']['lastModifiedDate'];
                    let size = files['file']['size'];
                    if (type !== jsons[0]) {
                        res.json({ error: 'File must a JSON!' })
                    }
                    fs.readFile(files.file.path, "utf8", (err, jsonString) => {
                        if (err) {
                            console.log("File read failed:", err);
                            return;
                        }
                        res.xls(name + '.xlsx', JSON.parse(jsonString));
                    });
                }
                res.xls('result.xlsx', JSON.parse(fields['textarea']));
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
        let { action, jsontext } = req.query, favicon = settings.PROJECT_DIR + '/public/icon.png';

        var options_excel = {
            title: "Upload Excel File",
            action: "tupload",
            accept: excels.join(),
            favicon, jsontext: false
        };
        var options_json = {
            title: "Upload JSON File",
            action: "json_upload",
            accept: jsons.join(),
            favicon, jsontext
        };
        var options = {
            title: "Upload Random File",
            action: "json_upload",
            accept: "*",
            favicon, jsontext
        };
        res.render(
            'pages/upload.ejs', action === "excel" ? options_excel : action === "json" ? options_json : options
        );
    },
}