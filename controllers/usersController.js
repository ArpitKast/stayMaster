const Response = require("../helpers/responseHelper");
const user = require("../models/userModel");
const User = new user;
const smModel = require("../models/smModel");
const SMModel = new smModel;
const property = require("../models/propertyModel");
const Property = new property;
const settingModel = require("../models/settingModel");
const Setting = new settingModel;
const settingsHelper = require("../helpers/settingsHelper");
const SettingsHelper = new settingsHelper;
const twilioHelper = require('../helpers/twilioHelper');
const TwilioHelper = new twilioHelper;
const QueryCondition = require("../helpers/utilsHelper");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/dbConnection");

const tableExists = async (connection, tableName) => {
    try {
        const [rows] = await connection.query(
            "SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
            [process.env.DB_NAME, tableName]
        );
        return rows?.[0]?.count > 0;
    } catch (error) {
        console.warn(`Failed to verify table ${tableName}:`, error.message);
        return false;
    }
};

const bucket = process.env.AWS_COLLECTION_BUCKET;
const { format,addDays,differenceInDays} = require("date-fns");
const userFields = ['firstname','lastname','email','phone','add','gender','address_line_1','address_line_2','city','state','country','postcode'];
const hostFields = ['firstname','lastname','email','phone','gender','address_line_1','address_line_2','city','state','country','postcode','date_of_birth','date_of_joining'];
const userTypes = {270:'staff',267:'host',271:'manager'};
const userRoles = {staff:270,host:267,manager:271};
const constants = require("../config/constants");
const utility = require("../helpers/utility");
const Utility = new utility;
const { formatPhoneForSms } = require("../helpers/phoneFormat");

class UsersController {

    async me(req,res){
        try {
            if(req.user){
                const me = await User.getById(req.user.id);
                return Response.success(res, {me:me[0]}, 200);
            }
        } catch (error) {
            return Response.error(res, "ERROR", error, 500);
        }
    }

    async checkUnique(req,res){
        try {
            const conditions = [];
            const { type,value,userType,currentId } = req.params;
            conditions.push(new QueryCondition('role','=',userRoles[userType]));
            conditions.push(new QueryCondition(type,'=',value));
            if(currentId){
                conditions.push(new QueryCondition('id','<>',currentId));
            }
            var result = await SMModel.exists('users',conditions);
            return Response.success(res, { exists:result }, 200);
        } catch (error) {
            console.log(error);
        }
    }

    async generateUserOTP(req,res){
        try {
            const {email} = req.body;
            if(!email) {
                return Response.error(res, "ERROR", 'Email is mandatory', 400);
            }
            var user = await User.getStaffByEmail(email);
            if(user){
                const {otp,expires_at} = Utility.generateOTP(constants.RESET_PASSWORD_EXPIRY);
                await User.upsert('otp',{user_id:user.id},{user_id:user.id,otp:otp,expires_at:expires_at});
                const emailBody = `${otp} is your OTP for resetting your password`;
                await Utility.sendEMail(user.email,'OTP from StayMaster',emailBody);
                return Response.success(res, {message:`OTP sent via email to ${email}`}, 200);
            }else{
                return Response.error(res, "ERROR", 'Unrecognised Email', 400);
            }
        } catch (error) {
            return Response.error(res, "ERROR", 'Please try after some time', 400);
        }        
    }

