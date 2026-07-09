var pool = require('../config/dbConnection');
const baseModel = require("../models/baseModel");
const { format,subMonths } = require("date-fns");

const propertyModel = require('../models/propertyModel');
const Property = new propertyModel();
class Booking extends baseModel{

    async save(fieldValues){
        try {
            const [result] = await pool.query('insert into bookings SET ?', fieldValues);
            const [rows] = await pool.query('select * from bookings where id = ?', [result.insertId]);
            return rows[0];
        } catch (error) {
            console.log("error in Booking.save (bookings):", error);
            throw error;
        }
    }

    async saveBookingGuests(fieldValues){
        try {
            // Map common field names to guest_details table columns if necessary
            const guestData = {
                booking_id: fieldValues.booking_id,
                first_name: fieldValues.first_name || fieldValues.firstname || '',
                last_name: fieldValues.last_name || fieldValues.lastname || '',
                email: fieldValues.email || '',
                mobile: fieldValues.mobile || fieldValues.phone || '',
                gender: fieldValues.gender || '',
                dob: fieldValues.dob || null,
                age: fieldValues.age || 0,
                guest_type: fieldValues.guest_type || 'family',
                id_proof_type: fieldValues.id_proof_type || '',
                id_proof_number: fieldValues.id_proof_number || '',
                is_lead: fieldValues.is_lead || fieldValues.lead_guest || 0,
                city: fieldValues.city || '',
                state: fieldValues.state || '',
                country: fieldValues.country || '',
                address: fieldValues.address || '',
                zip: fieldValues.zip || '',
                id_file: fieldValues.id_file || '',
                gst_bill: fieldValues.gst_bill || 0,
                gst_number: fieldValues.gst_number || '',
                business_name: fieldValues.business_name || '',
                stayed_before: fieldValues.stayed_before || '',
                purpose_of_visit: fieldValues.purpose_of_visit || '',
                group_type: fieldValues.group_type || '',
                declaration: fieldValues.declaration || 0,
                updated_at: new Date()
            };

            const [result] = await pool.query('insert into guest_details SET ?', guestData);
            const [rows] = await pool.query('select * from guest_details where id = ?', [result.insertId]);
            return rows[0];
        } catch (error) {
            console.log("error in saveBookingGuests (guest_details):", error);
            throw error;
        }
    }

    async saveBookingPayments(booking_id,transaction_id,amount){
        const result = await pool.query('insert into booking_payments (booking_id,transaction_id,amount,payment_status) values (?,?,?,1)',[booking_id,transaction_id,amount]);
        return result[0];
    }

    async saveBookingTariff(values) {
        try {
            const [result] = await pool.query('insert into booking_tariffs SET ?', values);
            return result;
        } catch (error) {
            console.log("error in saveBookingTariff:", error);
            throw error;
        }
    }

    async saveBookingRentalInfo(values) {
        try {
            const [result] = await pool.query('insert into booking_rentalInfo SET ?', values);
            return result;
        } catch (error) {
            console.log("error in saveBookingRentalInfo:", error);
            throw error;
        }
    }
    
    async getAll(params={}) {
        try{
            var query = 'SELECT * FROM bookings';
            var values = [];
            var whereAppended = false;
            if(params.id){
                query += ' where id = ?';
                values.push(params.id);
                whereAppended = true;
            }else{
                if(params.channelIds){
                    const ids = Array.isArray(params.channelIds) ? params.channelIds : params.channelIds.toString().split(',');
                    const placeholders = ids.map(()=>'?').join(',');
                    query += whereAppended ? ` and channel_id in (${placeholders})` : ` where channel_id in (${placeholders})`;
                    values.push(...ids);
                    whereAppended = true;
                }
                if(params.destination){
                    query += whereAppended ? ' and destination = ?' : ' where destination = ?';
                    values.push(params.destination);
                    whereAppended = true;
                }
                if(params.featured){
                    query += whereAppended ? ' and featured_property = ?' : ' where featured_property = ?';
                    values.push(params.featured);
                    whereAppended = true;
                }
            }
            const results = await pool.query(query, values);
            return results[0];
        }catch(error){
            console.log("error in get all");
            throw error;
        }   
    }



    async bookingOccupancy(booking_id){
        try {
            const result = await pool.query('select * from booking_rentalInfo where booking_id = ? limit 1',[booking_id]);
            return result[0];
        } catch (error) {
            console.log(error);
        }
    }

    /** gets Booking by ezee id(uniqueId) */
    async bookingById(uniqueId){
        try {
            const result = await pool.query('select * from bookings where uniqueId = ?',[uniqueId]);
            return result[0];
        } catch (error) {
            console.log(error);
        }
    }

    /** gets Booking by primary id */
    async bookingByLocalId(id){
        try {
            const result = await pool.query('select * from bookings where id = ?',[id]);
            return result[0];
        } catch (error) {
            console.log(error);
        }
    }

    /** gets Booking by ezee id(uniqueId) */
    async tempBookingById(uniqueId){
        try {
            const result = await pool.query('select * from booking_temp where uniqueId = ?',[uniqueId]);
            return result[0][0];
        } catch (error) {
            console.log(error);
        }
    }

    async logEzeeBookingInput(log){       
        const operation = log.operation;
        const data = log.data.Reservations;
        var uniqueId = 0;
        for(let i=0; i<data.Reservation.length; i++){
            const reservation = data.Reservation[i];
            uniqueId = reservation.UniqueID;
            break;
        }
        console.log(`UniqueID: ${uniqueId} Operation: ${operation}`);
        const result = await pool.query('insert into bookings_log (UniqueID,operation,log) values (?,?,?)',[uniqueId,operation,JSON.stringify(log, null, 4)]);
        return result[0].insertId; 
    }

