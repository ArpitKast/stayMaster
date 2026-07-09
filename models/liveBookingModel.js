const fs = require('fs');
const path = require('path');
const pool = require('../config/dbConnection');
const baseModel = require("./baseModel");
const constants = require('../config/constants');

class LiveBooking extends baseModel {
    constructor() {
        super();
        this.propertyCodeMap = new Map();
        this.propertyNameMap = new Map();
        this.propertyMapLoaded = false;
        this.missingPropertyMappings = new Set();
        this.isBatchProcessing = false;
    }
    
    /**
     * Save or update a booking based on ReservationNo (upsert)
     */
    async saveOrUpdate(bookingData) {
        try {
            // Check if booking exists
            const existing = await pool.query(
                'SELECT id FROM live_bookings WHERE ReservationNo = ?',
                [bookingData.ReservationNo]
            );

            // Map and normalize field names to match database schema
            const dataToSave = {};
            
            // Define allowed fields that exist in the database
            const allowedFields = [
                'ReservationNo', 'VoucherNo', 'BookingStatus', 'Source', 'Room', 'RoomShortCode',
                'GuestName', 'Mobile', 'Email', 'Adult', 'Child', 'NoOfGuest', 'ReservationDate',
                'ArrivalDate', 'DepartureDate', 'NoOfNights', 'TotalExclusivTax', 'TotalTax',
                'OtherRevenueExclusiveTax', 'OtherRevenueInclusiveTax', 'TACommision', 'DueAmount',
                'Deposit', 'Status', 'TransactionStatus', 'TotalInclusiveTax', 'FolioNo', 'Country',
                'Phone', 'Address', 'Salutation', 'FirstName', 'LastName', 'ReservationGuarantee',
                'CancelDate', 'BaseRateExclusiveTax', 'BaseRateInclusiveTax', 'ExtraCharges',
                'Createdatetime', 'SyncDate'
            ];

            // Field name mapping (API field name => Database field name)
            const fieldMapping = {
                'Total Tax': 'TotalTax',  // Remove space
                'salutation': 'Salutation',  // Fix case
                'totalTax': 'TotalTax',  // Alternative case
                'TotalTax': 'TotalTax',  // Keep as is
                'TACommision': 'TACommision',  // Keep as is (note: typo in original schema)
                'TACommission': 'TACommision'  // Alternative spelling
            };

            // Fields to skip (not in database schema)
            const skipFields = ['RoomInfo', 'PaymentType', 'RatePlan', 'ArrivalTime', 'DepartureTime', 'RoomNo', 'BedType'];

            // Process each field
            for (const [key, value] of Object.entries(bookingData)) {
                // Skip null/undefined values
                if (value === null || value === undefined) {
                    continue;
                }

                // Skip fields that don't exist in database
                if (skipFields.includes(key)) {
                    continue;
                }

                // Map field name
                let dbFieldName = fieldMapping[key];
                
                // If not in mapping, try to normalize the field name
                if (!dbFieldName) {
                    // Remove spaces from field names
                    dbFieldName = key.replace(/\s+/g, '');
                    
                    // Fix case for known fields
                    if (dbFieldName.toLowerCase() === 'salutation') {
                        dbFieldName = 'Salutation';
                    } else if (dbFieldName.toLowerCase() === 'totaltax') {
                        dbFieldName = 'TotalTax';
                    }
                }

                // Only include fields that exist in database
                if (!allowedFields.includes(dbFieldName)) {
                    continue;
                }

                // Handle JSON/object fields
                if (['BaseRateExclusiveTax', 'BaseRateInclusiveTax', 'ExtraCharges'].includes(dbFieldName)) {
                    if (typeof value === 'object' && value !== null) {
                        // Convert object/array to JSON string
                        if (Array.isArray(value) && value.length === 0) {
                            dataToSave[dbFieldName] = null;  // Empty array = null
                        } else {
                            try {
                                dataToSave[dbFieldName] = JSON.stringify(value);
                            } catch (e) {
                                dataToSave[dbFieldName] = null;
                            }
                        }
                    } else if (typeof value === 'string') {
                        // Already a string, use as is (but validate it's valid JSON)
                        if (value === '[]' || value === '{}') {
                            dataToSave[dbFieldName] = null;
                        } else {
                            dataToSave[dbFieldName] = value;
                        }
                    } else {
                        dataToSave[dbFieldName] = null;
                    }
                } else {
                    // Regular field - convert to appropriate type
                    if (typeof value === 'object' && value !== null) {
                        // Skip object fields that aren't JSON fields
                        continue;
                    }
                    dataToSave[dbFieldName] = value;
                }
            }

            // Ensure required field exists
            if (!dataToSave.ReservationNo) {
                throw new Error('ReservationNo is required');
            }

            // Log what we're saving (for debugging)
            if (Object.keys(dataToSave).length === 0) {
                console.warn(`Warning: No valid fields to save for booking ${bookingData.ReservationNo}`);
                return { id: null, action: 'skipped' };
            }

            if (existing[0].length > 0) {
                // Update existing booking
                const result = await pool.query(
                    'UPDATE live_bookings SET ? WHERE ReservationNo = ?',
                    [dataToSave, bookingData.ReservationNo]
                );
                return { id: existing[0][0].id, action: 'updated' };
            } else {
                // Insert new booking
                const result = await pool.query(
                    'INSERT INTO live_bookings SET ?',
                    [dataToSave]
                );
                return { id: result[0].insertId, action: 'inserted' };
            }
        } catch (error) {
            console.error('Error saving/updating live booking:', error);
            throw error;
        }
    }