    async generateGuestOTP(req,res){
        try {
            const {phone, email} = req.body;
            if(!phone && !email) {
                return Response.error(res, "ERROR", 'Phone number or email missing or invalid!', 400);
            }
            
            var user;
            if(phone) {
                user = await User.find('users',{phone:phone,role:constants.ROLE_GUEST});
                if(!user){
                    const variantUser = await User.getByPhoneVariants(phone);
                    if(variantUser && String(variantUser.role) === String(constants.ROLE_GUEST)){
                        user = variantUser;
                    }
                }
                if(!user){
                    user = await User.createWithPhone(phone,constants.ROLE_GUEST);
                }
            } else if(email) {
                user = await User.find('users',{email:email,role:constants.ROLE_GUEST});
                if(!user){
                    const newUserData = {role: constants.ROLE_GUEST, email: email};
                    user = await User.store(newUserData);
                }
            }
            
            const {otp,expires_at} = Utility.generateOTP(constants.GUEST_OTP_EXPIRY);
            await User.upsert('otp',{user_id:user.id},{user_id:user.id,otp:otp,phone:phone || null,expires_at:expires_at});
            var body = "Your staymaster OTP is: " + otp;
            
            let smsSent = false;
            let emailSent = false;
            
            if(phone) {
                try {
                    const formattedPhone = formatPhoneForSms(phone);
                    await TwilioHelper.sendSMS(body, process.env.TWILIO_FROM_NUMBER || "+12163036560", formattedPhone);
                    smsSent = true;
                    console.log(`OTP sent via SMS to ${formattedPhone}`);
                } catch (smsError) {
                    console.error("SMS sending error:", smsError);
                    // Continue execution even if SMS fails
                }
            }
            
            if(email) {
                try {
                    await Utility.sendEMail(email, 'OTP from Staymaster', body);
                    emailSent = true;
                    console.log(`OTP sent via email to ${email}`);
                } catch (emailError) {
                    console.error("Email sending error:", emailError);
                    // Continue execution even if email fails
                }
            }
            
            // Return success even if SMS/email sending failed (OTP is still generated and stored)
            return Response.success(res, {smsSent, emailSent}, 201);
        } catch (error) {
            console.error("OTP generation error:", error);
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
            console.error("Request body:", req.body);
            
            // Return more specific error message
            let errorMessage = 'Please try after some time';
            if (error.message) {
                errorMessage = error.message;
            } else if (error.code) {
                if (error.code === 'ER_NO_SUCH_TABLE') {
                    errorMessage = 'Database table not found. Please run migrations.';
                } else if (error.code === 'ER_BAD_FIELD_ERROR') {
                    errorMessage = `Database column error: ${error.sqlMessage || error.message}`;
                }
            }
            
            return Response.error(res, "ERROR", errorMessage, 400);
        }
    }

    async generateHostOTP(req,res){
        try {
            const {phone,email} = req.body;
            if(!phone && !email) {
                return Response.error(res, "ERROR", 'Phone number or email missing or invalid!', 400);
            }
            
            var user;
            // Try to find existing user
            var clauses = {role:constants.ROLE_HOST};
            if(phone){
                clauses['phone'] = phone;
            }
            if(email){
                clauses['email'] = email;
            }
            
            user = await User.find('users',clauses);
            
            // If user doesn't exist, create a new one
            if(!user){
                console.log(`Creating new host user with ${phone ? 'phone: '+phone : ''} ${email ? 'email: '+email : ''}`);
                const newUserData = {
                    role: constants.ROLE_HOST
                };
                if(phone) newUserData.phone = phone;
                if(email) newUserData.email = email;
                
                // Create new user
                user = await User.store(newUserData);
                console.log("Created new host user:", user);
            }
            
            const {otp,expires_at} = Utility.generateOTP(constants.HOST_OTP_EXPIRY);
            await User.upsert('otp',{user_id:user.id},{user_id:user.id,otp:otp,phone:phone,expires_at:expires_at});
            var body = "Your staymaster OTP is: " + otp;
            
            if(phone){
                const formattedPhone = formatPhoneForSms(phone);
                await TwilioHelper.sendSMS(body, process.env.TWILIO_FROM_NUMBER || "+12163036560", formattedPhone);
            }
            if(email){
                await Utility.sendEMail(email,'OTP from StayMaster',body);
            }
            
            // Never return the OTP in the response — the user must receive it via SMS/email
            return Response.success(res, { smsSent: Boolean(phone), emailSent: Boolean(email) }, 201);
        } catch (error) {
            console.error("OTP generation error:", error);
            return Response.error(res, "ERROR", 'Please try after some time', 400);
        }
    }