    async logEzeeLimechatWebhook(log){
        const operation = log.operation;        const result = await pool.query(
            'insert into ezee_limechat_webhook_log (operation,log) values (?,?)',
            [operation, JSON.stringify(log, null, 4)]
        );
        return result[0].insertId;
    }

    async updateEzeeLimechatWebhookLog(id, { limechatStatus = null, limechatSuccess = false, limechatResponse = null } = {}) {
        await pool.query(
            'update ezee_limechat_webhook_log set limechat_status = ?, limechat_success = ?, limechat_response = ? where id = ?',
            [limechatStatus, limechatSuccess ? 1 : 0, limechatResponse, id]
        );
        return;
    }

    async writeEzeeBooking(values){
        const result = await pool.query('INSERT INTO temp_booking SET ?', values);
        return result[0].insertId;
    }

    async writeEzeeBookingTable(table,values){
        const result = await pool.query('INSERT INTO '+table+' SET ?', values);
        return result[0].insertId;
    }

    /** When a booking gets modified delete the older records for the booking and write new ones */
    async clearEzeeBooking(uniqueId){
        try {
            await Promise.all([
                pool.query('DELETE FROM temp_BookByInfo WHERE UniqueID = ?', [uniqueId]),
                pool.query('DELETE FROM temp_BookingTran WHERE UniqueID = ?', [uniqueId]),
                pool.query('DELETE FROM temp_RentalInfo WHERE UniqueID = ?', [uniqueId]),
                pool.query('DELETE FROM temp_taxDetails WHERE UniqueID = ?', [uniqueId]),
                pool.query('DELETE FROM temp_paymentDetails WHERE UniqueID = ?', [uniqueId]),
            ]);
            return;
        } catch (error) {
            throw error;
        }
    }

    async calendarAvailability(check_in_date, check_out_date, propertyId){
        const result = await pool.query("select DATE_FORMAT(EffectiveDate, '%Y-%m-%d') as EffectiveDate from temp_RentalInfo where RoomTypeCode = ? and (EffectiveDate BETWEEN ? and ?)",[propertyId,check_in_date, check_out_date]);
        return result[0];
    }

    async propertyAvailability(propertyId,start=null){
        if(!start){
            start = format(new Date(),'yyyy-MM-dd');
        }
        const result = await pool.query("select start,end,currentStatus from bookings where property_id = ? and start >= ?)",[propertyId,start]);
        return result[0];
    }

    async propertyCalendar(propertyId){
        try {
            const result = await pool.query("select id,DATE_FORMAT(start, '%Y-%m-%d') as start,DATE_FORMAT(end, '%Y-%m-%d') as end,status,currentStatus from bookings where property_id = ? and currentStatus not in ('Cancel','Void')",[propertyId]);
            return result[0];
        } catch (error) {
            console.log(error);
            throw error;
        }
    }



    async getAllSyncLogs(){
        const restult = await pool.query("select * from bookings_log where imported = 0 limit 0,5");
        return restult[0];
    }

    async markAsImported(id){
        try {
            await pool.query('update  bookings_log set imported = 1 where id = ?',[id]);
            return;
        } catch (error) {
            throw error;
        }
    }

    async insertTempCheck(id){
        const result = await pool.query('INSERT INTO temp_check (UniqueID) values (?) ', [id]);
        return result[0].insertId;
    }

    async manageTempCheck(){
        const results = await pool.query("update temp_check set imported = 1 where imported = 0 and UniqueID in (select UniqueID from temp_RentalInfo)");
        return;
    }

    async doneUpto(){
        const results = await pool.query("select DATE_FORMAT(done_upto, '%Y-%m-%d') as done_upto from temp_table");
        return results[0][0].done_upto;
    }

    async updateUpto(upto){
        const results = await pool.query("update temp_table set done_upto = ?",[upto]);
        return;
    }

    async missing5(){
        const restult = await pool.query("select * from temp_check where imported = 0 and UniqueID not in (select UniqueID from temp_RentalInfo) limit 0,5");
        return restult[0];
    }

    async markMissedAsImported(id){
        try {
            await pool.query('update temp_check set imported = 1 where UniqueID = ?',[id]);
            return;
        } catch (error) {
            throw error;
        }
    }

    async futureOccupiedDates(propertyId){
        const today = format(new Date(),'yyyy-MM-dd');
        const results = await pool.query("select DATE_FORMAT(EffectiveDate, '%Y-%m-%d') as EffectiveDate from temp_RentalInfo where RoomTypeCode = ? and EffectiveDate >= ? order by EffectiveDate",[propertyId,today]);
        return results[0];
    }

    /** START - Importing Bookings into real booking tables from booking logs */
    async readBookingLog(id){
        try {
            const results = await pool.query("select * from bookings_log where id = ?",[id]);
            return results[0];
        } catch (error) {
            throw error;
        }
    }

    async bookingByEzeeIds(uniqueId,subBookingId){
        try {
            const results = await pool.query("select * from bookings where uniqueId = ? and subBookingId = ?",[uniqueId,subBookingId]);
            return results[0];
        } catch (error) {
            throw error;
        }
    }

    async fetchFromTable(table,key,value,single=false){
        try{
            const results = await pool.query('select * from '+table+' where '+key+' = ?',[value]);
            if(single){
                return results[0][0];
            }
            return results[0];
        } catch (error){
            throw error;
        }
    }

