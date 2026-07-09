var pool = require('../config/dbConnection');
const baseModel = require("../models/baseModel");

const { format } = require("date-fns");

class User extends baseModel{

    async getAll() {
        return await pool.query('SELECT * FROM users');
    }

    async getHosts(){
        const result = await pool.query("SELECT id,concat(firstname,' ',lastname) as name FROM users where role in (select id from settings where setting = 'role' and value='host') order by name");
        return result[0];
    }

    async getStaff(){
        const result =  await pool.query("SELECT id,concat(firstname,' ',lastname) as name FROM users where role in (select id from settings where setting = 'role' and value='staff') order by name");
        return result[0];
    }

    async getStaffWithDetails(){
        const result = await pool.query("SELECT u.*,concat(u.firstname,' ',u.lastname) as name,DATE_FORMAT(u.date_of_birth,'%d %b %Y') as dob,DATE_FORMAT(u.date_of_joining,'%d %b %Y') as doj,s.display as selectedcountry FROM users u,settings s where u.role in (select id from settings where setting = 'role' and value='staff') and u.country = s.id order by name");
        return result[0];
    }

    async getStaffByPhone(phone) {
        return await this.find('users', { phone: phone, role: 270 });
    }

    async getStaffByEmail(email){
        return await this.find('users',{email:email,role:270});
    }

    async getGuests(){
        const result =  await pool.query("SELECT id,concat(firstname,' ',lastname) as name FROM users where role in (select id from settings where setting = 'role' and value='guest') order by name");
        return result[0];
    }

    async getHostsWithDetails(){
        //console.log("SELECT u.*,concat(u.firstname,' ',u.lastname) as name,DATE_FORMAT(u.date_of_birth,'%d %b %Y') as dob,DATE_FORMAT(u.date_of_joining,'%d %b %Y') as doj,s.display as selectedcountry FROM users u,settings s where u.role in (select id from settings where setting = 'role' and value='host') and u.country = s.id order by name");
        console.log();
        const result = await pool.query("SELECT u.*,concat(u.firstname,' ',u.lastname) as name,DATE_FORMAT(u.date_of_birth,'%d %b %Y') as dob,DATE_FORMAT(u.date_of_joining,'%d %b %Y') as doj FROM users u where u.role in (select id from settings where setting = 'role' and value='host') order by name");
        return result[0];
    }

