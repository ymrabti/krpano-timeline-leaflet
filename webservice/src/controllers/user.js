const status = require('http-status');

const userModel = require('@models/users.js');


const has = require('has-keys');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const xml = require("xml");

module.exports = {
    async getXmlPano(req, res) {
        if (!has(req.query, 'sv', 'batch')) throw { code: status.BAD_REQUEST, message: 'You must specify the streetview and batch' };
        
        let { sv, batch } = req.query;
        
        var dataf = await userModel.findOne({
            attributes: ['id', ['images', 'pano'], ['y', 'latitude'], ['x', 'longitude'], ['bearing', 'heading'], 'batch', 'dist'],
            where: { images: sv/* , batch */ }
        });
        
        if (!dataf) throw { code: status.BAD_REQUEST, message: 'not found' };
        
        let dataValues = dataf.dataValues;
        let panoname = dataValues.pano.replace(".JPG", '') +"_Stitch_XHC";
        var data = `
        <krpano>
            <mapspot id="${dataValues.id}" pano="${panoname}" title="${panoname}" lat="${dataValues.latitude}" lng="${dataValues.longitude}" heading="${dataValues.heading}"/>
            <preview url="https://berkane.xyz/vr/panos/preview_${panoname}.png"/>
            <image>
                <cube url="https://berkane.xyz/vr/panos/${panoname}%s.png" />
            </image>
            <hotspot name="spot3" style="streetview_arrow" direction="177" linkedpano="camera-20160310-111408-000000018" description="" imagetype="normal"/>
            <hotspot name="spot4" style="streetview_arrow" direction="-6" linkedpano="camera-20160310-111408-000000022" description="" imagetype="normal"/>
            <hotspot name="spot5" style="streetview_arrow" direction="-7" linkedpano="camera-20160310-111408-000000023" description="" imagetype="normal"/>
            <hotspot name="spot6" style="streetview_arrow" direction="178" linkedpano="camera-20160310-111408-000000017" description="" imagetype="normal"/>
            <hotspot name="spot1" style="streetview_arrow" direction="177" linkedpano="camera-20160310-111408-000000019" description="" imagetype="sequence"/>
            <hotspot name="spot2" style="streetview_arrow" direction="-6" linkedpano="camera-20160310-111408-000000021" description="" imagetype="sequence"/>
        </krpano>
        `;

        res.header("Content-Type", "application/xml");
        res.status(200).send(data);
    },
    async getSpots(req, res) {
        if (!has(req.query, ['lat1', 'lat2', 'lng1', 'lng2', 'batch']))
            throw { code: status.BAD_REQUEST, message: 'You must specify the Bounds' };
        let { lat1, lat2, lng1, lng2, batch } = req.query;

        let data = await userModel.findAll({
            attributes: ['id', ['images', 'pano'], ['y', 'latitude'], ['x', 'longitude'], ['bearing', 'heading'], 'batch', 'dist'],
            where: {
                y: { [Op.gte]: parseFloat(lat1), [Op.lte]: parseFloat(lat2) },
                x: { [Op.gte]: parseFloat(lng1), [Op.lte]: parseFloat(lng2) },
                // batch:batch
            }
        });
        res.json(data);
    },
    async getTimeline(req, res) {
        res.json([{ "id": "1", "value": "2016-06-20" }, { "id": "2", "value": "2016-03-10" }, { "id": "3", "value": "2015-05-18" }]);
    },
    async newUser(req, res) {
        if (!has(req.params, ['name', 'email']))
            throw { code: status.BAD_REQUEST, message: 'You must specify the name and email' };

        let { name, email } = req.body;

        await userModel.create({ name, email });

        res.json({ status: true, message: 'User Added' });
    },
    async updateUser(req, res) {
        if (!has(req.body, ['id', 'name', 'email']))
            throw { code: status.BAD_REQUEST, message: 'You must specify the id, name and email' };

        let { id, name, email } = req.body;

        await userModel.updateUser({ name, email }, { where: { id } });

        res.json({ status: true, message: 'User updated' });
    },
    async deleteUser(req, res) {
        if (!has(req.params, 'id'))
            throw { code: status.BAD_REQUEST, message: 'You must specify the id' };

        let { id } = req.params;

        await userModel.destroy({ where: { id } });

        res.json({ status: true, message: 'User deleted' });
    }
}
