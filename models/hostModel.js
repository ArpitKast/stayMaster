var pool = require('../config/dbConnection');

class HostModel{
    async hostByPhone(phone){
        try{
            const results = pool.query('select * from host_enquiries where phone = ?',[phone]);
            return result[0][0];
        }catch(error){
            console.log(error);
            throw error;
        }
    }

    async findByPhone(phone){
        try {
            const result = await pool.query('SELECT * FROM host_enquiries WHERE phone = ?', [phone]);
            if (result[0].length) {
                return result[0];
            }
            return false;
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async findByEmail(email){
        try {
            const result = await pool.query('SELECT * FROM host_enquiries WHERE email = ?', [email]);
            if (result[0].length) {
                return result[0];
            }
            return false;
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async hostExists(phone,otp){
        const result = await pool.query('SELECT * FROM host_enquiries WHERE phone = ? and otp = ?', [phone,otp]);
        console.log(`SELECT * FROM host_enquiries WHERE phone = ${phone} and otp = ${otp}`);
        console.log(result[0]);
        if (result[0].length){
            return result[0];
        }
        return false;
    }

    async hostExistsByEmail(email, otp){
        const result = await pool.query('SELECT * FROM host_enquiries WHERE email = ? and otp = ?', [email, otp]);
        console.log(`SELECT * FROM host_enquiries WHERE email = ${email} and otp = ${otp}`);
        console.log(result[0]);
        if (result[0].length){
            return result[0];
        }
        return false;
    }

    async createWithPhone(phone){
        const result = await pool.query('SELECT a.id,ac.name as category,a.name as amenity,a.display_order FROM amenities a, amenity_categories ac where a.category_id = ac.id and ac.active =1 and a.active=1 order by ac.display_order,a.display_order');
        const amenities = result[0];
        const amenitiesByCategory = {};
        amenities.forEach(amenity => {
            const category = amenity.category;
            if(!amenitiesByCategory.hasOwnProperty(category)){
                amenitiesByCategory[category] = [];
            }
            amenitiesByCategory[category].push({id:amenity.id, name: amenity.amenity, order: amenity.display_order});
        });
        return amenitiesByCategory;
    }

    async saveOTP(phone, otp, expires_at, email = null){
        try{
            let user;
            if (phone) {
                const results = await pool.query('select * from host_enquiries where phone = ?', [phone]);
                user = results[0][0];
            } else if (email) {
                const results = await pool.query('select * from host_enquiries where email = ?', [email]);
                user = results[0][0];
            }
            
            if(!user){
                console.log("user not found");
                if (phone) {
                    await pool.query('insert into host_enquiries (phone, otp, otp_expires_at) values(?, ?, ?)', [phone, otp, expires_at]);
                } else if (email) {
                    await pool.query('insert into host_enquiries (email, otp, otp_expires_at) values(?, ?, ?)', [email, otp, expires_at]);
                }
            } else {
                console.log("user found");
                await pool.query('update host_enquiries set otp = ?, otp_expires_at = ? where id = ?', [otp, expires_at, user.id]);
            }
            return;
        } catch(error){
            console.log(error);
            throw error;
        }
    }

    async saveHostDetails(id,location, property_type, bedrooms,pool_type,name,email){
        console.log("inside saveHostDetails");
        console.log(`${location}-${property_type}-${bedrooms}-${pool_type}-${id}`);
        try{
            await pool.query('update host_enquiries set location = ?, property_type = ?,bedrooms = ?,pool_type = ?,name=?,email=? where id = ?',[location, property_type, bedrooms,pool_type,name,email,id]);
            return;
        }catch(error){
            console.log(error);
            throw error;
        }
    }

    async hostsList(){
        
    }

    async hostsByProperty(propertyId){
        try{
            const results = await pool.query('SELECT u.id,firstname,lastname,email,phone FROM users u, property_hosts h where h.host_id = u.id and h.property_id = ?',[propertyId]);
            return results[0];
        }catch(error){
            console.log(error);
            throw error;
        }
    }
}
module.exports = HostModel;