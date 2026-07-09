'use strict';
var pool = require('../config/dbConnection');

class Setting{
    async getSettings(setting, category) {
        let query = 'SELECT id,setting,category,description,display,value FROM settings';
        const values = [];
        if (setting !== undefined && category !== undefined) {
            query += ' WHERE setting = ? AND category = ?';
            values.push(setting, category);
        } else if (setting !== undefined) {
            query += ' WHERE setting = ?';
            values.push(setting);
        }
        const result = await pool.query(query, values);
        return result[0];
    }

    async hostCalculatorSettings(){
        try {
            const results = await pool.query("select * from earnings_calculator_settings where active = 1");
            return results[0];
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async hostSettingsByParams(location,property_type,bedrooms,pool_type){
        try{
            const results = await pool.query('select * from earnings_calculator_multipliers where active = 1 and setting_id in (?,?,?,?)',[location,property_type,bedrooms,pool_type]);
            return results[0];
        }catch (error){
            console.log(error);
            throw error;
        }
    }

    async list(setting, category) {
        let query = 'SELECT id,category,display,value FROM settings';
        const values = [];
        if (setting !== undefined && category !== undefined) {
            query += ' WHERE setting = ? AND category = ?';
            values.push(setting, category);
        } else if (setting !== undefined) {
            query += ' WHERE setting = ?';
            values.push(setting);
        }
        const result = await pool.query(query, values);
        return result[0];
    }

    async display(setting,id){
        try {
            const settingRecord = await pool.query("select * from settings where setting = ? and ?",[setting,id]);
            if(settingRecord[0]){
                return settingRecord[0][0].display;
            } else{
                return null;
            }
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async getSettingValue(setting, category) {
        try {
            const result = await pool.query(
                "select id,value from settings where setting = ? and category = ? limit 1",
                [setting, category]
            );
            return result[0][0] || null;
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async getMediaTypeByValue(value) {
        try {
            const result = await pool.query(
                "select * from settings where setting = 'media_type' and value = ? limit 1",
                [value]
            );
            return result[0][0] || null;
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async createMediaType(value, display = '', category = '', description = '') {
        try {
            const result = await pool.query(
                "insert into settings (setting, category, description, display, value, active) values ('media_type', ?, ?, ?, ?, 1)",
                [category, description, display, value]
            );
            return result[0].insertId;
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async upsertSettingValue(setting, category, value, display = '', description = '') {
        try {
            const existing = await pool.query(
                "select id from settings where setting = ? and category = ? limit 1",
                [setting, category]
            );
            if (existing[0].length > 0) {
                return await pool.query(
                    "update settings set value = ? where id = ?",
                    [value, existing[0][0].id]
                );
            }
            return await pool.query(
                "insert into settings (setting, category, description, display, value, active) values (?,?,?,?,?,1)",
                [setting, category, description, display, value]
            );
        } catch (error) {
            console.log(error);
            throw error;
        }
    }
}
module.exports= Setting;
