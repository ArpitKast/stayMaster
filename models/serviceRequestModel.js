var pool = require('../config/dbConnection');
const baseModel = require("../models/baseModel");
const BaseModel = new baseModel;

class ServiceRequestModel extends baseModel{

    async serviceRequests(){
        try {
            var query = `select sr.id as id, sr.description,s.display as status,sr.amount,sr.reject_reason, DATE_FORMAT(sr.updated_at, '%d %m %Y') as updated_at, p.listing_name as property,concat(u.firstname,' ',u.lastname) as service_incharge, u.phone, concat(c.firstname,' ',c.lastname) as created_by from service_requests sr,properties p, users u,users c, settings s where sr.property_id = p.id and sr.created_by = c.id and sr.service_incharge = u.id and s.setting = 'service_request_status' and sr.status = s.value`;
            const srs = await pool.query(query);
            const hosts = await pool.query(`select srh.service_request_id,concat(u.firstname,' ',u.lastname) as name from service_request_hosts srh,users u where srh.host_id = u.id`);
            var results = [];
            var i=0;
            srs[0].forEach(sr=>{
                const srHosts =  hosts[0].filter(host => host.service_request_id == sr.id);
                var hostList = "";
                srHosts.forEach(h=>{
                    hostList += `${h.name}\n`;
                });
                sr['host'] = hostList;
                results[i] = sr;
                i++;
            });
            return results;
        } catch (error) {
            console.log(error);
            throw error;
        }
    }
}
module.exports = ServiceRequestModel;