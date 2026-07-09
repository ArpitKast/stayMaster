const Response = require("../helpers/responseHelper");
const S3Helper = require('../helpers/s3Helper');
const collection = require("../models/collectionModel");
const Collection = new collection();
const path = require('path');
const ImageHelper = require('../helpers/imageHelper');

const bucket = process.env.AWS_COLLECTION_BUCKET;

class CollectionController {
    async getAllCollections(req, res) {
        try {
            const collections = await Collection.getAllCollections();
            if(!collections || !collections[0] || collections[0].length === 0){
                return Response.error(res, "ERROR", 'No collections found', 404);
            }else{
                return Response.success(res, collections[0], 200);
            }
        } catch (error) {
            return Response.error(res, "ERROR", 'Internal server error', 500);
        }
    }

    async getCollectionById(req, res) {
        const { id } = req.params;
        try {
            const collection = await Collection.getCollectionById(id);
            return Response.success(res, collection[0], 200);
        } catch (error) {
            console.log(error);
            return Response.error(res, "ERROR", 'Internal server error', 500);
        }
    }
    
    async createCollection(req, res) {
        const collectionData = req.body;
        try {
            if(!collectionData.name || !req.file){
                return Response.error(res, "ERROR", 'Name and photo are mandatory fields', 404);
            }
            const createdId = await Collection.addCollection(collectionData);
            const { buffer, ext, contentType } = await ImageHelper.processUpload(req.file);
            const icon = `collection_${createdId}${ext}`;
            const uploadData = await S3Helper.uploadFile(bucket,icon, buffer, {
                ContentType: contentType
            });
            await Collection.updateIcon(createdId, icon);
            return Response.success(res, { message: 'Collection created successfully' }, 201);
        } catch (error) {
            return Response.error(res, "ERROR", 'Internal Server error', 500);
        }
    }
    
    async updateCollection(req, res) {
        const { id } = req.params;
        const updates = req.body;
        try {
            const success = await Collection.updateCollection(id, updates);
            if (success) {
                return Response.success(res, { success: true }, 200);
            } else {
                return Response.error(res, "ERROR", 'Collection not found', 404);
            }
        } catch (error) {
            return Response.error(res, "ERROR", 'Internal server error', 500);
        }
    }
    
    async deleteCollection(req, res) {
        const { id } = req.params;
        try {
            const collection = await Collection.getById(id);

            if (!collection.length) {
                return Response.error(res, "ERROR", 'Collection not found', 404);
            }
            const icon = collection[0].icon;

            await S3Helper.deleteFile(bucket,icon);
            await Collection.delete(id);
            return Response.success(res, { message: 'Collection deleted successfully' }, 200);
        } catch (error) {
            console.error(error);
            return Response.error(res, "ERROR", 'Internal Server Error', 500);
        }
    }
}
module.exports = CollectionController;
    