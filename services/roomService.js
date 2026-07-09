const axios = require('axios');
const dotenv = require("dotenv").config();
const EzeeHelperImproved = require('../helpers/ezeeHelperImproved');

const HotelCode = process.env.EZEE_HOTEL_CODE;
const APIKey = process.env.EZEE_API_KEY;
const ezee_base_url = 'https://live.ipms247.com/';
const ezee_pms_url = 'pmsinterface/pms_connectivity.php';

class RoomService {
    constructor() {
        this.hotelCode = HotelCode;
        this.authCode = APIKey;
        this.ezeeHelper = new EzeeHelperImproved();
    }

    async retrieveRoomInformation(hotelCode = null, authCode = null) {
        try {
            const hotelCodeToUse = hotelCode || this.hotelCode;
            const authCodeToUse = authCode || this.authCode;

            return await this.ezeeHelper.retrieveRoomInformation(hotelCodeToUse, authCodeToUse);
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

    async updatePropertyInventory(propertyId, roomData) {
        try {
            const Property = require('../models/propertyModel');
            const property = new Property();

            // Get property details to get the channel_id
            const propertyDetails = await property.find('properties', { id: propertyId });
            if (!propertyDetails || !propertyDetails.channel_id) {
                throw new Error(`Property ${propertyId} not found or missing channel_id`);
            }

            // Clear existing inventory for this property
            await property.delete('property_inventory', { property_id: propertyId });

            // Use the channel_id from properties table as both room_type_id and room_id
            // This is the correct mapping based on your database structure
            const inventoryData = [{
                property_id: propertyId,
                room_type_id: propertyDetails.channel_id,
                room_id: propertyDetails.channel_id
            }];

            // Insert the mapped room data
            for (const item of inventoryData) {
                await property.insert('property_inventory', item);
            }
            
            console.log(`Updated property ${propertyId} inventory with channel_id: ${propertyDetails.channel_id}`);
            console.log('Inventory data:', inventoryData);

            return {
                success: true,
                message: `Updated property inventory with channel_id: ${propertyDetails.channel_id}`,
                roomCount: inventoryData.length,
                channelId: propertyDetails.channel_id
            };
        } catch (error) {
            console.error('Error updating property inventory:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async validateAndFixPropertyInventory(propertyId) {
        try {
            const Property = require('../models/propertyModel');
            const property = new Property();

            // Get property details first
            const propertyDetails = await property.find('properties', { id: propertyId });
            if (!propertyDetails || !propertyDetails.channel_id) {
                return {
                    success: false,
                    error: `Property ${propertyId} not found or missing channel_id`
                };
            }

            // Get current inventory
            const inventories = await property.select('property_inventory', { property_id: propertyId });
            
            // Check if inventory has valid Ezee room IDs (not default values)
            const hasValidRooms = inventories.some(inventory => 
                inventory.room_id && 
                inventory.room_type_id && 
                inventory.room_id !== 'default_room' && 
                inventory.room_type_id !== 'default_room_type' &&
                inventory.room_id.trim() !== '' &&
                inventory.room_type_id.trim() !== '' &&
                inventory.room_id.startsWith('40583') // Ezee room IDs typically start with hotel code
            );

            if (!hasValidRooms) {
                console.log(`Property ${propertyId} has invalid room inventory, updating with channel_id from properties table...`);
                
                // Use the channel_id from properties table directly
                const updateResult = await this.updatePropertyInventory(propertyId, null);
                
                if (updateResult.success) {
                    return {
                        success: true,
                        message: `Property inventory updated with channel_id: ${propertyDetails.channel_id}`,
                        updated: true,
                        roomCount: updateResult.roomCount,
                        channelId: propertyDetails.channel_id
                    };
                } else {
                    return {
                        success: false,
                        message: 'Failed to update property inventory',
                        error: updateResult.error
                    };
                }
            }

            return {
                success: true,
                message: 'Property inventory is valid',
                updated: false,
                roomCount: inventories.length
            };
        } catch (error) {
            console.error('Error validating property inventory:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = RoomService;
