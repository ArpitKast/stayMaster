const baseModel = require('./baseModel');
const pool = require('../config/dbConnection');

class LeadModel extends baseModel {
    constructor() {
        super('leads');
    }

    async createLead(values) {
        const payload = {
            name: values.name,
            country_code: values.country_code || '+91',
            phone: values.phone,
            email: values.email,
            message: values.message || '',
            // Only include optional fields if they have values
            ...(values.check_in && { check_in: values.check_in }),
            ...(values.check_out && { check_out: values.check_out }),
            ...(values.guests && values.guests.trim() !== '' && { guests: values.guests }),
            ...(values.rooms && values.rooms.trim() !== '' && { rooms: values.rooms }),
            ...(values.preferred_property && values.preferred_property.trim() !== '' && { preferred_property: values.preferred_property }),
            ...(values.lead_source && { lead_source: values.lead_source })
        };
        return this.create(payload);
    }

    async getPaginated(page = 1, pageSize = 20, source = '') {
        const safePage = Number.isInteger(page) && page > 0 ? page : 1;
        const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 20;
        const offset = (safePage - 1) * safePageSize;
        let rows = [];
        let total = 0;
        if (source) {
            if (source === 'form') {
                const [filteredRows] = await pool.query(
                    'select * from leads where LOWER(lead_source) = LOWER(?) order by created_at desc limit ? offset ?',
                    [source, safePageSize, offset]
                );
                rows = filteredRows;
                const [countRows] = await pool.query(
                    'select count(*) as total from leads where LOWER(lead_source) = LOWER(?)',
                    [source]
                );
                total = countRows[0] ? countRows[0].total : 0;
            } else {
                const [filteredRows] = await pool.query(
                    'select * from leads where lead_source = ? order by created_at desc limit ? offset ?',
                    [source, safePageSize, offset]
                );
                rows = filteredRows;
                const [countRows] = await pool.query(
                    'select count(*) as total from leads where lead_source = ?',
                    [source]
                );
                total = countRows[0] ? countRows[0].total : 0;
            }
        } else {
            const [allRows] = await pool.query(
                'select * from leads order by created_at desc limit ? offset ?',
                [safePageSize, offset]
            );
            rows = allRows;
            const [countRows] = await pool.query('select count(*) as total from leads');
            total = countRows[0] ? countRows[0].total : 0;
        }
        return { rows, total };
    }

    async getAllBySource(source = '') {
        if (source === 'form') {
            const [rows] = await pool.query(
                `SELECT * FROM leads WHERE LOWER(TRIM(lead_source)) = 'form' ORDER BY created_at DESC`
            );
            return rows;
        } else if (source) {
            const [rows] = await pool.query(
                `SELECT * FROM leads WHERE LOWER(TRIM(lead_source)) = LOWER(TRIM(?)) ORDER BY created_at DESC`,
                [source]
            );
            return rows;
        } else {
            const [rows] = await pool.query(`SELECT * FROM leads ORDER BY created_at DESC`);
            return rows;
        }
    }
}

module.exports = LeadModel;