    async loginUser(req,res){
        try {
            const {email, password} = req.body;
            if(!email || !password) {
                return Response.error(res, "ERROR", 'Email and password are mandatory', 400);
            }

            if (!process.env.ACCESS_TOKEN_SECRET) {
                return Response.error(res, "ERROR", 'Server auth configuration missing', 500);
            }

            const userAvailable = await User.getByEmail(email);
            if(userAvailable && userAvailable.role == 270 && await (bcrypt.compare(password, userAvailable.password))) {
                const accessToken = jwt.sign({
                    user: {
                        email: userAvailable.email,
                        id: userAvailable.id
                    },
                }, process.env.ACCESS_TOKEN_SECRET, 
                { expiresIn : "300m"});

                const isProduction = process.env.NODE_ENV === 'production';
                res.cookie('authcookie', accessToken, {
                    maxAge: 9000000,
                    httpOnly: true,
                    sameSite: 'lax',
                    secure: isProduction
                });
                return res.redirect('/admin/');
            }

            return res.render('login.ejs',{flash:'Wrong email or password'});
        } catch (error) {
            console.error("Admin login error:", error);
            return Response.error(res, "ERROR", 'Login failed. Please try again.', 500);
        }
    }

    async loginWithEmail(email,password,role){
        if(!email || !password) {
            return {success:false,error:'Email and password are mandatory'};
        }
        const userAvailable = await User.find('users',{email:email,role:role});
        if(userAvailable && userAvailable.role == role && await (bcrypt.compare(password, userAvailable.password))) {
            const accessToken = jwt.sign({
                user: {
                    email: userAvailable.email,
                    id: userAvailable.id
                },
            }, process.env.ACCESS_TOKEN_SECRET, 
            { expiresIn : "300m"});
            const u = userAvailable;
            const user = {id:u.id,firstname:u.firstname,lastname:u.lastname,email:u.email,phone:u.phone};
            return {success:true,accessToken,user};
        }
        return {success:false,error:'Invalid credentials'};
    }

    async guestLoginWithOTP(req,res){
        try {
            const {phone, otp, email} = req.body;
            if(!otp) {
                return Response.error(res, "ERROR", 'OTP is required', 400);
            }
            if(!phone && !email) {
                return Response.error(res, "ERROR", 'Phone number or email is required', 400);
            }
            
            // Find user by phone or email
            let userAvailable;
            if(phone) {
                userAvailable = await User.find('users',{phone:phone,role:constants.ROLE_GUEST});
                if(!userAvailable){
                    const variantUser = await User.getByPhoneVariants(phone);
                    if(variantUser && String(variantUser.role) === String(constants.ROLE_GUEST)){
                        userAvailable = variantUser;
                    }
                }
            } else if(email) {
                userAvailable = await User.find('users',{email:email,role:constants.ROLE_GUEST});
            }

            if(!userAvailable) {
                return Response.error(res, "ERROR", 'User not found. Please generate OTP first.', 404);
            }

            // Use the phone/email stored in DB (may differ in format from what the user typed)
            const lookupKey = userAvailable.phone || userAvailable.email || phone || email;
            const result = await this.loginWithOTP(lookupKey, otp, constants.ROLE_GUEST);
            if(!result.success){
                return Response.error(res, "ERROR", result.error, 400);
            }
            res.cookie('logincookie',result.accessToken,{maxAge:9000000,httpOnly:true}) 
            return Response.success(res, {webUserToken:result.accessToken,user:result.user}, 200);
        } catch (error) {
            console.error("OTP login error:", error);
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
            return Response.error(res, "ERROR", error.message || 'Login failed. Please try again.', 500);
        }
    }

