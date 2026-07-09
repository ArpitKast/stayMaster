var pool = require('../config/dbConnection');
const baseModel = require("../models/baseModel");

class FormsModel extends baseModel{

    async saveFormDetails(fieldValues){
        console.log("Inside saveFormDetails with data:", Object.keys(fieldValues));
        try{
            // Validate required fields
            if(!fieldValues || Object.keys(fieldValues).length === 0){
                throw new Error('No form data provided');
            }
            
            console.log("Field values to insert:", fieldValues);
            const result = await pool.query('INSERT INTO form_submissions SET ?', fieldValues);
            const insertId = result[0].insertId;
            console.log(`Form submission saved successfully with ID: ${insertId}`);
            return insertId;
        }catch(error){
            console.error('Error in saveFormDetails:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            console.error('SQL message:', error.sqlMessage);
            console.error('Field values attempted:', fieldValues);
            
            // Re-throw with more context
            if (error.code === 'ER_NO_SUCH_TABLE') {
                throw new Error(`Table 'form_submissions' does not exist. Please run database migrations.`);
            } else if (error.code === 'ER_BAD_FIELD_ERROR') {
                throw new Error(`Database column error: ${error.sqlMessage || error.message}`);
            } else {
                throw error;
            }
        }
    }
}
module.exports = FormsModel;