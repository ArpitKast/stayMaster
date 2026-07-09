/*const mongoose = require("mongoose");

const connectDb = async () => {
    try {
        const connect = await mongoose.connect(process.env.CONNECTION_STRING);
        console.log("Database connection established ", connect.connection.host);
    } catch(err) {
        console.log(err);
        process.exit(1);
    }
};*/
/*const connect = mysql.createConnection({
    host : '127.0.0.1',
    user : 'root',
    password : 'newourlab',
    database : 'staymaster'
});*/
/*
host : '127.0.0.1',
    user : 'root',
    password : 'newourlab',
    database : 'staymaster',
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0
*/
/*'use strict';
const mysql = require('mysql');
const dotenv = require("dotenv").config();
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0
});*/

/*connect.connect(function(err) {
    if (err) throw err;
    console.log("Database Connected!");
  });*/
  require("dotenv").config();
const mysql = require('mysql2/promise');
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0
});
module.exports = pool;