    async hostLogin(req,res){
        const {phone, otp,email,password} = req.body;
        if((!phone && !otp) && (!email && !password)) {
            return Response.error(res, "ERROR", 'Phone and OTP or Email and Password are mandatory', 400);
        }
        var result;
        if(phone && otp){
            result = await this.loginWithOTP(phone,otp,constants.ROLE_HOST);
        }else{
            result = await this.loginWithEmail(email,password,constants.ROLE_HOST);
        }
        if(!result.success){
            return Response.error(res, "ERROR", result.error, 400);
        }else{
            res.cookie('logincookie',result.accessToken,{maxAge:9000000,httpOnly:true}) 
            return Response.success(res, {webUserToken:result.accessToken,user:result.user}, 200);
        }
    }

    async loginWithOTP(phoneOrEmail,otp,role){
        if(!phoneOrEmail || !otp) {
            return {success:false,error:'Phone/Email and OTP are mandatory'};
        }
        
        // Find user by phone or email
        let userAvailable;
        const isEmail = phoneOrEmail.includes('@');
        if(isEmail) {
            userAvailable = await User.find('users',{email:phoneOrEmail,role:role});
        } else {
            userAvailable = await User.find('users',{phone:phoneOrEmail,role:role});
        }
        
        if(!userAvailable) {
            return {success:false,error:'User not found. Please generate OTP first.'};
        }
        
        // Regular OTP verification
        const currentTime = Math.round(Date.now() / 1000);
        const otpResult = await User.find('otp',{user_id:userAvailable.id,otp:otp});
        if(!otpResult || (Array.isArray(otpResult) && otpResult.length == 0) || (!Array.isArray(otpResult) && !otpResult) || currentTime >= otpResult.expires_at){
            return {success:false,error:'OTP invalid or expired'};
        } 
        const accessToken = jwt.sign({
            user: {
                email: userAvailable.email || userAvailable.phone,
                id: userAvailable.id,
                transExpiry: Math.round(Date.now() / 1000) + (60 * 60), //60 minutes expiry
            },
        }, process.env.ACCESS_TOKEN_SECRET, 
        { expiresIn : "60m"});
        const u = userAvailable;
        const user = {id:u.id,firstname:u.firstname,lastname:u.lastname,email:u.email,phone:u.phone};
        return {success:true,accessToken,user};
    }



    async changePassword(req, res){
        try {
            var { id } = req.params;
            var own = 0;
            if(!id || id == req.user.id){
                id = req.user.id;
                own = 1;
            }
            const user = await User.getById(id);
            await res.render('users/changePassword.ejs',{own,user:user[0]});
        } catch (error) {
            return Response.error(res, "ERROR", 'Internal server error', 500);
        }
    }

    async savePassword(req, res){
        try {
            const {id,current_password,new_password,confirm_password} = req.body;
            var user = await User.getById(id);
            if(id == req.user.id){
                if(!current_password || !(await (bcrypt.compare(current_password, user[0].password)))){
                    return Response.error(res, "ERROR", "Current password incorrect", 400);
                }
            }
            if(new_password == confirm_password){
                user[0].password = await bcrypt.hash(new_password, 10);
                await SMModel.updateTableEntry('users',user[0],id);
            }else{
                return Response.error(res, "ERROR", "new password and confirm password do not match", 400);
            }
            const flash = `Password changed successfully for ${user[0].firstname} ${user[0].lastname}`;
            return Response.success(res, {flash}, 200);
        } catch (error) {
            return Response.error(res, "ERROR", 'Internal server error', 500);
        }
    }

    async resetPassword(req, res){
        try {
            const reset = await this.passwordReset(req,constants.ROLE_STAFF);
            if(reset.success){
                return Response.success(res, {message:"Password reset successfull. Please login again with the new password"}, 200);
            }
            return Response.error(res, "ERROR", reset.message, 400);
        } catch (error) {
            return Response.error(res, "ERROR", 'Internal server error', 500);
        }
    }

    async resetHostPassword(req, res){
        try {
            const reset = await this.passwordReset(req,constants.ROLE_HOST);
            if(reset.success){
                return Response.success(res, {message:"Password reset successfull. Please login again with the new password"}, 200);
            }
            return Response.error(res, "ERROR", reset.message, 400);
        } catch (error) {
            return Response.error(res, "ERROR", 'Internal server error', 500);
        }
    }

