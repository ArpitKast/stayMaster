var pool = require('../config/dbConnection');
//const SettingsHelper = new settingsHelper;
const QueryCondition = require("../helpers/utilsHelper");

class SMModel{

    async buildBasicSelectQuery(table,where={}){
        var query = `select * from ${table} `;
        if(where && Object.keys(where).length > 0){
            query += 'where ';
            var i = 1;
            for (const [key, value] of Object.entries(where)){
                console.log(`${key} => ${value}`);
                query += `${key}='${value}'`;
                if(i<Object.keys(where).length){
                    query += ' and ';
                }
                i++;
            }
        }
        return query;
    }

    async exists(table,conditions){
        try {
            const query = await this.buildBasicSelectQuery1(table,conditions);
            console.log(query);
            const result = await pool.query(query);
            if (result[0].length){
                return true;
            }
            return false;
        } catch (error) {
            throw error;
        }
    }

    async buildBasicSelectQuery1(table,conditions=[]){
        var query = `select * from ${table} `;
        const clauses = conditions.map(c=>`${c.column} ${c.condition} '${c.value}'`).join(' and ');
        if(clauses && clauses != ""){
            query += `where ${clauses}`;
        }
        return query;
    }

    async getFromTable(table,where={}){
        /*var query = `select * from ${table} `;
        if(where && Object.keys(where).length > 0){
            query += 'where ';
            var i = 1;
            for (const [key, value] of Object.entries(where)){
                console.log(`${key} => ${value}`);
                query += `${key}='${value}'`;
                if(i<Object.keys(where).length){
                    query += ' and ';
                }
                i++;
            }
        }*/
       const conditions = [];
        if(where && Object.keys(where).length > 0){
            for (const [key, value] of Object.entries(where)){
                conditions.push(new QueryCondition(key,'=',value));
            }
        }
        try {
            const query = await this.buildBasicSelectQuery1(table,conditions);
            console.log(query);
            const results = await pool.query(query);
            return results[0];
        } catch (error) {
            throw error;
        }
    }

    async getRowByUniqueId(table,id,idName="id"){
        try {
            const results = await pool.query(`select * from ${table} where ${idName} = ?`,[id]);
            return results[0][0];
        } catch (error) {
            throw error;
        }
    }

    async getMaxValueForColumn(table,column="id"){
        try {
            const results = await pool.query(`select max(${column}) as maxval from ${table}`,[column,table]);
            return results[0].maxval;
        } catch (error) {
            throw error;
        }
    }

    async getNextValueForColumn(table,column="id"){
        try {
            const maxval = await this.getMaxValueForColumn(table,column);
            return maxval + 1;
        } catch (error) {
            throw error;
        }
    }

    async updateTableEntry(table,values,id){
        try{
            const result = await pool.query('update '+table+' SET ? where id = ?', [values,id]);
            return result[0];
        } catch (error) {
            throw error;
        }
    }

    async updateOneToManyEntries(table,oneIdName,oneId,manyIdName,manyIds){
        try {
            if(!manyIds || !Array.isArray(manyIds)){
                manyIds = [manyIds];
            }

            //if new = 0, delete all existing
            if(!manyIds || manyIds.length == 0){
                await pool.query(`delete from ${table} where ${oneIdName} = ${oneId}`);
                return;
            }
            //get existing entries
            const existingEntries = await pool.query(`select * from ${table} where ${oneIdName} = ${oneId}`); 
            var existingIds = existingEntries[0].map((entry) => entry[manyIdName]);
            //console.log(existingIds);
            if(!existingIds || existingIds.length == 0){
                await this.writeOneToManyEntries(table,oneIdName,oneId,manyIdName,manyIds);
                return;
            }
            
            //delete from existing where id not in new
            const toBeDeleted = manyIds.map(entry => `'${entry}'`).join(',');
            await pool.query(`delete from ${table} where ${oneIdName} = ${oneId} and ${manyIdName} not in (${toBeDeleted})`);
            //insert new
            const inserts = manyIds.filter(function(id){
                if(!existingIds.includes(id)){
                    return id;
                }
            });
            console.log(inserts);
            await this.writeOneToManyEntries(table,oneIdName,oneId,manyIdName,inserts);
            return;
        } catch (error) {
            console.log(error);
        }
    }

    async writeTableEntry(table,values){
        try{
            const result = await pool.query('INSERT INTO '+table+' SET ?', values);
            return result[0].insertId;
        } catch (error) {
            throw error;
        }
    }

    async writeOneToManyEntries(table,oneIdName,oneId,manyIdName,manyIds){
        if(!manyIds || (Array.isArray(manyIds) && manyIds.length === 0)){
            return null;
        }
        if(!Array.isArray(manyIds)){
            manyIds = [manyIds];
        }
        var query = `insert into ${table} (${oneIdName},${manyIdName}) values `;
        try{
            manyIds.forEach(mid=>{
                query += `(${oneId},'${mid}'),`;
            });
            query = query.substring(0,query.length-1);//remove the ',' at the end
            const result = await pool.query(query);
            return result[0];
        } catch (error) {
            throw error;
        }
    }

    async deleteById(table,id,idName="id"){
        try {
            await pool.query(`delete from ${table} where ${idName} = ?`,[id]);
            return;
        } catch (error) {
            throw error;
        }
    }
}
module.exports = SMModel;