    /**
     * Get bookings with filters and pagination
     */
    async getBookings(filters = {}, page = 1, limit = 50) {
        try {
            let query = 'SELECT * FROM live_bookings WHERE 1=1';
            const queryParams = [];

            // Apply filters
            if (filters.ReservationNo) {
                query += ' AND ReservationNo LIKE ?';
                queryParams.push(`%${filters.ReservationNo}%`);
            }
            if (filters.BookingStatus) {
                query += ' AND BookingStatus = ?';
                queryParams.push(filters.BookingStatus);
            }
            if (filters.GuestName) {
                query += ' AND (GuestName LIKE ? OR FirstName LIKE ? OR LastName LIKE ?)';
                const namePattern = `%${filters.GuestName}%`;
                queryParams.push(namePattern, namePattern, namePattern);
            }
            if (filters.Email) {
                query += ' AND Email LIKE ?';
                queryParams.push(`%${filters.Email}%`);
            }
            if (filters.Mobile) {
                query += ' AND Mobile LIKE ?';
                queryParams.push(`%${filters.Mobile}%`);
            }
            if (filters.ArrivalDateFrom) {
                query += ' AND ArrivalDate >= ?';
                queryParams.push(filters.ArrivalDateFrom);
            }
            if (filters.ArrivalDateTo) {
                query += ' AND ArrivalDate <= ?';
                queryParams.push(filters.ArrivalDateTo);
            }
            if (filters.DepartureDateFrom) {
                query += ' AND DepartureDate >= ?';
                queryParams.push(filters.DepartureDateFrom);
            }
            if (filters.DepartureDateTo) {
                query += ' AND DepartureDate <= ?';
                queryParams.push(filters.DepartureDateTo);
            }
            if (filters.Source) {
                query += ' AND Source LIKE ?';
                queryParams.push(`%${filters.Source}%`);
            }
            if (filters.Room) {
                query += ' AND Room LIKE ?';
                queryParams.push(`%${filters.Room}%`);
            }

            // Get total count (before pagination)
            const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
            const countResult = await pool.query(countQuery, queryParams);
            const total = countResult[0][0].total || 0;

            // Add ordering and pagination
            query += ' ORDER BY ArrivalDate DESC, ReservationNo DESC';
            const offset = (page - 1) * limit;
            query += ' LIMIT ? OFFSET ?';
            queryParams.push(limit, offset);

            const results = await pool.query(query, queryParams);
            
            // Parse JSON fields
            const bookings = results[0].map(booking => {
                if (booking.BaseRateExclusiveTax) {
                    try {
                        booking.BaseRateExclusiveTax = JSON.parse(booking.BaseRateExclusiveTax);
                    } catch (e) {
                        // Keep as string if not valid JSON
                    }
                }
                if (booking.BaseRateInclusiveTax) {
                    try {
                        booking.BaseRateInclusiveTax = JSON.parse(booking.BaseRateInclusiveTax);
                    } catch (e) {
                        // Keep as string if not valid JSON
                    }
                }
                if (booking.ExtraCharges) {
                    try {
                        booking.ExtraCharges = JSON.parse(booking.ExtraCharges);
                    } catch (e) {
                        // Keep as string if not valid JSON
                    }
                }
                return booking;
            });

            return {
                bookings,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                count: bookings.length  // Add count for pagination display
            };
        } catch (error) {
            console.error('Error getting live bookings:', error);
            throw error;
        }
    }