    async generateCheckinToken(req, res) {
        try {
            const guest = req.guest || req.user;
            if (!guest || !guest.id) {
                return Response.error(res, "ERROR", "Authentication required", 401);
            }

            const userRows = await User.getById(guest.id);
            const user = Array.isArray(userRows) ? userRows[0] : userRows;
            if (!user) {
                return Response.error(res, "ERROR", "User not found", 404);
            }

            const checkinToken = jwt.sign(
                {
                    user: {
                        phone: user.phone,
                        id: user.id,
                        type: 'checkin_autologin',
                    },
                },
                process.env.ACCESS_TOKEN_SECRET,
                { expiresIn: '15m' }
            );

            return Response.success(res, { success: true, checkinToken }, 200);
        } catch (error) {
            console.error("generateCheckinToken error:", error);
            return Response.error(res, "ERROR", "Failed to generate checkin token", 500);
        }
    }

    async passwordReset(req,role){
        try {
            const {email,otp,new_password,confirm_password} = req.body;
            
            if(!email || !otp || !new_password || !confirm_password){
                return {success:false, message:"Mandatory fields missing"};
            }
            var user = await User.find('users',{email:email,role});
            
            if(!user){
                return {success:false, message:"Unrecognised email"};
            }
            const otpRecord = await User.getOTPRecord({user_id:user.id});
            const currentTime = Math.round(Date.now() / 1000);

            if(!otpRecord || otpRecord.length == 0 || otpRecord.otp != otp){
                return {success:false, message:"OTP is Incorrect"};
            }
            if(currentTime >= otpRecord.expires_at){
                return {success:false, message:"OTP has expired"};
            }
            if(new_password != confirm_password){
                return {success:false, message:"Passwords do not match"};
            }
            user.password = await bcrypt.hash(new_password, 10);
            User.update('users',user,user.id);
            return {success:true, message:"Password reset successfull"};
        } catch (error) {
            return {success:false, message:"Internal server error"};
        }
    }

    async guests(req, res) {
        try {
            const {recent,upcoming,ongoing,past} = await User.guestsForDashboard(); 
            await res.render('guests/list.ejs',{recent,upcoming,ongoing,past});
        } catch (error) {
            return Response.error(res, "ERROR", 'Internal server error', 500);
        }
    }

    async users(req, res){
        var { type,flash } = req.params;
        if(!flash){
            flash="";
        }
        var users = [];
        if(type=='staff'){
            users = await User.getStaffWithDetails();
        }
        if(type=='host'){
            const hosts = await User.getHostsWithDetails();
            const countries = await SMModel.getFromTable('settings',{setting:'countries'});
            const allProperties = await Property.propertiesList();
            const property_hosts = await SMModel.getFromTable('property_hosts');
            hosts.forEach(user=>{
                const selectedcountry = countries.find(country=> country.id == user.country);
                user['selectedcountry'] = '';
                if(selectedcountry){
                    user['selectedcountry'] = selectedcountry.display;
                }
                var hostProps = property_hosts.filter(ph => ph.host_id == user.id);
                hostProps = hostProps.map(p => p.property_id);
                const properties = allProperties.filter(p => hostProps.includes(p.id));
                user['properties'] = properties.map(a => `${a.listing_name}`).join('<br>');
                users.push(user);
            });
        }
        if(type=='manager'){
            users = await User.getManagers();
        }
        await res.render('users/list.ejs',{users,type,flash});
    }

    async add(req, res){
        const { type } = req.params;
        const results = await SettingsHelper.consolidatedSettingsWithUsers();
        const allProperties = await Property.propertiesList();
        await res.render('users/add.ejs',{type,results,allProperties,defaultCountry:14});
    }

