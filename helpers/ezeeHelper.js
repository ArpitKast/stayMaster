const axios = require('axios');
const https = require('https');
const dotenv = require("dotenv").config();
const fs = require("fs").promises;
const defaultHttpsAgent = new https.Agent({ rejectUnauthorized: false });
const HotelCode = process.env.EZEE_HOTEL_CODE;
const APIKey = process.env.EZEE_API_KEY;
const availability_request_type = 'RoomList';
const availability_endpoint = 'booking/reservation_api/listing.php';
const create_booking_request_type = 'InsertBooking';
const create_booking_endpoint = 'booking/reservation_api/listing.php';
const pms_connectivity_url = "https://live.ipms247.com/pmsinterface/pms_connectivity.php";
const GET = 'GET';
const POST = 'POST';

const ezee_base_url = 'https://live.ipms247.com/';
const ezee_pms_url = 'pmsinterface/pms_connectivity.php';
const ezee_booking_url = 'booking/reservation_api/listing.php';

const request_types = { availability: 'RoomList', 
                        create_booking: 'InsertBooking',
                        block_property: 'SetoutofOrder',
                        unblock_property: 'UnblockRoom',
                        rooms_info:'RoomInfo' 
                    };

class EzeeHelper {
    constructor(apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl;
    }
  
    async fetchData(endpoint, method, params) {
        const config = {
            method,
            url: `${this.apiBaseUrl}/${endpoint}`,
            httpsAgent: defaultHttpsAgent,
            headers: {
                'User-Agent': 'OpenAPI-StayMaster'
            }
        };
  
        if (method.toUpperCase() === 'GET') {
            config.params = params;
        } else if (method.toUpperCase() === 'POST') {
            config.url = 'https://live.ipms247.com/booking/reservation_api/listing.php?request_type=InsertBooking&HotelCode=8&APIKey=11868080699e9df9a0-800a-11eb-9';
            config.maxBodyLength = Infinity;
            const FormData = require('form-data');
            let data = new FormData();
            for(const[key,value] of Object.entries(params)){
                data.append(key,value);
            }
            config.data = data;
            config.headers = {
                ...data.getHeaders(),
                'User-Agent': 'OpenAPI-StayMaster'
            };
            for(const[key,value] of Object.entries(config)){
            }
        }
        try {
            const response = await axios(config);

            const data = response.data;

            return response.data;
        } catch (error) {
            console.error('Ezee API Error:');
            throw error;
        }
    }

    async commonFetchData(url, method, params) {
        const config = {
            method,
            url: url,
            httpsAgent: defaultHttpsAgent,
            headers: {
                'User-Agent': 'OpenAPI-StayMaster'
            }
        };
        if (method.toUpperCase() === 'GET') {
            config.params = params;
        } else if (method.toUpperCase() === 'POST') {
        }
        try {
            const response = await axios(config);
            return response;
        } catch (error) {
            throw error;
        }
    }

    async listings(params) {
        try {
            var endpoint = `${ezee_base_url}${ezee_booking_url}`;
            var method = 'GET';
            params = await this.appendHotelParams(params);
            params['request_type'] = request_types.availability;
            return await this.commonFetchData(endpoint,method,params);
        } catch (error) {
            return {status:500,error:error};
        }
    }

    async getPropertyTypes(){
        var params = {};
        params = await this.appendHotelParams(params);
        params['request_type'] = 'RoomTypeList';
        try {
            const results = await this.fetchData(availability_endpoint,GET,params);
            return results;
        } catch (error) {
            return Response.error("ERROR", error.message, 500);
        }
    }

    async getProperties(params){
        params['request_type'] = availability_request_type;
        params = await this.appendHotelParams(params);
        try {
            const results = await this.fetchData(availability_endpoint,GET,params);
            return results;
        } catch (error) {
            return Response.error("ERROR", error.message, 500);
        }
    }

    async getProperty(params){
        const results = await this.getProperties(params);
        if(!results || results.length == 0){
            return {status:false,property:null};
        }
        var property = results[0];
        if(!property || property.hasOwnProperty("Error Details")){
            return {status:false,property:null};
        }
        return {status:true,property:property};
    }

    async isPropertyAvailable(params){
        const results = await this.getProperties(params);
        if(!results || results.length == 0){
            return {status:false,property:null};
        }
        var property = results[0];
        if(!property || property.min_ava_rooms == 0){
            return {status:false,property:null};
        }
        return {status:true,property:property};
    }

    async fetchPostData(params,request_type){
        try {
            const FormData = require('form-data');
const fs = require('fs');
            let form_data = new FormData();
            for(const[key,value] of Object.entries(params)){
                form_data.append(key,value);
            }
            const config = {
                method:POST,
                maxBodyLength: Infinity,
                url: `${this.apiBaseUrl}/${availability_endpoint}?request_type=${request_type}&HotelCode=${HotelCode}&APIKey=${APIKey}`,
                data : form_data,
                httpsAgent: defaultHttpsAgent
            };
            config.headers = {
                ...form_data.getHeaders(),
                'User-Agent': 'OpenAPI-StayMaster'
            };
            const response = await axios(config);

            const {status,data} = response;
            return {status,data};
        } catch (error) {
            throw error;
        }
    }