    /**
     * Get distinct booking statuses for filter dropdown
     */
    async getDistinctStatuses() {
        try {
            const result = await pool.query(
                'SELECT DISTINCT BookingStatus FROM live_bookings WHERE BookingStatus IS NOT NULL ORDER BY BookingStatus'
            );
            return result[0].map(row => row.BookingStatus);
        } catch (error) {
            console.error('Error getting distinct statuses:', error);
            return [];
        }
    }

    /**
     * Get distinct sources for filter dropdown
     */
    async getDistinctSources() {
        try {
            const result = await pool.query(
                'SELECT DISTINCT Source FROM live_bookings WHERE Source IS NOT NULL ORDER BY Source'
            );
            return result[0].map(row => row.Source);
        } catch (error) {
            console.error('Error getting distinct sources:', error);
            return [];
        }
    }

    /**
     * Get statistics
     */
    async getStatistics() {
        try {
            const totalResult = await pool.query('SELECT COUNT(*) as total FROM live_bookings');
            const total = totalResult[0][0].total || 0;

            const statusResult = await pool.query(
                'SELECT BookingStatus, COUNT(*) as count FROM live_bookings GROUP BY BookingStatus'
            );
            
            // Get date range - always start from 2025-10-01 (sync start date)
            const dateRangeResult = await pool.query(
                'SELECT MAX(ArrivalDate) as latest FROM live_bookings WHERE ArrivalDate IS NOT NULL'
            );

            return {
                total,
                statusBreakdown: statusResult[0] || [],
                dateRange: {
                    earliest: '2025-10-01',  // Always show sync start date
                    latest: dateRangeResult[0][0]?.latest || 'N/A'
                }
            };
        } catch (error) {
            console.error('Error getting statistics:', error);
            return { total: 0, statusBreakdown: [], dateRange: { earliest: '2025-10-01', latest: 'N/A' } };
        }
    }

    async bulkSaveOrUpdate(bookings, syncDate) {
        let saved = 0;
        let updated = 0;
        let skipped = 0;
        let errors = 0;
        let mainTableSaved = 0;
        let mainTableUpdated = 0;
        let mainTableErrors = 0;

        this.isBatchProcessing = true;
        this.missingPropertyMappings.clear();

        for (const booking of bookings) {
            try {
                const bookingData = {
                    ...booking,
                    SyncDate: syncDate
                };
                const result = await this.saveOrUpdate(bookingData);
                if (result.action === 'inserted') {
                    saved++;
                } else if (result.action === 'updated') {
                    updated++;
                } else if (result.action === 'skipped') {
                    skipped++;
                } else if (result.action === 'error') {
                    errors++;
                }

                // Also transfer to main bookings table
                if (result.id) {
                    try {
                        const transferResult = await this.transferToMainBookingTable(booking, result.id);
                        if (transferResult.action === 'inserted') {
                            mainTableSaved++;
                        } else if (transferResult.action === 'updated') {
                            mainTableUpdated++;
                        } else if (transferResult.action === 'error') {
                            mainTableErrors++;
                        }
                    } catch (transferError) {
                        console.error(`Transfer error for booking ${booking.ReservationNo}:`, transferError.message);
                        mainTableErrors++;
                    }
                }
            } catch (error) {
                console.error(`Error saving booking ${booking.ReservationNo}:`, error.message);
                errors++;
            }
        }

        // Log summary of missing property mappings
        if (this.missingPropertyMappings.size > 0) {
            console.warn(`[Live Booking Sync] Used fallback property ID for ${this.missingPropertyMappings.size} unique room types. See missing_property_mappings.log for details.`);
        }

        this.isBatchProcessing = false;
        this.missingPropertyMappings.clear();

        return { saved, updated, skipped, errors, mainTableSaved, mainTableUpdated, mainTableErrors };
    }