    async fetchFromTableWithClause(table,where){
        try{
            const results = await pool.query('select * from '+table+' where ?',[where]);
            return results[0];
        } catch (error){
            throw error;
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

    async deleteFromBookingTable(table,booking_id){
        try{
            const result = await pool.query('delete from '+table+' where booking_id = ?', [booking_id]);
            return result;
        } catch (error) {
            throw error;
        }
    }

    async updateBookingTable(table,values,id){
        try{
            const result = await pool.query('update '+table+' SET ? where id = ?', [values,id]);
            return result[0];
        } catch (error) {
            throw error;
        }
    }

    async guestFromPhone(phone,mobile){
        if((!phone || phone=="") && (!mobile || mobile=="")){
            return null;
        }
        var whereClause = 'where role = 268 and (';
        var clauseAdded = false;
        if(phone && phone !=''){
            whereClause += ` phone = '${phone}' || phone1 = '${phone}' || phone2 = '${phone}' `;
            clauseAdded = true;
        }
        if(mobile && mobile !=''){
            if(clauseAdded){
                whereClause += ' || ';
            }
            whereClause += ` phone1 = '${mobile}' || phone1 = '${mobile}' || phone2 = '${mobile}' `;
        }
        whereClause += ')';
        try{
            const result = await pool.query('select * from users '+whereClause);
            return result[0];
        } catch (error) {
            throw error;
        }
    }

    async getLogsForImport(no){
        try {
            const results = await pool.query('select id from bookings_log where imported in (0,1) limit ?',[no]);
            return results[0];
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async markImported(id,status=2){
        try{
            const result = await pool.query('update bookings_log SET imported = ? where id = ?', [status,id]);
            return result[0];
        } catch (error) {
            throw error;
        }
    }
    /** END - Importing Bookings into real booking tables from booking logs */
    /** START - Admin panel booking screen functions */

    async adminBookingsList(){
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            const baseQuery = `SELECT
                b.id,
                b.uniqueId,
                b.currentStatus,
                IFNULL(u.firstname,'') AS firstname,
                IFNULL(u.lastname,'') AS lastname,
                DATE_FORMAT(b.start,'%d %b %y') AS start,
                DATE_FORMAT(b.end,'%d %b %y') AS end,
                b.createDatetime,
                COALESCE(s.display,'') AS property_type,
                COALESCE(p.listing_name,'') AS listing_name,
                COALESCE(bt.totalPayment,0) AS totalPayment,
                COALESCE(bt.totalAmountAfterTax,0) AS totalAmountAfterTax,
                COALESCE(bt.taCommision,0) AS taCommision
            FROM bookings b
            LEFT JOIN users u ON b.guest_id = u.id
            LEFT JOIN properties p ON b.property_id = p.id
            LEFT JOIN booking_tariffs bt ON b.id = bt.booking_id
            LEFT JOIN settings s ON s.setting = 'property_type' AND p.property_type = s.id`;

            const [past, upcoming, recent, ongoing] = await Promise.all([
                pool.query(baseQuery + ' WHERE b.start < ?  ORDER BY b.start DESC LIMIT 50', [today]),
                pool.query(baseQuery + ' WHERE b.start > ? ORDER BY b.start ASC LIMIT 200', [today]),
                pool.query(baseQuery + ' ORDER BY b.createDatetime DESC LIMIT 50'),
                pool.query(baseQuery + ' WHERE b.start <= ? AND b.end >= ?', [today, today]),
            ]);
            return {recent:recent[0],upcoming:upcoming[0],ongoing:ongoing[0],past:past[0]};
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async adminManageBookingsList(){
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            const startOfMonth = format(subMonths(new Date(),1), 'yyyy-MM-01');
            //const startOfMonth = format(new Date(), 'yyyy-MM-01');
            console.log(`looking for dates between ${startOfMonth} and ${today}`);
            const baseQuery = `SELECT
                b.id,
                b.uniqueId,
                b.currentStatus,
                b.source,
                IFNULL(u.firstname,'') AS firstname,
                IFNULL(u.lastname,'') AS lastname,
                DATE_FORMAT(b.start,'%d %b %y') AS start,
                DATE_FORMAT(b.end,'%d %b %y') AS end,
                b.createDatetime,
                COALESCE(s.display,'') AS property_type,
                COALESCE(p.listing_name,'') AS listing_name,
                COALESCE(bt.totalPayment,0) AS totalPayment,
                COALESCE(bt.totalAmountAfterTax,0) AS totalAmountAfterTax,
                COALESCE(bt.totalAmountBeforeTax,0) AS totalAmountBeforeTax,
                COALESCE(bt.totalTax,0) AS totalTax,
                COALESCE(bt.taCommision,0) AS taCommision
            FROM bookings b
            LEFT JOIN users u ON b.guest_id = u.id
            LEFT JOIN properties p ON b.property_id = p.id
            LEFT JOIN booking_tariffs bt ON b.id = bt.booking_id
            LEFT JOIN settings s ON s.setting = 'property_type' AND p.property_type = s.id
            WHERE end >= ? AND end <= ?`;
            const bookings = await pool.query(baseQuery,[startOfMonth,today]);
            return bookings[0]; 
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async bookingWithPricing(id){
        try {
            const booking = await pool.query("SELECT b.id,b.uniqueId,b.currentStatus,b.source, u.firstname, u.lastname,u.phone,u.email,DATE_FORMAT(b.start,'%d %b %y') as start,DATE_FORMAT(b.end,'%d %b %y') as end,b.createDatetime,p.listing_name,bt.totalPayment,bt.totalAmountAfterTax,bt.totalAmountBeforeTax,bt.totalTax,bt.taCommision FROM bookings b, users u,properties p,booking_tariffs bt where b.guest_id = u.id and b.property_id = p.id and b.id = bt.booking_id and b.id = ?",[id]);
            return booking[0][0];
        } catch (error) {
            console.log(error);
            throw error;
        }
    }
    /** END - Admin panel booking screen functions */

    /** START - Dashboard related data functions */
    async todaysCheckouts(){
        try{
            const today = format(new Date(), 'yyyy-MM-dd');
            const [bookings, tarrifs, rentals] = await Promise.all([
                pool.query("select * from bookings where end = ? and uniqueId > 0 and currentStatus not in ('Void','Cancel')", [today]),
                pool.query("select *,(totalAmountBeforeTax - taCommision) as nbv from booking_tariffs where booking_id in (select id from bookings where end = ? and currentStatus not in ('Void','Cancel'))", [today]),
                pool.query("select *, DATE_FORMAT(effectiveDate,'%Y-%m-%d') as effDate from booking_rentalInfo where booking_id in (select id from bookings where end = ? and currentStatus not in ('Void','Cancel'))", [today]),
            ]);
            return {bookings:bookings[0],tarrifs:tarrifs[0],rentals:rentals[0]};
        }catch (error) {
            console.log(error);
            throw error;
        }
    }

    async todaysBookings(){
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            //and b.currentStatus not in ('Cancel','Void') 
            const [bookingStats, rentalStats] = await Promise.all([
                pool.query("SELECT b.id,b.uniqueId,b.start,b.end,b.voucherNo,b.packageName,b.roomName,b.currentStatus,t.totalAmountAfterTax,t.taCommision, concat(u.firstname,' ',u.lastname) as guest,u.phone,u.email FROM bookings b,booking_tariffs t, users u where b.start <= ? and b.end >= ? and b.id = t.booking_id and b.guest_id = u.id", [today, today]),
                pool.query("SELECT booking_id,max(effectiveDate) as eDate, max(adult) as adults, max(child) as children FROM `booking_rentalInfo` where booking_id in (select id from bookings where start <= ? and end >= ?) group by booking_id;", [today, today]),
            ]);
            return {bookingStats:bookingStats[0],rentalStats:rentalStats[0]};    
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async revenueByDay(start,end){
        try {
            const results = await pool.query(`SELECT b.end,sum(t.totalAmountBeforeTax-t.taCommision) as revenue FROM bookings b, booking_tariffs t where b.end >= ? and b.end <= ? and b.currentStatus not in ('Void','Cancel') and b.id = t.booking_id group by b.end order by b.end`,[start,end]);
            return results[0];
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async revenueByMonth(start,end){
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            /*
             * The temp_RentalInfo table in production does not have a TariffGross column – it stores the nightly
             * pre-tax amount in the RentPreTax column. The previous query crashed the dashboard with an
             * “Unknown column 'ri.TariffGross'” SQL error. We now use RentPreTax as the revenue basis to
             * eliminate the crash while keeping the business logic intact.
             */
            const result = await pool.query("select MONTH(ri.EffectiveDate) as month, YEAR(ri.EffectiveDate) as year, DATE_FORMAT(ri.EffectiveDate, '%M') as monthName, sum(ri.RentPreTax) as revenue from temp_RentalInfo ri where ri.EffectiveDate between ? and ? group by MONTH(ri.EffectiveDate), YEAR(ri.EffectiveDate) order by YEAR(ri.EffectiveDate), MONTH(ri.EffectiveDate)",[start,end]);
            return result[0];
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    // New method for stacked chart data by property
    async revenueByPropertyStacked(start, end, propertyId = null) {
        try {
            let query = `
                SELECT 
                    DATE(ri.EffectiveDate) as date,
                    p.id as property_id,
                    p.listing_name,
                    SUM(ri.RentPreTax) as revenue
                FROM temp_RentalInfo ri
                JOIN properties p ON p.channel_id = ri.RoomTypeCode
                WHERE ri.EffectiveDate BETWEEN ? AND ?
            `;
            
            const params = [start, end];
            
            if (propertyId) {
                query += ` AND p.id = ?`;
                params.push(propertyId);
            }
            
            query += ` 
                GROUP BY DATE(ri.EffectiveDate), p.id, p.listing_name
                ORDER BY ri.EffectiveDate, p.listing_name
            `;
            
            const result = await pool.query(query, params);
            return result[0];
        } catch (error) {
            console.log('Error in revenueByPropertyStacked:', error);
            throw error;
        }
    }

    // Get historical pricing data for revenue loss calculation
    async getHistoricalPricing(propertyId, startDate, endDate) {
        try {
            // Get average pricing from last year for same dates
            const lastYearStart = new Date(startDate);
            lastYearStart.setFullYear(lastYearStart.getFullYear() - 1);
            const lastYearEnd = new Date(endDate);
            lastYearEnd.setFullYear(lastYearEnd.getFullYear() - 1);

            const query = `
                SELECT 
                    AVG(ri.RentPreTax) as avgRate,
                    COUNT(*) as bookingCount
                FROM temp_RentalInfo ri
                JOIN properties p ON p.channel_id = ri.RoomTypeCode
                WHERE p.id = ? 
                AND ri.EffectiveDate BETWEEN ? AND ?
                AND ri.RentPreTax > 0
            `;
            
            const result = await pool.query(query, [propertyId, format(lastYearStart, 'yyyy-MM-dd'), format(lastYearEnd, 'yyyy-MM-dd')]);
            return result[0];
        } catch (error) {
            console.log('Error in getHistoricalPricing:', error);
            return [];
        }
    }

    // Get monthly bookings for a property
    async getMonthlyBookings(propertyId, startDate, endDate) {
        try {
            const query = `
                SELECT 
                    b.id,
                    b.uniqueId,
                    b.start,
                    b.end,
                    b.currentStatus,
                    b.totalAmountAfterTax,
                    b.totalAmountBeforeTax,
                    DATEDIFF(b.end, b.start) as nights
                FROM bookings b
                WHERE b.property_id = ?
                AND (
                    (b.start BETWEEN ? AND ?) 
                    OR (b.end BETWEEN ? AND ?)
                    OR (b.start <= ? AND b.end >= ?)
                )
                AND b.currentStatus NOT IN ('Cancel', 'Void')
                ORDER BY b.start
            `;
            
            const result = await pool.query(query, [
                propertyId, 
                startDate, endDate, 
                startDate, endDate,
                startDate, endDate
            ]);
            return result[0];
        } catch (error) {
            console.log('Error in getMonthlyBookings:', error);
            throw error;
        }
    }

    // Get monthly revenue data for a property
    async getMonthlyRevenue(propertyId, startDate, endDate) {
        try {
            const query = `
                SELECT 
                    DATE(ri.EffectiveDate) as date,
                    SUM(ri.RentPreTax) as revenue,
                    COUNT(*) as bookingCount
                FROM temp_RentalInfo ri
                JOIN properties p ON p.channel_id = ri.RoomTypeCode
                WHERE p.id = ? 
                AND ri.EffectiveDate BETWEEN ? AND ?
                GROUP BY DATE(ri.EffectiveDate)
                ORDER BY ri.EffectiveDate
            `;
            
            const result = await pool.query(query, [propertyId, startDate, endDate]);
            return result[0];
        } catch (error) {
            console.log('Error in getMonthlyRevenue:', error);
            throw error;
        }
    }

    async pieChartsData(){
        try {
            const props = await pool.query("select p.listing_name as category,count(r.id) as count from bookings b, booking_rentalInfo r, properties p WHERE b.currentStatus not in ('Void','Cancel') and b.id = r.booking_id and b.property_id = p.id group by category");
            const channels = await pool.query("SELECT source as category,count(*) as count FROM bookings group by category");
            const propTypes = await pool.query("select s.display as category,count(r.id) as count from bookings b, booking_rentalInfo r, properties p, settings s WHERE b.currentStatus not in ('Void','Cancel') and b.id = r.booking_id and b.property_id = p.id and p.property_type = s.id group by display");
            return {props:props[0],channels:channels[0],propTypes:propTypes[0]};
        } catch (error) {
            console.log(error);
            throw error;
        }
    }
    /** END - Dashboard related data functions */

    /** START - My trips related data functions */

    /**
     * Main-site /ext/myTrips: trips where this portal user owns the booking (user_id, or legacy guest_id).
     */
    async myTrips(userId) {
        try {
            const portalWhere = '(b.user_id = ? OR (b.user_id IS NULL AND b.guest_id = ?))';
            const [trips] = await pool.query(
                `SELECT
                    b.id,
                    DATE_FORMAT(b.start, '%Y-%m-%d') AS start,
                    DATE_FORMAT(b.end, '%Y-%m-%d') AS end,
                    COALESCE(b.currentStatus, b.status) AS status,
                    p.id AS property_id,
                    p.listing_name,
                    pm.media_filename
                 FROM bookings b
                 JOIN properties p ON b.property_id = p.id
                 LEFT JOIN property_media pm ON pm.property_id = p.id AND pm.media_type_id = 4
                 WHERE ${portalWhere}
                 ORDER BY b.createDatetime DESC`,
                [userId, userId]
            );
            const list = trips || [];
            if (list.length === 0) {
                return { trips: [], occupancy: [] };
            }
            const ids = list.map((t) => t.id);
            const ph = ids.map(() => '?').join(',');
            const [rentalRows] = await pool.query(
                `SELECT booking_id, adult, child FROM booking_rentalInfo WHERE booking_id IN (${ph})`,
                ids
            );
            const firstRental = {};
            for (const r of rentalRows || []) {
                if (firstRental[r.booking_id] == null) {
                    firstRental[r.booking_id] = r;
                }
            }
            const occupancy = list.map((t) => ({
                booking_id: t.id,
                adults: Number(firstRental[t.id]?.adult || 0),
                children: Number(firstRental[t.id]?.child || 0),
            }));
            return { trips: list, occupancy };
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    /**
     * PMS live_bookings rows linked to bookings the portal user owns (no phone-wide matching).
     */
    async myTripsNew(userId){
        try {
            const portalJoin = `(b.user_id = ? OR (b.user_id IS NULL AND b.guest_id = ?))`;
            const tripsQuery = `
                SELECT
                    lb.id,
                    STR_TO_DATE(lb.ArrivalDate, '%Y-%m-%d') as start,
                    STR_TO_DATE(lb.DepartureDate, '%Y-%m-%d') as end,
                    COALESCE(lb.BookingStatus, lb.Status) as status,
                    p.id as property_id,
                    p.listing_name,
                    p.google_latitude,
                    p.google_longitude,
                    COALESCE(CONCAT(p.id, '/', pm.media_filename), p.cover_photo_link) as cover_image,
                    lb.TotalInclusiveTax as amount,
                    lb.TotalExclusivTax as amount_before_tax,
                    lb.Adult as adults,
                    lb.Child as children,
                    lb.ReservationNo,
                    b.declaration,
                    b.esign_status,
                    b.security_deposit_paid,
                    b.security_deposit_status,
                    (SELECT COUNT(*) FROM guest_details gd WHERE gd.booking_id = b.id AND (gd.id_file IS NOT NULL OR gd.first_name IS NOT NULL)) as filled_guests_count
                FROM live_bookings lb
                INNER JOIN bookings b ON (
                    CAST(b.uniqueId AS CHAR) = CAST(lb.ReservationNo AS CHAR)
                    OR b.subBookingId = lb.ReservationNo
                )
                LEFT JOIN properties p ON p.channel_id = lb.RoomShortCode
                LEFT JOIN property_media pm ON pm.property_id = p.id AND pm.media_type_id = 4
                WHERE ${portalJoin}
            `;
            const trips = await pool.query(tripsQuery, [userId, userId]);
            const validTrips = (trips[0] || []).filter(t => t.property_id != null);
            const occupancy = validTrips.map(trip => ({
                booking_id: trip.id,
                adults: Number(trip.adults || 0),
                children: Number(trip.children || 0)
            }));
            return { trips: validTrips, occupancy };
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    /**
     * Precheckin My Trips: only bookings where user_id matches (non-null). No legacy guest_id fallback.
     */
    async myTripsNewPrecheckin(userId) {
        try {
            const portalJoin = `(b.user_id = ? AND b.user_id IS NOT NULL)`;
            const tripsQuery = `
                SELECT
                    lb.id,
                    STR_TO_DATE(lb.ArrivalDate, '%Y-%m-%d') as start,
                    STR_TO_DATE(lb.DepartureDate, '%Y-%m-%d') as end,
                    COALESCE(lb.BookingStatus, lb.Status) as status,
                    p.id as property_id,
                    p.listing_name,
                    p.google_latitude,
                    p.google_longitude,
                    COALESCE(CONCAT(p.id, '/', pm.media_filename), p.cover_photo_link) as cover_image,
                    lb.TotalInclusiveTax as amount,
                    lb.TotalExclusivTax as amount_before_tax,
                    lb.Adult as adults,
                    lb.Child as children,
                    lb.ReservationNo,
                    b.declaration,
                    b.esign_status,
                    b.security_deposit_paid,
                    b.security_deposit_status,
                    (SELECT COUNT(*) FROM guest_details gd WHERE gd.booking_id = b.id AND (gd.id_file IS NOT NULL OR gd.first_name IS NOT NULL)) as filled_guests_count
                FROM live_bookings lb
                INNER JOIN bookings b ON (
                    CAST(b.uniqueId AS CHAR) = CAST(lb.ReservationNo AS CHAR)
                    OR b.subBookingId = lb.ReservationNo
                )
                LEFT JOIN properties p ON p.channel_id = lb.RoomShortCode
                LEFT JOIN property_media pm ON pm.property_id = p.id AND pm.media_type_id = 4
                WHERE ${portalJoin}
            `;
            const trips = await pool.query(tripsQuery, [userId]);
            const validTrips = (trips[0] || []).filter(t => t.property_id != null);
            const occupancy = validTrips.map(trip => ({
                booking_id: trip.id,
                adults: Number(trip.adults || 0),
                children: Number(trip.children || 0)
            }));
            return { trips: validTrips, occupancy };
        } catch (error) {
            console.log(error);
            throw error;
        }
    }
    /** END - My trips related data functions */

    async bookingDetailsForHost(bookingId){ 
        try {
            // Get basic booking details
            const results = await pool.query(`select b.id,b.uniqueId,b.subBookingId,b.transaction_id,b.voucherNo,b.property_id,b.start,b.end,b.source,b.currentStatus,b.createDatetime,b.guest_id,NULL as user_id,b.security_deposit,b.security_deposit_paid,b.security_deposit_status,b.declaration,b.esign_status,b.cancellation_requested,b.cancellation_reason,b.cancellation_requested_at,b.refund_amount,b.refund_status,b.refund_notes,b.paymentMethod,p.listing_name,DATE_FORMAT(b.start, '%d %M %Y') as check_in_date,DATE_FORMAT(b.end, '%d %M %Y') as check_out_date,(SELECT COUNT(*) FROM guest_details gd WHERE gd.booking_id = b.id) AS number_of_guests from bookings b join properties p on b.property_id = p.id where b.id = ?`,[bookingId]);
            
            if (results[0].length === 0) {
                throw new Error('Booking not found');
            }
            
            const booking = results[0][0];
            const propertyId = booking.property_id;

            // Get tariff details
            const tariffs = await pool.query("select totalAmountBeforeTax,taCommision,totalAmountAfterTax,totalPayment from booking_tariffs where booking_id = ?",[bookingId]);
            
            // Get rental info
            const rentalInfo = await pool.query("select effectiveDate,adult as adults,child as children,rent from booking_rentalInfo where booking_id = ? order by effectiveDate",[bookingId]);
            
            // Get guest details from guest_details table directly
            const guests = await pool.query(`
                SELECT
                    gd.id, gd.is_lead as lead_guest, gd.first_name as firstname, gd.last_name as lastname, gd.email, gd.mobile as phone,
                    gd.group_type, gd.purpose_of_visit,
                    gd.id_file, gd.id_proof_type, gd.id_proof_number,
                    gd.gender, gd.dob, gd.city, gd.state, gd.country, gd.address, gd.zip, gd.stayed_before as stayedBefore
                FROM guest_details gd
                WHERE gd.booking_id = ?
            `, [bookingId]);
            const property = await Property.forBookingInfoDisplay(propertyId); 
            // Get property details
           console.log("Properties:::",property); 
            
            // Add tariff information
            if(tariffs[0].length > 0){
                booking["tariff"] = tariffs[0][0];
            } else {
                booking["tariff"] = {};
            }
            
            // Add rental information
            if(rentalInfo[0].length > 0){
                booking["rentalInfo"] = rentalInfo[0];
            } else {
                booking["rentalInfo"] = [];
            }
            
            // Find lead guest and add their details to booking
            const leadGuest = guests[0].find(guest => guest.lead_guest === 1);
            if (leadGuest) {
                booking["guest"] = {
                    firstname: leadGuest.firstname,
                    lastname: leadGuest.lastname,
                    email: leadGuest.email,
                    phone: leadGuest.phone,
                    group_type: leadGuest.group_type,
                    purpose_of_visit: leadGuest.purpose_of_visit,
                    id_file: leadGuest.id_file,
                    gender: leadGuest.gender,
                    dob: leadGuest.dob,
                    city: leadGuest.city,
                    state: leadGuest.state,
                    country: leadGuest.country,
                    address: leadGuest.address,
                    zip: leadGuest.zip,
                    stayedBefore: leadGuest.stayedBefore || leadGuest.stayed_before
                };
            } else {
                booking["guest"] = {};
            }
            
            // Add all guests array
            booking["guests"] = guests[0] || [];
            
            // Add property information
            booking["property"] = property || {};
                
            return {
                booking: booking,
                rentalInfo: booking.rentalInfo || [],
                tariff: booking.tariff || {},
                property: booking.property || {},
                guest: booking.guest || {},
                guests: booking.guests || []
            };
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async updateGuestQuestionnaire(bookingId, userId, updates = {}) {
        try {
            const [rows] = await pool.query(
                `SELECT id FROM bookings WHERE id = ?
                 AND user_id = ? AND user_id IS NOT NULL
                 LIMIT 1`,
                [bookingId, userId]
            );

            if (!rows || rows.length === 0) {
                return null;
            }

            const payload = {
                stayed_before: updates.stayed_before ?? null,
                purpose_of_visit: updates.purpose_of_visit ?? null,
                group_type: updates.group_type ?? null,
                updated_at: new Date()
            };

            await pool.query('update bookings set ? where id = ?', [payload, bookingId]);

            const [updated] = await pool.query(
                'select id, stayed_before, purpose_of_visit, group_type from bookings where id = ?',
                [bookingId]
            );

            return updated[0];
        } catch (error) {
            throw error;
        }
    }

    async bookingForGuest(bookingId, portalUserId) {
        try {
            const [rows] = await pool.query(
                `SELECT id, property_id FROM bookings WHERE id = ?
                 AND user_id = ? AND user_id IS NOT NULL
                 LIMIT 1`,
                [bookingId, portalUserId]
            );
            return rows && rows.length ? rows[0] : null;
        } catch (error) {
            throw error;
        }
    }

    /** ===== PROPERTY MANAGER METHODS ===== */

    /**
     * Returns bookings for all properties managed by the given manager.
     * status: 'upcoming' | 'ongoing' | 'cancelled' | 'completed' | 'all'
     */
    async bookingsForManager(managerId, status = 'all') {
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            const baseQuery = `
                SELECT
                    b.id,
                    b.uniqueId,
                    b.currentStatus,
                    b.source,
                    IFNULL(u.firstname,'') AS firstname,
                    IFNULL(u.lastname,'') AS lastname,
                    DATE_FORMAT(b.start,'%d %b %Y') AS start,
                    DATE_FORMAT(b.end,'%d %b %Y') AS end,
                    b.createDatetime,
                    COALESCE(p.listing_name,'') AS listing_name,
                    COALESCE(bt.totalPayment,0) AS totalPayment,
                    COALESCE(bt.totalAmountAfterTax,0) AS totalAmountAfterTax,
                    (SELECT COUNT(*) FROM guest_details gd WHERE gd.booking_id = b.id) AS number_of_guests
                FROM bookings b
                LEFT JOIN users u ON b.guest_id = u.id
                LEFT JOIN properties p ON b.property_id = p.id
                LEFT JOIN booking_tariffs bt ON b.id = bt.booking_id
                WHERE (
                    p.reservation_executive = ? OR
                    p.hospitality_manager = ? OR
                    p.revenue_manager = ? OR
                    p.general_manager = ? OR
                    p.property_manager_user_id = ?
                )
            `;
            const params = [managerId, managerId, managerId, managerId, managerId];

            let statusClause = '';
            let statusParams = [];
            if (status === 'upcoming') {
                statusClause = ' AND b.start > ?';
                statusParams = [today];
            } else if (status === 'ongoing') {
                statusClause = ' AND b.start <= ? AND b.end >= ?';
                statusParams = [today, today];
            } else if (status === 'cancelled') {
                statusClause = " AND b.currentStatus IN ('Cancel','Cancelled')";
            } else if (status === 'completed') {
                statusClause = ' AND b.end < ?';
                statusParams = [today];
            }

            const [rows] = await pool.query(
                baseQuery + statusClause + ' ORDER BY b.start DESC LIMIT 200',
                [...params, ...statusParams]
            );
            return rows;
        } catch (error) {
            console.error('bookingsForManager error:', error);
            throw error;
        }
    }

    /**
     * Checks whether the given manager has access to the given booking
     * (i.e., the booking's property is assigned to this manager).
     */
    async managerHasBookingAccess(managerId, bookingId) {
        try {
            const [rows] = await pool.query(`
                SELECT b.id FROM bookings b
                JOIN properties p ON b.property_id = p.id
                WHERE b.id = ? AND (
                    p.reservation_executive = ? OR
                    p.hospitality_manager = ? OR
                    p.revenue_manager = ? OR
                    p.general_manager = ? OR
                    p.property_manager_user_id = ?
                )
                LIMIT 1
            `, [bookingId, managerId, managerId, managerId, managerId, managerId]);
            return rows && rows.length > 0;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Returns check-in status summary for a booking.
     */
    async checkinStatusForBooking(bookingId) {
        try {
            const [bookingRows] = await pool.query(`
                SELECT b.id, b.declaration, b.esign_status,
                       b.security_deposit_paid, b.security_deposit_status,
                       DATE_FORMAT(b.start,'%d %b %Y') AS check_in_date,
                       DATE_FORMAT(b.end,'%d %b %Y') AS check_out_date,
                       DATE_FORMAT(b.start,'%Y-%m-%d') AS start_iso,
                       DATE_FORMAT(b.end,'%Y-%m-%d') AS end_iso,
                       DATEDIFF(b.end, b.start) AS nights
                FROM bookings b WHERE b.id = ?
            `, [bookingId]);

            if (!bookingRows || bookingRows.length === 0) throw new Error('Booking not found');
            const booking = bookingRows[0];

            // Fetch guests with all display fields and computed flags
            const [guestRows] = await pool.query(`
                SELECT id, first_name, last_name, email, mobile,
                       id_proof_type, id_proof_number, id_file, is_lead, declaration,
                       COALESCE(document_status, 'pending') AS document_status,
                       document_rejection_reason
                FROM guest_details WHERE booking_id = ?
            `, [bookingId]);

            const totalGuests = guestRows ? guestRows.length : 0;
            const checkedInGuests = guestRows ? guestRows.filter(g => g.first_name && g.first_name.trim()).length : 0;
            // A guest counts as ID-verified only when manager has explicitly approved their document
            const verifiedGuests = guestRows ? guestRows.filter(g => g.document_status === 'approved').length : 0;

            const isDeclarationDone = booking.declaration === 1 || booking.esign_status === 'success';
            const isDepositPaid = booking.security_deposit_paid === 1 || booking.security_deposit_status === 'paid';

            // Calculate progress percentage
            let progressItems = 0, completedItems = 0;
            if (totalGuests > 0) { progressItems += totalGuests; completedItems += checkedInGuests; }
            progressItems += 1; // declaration
            if (isDeclarationDone) completedItems += 1;
            progressItems += 1; // deposit
            if (isDepositPaid) completedItems += 1;
            if (totalGuests > 0) { progressItems += totalGuests; completedItems += verifiedGuests; }

            const progress = progressItems > 0 ? Math.round((completedItems / progressItems) * 100) : 0;

            let statusLabel = 'Not Started';
            if (progress === 100) statusLabel = 'Complete';
            else if (progress >= 50) statusLabel = 'Almost Complete';
            else if (progress > 0) statusLabel = 'In Progress';

            // Build per-guest status array for frontend
            const guests = (guestRows || []).map(g => ({
                id: g.id,
                firstname: g.first_name || "",
                lastname: g.last_name || "",
                email: g.email || "",
                phone: g.mobile || "",
                lead_guest: g.is_lead,
                checked_in: !!(g.first_name && g.first_name.trim()),
                id_proof_type: g.id_proof_type || "",
                id_proof_number: g.id_proof_number || "",
                id_file: g.id_file || "",
                document_status: g.document_status || "pending",
                document_rejection_reason: g.document_rejection_reason || "",
            }));

            // Try to load any previously saved manager feedback (non-fatal if table missing)
            let feedback = null;
            try {
                const [fbRows] = await pool.query(
                    `SELECT overall_rating, cleanliness, comfort, location, services, comment, google_rating
                     FROM manager_booking_feedbacks WHERE booking_id = ? LIMIT 1`,
                    [bookingId]
                );
                if (fbRows && fbRows.length > 0) {
                    const fb = fbRows[0];
                    feedback = {
                        overallRating: fb.overall_rating,
                        googleRating: fb.google_rating,
                        comment: fb.comment || "",
                        categories: {
                            Cleanliness: fb.cleanliness,
                            Comfort: fb.comfort,
                            Location: fb.location,
                            Services: fb.services,
                        },
                    };
                }
            } catch (_) { /* table may not exist yet */ }

            // Try to load guest feedback submitted via the feedback form (non-fatal if table missing)
            let guestFeedback = null;
            try {
                const [gfRows] = await pool.query(
                    `SELECT overall_rating, cleanliness, comfort, location, amenities, service, caretaker, property_manager, comment
                     FROM stay_feedbacks WHERE booking_id = ? LIMIT 1`,
                    [bookingId]
                );
                if (gfRows && gfRows.length > 0) {
                    const gf = gfRows[0];
                    guestFeedback = {
                        overallRating:   gf.overall_rating,
                        cleanliness:     gf.cleanliness,
                        comfort:         gf.comfort,
                        location:        gf.location,
                        amenities:       gf.amenities,
                        service:         gf.service,
                        caretaker:       gf.caretaker,
                        propertyManager: gf.property_manager,
                        comment:         gf.comment || '',
                    };
                }
            } catch (_) { /* stay_feedbacks table may not exist yet */ }

            return {
                bookingId,
                progress,
                statusLabel,
                totalGuests,
                checkedInGuests,
                verifiedGuests,
                isDeclarationDone,
                isDepositPaid,
                checkInDate: booking.check_in_date,
                checkOutDate: booking.check_out_date,
                startDate: booking.start_iso,
                endDate: booking.end_iso,
                nights: booking.nights,
                guests,
                feedback,
                guestFeedback,
            };
        } catch (error) {
            throw error;
        }
    }
}
module.exports = Booking;