    async create(req,res){
        try {
            const{firstname,lastname,email,phone,password,type} = req.body;
            if(!firstname || firstname=="" || !lastname || lastname=="" || !email || email=="" || !phone || phone==""){
                return Response.error(res, "ERROR", "Mandatory booking parameters missing or incorrect!", 400);
            }
            //validate email and phone unique
            const values = {};
            if(!password || password==""){
                return Response.error(res, "ERROR", "Mandatory booking parameters missing or incorrect!", 400);
            }else{
                values['password'] = await bcrypt.hash(password, 10);
            }
            userFields.forEach(fieldName => {
                if(Object.hasOwnProperty.bind(req.body)(fieldName)){
                    values[fieldName] = req.body[fieldName];
                }
            });
            if(req.body.date_of_birth && req.body.date_of_birth != ''){
                values.date_of_birth = format(req.body.date_of_birth, 'yyyy-MM-dd');
            }
            if(req.body.date_of_joining && req.body.date_of_joining != ''){
                values.date_of_joining = format(req.body.date_of_joining, 'yyyy-MM-dd');
            }
            values['role'] = userRoles[type];
            
            //const user = await SMModel.writeTableEntry('users',values);
            const userId = await User.insert('users',values);
            const user = await User.find('users',{id:userId});
            if(type == 'host'){
                var properties = [];
                if(req.body.properties){
                    properties = req.body.properties;
                }
                await SMModel.updateOneToManyEntries('property_hosts','host_id',user.id,'property_id',properties);
            }
            return Response.success(res, {user:user,flash:`Successfully added ${firstname} ${lastname} `}, 200);
        } catch (error) {
            return Response.error(res, "ERROR", "Failed to create user", 400);
        }
    }

    async edit(req, res){
        const {id} = req.params;
        const results = await SettingsHelper.consolidatedSettingsWithUsers();
        const user = await SMModel.getRowByUniqueId('users',id);
        const allProperties = await Property.propertiesList();
        if(user.date_of_birth){
            user.date_of_birth = format(user.date_of_birth, 'dd MMM yyyy');
        }
        if(user.date_of_joining){
            user.date_of_joining = format(user.date_of_joining, 'dd MMM yyyy');
        }
        var selectedCountry = 0;
        if(user.country){
            const country = await SMModel.getRowByUniqueId('settings',user.country);
            selectedCountry = country.id;
        }
        const type = userTypes[user.role];
        if(type == 'host'){
            const hostProps = await SMModel.getFromTable('property_hosts',{host_id:id});
            user['hostProps'] = hostProps.map(p=> p.property_id);
        }
        await res.render('users/edit.ejs',{type,results,user,selectedCountry,allProperties});
    }

    async save(req, res){
        try{
            const {id,type} = req.body;
            const{firstname,lastname,email,phone} = req.body;
            if(!firstname || firstname=="" || !lastname || lastname=="" || !email || email=="" || !phone || phone=="" ){
                return Response.error(res, "ERROR", "Mandatory booking parameters missing or incorrect!", 400);
            }
            //validate email and phone unique
            const values = {};
            userFields.forEach(fieldName => {
                if(Object.hasOwnProperty.bind(req.body)(fieldName)){
                    values[fieldName] = req.body[fieldName];
                }
            });
            values.date_of_birth = null;
            if(req.body.date_of_birth && req.body.date_of_birth != ''){
                values.date_of_birth = format(req.body.date_of_birth, 'yyyy-MM-dd');
            }
            values.date_of_joining = null;
            if(req.body.date_of_joining && req.body.date_of_joining != ''){
                values.date_of_joining = format(req.body.date_of_joining, 'yyyy-MM-dd');
            }
            
            const user = await User.update('users',values,id);
            if(type =="host"){
                var properties = [];
                if(req.body.properties){
                    properties = req.body.properties;
                }
                await User.updateOneToManyEntries('property_hosts','host_id',id,'property_id',properties);
            }
            return Response.success(res, {user:user,flash:`${firstname} ${lastname} was updated`}, 200);
        } catch (error) {
            return Response.error(res, "ERROR", "Failed to update user", 400);
        }
    }

