/**
 * URL Helper for secure IDs (Backend version)
 */

const SALT = "precheckin_secure_salt_2024";

/**
 * Decodes a salted Base64 string into tripId and guestId
 * @param {string} secureId 
 * @returns {object|null} { tripId, guestId } or null if invalid
 */
const decodeSecureGuestId = (secureId) => {
    try {
        if (!secureId) return null;
        
        const decoded = Buffer.from(secureId, 'base64').toString('utf8');
        const [tripId, guestId, salt] = decoded.split(":");
        
        if (salt !== SALT) {
            console.error("Invalid salt in secure ID");
            return null;
        }
        
        return {
            tripId,
            guestId
        };
    } catch (error) {
        console.error("Failed to decode secure ID", error);
        return null;
    }
};

/**
 * Encodes tripId and guestId into a salted Base64 string
 */
const encodeSecureGuestId = (tripId, guestId) => {
    const payload = `${tripId}:${guestId}:${SALT}`;
    return Buffer.from(payload).toString('base64');
};

module.exports = {
    decodeSecureGuestId,
    encodeSecureGuestId
};