    /**
     * Transfer booking data from live_bookings to main bookings table
     */
    async transferToMainBookingTable(liveBooking, liveBookingId) {
        try {
            // Validate required fields first
            if (!liveBooking.ReservationNo) {
                console.warn(`Skipping transfer - missing ReservationNo`);
                return { action: 'skipped' };
            }

            if (!liveBooking.ArrivalDate || !liveBooking.DepartureDate) {
                console.warn(`Skipping transfer for ${liveBooking.ReservationNo} - missing arrival/departure dates`);
                return { action: 'skipped' };
            }

            // Get or create guest_id FIRST (required field)
            let guestId = 1; // default fallback
            try {
                guestId = await this.getOrCreateGuestId(liveBooking);
            } catch (e) {
                console.warn(`Could not create guest for ${liveBooking.ReservationNo}, using default`);
                guestId = 1;
            }

            // Get property_id (required for main bookings table FK)
            let propertyId = null;
            const fallbackPropertyId = constants?.BOOKING_FALLBACKS?.DEFAULT_PROPERTY_ID;
            try {
                const pid = await this.getPropertyIdFromRoom(
                    liveBooking.Room,
                    liveBooking.RoomShortCode || liveBooking.RoomTypeCode
                );
                if (pid) propertyId = pid;
            } catch (e) {
                console.warn(`Could not find property for room ${liveBooking.Room}`);
            }

            if (propertyId === null || propertyId === undefined) {
                await this.logMissingPropertyMapping(liveBooking);

                const hasValidFallback = Number.isInteger(fallbackPropertyId) && fallbackPropertyId >= 0;
                if (hasValidFallback) {
                    propertyId = fallbackPropertyId;
                    
                    // Add to missing mappings set for summary logging
                    const roomKey = `${liveBooking.Room} (${liveBooking.RoomShortCode || 'N/A'})`;
                    this.missingPropertyMappings.add(roomKey);
                    
                    // Only log individually if NOT in a batch process
                    if (!this.isBatchProcessing) {
                        console.warn(`Using fallback property ID ${propertyId} for ${liveBooking.ReservationNo}`);
                    }
                } else {
                    console.warn(`Skipping transfer for ${liveBooking.ReservationNo} - missing property mapping and no fallback ID configured`);
                    return { action: 'skipped' };
                }
            }

            // Map live booking fields to bookings table fields
            const bookingData = {
                uniqueId: parseInt(liveBooking.ReservationNo) || 0,
                guest_id: guestId,
                property_id: propertyId,
                subBookingId: liveBooking.ReservationNo || '0',
                transaction_id: liveBooking.TransactionStatus || '0',
                voucherNo: liveBooking.VoucherNo || null,
                packageCode: liveBooking.PackageCode || null,
                packageName: liveBooking.PackageName || null,
                rateplanCode: liveBooking.RatePlanCode || null,
                rateplanName: liveBooking.RatePlanName || null,
                eZeePMSRoomid: liveBooking.eZeePMSRoomId || null,
                roomTypeCode: liveBooking.RoomShortCode || null,
                roomTypeName: liveBooking.Room || null,
                roomId: liveBooking.roomId || null,
                roomName: liveBooking.Room || null,
                start: new Date(liveBooking.ArrivalDate),
                end: new Date(liveBooking.DepartureDate),
                arrivalTime: liveBooking.ArrivalTime || '00:00:00',
                departureTime: liveBooking.DepartureTime || '00:00:00',
                source: liveBooking.Source || null,
                status: liveBooking.BookingStatus || liveBooking.Status || 'Confirmed',
                currentStatus: liveBooking.BookingStatus || liveBooking.Status || 'Confirmed',
                bookedBy: liveBooking.GuestName || liveBooking.FirstName || 'Guest',
                businessSource: liveBooking.Source || null,
                paymentMethod: liveBooking.TransactionStatus || null,
                isChannelBooking: 1,
                isConfirmed: (liveBooking.BookingStatus === 'Confirmed' || liveBooking.Status === 'Confirmed') ? 1 : 0,
                comment: liveBooking.SpecialRequest || null,
                affiliateName: liveBooking.affiliateName || null,
                affiliateCode: liveBooking.affiliateCode || null,
                lastOperation: 'Sync from Ezee',
                createDatetime: new Date(),
                modifyDatetime: new Date()
            };

            // Only include reference_id if column exists in bookings table
            if (this.bookingColumns?.has('reference_id')) {
                bookingData.reference_id = liveBooking.VoucherNo || liveBooking.ReservationNo;
            }

            // Check if booking already exists in main bookings table
            const existingResult = await pool.query(
                'SELECT id FROM bookings WHERE uniqueId = ?',
                [bookingData.uniqueId]
            );

            if (existingResult[0] && existingResult[0].length > 0) {
                // Update existing booking - remove id from update
                const updateData = { ...bookingData };
                delete updateData.id;
                
                const updateResult = await pool.query(
                    'UPDATE bookings SET ? WHERE uniqueId = ?',
                    [updateData, bookingData.uniqueId]
                );
                return { action: 'updated', id: existingResult[0][0].id };
            } else {
                // Insert new booking
                const insertResult = await pool.query(
                    'INSERT INTO bookings SET ?',
                    [bookingData]
                );
                return { action: 'inserted', id: insertResult[0].insertId };
            }
        } catch (error) {
            console.error(`Error transferring booking ${liveBooking.ReservationNo}:`, error.message, error.sql);
            // Don't throw - just return skipped so sync can continue
            return { action: 'error', originalError: error.message };
        }
    }

