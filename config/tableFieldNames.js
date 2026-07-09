
const tableFields = [];
tableFields['propertyFields'] = ['channel_id','listing_name','internal_name','destination','host','featured_property','for_events','for_corporate_offsite',
    'meals_available','meals_text','pets_welcome','address_line_1','address_line_2','city','state','country','postcode',
    'property_type','number_of_bedrooms','number_of_bathrooms','number_of_guests','number_of_extra_guests',
    'description_summary','description_bedrooms_and_bath','description_living_and_dining','description_kitchen_space',
    'description_pool','description_unique_highlights','description_hospitality_service','google_latitude','google_longitude',
    'location_details','places_around','check_in','check_out','house_rules','security_deposit_percentage',
    'reservation_executive','revenue_manager','hospitality_manager','general_manager'];

tableFields['user_fields'] = ['firstname','lastname','profile_pic_link','username','email','password','phone','phone1','phone2',
    'role','date_of_birth','address_line_1','address_line_2','city','state','country','postcode'];

tableFields['booking_fields'] = ['property_id','breakfast_included','booking_date','booking_status','check_in_date','check_out_date',
    'number_adults','number_children','number_pets','stay_type','listed_tariff','gst'];



tableFields['guest_details_fields'] = [
    'booking_id', 'first_name', 'last_name', 'email', 'mobile',
    'gender', 'dob', 'age', 'guest_type', 'id_proof_type', 'id_proof_number',
    'is_lead', 'declaration', 'gst_bill', 'gst_number', 'business_name', 'stayed_before',
    'purpose_of_visit', 'group_type'
];

module.exports = tableFields;
