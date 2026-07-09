const axios = require('axios');
const dotenv = require("dotenv").config();
const HotelCode = process.env.EZEE_HOTEL_CODE;
const APIKey = process.env.EZEE_API_KEY;
const availability_request_type = 'RoomList';
const availability_endpoint = 'reservation_api/listing.php';
const create_booking_request_type = 'InsertBooking';
const create_booking_endpoint = 'reservation_api/listing.php';
const pms_connectivity_url = "https://live.ipms247.com/pmsinterface/pms_connectivity.php";
const GET = 'GET';
const POST = 'POST';

const ezee_base_url = 'https://live.ipms247.com/';
const ezee_pms_url = 'pmsinterface/pms_connectivity.php';
const ezee_booking_url = 'booking/reservation_api/listing.php';

const request_types = { 
    availability: 'RoomList', 
    create_booking: 'InsertBooking',
    block_property: 'SetoutofOrder',
    unblock_property: 'UnblockRoom',
    rooms_info: 'RoomInfo' 
};

class EzeeHelperImproved {
    constructor(apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl;
    }

    async fetchData1(url, data, retryCount = 0) {
        const maxRetries = 3;
        const retryDelay = 1000; // 1 second

        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: url,
            headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'OpenAPI-StayMaster'
            },
            data: data,
            timeout: 30000, // 30 second timeout
            validateStatus: function (status) {
                return status < 500; // Don't throw for 4xx errors, only 5xx
            }
        };

        try {
            console.log(`Making Ezee API call (attempt ${retryCount + 1}/${maxRetries + 1})`);
            console.log('Request URL:', url);
            console.log('Request data:', data);

            const response = await axios(config);
            const {status, data: responseData} = response;
            
            console.log('Ezee API response status:', status);
            console.log('Ezee API response data:', JSON.stringify(responseData, null, 2));

            // Check if response is HTML (error page)
            if (typeof responseData === 'string' && responseData.includes('<!DOCTYPE html')) {
                throw new Error('Received HTML error page instead of JSON response');
            }

            return {status, data: responseData};
        } catch (error) {
            console.error(`Error in fetchData1 (attempt ${retryCount + 1}):`, error.message);
            
            // If it's a 500 error and we haven't exceeded max retries, try again
            if (error.response && error.response.status === 500 && retryCount < maxRetries) {
                console.log(`Retrying in ${retryDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return this.fetchData1(url, data, retryCount + 1);
            }
            
            // If it's a 500 error, return a structured error response
            if (error.response && error.response.status === 500) {
                return {
                    status: 500,
                    data: {
                        Errors: {
                            ErrorCode: 500,
                            ErrorMessage: 'Ezee API server error. Please try again later or contact support.'
                        }
                    }
                };
            }
            
            throw error;
        }
    }

    async blockUnblockProperty(params, units) {
        const rooms = [];
        for (const unit of units) {
            const room = {
                "RoomID": unit.RoomID,
                "RoomtypeID": unit.RoomtypeID,
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

    async blockProperty(rooms) {
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
            console.log("params _-_----_-_-", params);
            const data = await this.blockUnblockProperty(params, rooms);
            const url = ezee_base_url + ezee_pms_url;
            return await this.fetchData1(url, data);
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

    async unblockProperty(rooms) {
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
            const data = await this.blockUnblockProperty(params, rooms);
            const url = ezee_base_url + ezee_pms_url;
            return await this.fetchData1(url, data);
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

    async retrieveRoomInformation(hotelCode, authCode) {
        try {
            const data = {
                "RES_Request": {
                    "Request_Type": "RoomInfo",
                    "NeedPhysicalRooms": 1,
                    "Authentication": {
                        "HotelCode": hotelCode,
                        "AuthCode": authCode
                    }
                }
            };

            const url = ezee_base_url + ezee_pms_url;
            console.log('Fetching room information from:', url);
            console.log('Request data:', JSON.stringify(data, null, 2));

            const response = await axios.post(url, data, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'OpenAPI-StayMaster'
                },
                timeout: 30000 // 30 second timeout
            });

            console.log('Room information response status:', response.status);
            console.log('Room information response data:', JSON.stringify(response.data, null, 2));

            return {
                status: response.status,
                data: response.data
            };
        } catch (error) {
            console.error('Error retrieving room information:', error);
            return {
                status: 500,
                data: {
                    Errors: {
                        ErrorCode: 500,
                        ErrorMessage: error.message || 'Failed to retrieve room information from Ezee'
                    }
                }
            };
        }
    }

    async appendHotelParams(params) {
        params['HotelCode'] = HotelCode;
        params['APIKey'] = APIKey;
        return params;
    }
}

module.exports = EzeeHelperImproved;

