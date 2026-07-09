const asyncHandler = require("express-async-handler");
const Response = require("../helpers/responseHelper");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Feuser = require("../models/feuserModel");

//@access public
const registerUser =  asyncHandler(async (req, res) =>{
    const {first_name, last_name, mobile_number, password, user_role } = req.body;
    if(!first_name || !last_name || !mobile_number || !password || !user_role) {
        return Response.error(res, "ERROR", "Please fill all required fields.", 400);
    }
    const userAvailable = await Feuser.findOne({ mobile_number });
    console.log(userAvailable);
    if(userAvailable) {
        return Response.error(res, "ERROR", "User already registered.", 400);
    }

    //Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const feuser = await Feuser.create({ first_name, last_name, mobile_number, password:hashedPassword, user_role});
    if(feuser) {
        return Response.success(res, {_id: feuser.id, first_name: feuser.first_name, last_name: feuser.last_name, mobile_number: feuser.mobile_number, user_role: feuser.user_role}, 201);
    } else {
        return Response.error(res, "ERROR", "Invalid user data", 400);
    } 
    res.json({ message: "Register the user"});
});

const currentUser =  asyncHandler(async (req, res) =>{
    return Response.success(res, req.user, 200);
});

module.exports = {registerUser};