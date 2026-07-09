const propertyFields = ['slug','display_order','channel_id','listing_name','internal_name','destination','featured_property','staymaster_select','for_events','for_corporate_offsite',
'meals_available','meals_text','pets_welcome','address_line_1','address_line_2','city','state','country','postcode',
'property_type','number_of_bedrooms','number_of_bathrooms','number_of_guests','number_of_extra_guests',
'description_summary','description_bedrooms_and_bath','description_living_and_dining','description_kitchen_space',
'description_pool','description_unique_highlights','description_hospitality_service','google_latitude','google_longitude',
'location_details','places_around','check_in','check_out','house_rules','security_deposit_percentage','reservation_executive',
'revenue_manager','hospitality_manager','general_manager','property_manager_user_id','property_manager_name','property_manager_phone','property_manager_email'];
const booking_fields = ['property_id','breakfast_included','booking_date','booking_status','check_in_date','check_out_date',
    'number_adults','number_children','number_pets','stay_type','listed_tariff','gst'];
const user_fields = ['firstname','lastname','profile_pic_link','username','email','password','phone','phone1','phone2','role',
    'date_of_birth','address_line_1','address_line_2','city','state','country','postcode'];

const ezee_bookByInfo_fields = ['UniqueID','BookedBy','Salutation','FirstName','LastName','Gender','Address','City','State','Country','Zipcode','Phone','Mobile','Fax','Email','BusinessSource','Source','PaymentMethod','IsChannelBooking'];
const ezee_BookingTran_fields = ['SubBookingId','TransactionId','Createdatetime','Modifydatetime','Status','IsConfirmed','CurrentStatus','VoucherNo','PackageCode','PackageName','RateplanCode','RateplanName','eZeePMSRoomid','RoomTypeCode','RoomTypeName','RoomID','RoomName','Start','End','ArrivalTime','DepartureTime','CurrencyCode','TotalRate','TotalAmountAfterTax','TotalAmountBeforeTax','TotalTax','TotalDiscount','TotalExtraCharge','TotalPayment','PayAtHotel','TACommision','Salutation','FirstName','LastName','Gender','DateOfBirth','SpouseDateOfBirth','WeddingAnniversary','Nationality','Address','City','State','Country','Zipcode','Phone','Mobile','Fax','Email','RegistrationNo','IdentiyType','IdentityNo','ExpiryDate','TransportationMode','Vehicle','PickupDate','PickupTime','Source','Comment','AffiliateName','AffiliateCode','CCLink','CCNo','CCType','CCExpiryDate','CardHoldersName'];
const ezee_RentalInfo_fields = ['RoomID','RoomName','EffectiveDate','PackageCode','PackageName','RoomTypeCode','RoomTypeName','Adult','Child','Rent','RentPreTax','RentBeforeTax','Discount'];
const ezee_TaxDetails_fields = ['TaxCode','TaxName','TaxAmount'];
const ezee_PaymentDetails_fields = ['amount','datetime','method'];
const service_request_fields = ['service_incharge','property_id','description','amount','status','reject_reason'];
const form_fields = ['form_type','name','email','phone','property_type','comment'];
module.exports = {propertyFields,booking_fields,user_fields,ezee_bookByInfo_fields,ezee_BookingTran_fields,ezee_RentalInfo_fields,ezee_TaxDetails_fields,ezee_PaymentDetails_fields,form_fields,service_request_fields};
