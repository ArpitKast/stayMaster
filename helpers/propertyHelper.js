'use strict';
var pool = require('../config/dbConnection');

const propertyModel = require('../models/propertyModel');
const PropertyModel = new propertyModel();
const amenityModel = require('../models/amenityModel');
const AmenityModel = new amenityModel();

class PropertyHelper{

    async listPropertiesDetails(){
        var properties = PropertyModel.getAll();
        var amenities = "";
    }

    async listAvailableProperties(ids){
        'SELECT p.id, p.channel_id,p.listing_name,pm.media_filename FROM properties p, property_media pm where p.channel_id in (4058300000000000009, 4058300000000000037) and p.id = pm.property_id and pm.media_type_id = 4';
    }

    async propertiesInfo(ids){
        var details = {};
    }
}
module.exports = PropertyHelper;