    /**
     * Get or create guest ID from live booking data
     */
    async getOrCreateGuestId(liveBooking) {
        try {
            // Try to find existing user by email
            if (liveBooking.Email) {
                const userResult = await pool.query(
                    'SELECT id FROM users WHERE email = ? LIMIT 1',
                    [liveBooking.Email]
                );
                if (userResult[0] && userResult[0].length > 0) {
                    return userResult[0][0].id;
                }
            }

            // Try to find by phone
            if (liveBooking.Mobile || liveBooking.Phone) {
                const phone = liveBooking.Mobile || liveBooking.Phone;
                const userResult = await pool.query(
                    'SELECT id FROM users WHERE phone = ? OR phone1 = ? OR phone2 = ? LIMIT 1',
                    [phone, phone, phone]
                );
                if (userResult[0] && userResult[0].length > 0) {
                    return userResult[0][0].id;
                }
            }

            // Create new guest user if not found
            const rawEmail = liveBooking.Email || '';
            const fallbackEmail = `guest_${Date.now()}@staymaster.local`;
            const email = (rawEmail || fallbackEmail).slice(0, 30);
            const phone = liveBooking.Mobile || liveBooking.Phone || null;
            const newGuestData = {
                firstname: (liveBooking.FirstName || liveBooking.GuestName || 'Guest').slice(0, 40),
                lastname: (liveBooking.LastName || '').slice(0, 40),
                email,
                phone: phone ? String(phone).slice(0, 15) : null,
                role: 268,
                active: 1,
                created_at: new Date(),
                updated_at: new Date()
            };

            const result = await pool.query(
                'INSERT INTO users SET ?',
                [newGuestData]
            );
            return result[0].insertId;
        } catch (error) {
            console.error('Error getting/creating guest ID:', error.message);
            // Return a default guest ID if creation fails
            return 1;
        }
    }

    /**
     * Get property ID from room name
     */
    async loadPropertyCache() {
        if (this.propertyMapLoaded) {
            return;
        }

        try {
            const [properties] = await pool.query(
                'SELECT id, channel_id, listing_name, internal_name FROM properties'
            );

            properties.forEach((property) => {
                if (property.channel_id) {
                    const codeKey = property.channel_id.toString().trim().toLowerCase();
                    if (codeKey) {
                        this.propertyCodeMap.set(codeKey, property.id);
                    }
                }

                const listingKey = this.normalizeRoomName(property.listing_name);
                if (listingKey) {
                    this.propertyNameMap.set(listingKey, property.id);
                }

                const internalKey = this.normalizeRoomName(property.internal_name);
                if (internalKey) {
                    this.propertyNameMap.set(internalKey, property.id);
                }
            });

            this.propertyMapLoaded = true;
        } catch (error) {
            console.error('Error loading property cache:', error.message);
        }
    }

    normalizeRoomName(name) {
        if (!name) return null;
        return name.split('(')[0].trim().toLowerCase();
    }

    async getPropertyIdFromRoom(roomName, roomCode) {
        try {
            await this.loadPropertyCache();
            const normalizedRoomName = this.normalizeRoomName(roomName);

            if (roomCode) {
                const codeKey = roomCode.toString().trim().toLowerCase();
                if (codeKey && this.propertyCodeMap.has(codeKey)) {
                    return this.propertyCodeMap.get(codeKey);
                }
            }

            if (!normalizedRoomName) return null;

            if (this.propertyNameMap.has(normalizedRoomName)) {
                return this.propertyNameMap.get(normalizedRoomName);
            }

            return null;
        } catch (error) {
            console.error('Error getting property ID:', error.message);
            return null;
        }
    }

    async logMissingPropertyMapping(liveBooking) {
        try {
            const logDir = path.join(__dirname, '../logs');
            const logFile = path.join(logDir, 'missing_property_mappings.log');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            const payload = {
                timestamp: new Date().toISOString(),
                reservationNo: liveBooking.ReservationNo,
                room: liveBooking.Room,
                roomShortCode: liveBooking.RoomShortCode || null,
                roomTypeCode: liveBooking.RoomTypeCode || null,
                source: liveBooking.Source || null
            };

            fs.appendFileSync(logFile, JSON.stringify(payload) + '\n');
        } catch (error) {
            console.error('Failed to log missing property mapping:', error.message);
        }
    }
}

module.exports = LiveBooking;

