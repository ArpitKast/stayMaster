const Response = require("../helpers/responseHelper");
const user = require("../models/userModel");
const User = new user;
/*const smModel = require("../models/smModel");
const SMModel = new smModel;*/
const gmailer = require("../config/gmail");
const hostModel = require("../models/hostModel");
const HostModel = new hostModel;
const serviceRequestModel = require("../models/serviceRequestModel");
const ServiceRequestModel = new serviceRequestModel;
const settingModel = require("../models/settingModel");
const SettingModel = new settingModel;
const fields = require('../config/configs');
const {service_request_fields} = fields;
const S3Helper = require('../helpers/s3Helper');
const path = require('path');
const ImageHelper = require('../helpers/imageHelper');
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const property = require("../models/propertyModel");
const Property = new property;
const bucket = process.env.AWS_SERVICE_REQUEST_BUCKET;

const PENDING = 1;
const REJECTED = 2;
const APPROVED = 3;
const COMPLETED = 4;

class ServiceRequestController {

    async add(req, res) {
        try {
            const properties = await Property.propertiesList();
            const staffs = await User.getStaffWithDetails();
            await res.render('serviceRequest/add.ejs',{properties,staffs});
        } catch (error) {
            console.log(error);
        }
    }

    async index(req, res){
        try {
            var {flash } = req.params;
            if(!flash){
                flash="";
            }
            const serviceRequests = await ServiceRequestModel.serviceRequests();
            const completed = serviceRequests.filter(sr => sr.status == 'Completed');
            const approved = serviceRequests.filter(sr => sr.status == 'Approved');
            const pending = serviceRequests.filter(sr => sr.status == 'Pending');
            const rejected = serviceRequests.filter(sr => sr.status == 'Rejected');
            await res.render('serviceRequest/list.ejs',{serviceRequests,completed,approved,pending,rejected,flash});
        } catch (error) {
            return Response.error(res, "ERROR", 'Could not fetch service requests', 404);
        }
    }

    async create(req, res){
        try {   
            /* Error if no files */
            const {property_id,description,hostIds,amount,service_incharge} = req.body;
            if(!property_id || !description || !amount || !service_incharge){
                return Response.error(res, "ERROR", 'Either property,description,amount or staff not selected', 400);
            }
            if(!hostIds || hostIds == 'null'){
                return Response.error(res, "ERROR", 'Host not selected', 400);
            }
            const fieldValues = {};
            service_request_fields.forEach(fieldName => {
                if(Object.hasOwnProperty.bind(req.body)(fieldName)){
                    fieldValues[fieldName] = req.body[fieldName];
                }
            });
            fieldValues['created_by'] = req.user.id;
            fieldValues['created_date'] = new Date();
            fieldValues['last_modified'] = req.user.id;
            const serviceReqestId = await ServiceRequestModel.insert('service_requests',fieldValues);
            await ServiceRequestModel.insertOneToMany('service_request_hosts','service_request_id',serviceReqestId,'host_id',hostIds);
            const { files } = req;/* Get all files from request */
            await this.saveMediaFiles(files,serviceReqestId);
            return Response.success(res, {flash:`Service Request Created`}, 200);
        } catch (error) {
            return Response.error(res, "ERROR", 'Failed to create Service request', 400);
        }
    }

    async saveMediaFiles(files,serviceReqestId){
        if (!files || files.length === 0) {
            return;
        }
        const values = [];
        const S3Files = [];
        await Promise.all(files.map(async (theFile, index) => {
            var order = index + 1;
            const { buffer, ext, contentType } = await ImageHelper.processUpload(theFile);
            var media_filename = `${serviceReqestId}_${order}${ext}`;
                
            values.push(media_filename);
            
            var S3File = {};
            S3File['media_filename'] = media_filename;
            S3File['buffer'] = buffer;
            S3File['contentType'] = contentType;
            S3Files.push(S3File);
        }));
        await ServiceRequestModel.insertOneToMany('service_request_media','service_request_id',serviceReqestId,'media_link',values);
        S3Files.forEach(async(file)=>{
            await S3Helper.uploadFile(bucket+"/"+serviceReqestId,file['media_filename'], file['buffer'], {
                ContentType: file['contentType']
            });
        });
    }

