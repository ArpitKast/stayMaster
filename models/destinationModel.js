var pool = require('../config/dbConnection');

class Destination {
    /*constructor({ id, name, description, photo }) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.photo = photo;
    }*/
  
    async getAll() {
        const results = await pool.query('SELECT * FROM destinations');
        return results[0];
    }
    async list(){
        const results = await pool.query('SELECT id,name FROM destinations');
        return results[0];
    }
    
    async getById(id) {
        const result = await pool.query('SELECT * FROM destinations WHERE id = ?', [id]);
        return result[0];
    }

    async create({ name, description, photo }) {
        return await pool.query('INSERT INTO destinations (name, description, photo) VALUES (?, ?, ?)', [name, description, photo]);
    }
  
    async update(id, { name, description,photo }) {
        return await pool.query('UPDATE destinations SET name = ?, description = ?, photo = ? WHERE id = ?', [name, description, photo, id]);
    }
  
    async updatePhotoLink(id, photo) {
        return await pool.query('UPDATE destinations SET photo = ? WHERE id = ?', [photo, id]);
    }

    async deleteDestination(id) {
        console.log("Delete ID: ",id);
        return await pool.query('DELETE FROM destinations WHERE id = ?', [id]);
    }
  }
  
  module.exports = Destination;