    async userDetails(req,res){
        const { id } = req.params;
        try {
            const booking = await SMModel.getRowByUniqueId('bookings',id);
            booking['formated_reservation_date'] = format(booking.createDatetime, 'dd/MM/yyyy');
            booking['formated_start_date'] = format(booking.start, 'dd/MM/yyyy');
            booking['formated_end_date'] = format(booking.end, 'dd/MM/yyyy');
            booking['nights'] = differenceInDays(booking.end,booking.start);
            const user = await SMModel.getRowByUniqueId('users',booking.guest_id);
            const property = await SMModel.getRowByUniqueId('properties',booking.property_id);
            const registration = await SMModel.getRowByUniqueId('booking_registrations',id,'booking_id');
            const rental = await SMModel.getFromTable('booking_rentalInfo',{booking_id:id,effectiveDate:format(booking.start, 'yyyy-MM-dd')});
            const amenities = await Property.aminitiesByProperty(booking.property_id);
            const property_type = await Setting.display('property_type',property.property_type);
            const destination = await SMModel.getRowByUniqueId('destinations',property.destination);
            await res.render('guests/edit.ejs', {booking,user,property,registration,rental:rental[0],amenities,property_type,destination:destination.name});
        } catch (error) {
            return Response.error(res, "ERROR", "Error while fetching details", 400);
        }
    }
    
    async editHost(req,res){
        try {
            const result = await User.find('users',{id:req.guest.id});
            if(result){
                const user = {};
                hostFields.forEach(fieldName => {
                    if(Object.hasOwnProperty.bind(result)(fieldName)){
                        user[fieldName] = result[fieldName];
                    }
                });
                return Response.success(res, {user}, 200);
            }
            return Response.error(res, "ERROR", "Unknown user", 400);
        } catch (error) {
            return Response.error(res, "ERROR", 'Internal server error', 500);
        }
    }

    async updateHost(req,res){
        try {
            const user = {};
            hostFields.forEach(fieldName => {
                if(Object.hasOwnProperty.bind(req.body)(fieldName)){
                    user[fieldName] = req.body[fieldName];
                }
            });
            const result = await User.update('users',user,req.guest.id);
            return Response.success(res, {user}, 200);
        } catch (error) {
            return Response.error(res, "ERROR", 'Internal server error', 500);
        }
    }



    async clearAllUserData(req, res) {
        const connection = await db.getConnection();
        try {
            const guest = req.guest || req.user;
            if (!guest || !guest.id) {
                return Response.error(res, "ERROR", "Authentication required", 401);
            }

            const userId = guest.id;
            await connection.beginTransaction();

            // 1. Get all booking IDs for this user
            const [bookings] = await connection.query("SELECT id FROM bookings WHERE guest_id = ?", [userId]);
            const bookingIds = bookings.map(b => b.id);

            if (bookingIds.length > 0) {
                // 2. Delete booking-specific data (optional tables)
                if (await tableExists(connection, 'guest_details')) {
                    await connection.query("DELETE FROM guest_details WHERE booking_id IN (?)", [bookingIds]);
                }
                if (await tableExists(connection, 'booking_payments')) {
                    await connection.query("DELETE FROM booking_payments WHERE booking_id IN (?)", [bookingIds]);
                }
                if (await tableExists(connection, 'booking_tariffs')) {
                    await connection.query("DELETE FROM booking_tariffs WHERE booking_id IN (?)", [bookingIds]);
                }
                
                // 3. Delete from bookings table
                await connection.query("DELETE FROM bookings WHERE guest_id = ?", [userId]);
            }
            
            // 4. Delete OTP records
            await connection.query("DELETE FROM otp WHERE user_id = ?", [userId]);

            // 5. guest_details / master profiles will be deleted via cascade or booking deletion above

            await connection.commit();
            return Response.success(res, { message: "All user activity data has been cleared successfully. Account remains active." }, 200);

        } catch (error) {
            await connection.rollback();
            console.error("clearAllUserData error:", error);
            return Response.error(res, "ERROR", "Failed to clear user data: " + error.message, 500);
        } finally {
            connection.release();
        }
    }
}
module.exports = UsersController;
    
