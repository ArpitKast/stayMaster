var pool = require('../config/dbConnection');

class AmenityModel{
    async amenitiesGroupedByCategory1(){
        const result = await pool.query('SELECT ac.name as category,a.name as amenity,a.display_order FROM amenities a, amenity_categories ac where a.category_id = ac.id and ac.active =1 and a.active=1 order by ac.display_order,a.display_order');
        const amenities = result[0];
        const amenitiesByCategory = {};
        amenities.forEach(amenity => {
            const category = amenity.category;
            if(!amenitiesByCategory.hasOwnProperty(category)){
                amenitiesByCategory[category] = [];
            }
            amenitiesByCategory[category].push({name: amenity.amenity, order: amenity.display_order});
        });
        return amenitiesByCategory;
    }

    async amenitiesGroupedByCategory(){
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
}
module.exports = AmenityModel;