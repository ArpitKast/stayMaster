var pool = require('../config/dbConnection');
const S3Helper = require('../helpers/s3Helper');
const bucket = process.env.AWS_COLLECTION_BUCKET;

class CollectionModel{
    async getAllCollections() {
        return await pool.query('SELECT * FROM collections');
    }

    async list(){
        try {
            //const results = await pool.query('SELECT id,name,icon,display_order FROM collections where active = 1');
            const results = await pool.query('SELECT id,name,slug,icon,concat("white","_",icon) as icon_white,display_order FROM collections');
            if(results.length == 0){
                throw new Error("No collections found!");
            }
            const collectionsWithUrls = await Promise.all(results[0].map(async (collection) => {
                const preSignedUrl = await S3Helper.generatePreSignedUrl(bucket,collection.icon);
                const preSignedWhiteUrl = await S3Helper.generatePreSignedUrl(bucket,collection.icon_white);
                return {
                    id: collection.id,
                    name: collection.name,
                    slug: collection.slug,
                    display_order: collection.display_order,
                    icon: preSignedUrl,
                    icon_white: preSignedWhiteUrl
                };
            }));
            return collectionsWithUrls;
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async activeCollections(){
        const collections = await pool.query("select * from collections where active = 1");
        var activeCollections = [];
        collections[0].forEach(collection => {
            activeCollections.push(collection.id);
        });
        return activeCollections;
    }

    async getCollectionById(id) {
        return await pool.query('SELECT * FROM collections WHERE id = ?',[id]);
    }

    async addCollection(collection) {
        const { name, description, display_order, active } = collection;
        const result = await pool.query('INSERT INTO collections (name, description, display_order,active) VALUES (?, ?, ?,?)', [name, description, display_order, active]);
        return result[0].insertId;
    }

    async updateIcon(id,icon){
        return await pool.query('UPDATE collections SET icon = ? WHERE id = ?', [icon, id]);
    }

    async updateCollection(id, updates) {
        return await pool.query('UPDATE collections SET ? WHERE id = ?',[updates, id]);
    }

    async deleteCollection(id) {
        return  await pool.query('DELETE FROM collections WHERE id = ?', [id]);
    }
}
module.exports = CollectionModel;