    async updateStatus(req,res){
        const {id,status,reject_reason} = req.body;
        if(!id || id=="" || !status || status==""){
            return Response.error(res, "ERROR", "Mandatory parameters missing!", 400);
        }
        if(status == REJECTED && (!reject_reason || reject_reason=="")){
            return Response.error(res, "ERROR", "Rejection reason is mandatory!", 400);
        }
        try {
            const serviceRequest = await ServiceRequestModel.find('service_requests',{id:id});
            serviceRequest.status = status;
            if(status == REJECTED){
                serviceRequest.reject_reason = reject_reason;
                serviceRequest.rejected_date = new Date();
                serviceRequest.rejected_by = req.user.id;
            }
            if(status == APPROVED){
                serviceRequest.approved_date = new Date();
                serviceRequest.approved_by = req.user.id;
            }
            if(status == COMPLETED){
                serviceRequest.completed_date = new Date();
                serviceRequest.completed_by = req.user.id;
            }
            await ServiceRequestModel.update('service_requests',serviceRequest,id);
            return Response.success(res, {flash:"Service request updated"}, 200);
        } catch (error) {
            return Response.error(res, "ERROR", error, 400);
        }
    }

    async edit(req, res) {
        const { id } = req.params;
        try {
            const serviceRequest = await ServiceRequestModel.find('service_requests',{id:id});
            var selectedHosts = await ServiceRequestModel.select('service_request_hosts',{service_request_id:id});
            if(selectedHosts && !Array.isArray(selectedHosts)){
                selectedHosts = [selectedHosts];
            }
            const selectedHostsIds = selectedHosts.map((entry) => entry.host_id);
            const properties = await Property.propertiesList();
            const propertyHosts = await HostModel.hostsByProperty(serviceRequest.property_id);
            const staffs = await User.getStaffWithDetails();
            const mediaFiles = await this.getPresignedURLs(id);
            const all_statuses = await SettingModel.list('service_request_status');
            const currentStatus = all_statuses.find(cs => cs.value == serviceRequest.status).display;
            await res.render('serviceRequest/edit.ejs',{serviceRequest,selectedHostsIds,properties,staffs,propertyHosts,mediaFiles,currentStatus});
        } catch (error) {
            return Response.error(res, "ERROR", 'Internal server error', 400);
        }
    }

    async getPresignedURLs(id){
        const mediaFiles = await ServiceRequestModel.select('service_request_media',{service_request_id:id});//media_link
        const presignedUrlPromises = mediaFiles.map(async(object)=>{
            const urlParams = { Bucket: bucket+"/"+id, Key: object.media_link, Expires: 3600 };
            const url = await S3Helper.getSignedUrlPromise(urlParams);
            return { id: object.id, url:url };
        });
        try {
            const presignedUrls = await Promise.all(presignedUrlPromises);
            return presignedUrls;
        } catch (error) {
            console.log(error);
        }
    }

    async save(req, res){
        try {
            const {id,property_id,description,hostIds,amount,service_incharge} = req.body;
            if(!property_id || !description || !amount || !service_incharge){
                return Response.error(res, "ERROR", 'Either property,description,amount or staff not selected', 400);
            }
            if(!hostIds || hostIds == 'null'){
                return Response.error(res, "ERROR", 'Host not selected', 400);
            }
            const fieldValues = {};
            service_request_fields.forEach(fieldName => {
                if(Object.hasOwnProperty.bind(req.body)(fieldName)){
                    fieldValues[fieldName] = req.body[fieldName];
                }
            });

            fieldValues['last_modified'] = req.user.id;
            await ServiceRequestModel.update('service_requests',fieldValues,id);
            await ServiceRequestModel.updateOneToManyEntries('service_request_hosts','service_request_id',id,'host_id',hostIds);
        } catch (error) {
            console.log(error);
            return Response.error(res, "ERROR", 'Failed to save Service request', 400);
        }
        return Response.success(res, {flash:'Service request updated'}, 200);
    }

    async deleteImage(req,res){
        const {id} = req.body;
        var media = await ServiceRequestModel.find('service_request_media',{id:id});
        await S3Helper.deleteFile(bucket+"/"+media.service_request_id,media.media_link);
        await ServiceRequestModel.delete('service_request_media',{id:id});
        return Response.success(res, { deleted: id }, 200);
    }

    async uploadImage(req,res){
        const { files } = req;
        const {serviceRequestId} = req.body;

        var order = await ServiceRequestModel.getNextValueForColumn('service_request_media');
        const theFile = files[0];
        const { buffer, ext, contentType } = await ImageHelper.processUpload(theFile);
        var filename = `${serviceRequestId}_${order}${ext}`;
        var newId = await ServiceRequestModel.insert('service_request_media',{service_request_id:serviceRequestId,media_link:filename});
        await S3Helper.uploadFile(bucket+"/"+serviceRequestId,filename, buffer, {
            ContentType: contentType
        });
        return Response.success(res, { newId: newId }, 200);
    }

}
module.exports = ServiceRequestController;