    async guestsForDashboard(){
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            const baseQuery = "SELECT u.id,concat(u.salutation,' ',u.firstname,' ',u.lastname) as name, u.email, u.phone, b.subBookingId as booking,b.id as booking_id, b.currentStatus as status, concat(DATE_FORMAT(b.start,'%d %b %y'),' - ',DATE_FORMAT(b.end,'%d %b %y')) as stay,b.start,b.end,b.createDatetime, p.listing_name as property from users u, bookings b, properties p where u.role = 268 and u.id = b.guest_id and b.property_id = p.id";
            const past = await pool.query(baseQuery + ' and b.end < ?  order by b.end desc limit 50',[today]);
            const upcoming = await pool.query(baseQuery + ' and b.start > ? order by b.start',[today]);
            const recent = await pool.query(baseQuery + ' order by b.createDatetime desc limit 50');
            const ongoing = await pool.query(baseQuery + ' and b.start <= ? and b.end >= ? order by b.start',[today,today]);
            return {recent:recent[0],upcoming:upcoming[0],ongoing:ongoing[0],past:past[0]};
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async getById(id) {
        const result = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
        return result[0];
    }

    async getByIdAndRole(id,role) {
        const result = await pool.query('SELECT * FROM users WHERE id = ? and role = ?', [id,role]);
        return result[0];
    }

    async getByEmail(email) {
        const result = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        return result[0][0];
    }

    /**
     * Staff (270) or property manager (271) rows for login — avoids matching a guest/host
     * with the same email first. Email match is case-insensitive and ignores surrounding spaces.
     */
    async findStaffOrManagerByEmailForLogin(normalizedEmail) {
        const result = await pool.query(
            `SELECT * FROM users 
             WHERE LOWER(TRIM(COALESCE(email, ''))) = ? 
             AND role IN (?, ?)`,
            [normalizedEmail, 270, 271]
        );
        return result[0] || [];
    }

    async userExists(email) {
        const result = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        console.log(result);
        if (result[0].length){
            return true;
        }
        return false;
    }

    async getByPhone(phone) {
        const result = await pool.query('SELECT * FROM users WHERE phone = ?', [phone]);
        return result[0][0];
    }

    // Find a user by any known phone format (e.g. +919001995465, 9001995465, +9001995465).
    // Used as a fallback when an exact-match lookup fails so that different normalizations
    // of the same number don't create duplicate user accounts.
    async getByPhoneVariants(phone) {
        const digits = phone.replace(/[^0-9]/g, '');
        const tenDigit = digits.slice(-10);
        if (tenDigit.length !== 10) return null;
        const variants = [
            tenDigit,
            `+91${tenDigit}`,
            `91${tenDigit}`,
            `+91-${tenDigit}`,
            `91-${tenDigit}`,
            `+${tenDigit}`,
            `0${tenDigit}`,
        ];
        const placeholders = variants.map(() => '?').join(',');
        const result = await pool.query(
            `SELECT * FROM users WHERE phone IN (${placeholders}) LIMIT 1`,
            variants
        );
        return result[0][0] || null;
    }

    async userPhoneExists(phone) {
        const result = await pool.query('SELECT * FROM users WHERE phone = ?', [phone]);
        console.log(result);
        if (result[0].length){
            return result[0];
        }
        return false;
    }

    async create({firstname,lastname,email,password,role}){
        const result = await pool.query('insert into users (firstname,lastname,email,password,role) values (?,?,?,?,?)',[firstname,lastname,email,password,role]);
        const user = await pool.query('select * from users where id = ?',[result[0].insertId]);
        return user[0][0];
    }

    async store(fieldValues){
        //const result = await pool.query('insert into users (firstname,lastname,email,phone,role) values (?,?,?,?,268)',[firstname,lastname,email,phone]);
        const ALLOWED_FIELDS = ['firstname','lastname','email','phone','role','salutation','date_of_birth','country','id_type','id_number','id_file','address','password'];
        const sanitized = {};
        ALLOWED_FIELDS.forEach(f => { if (fieldValues[f] !== undefined) sanitized[f] = fieldValues[f]; });
        const result = await pool.query('insert into users SET ?', sanitized);
        const user = await pool.query('select * from users where id = ?',[result[0].insertId]);
        return user[0][0];
    }

    async createWithPhone(phone, role) {
        const result = await pool.query('INSERT INTO users (phone,role) VALUES (?, ?)', [phone,role]);
        const user = await pool.query('select * from users where id = ?',[result[0].insertId]);
        return user[0][0];
    }
  
    async saveOTP(phone,otp,expires_at){
        const res = await pool.query('select * from otp where phone = ?',[phone]);
        if(!res || res[0].length == 0){
            await pool.query('insert into otp (phone, otp, expires_at) values (?,?,?)',[phone,otp,expires_at]);
        }else{
            console.log("phone otp record exists");
            await pool.query('update otp set otp = ?, expires_at = ? where phone = ?',[otp,expires_at,phone]);
        }
        const otpRecord = await pool.query('select * from otp where phone = ?',[phone]);
        return otpRecord[0][0].otp;
    }

    async validatePhoneOTP(phone,otp){
        const result = await pool.query('SELECT * FROM otp WHERE phone = ?', [phone]);
        return result[0];
    }

    async getOTPRecord(where={}){
        console.log("where clause");
        console.log(where);
        return this.find('otp',where);
    }

    async updateProfile(id,firstname,lastname,email,phone){
        return await pool.query('UPDATE users SET firstname = ?, lastname = ?, email = ?, phone=? WHERE id = ?', [firstname,lastname,email,phone, id]);
    }

    async updateUser(values,id){
        const ALLOWED_UPDATE_FIELDS = ['firstname','lastname','email','phone','salutation','date_of_birth','country','id_type','id_number','id_file','address','token_invalid_after'];
        const sanitized = {};
        ALLOWED_UPDATE_FIELDS.forEach(f => { if (values[f] !== undefined) sanitized[f] = values[f]; });
        if (Object.keys(sanitized).length === 0) return null;
        const result = await pool.query('update users SET ? where id = ?', [sanitized, id]);
        return result[0];
    }

    async invalidateTokens(userId) {
        try {
            return await pool.query('UPDATE users SET token_invalid_after = ? WHERE id = ?', [Math.floor(Date.now() / 1000), userId]);
        } catch (err) {
            console.warn('invalidateTokens failed (column may be missing):', err.message);
        }
    }

    async updateDestination(id, { name, description, photo }) {
        return await pool.query('UPDATE destinations SET name = ?, description = ?, photo = ? WHERE id = ?', [name, description, photo, id]);
    }
  
    async updatePhotoLink(id, photo) {
        return await pool.query('UPDATE destinations SET photo = ? WHERE id = ?', [photo, id]);
    }

    async deleteDestination(id) {
        return await pool.query('DELETE FROM destinations WHERE id = ?', [id]);
    }

    async forBookingInfoDisplay(id){
        const result = await pool.query('select firstname,lastname,phone,email from users where id = ?', [id]);
        return result[0][0];
    }

    /** ===== PROPERTY MANAGER METHODS ===== */

    async getManagers() {
        const result = await pool.query(
            "SELECT id, CONCAT(firstname,' ',lastname) AS name, firstname, lastname, email, phone FROM users WHERE role = 271 ORDER BY firstname"
        );
        return result[0];
    }

    async createManager({ firstname, lastname, email, password, phone }) {
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (firstname, lastname, email, password, phone, role) VALUES (?,?,?,?,?,271)',
            [firstname, lastname, email, hashedPassword, phone || null]
        );
        const [rows] = await pool.query('SELECT id, firstname, lastname, email, phone, role FROM users WHERE id = ?', [result[0].insertId]);
        return rows[0];
    }
  }
  
  module.exports = User;