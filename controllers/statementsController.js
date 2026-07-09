'use strict';
const Response = require("../helpers/responseHelper");
const S3Helper = require('../helpers/s3Helper');
const s3Helper = new S3Helper();
const utility = require("../helpers/utility");
const Utility = new utility;
const property = require("../models/propertyModel");
const Property = new property;
const path = require('path');

class StatementsController{
    async list(req, res) {
        try {
            const {property_id} = req.body;
            if(await Utility.checkEmpty({property_id})){
                return Response.error(res, "ERROR", "One or more mandatory parameters missing!", 400);
            }
            const data = await s3Helper.listStatements(property_id);
            const contents = data.Contents.map((file) => {
                const fileparts = file.Key.split('/');
                if(fileparts.length == 3){
                    const fileName = fileparts[2];
                    const yearAndMonth = fileName.split('.')[0];
                    return {
                        name: fileparts[2],
                        year: yearAndMonth.split('_')[0],
                        month: yearAndMonth.split('_')[1]
                    };
                } 
            });
            return Response.success(res, contents.filter(file => file.name !== ''), 200);
        } catch (error) {
            return Response.error(res, "ERROR", error.message, 500);
        }
    }

    async download(req, res) {
        try {
            const {property_id,filename} = req.body;
            if(await Utility.checkEmpty({property_id,filename})){
                return Response.error(res, "ERROR", "One or more mandatory parameters missing!", 400);
            }
            let result = await s3Helper.getStatement(property_id,filename);
            return Response.success(res, result, 200);
        } catch (error) {
            return Response.error(res, "ERROR", error.message, 500);
        }
    }

    async statementsForProperty(req, res){
        const {property_id} = req.params;
        if(await Utility.checkEmpty({property_id})){
            return Response.error(res, "ERROR", "One or more mandatory parameters missing!", 400);
        }
        try {
            const property = await Property.find('properties',{id:property_id});
            const statements = await this.getPropertyStatementsFromS3(property_id);
            res.render('accounts/statements.ejs', { property,statements });
        } catch (error) {
            return Response.error(res, "ERROR", error.message, 500);
        }
    }

    async uploadStatement(req,res){
        try {
            const {property_id,file_month,file_year} = req.body;
            var monthString = file_month
            if(file_month < 10){
                monthString = `0${file_month}`;
            }
            const { files } = req;
            const statement = files.find(file => file.fieldname === 'statement_file');
            var fileExtension = path.extname(statement.originalname);
            var fileName = file_year+"_"+monthString+fileExtension;
            await S3Helper.uploadStatement(property_id,fileName,statement.buffer);
            return Response.success(res, {flash:`Statement Uploaded`}, 200);
        } catch (error) {
            return Response.error(res, "ERROR", 'Failed to upload Statement', 400);
        }
    }

    async getPropertyStatementsFromS3(property_id){
        const data = await s3Helper.listStatements(property_id);
        const contents = data.Contents.map((file) => {
            const fileparts = file.Key.split('/');
            if(fileparts.length == 3){
                const fileName = fileparts[2];
                const yearAndMonth = fileName.split('.')[0];
                return {
                    name: fileparts[2],
                    year: yearAndMonth.split('_')[0],
                    month: yearAndMonth.split('_')[1]
                };
            } 
        });
        return contents.filter(file => file.name !== '');
    }
}
module.exports = StatementsController;