    async fetchData1(url,data){
        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: url,
            headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'OpenAPI-StayMaster'
            },
            data : data,
            timeout: 30000, // 30 second timeout
            httpsAgent: defaultHttpsAgent
        };
        try {
            const response = await axios(config);
            const {status,data} = response;
            return {status,data};
        } catch (error) {
            console.error('Ezee API Error:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message
            });
            
            // Return a structured error response
            return {
                status: error.response?.status || 500,
                data: {
                    Errors: {
                        ErrorCode: error.response?.status || 500,
                        ErrorMessage: error.response?.data || error.message || 'Ezee API request failed'
                    }
                }
            };
        }
    }

    async roomsInfo(params={}){
        try {
            params = await this.appendHotelParams(params);
            params.request_type = request_types.rooms_info;
            const data = JSON.stringify({
                "RES_Request": {
                  "Request_Type": params.request_type,
                  "NeedPhysicalRooms":1,
                  "Authentication": {
                    "HotelCode": params.HotelCode,
                    "AuthCode": params.APIKey
                  }
                }
            });
            const url = ezee_base_url + ezee_pms_url;
            return await this.fetchData1(url,data);
        } catch (error) {
            console.error(error);
        }

    }

    async blockUnblockProperty(params,units){
        const rooms = [];
        for(const unit of units){
            const room = {
                "RoomID": unit.RoomID,
                "RoomtypeID":unit.RoomtypeID,
                "FromDate": unit.FromDate,
                "ToDate": unit.ToDate,
                "Reason": unit.Reason
            };
            rooms.push(room);
        }
        let data = JSON.stringify({
            "RES_Request": {
                "Request_Type": params.request_type,
                "Authentication": {
                    "HotelCode": params.HotelCode,
                    "AuthCode": params.APIKey
                },
                "Rooms": rooms
            }
        });
        return data;
    }

    async blockProperty(rooms){
        try {
            // Validate room data before making API call
            if (!rooms || rooms.length === 0) {
                throw new Error('No rooms provided for blocking');
            }
            
            // Check for invalid room IDs
            const invalidRooms = rooms.filter(room => 
                !room.RoomID || 
                !room.RoomtypeID || 
                room.RoomID === 'default_room' || 
                room.RoomtypeID === 'default_room_type' ||
                room.RoomID.trim() === '' ||
                room.RoomtypeID.trim() === ''
            );
            
            if (invalidRooms.length > 0) {
                console.error('Invalid room data detected:', invalidRooms);
                throw new Error('Invalid room IDs detected. Please ensure all rooms have valid Ezee room IDs.');
            }
            
            const params = await this.appendHotelParams({});
            params.request_type = request_types.block_property;
            console.log("params _-_----_-_-",params);
            const data = await this.blockUnblockProperty(params,rooms);
            const url = ezee_base_url + ezee_pms_url;
            return await this.fetchData1(url,data);
        } catch (error) {
            console.error('Error in blockProperty:', error);
            // Return a consistent error response structure
            return {
                status: 500,
                data: {
                    Errors: {
                        ErrorCode: 500,
                        ErrorMessage: error.message || 'Failed to block property by ezee'
                    }
                }
            };
        }
    }

    async unblockProperty(rooms){
        try {
            // Validate room data before making API call
            if (!rooms || rooms.length === 0) {
                throw new Error('No rooms provided for unblocking');
            }
            
            // Check for invalid room IDs
            const invalidRooms = rooms.filter(room => 
                !room.RoomID || 
                !room.RoomtypeID || 
                room.RoomID === 'default_room' || 
                room.RoomtypeID === 'default_room_type' ||
                room.RoomID.trim() === '' ||
                room.RoomtypeID.trim() === ''
            );
            
            if (invalidRooms.length > 0) {
                console.error('Invalid room data detected for unblocking:', invalidRooms);
                throw new Error('Invalid room IDs detected. Please ensure all rooms have valid Ezee room IDs.');
            }
            
            const params = await this.appendHotelParams({});
            params.request_type = request_types.unblock_property;
            const data = await this.blockUnblockProperty(params,rooms);
            const url = ezee_base_url + ezee_pms_url;
            return await this.fetchData1(url,data);
        } catch (error) {
            console.error('Error in unblockProperty:', error);
            // Return a consistent error response structure
            return {
                status: 500,
                data: {
                    Errors: {
                        ErrorCode: 500,
                        ErrorMessage: error.message || 'Failed to unblock property by ezee'
                    }
                }
            };
        }
    }

    async createBooking(params){
        return await this.fetchPostData(params,"InsertBooking");
    }

    async processPostBooking(params){
        return await this.fetchPostData(params,"ProcessBooking");
    }

    async historicalBookings(start, end){
        let data = `<RES_Request>\n<Request_Type>Booking</Request_Type>\n<Authentication>\n<HotelCode>40583</HotelCode>\n<AuthCode>3758850035b63f53bd-79f2-11ee-b</AuthCode>\n</Authentication>\n<FromDate>${start}</FromDate>\n<ToDate>${end}</ToDate>\n</RES_Request>`;
        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://live.ipms247.com/pmsinterface/getdataAPI.php',
            headers: { 
                'Content-Type': 'application/xml',
                'User-Agent': 'OpenAPI-StayMaster'
            },
            data : data,
            httpsAgent: defaultHttpsAgent
        };

        try {
            const response = await axios(config);
            return response.data;
        } catch (error) {
            throw error;
        }
    }

    async retrieveSingleBooking(booking){
        let data = JSON.stringify({
            "RES_Request": {
              "Request_Type": "FetchSingleBooking",
              "BookingId": booking,
              "Authentication": {
                "HotelCode": "40583",
                "AuthCode": "3758850035b63f53bd-79f2-11ee-b"
              }
            }
          });

        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://live.ipms247.com/pmsinterface/pms_connectivity.php',
            headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'OpenAPI-StayMaster'
            },
            data : data,
            httpsAgent: defaultHttpsAgent
        };

        try {
            const response = await axios(config);
            return response.data;
        } catch (error) {
            throw error;
        }
    }

    async appendHotelParams(params){
        params['HotelCode'] = HotelCode;
        params['APIKey'] = APIKey;
        return params;
    }
}
  
module.exports = EzeeHelper;