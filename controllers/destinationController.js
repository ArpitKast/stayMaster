const Response = require("../helpers/responseHelper");
const S3Helper = require('../helpers/s3Helper');
const destination = require("../models/destinationModel");
const Destination = new destination();
const path = require('path');
const ImageHelper = require('../helpers/imageHelper');

const bucket = process.env.AWS_DESTINATION_BUCKET;

class DestinationController {

    async getAllDestinations(req, res) {
        try {
            const results = await Destination.getAll();
            if(results.length === 0){
                return Response.error(res, "ERROR", "No destinations found", 404);
            }
            const destinationsWithUrls = await Promise.all(results.map(async (destination) => {
                const preSignedUrl = await S3Helper.generatePreSignedUrl(bucket,destination.photo);
                return {
                    id: destination.id,
                    name: destination.name,
                    description: destination.description,
                    photo: preSignedUrl,
                };
            }));
            return Response.success(res, destinationsWithUrls, 200);
        } catch (error) {
            console.error(error);
            return Response.error(res, "ERROR", 'Internal Server Error', 500);
        }
    }

    async getDestinationById(req, res) {
        const { id } = req.params;
        try {
            const destination = await Destination.getById(id);
            if (!destination.length) {
                return Response.error(res, "ERROR", 'Destination not found', 404);
            }
            const preSignedUrl = await S3Helper.generatePreSignedUrl(bucket,destination[0].photo);
            const destinationWithUrl = {
                id: destination[0].id,
                name: destination[0].name,
                description: destination[0].description,
                photo: preSignedUrl,
            };
            return Response.success(res, destinationWithUrl, 200);
        } catch (error) {
            console.error(error);
            return Response.error(res, "ERROR", 'Internal Server Error', 500);
        }
    }
  
    async createDestination(req, res) {
        const { name, description } = req.body;
        if(!name || !req.file){
            return Response.error(res, "ERROR", 'Name and photo are mandatory fields', 400);
        }
        try {
            const result = await Destination.create({ name, description, photo: '' });

            const createdId = result[0].insertId;
            const { buffer, ext, contentType } = await ImageHelper.processUpload(req.file);
            const photoKey = `destination_${createdId}${ext}`;

            await S3Helper.uploadFile(bucket, photoKey, buffer, {
                ContentType: contentType
            });
            await Destination.updatePhotoLink(createdId, photoKey);

            res.status(200).send('Destination created successfully');
        } catch (error) {
            return Response.error(res, "ERROR", error.message || 'Internal Server Error', 500);
        }
    }

    async updateDestination(req, res) {
        const { id } = req.params;
        const { name, description } = req.body;
        if(!name){
            return Response.error(res, "ERROR", 'Name can not be empty', 400);
        }
        try {
            const existingDestination = await Destination.getById(id);

            if (!existingDestination.length) {
                return Response.error(res, "ERROR", 'Destination not found', 404);
            }
            if(req.file){
                if (existingDestination[0].photo) {
                    await S3Helper.deleteFile(bucket, existingDestination[0].photo);
                }
                const { buffer, ext, contentType } = await ImageHelper.processUpload(req.file);
                const photoKey = `destination_${id}${ext}`;
                await S3Helper.uploadFile(bucket, photoKey, buffer, {
                    ContentType: contentType
                });
                await Destination.updatePhotoLink(id, photoKey);
            }
            await Destination.update(id, { name, description});
            res.status(200).send('Destination updated successfully');
        } catch (error) {
            console.error(error);
            res.status(500).send('Internal Server Error');
        }
    }
  
    async deleteDestination(req, res) {
        const { id } = req.params;
        try {
            const destination = await Destination.getById(id);
            if (!destination.length) {
                return Response.error(res, "ERROR", 'Destination not found', 404);
            }

            const photo = destination[0].photo;
            await S3Helper.deleteFile(bucket,photo);
            await Destination.deleteDestination(id);

            res.send('Destination deleted successfully');
        } catch (error) {
            console.error(error);
            res.status(500).send('Internal Server Error');
        }
    }
}
  
module.exports = DestinationController;