/**
 * Manager Controller
 * Handles Property Manager authentication and booking management APIs.
 */

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Response = require("../helpers/responseHelper");
const constants = require("../config/constants");
const UserModel = require("../models/userModel");
const BookingModel = require("../models/bookingModel");
const PropertyModel = require("../models/propertyModel");
const S3Helper = require("../helpers/s3Helper");
const pool = require("../config/dbConnection");

const User = new UserModel();
const Booking = new BookingModel();
const Property = new PropertyModel();

// Module-level guard: ensures DDL only runs once per process lifetime.
// TODO: move CREATE TABLE statements to a proper migrations file.
let _feedbackTableCreated = false;

class ManagerController {

    /**
     * POST /api/manager/login
     * Authenticates a manager with email + password.
     */
    async login(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return Response.error(res, "VALIDATION_ERROR", "Email and password are required.", 400);
            }

            const user = await User.getByEmail(email);

            if (!user) {
                return Response.error(res, "AUTH_ERROR", "Invalid email or password.", 401);
            }

            // Allow ROLE_MANAGER (271) or ROLE_STAFF (270) so admin staff can also access
            const roleNum = Number(user.role);
            const allowedRoles = [constants.ROLE_MANAGER, constants.ROLE_STAFF];
            if (!allowedRoles.includes(roleNum)) {
                return Response.error(res, "AUTH_ERROR", "Access denied. Not a property manager account.", 403);
            }

            if (!user.password) {
                return Response.error(res, "AUTH_ERROR", "Invalid email or password.", 401);
            }

            const passwordMatch = await bcrypt.compare(String(password), user.password);
            if (!passwordMatch) {
                return Response.error(res, "AUTH_ERROR", "Invalid email or password.", 401);
            }

            const accessToken = jwt.sign(
                {
                    user: {
                        id: user.id,
                        email: user.email,
                        role: user.role,
                        firstname: user.firstname,
                        lastname: user.lastname,
                    }
                },
                process.env.ACCESS_TOKEN_SECRET,
                { expiresIn: "8h" }
            );

            return Response.success(res, {
                token: accessToken,
                manager: {
                    id: user.id,
                    firstname: user.firstname,
                    lastname: user.lastname,
                    email: user.email,
                    role: user.role,
                }
            });
        } catch (err) {
            console.error("Manager login error:", err);
            return Response.error(res, "SERVER_ERROR", "Login failed. Please try again.", 500);
        }
    }

    /**
     * GET /api/manager/me
     * Returns current manager profile.
     */
    async me(req, res) {
        try {
            const rows = await User.getById(req.managerId);
            const user = Array.isArray(rows) && rows[0] ? rows[0] : null;
            if (!user) {
                return Response.error(res, "NOT_FOUND", "Manager not found.", 404);
            }
            return Response.success(res, {
                id: user.id,
                firstname: user.firstname,
                lastname: user.lastname,
                email: user.email,
                role: user.role,
                phone: user.phone,
            });
        } catch (err) {
            console.error("Manager me error:", err);
            return Response.error(res, "SERVER_ERROR", "Failed to fetch manager info.", 500);
        }
    }

    /**
     * GET /api/manager/properties
     * Returns all properties assigned to this manager.
     */
    async getProperties(req, res) {
        try {
            const properties = await Property.propertiesForManager(req.managerId);
            return Response.success(res, { properties });
        } catch (err) {
            console.error("Manager getProperties error:", err);
            return Response.error(res, "SERVER_ERROR", "Failed to fetch properties.", 500);
        }
    }

    /**
     * GET /api/manager/bookings?status=upcoming|ongoing|cancelled|completed|all
     * Returns bookings for this manager's assigned properties.
     */
    async getBookings(req, res) {
        try {
            const status = req.query.status || "all";
            const bookings = await Booking.bookingsForManager(req.managerId, status);
            return Response.success(res, { bookings });
        } catch (err) {
            console.error("Manager getBookings error:", err);
            return Response.error(res, "SERVER_ERROR", "Failed to fetch bookings.", 500);
        }
    }

    /**
     * GET /api/manager/booking/:id
     * Returns full booking details (for manager's assigned properties only).
     */
    async getBookingDetail(req, res) {
        try {
            const bookingId = req.params.id;

            // Verify this booking belongs to a property managed by this manager
            const hasAccess = await Booking.managerHasBookingAccess(req.managerId, bookingId);
            if (!hasAccess) {
                return Response.error(res, "FORBIDDEN", "Access denied to this booking.", 403);
            }

            const detail = await Booking.bookingDetailsForHost(bookingId);
            return Response.success(res, detail);
        } catch (err) {
            console.error("Manager getBookingDetail error:", err);
            return Response.error(res, "SERVER_ERROR", "Failed to fetch booking detail.", 500);
        }
    }

    /**
     * PATCH /api/manager/me
     * Updates current manager's profile (firstname, lastname, phone, email).
     */
    async updateMe(req, res) {
        try {
            const { firstname, lastname, phone, email } = req.body;
            await User.updateProfile(req.managerId, firstname, lastname, email, phone);
            const rows = await User.getById(req.managerId);
            const user = Array.isArray(rows) && rows[0] ? rows[0] : null;
            if (!user) {
                return Response.error(res, "NOT_FOUND", "Manager not found.", 404);
            }
            return Response.success(res, {
                id: user.id,
                firstname: user.firstname,
                lastname: user.lastname,
                email: user.email,
                role: user.role,
                phone: user.phone,
            });
        } catch (err) {
            console.error("Manager updateMe error:", err);
            return Response.error(res, "SERVER_ERROR", "Failed to update profile.", 500);
        }
    }

    /**
     * GET /api/manager/booking/:id/checkin
     * Returns check-in status data for a booking.
     */
    async getCheckinStatus(req, res) {
        try {
            const bookingId = req.params.id;

            const hasAccess = await Booking.managerHasBookingAccess(req.managerId, bookingId);
            if (!hasAccess) {
                return Response.error(res, "FORBIDDEN", "Access denied to this booking.", 403);
            }

            const checkin = await Booking.checkinStatusForBooking(bookingId);
            return Response.success(res, checkin);
        } catch (err) {
            console.error("Manager getCheckinStatus error:", err);
            return Response.error(res, "SERVER_ERROR", "Failed to fetch check-in status.", 500);
        }
    }

    /**
     * POST /api/manager/booking/:id/feedback
     * Save (upsert) manager-recorded guest feedback for a booking.
     */
    async saveFeedback(req, res) {
        try {
            const bookingId = req.params.id;
            const hasAccess = await Booking.managerHasBookingAccess(req.managerId, bookingId);
            if (!hasAccess) {
                return Response.error(res, "FORBIDDEN", "Access denied to this booking.", 403);
            }

            const { overallRating, cleanliness, comfort, location, services, comment, googleRating } = req.body;

            if (!overallRating && overallRating !== 0) {
                return Response.error(res, "VALIDATION_ERROR", "Overall rating is required.", 400);
            }

            // Create table if it doesn't exist, then upsert feedback.
            // Guard ensures DDL only runs once per process lifetime (should be in migrations).
            if (!_feedbackTableCreated) {
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS manager_booking_feedbacks (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        booking_id INT NOT NULL,
                        overall_rating DECIMAL(3,1) DEFAULT 0,
                        cleanliness DECIMAL(3,1) DEFAULT 0,
                        comfort DECIMAL(3,1) DEFAULT 0,
                        location DECIMAL(3,1) DEFAULT 0,
                        services DECIMAL(3,1) DEFAULT 0,
                        comment TEXT,
                        google_rating DECIMAL(3,1) DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        UNIQUE KEY uq_booking (booking_id)
                    )
                `);
                _feedbackTableCreated = true;
            }

            await pool.query(`
                INSERT INTO manager_booking_feedbacks
                    (booking_id, overall_rating, cleanliness, comfort, location, services, comment, google_rating)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    overall_rating = VALUES(overall_rating),
                    cleanliness    = VALUES(cleanliness),
                    comfort        = VALUES(comfort),
                    location       = VALUES(location),
                    services       = VALUES(services),
                    comment        = VALUES(comment),
                    google_rating  = VALUES(google_rating),
                    updated_at     = NOW()
            `, [
                bookingId,
                Number(overallRating) || 0,
                Number(cleanliness)   || 0,
                Number(comfort)       || 0,
                Number(location)      || 0,
                Number(services)      || 0,
                comment || "",
                Number(googleRating)  || 0,
            ]);

            return Response.success(res, { bookingId, saved: true });
        } catch (err) {
            console.error("Manager saveFeedback error:", err);
            return Response.error(res, "SERVER_ERROR", "Failed to save feedback.", 500);
        }
    }

    /**
     * POST /api/manager/booking/:id/guest/:guestId/upload-document
     * Upload an ID document (image or PDF) for a specific guest in a booking.
     */
    async uploadGuestDocument(req, res) {
        try {
            const bookingId = req.params.id;
            const guestId = req.params.guestId;

            const hasAccess = await Booking.managerHasBookingAccess(req.managerId, bookingId);
            if (!hasAccess) {
                return Response.error(res, "FORBIDDEN", "Access denied to this booking.", 403);
            }

            if (!req.file) {
                return Response.error(res, "VALIDATION_ERROR", "No file uploaded. Please attach an image or PDF.", 400);
            }

            const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
            if (!allowedTypes.includes(req.file.mimetype)) {
                return Response.error(res, "VALIDATION_ERROR", "Invalid file type. Only images (JPG, PNG, WEBP) and PDFs are allowed.", 400);
            }

            const fileName = `guest_ids/manager_${bookingId}_${guestId}_${Date.now()}_${req.file.originalname}`;
            let fileUrl = "";

            try {
                const uploadResult = await S3Helper.uploadFile(
                    process.env.AWS_BUCKET || "staymaster",
                    fileName,
                    req.file.buffer,
                    { ContentType: req.file.mimetype }
                );
                fileUrl = uploadResult.Location || fileName;
            } catch (s3Err) {
                console.error("S3 upload error:", s3Err);
                return Response.error(res, "SERVER_ERROR", "Failed to upload file. Please try again.", 500);
            }

            await pool.query(
                "UPDATE guest_details SET id_file = ?, document_status = 'pending' WHERE id = ? AND booking_id = ?",
                [fileUrl, guestId, bookingId]
            );

            return Response.success(res, { id_file: fileUrl, guestId, bookingId });
        } catch (err) {
            console.error("Manager uploadGuestDocument error:", err);
            return Response.error(res, "SERVER_ERROR", "Failed to upload document.", 500);
        }
    }

    /**
     * PATCH /api/manager/booking/:id/guest/:guestId/document-status
     * Approve or reject a guest's uploaded ID document.
     * Body: { status: 'approved' | 'rejected' | 'pending', rejection_reason?: string }
     */
    async updateDocumentStatus(req, res) {
        try {
            const bookingId = req.params.id;
            const guestId = req.params.guestId;

            const hasAccess = await Booking.managerHasBookingAccess(req.managerId, bookingId);
            if (!hasAccess) {
                return Response.error(res, "FORBIDDEN", "Access denied to this booking.", 403);
            }

            const { status, rejection_reason } = req.body;
            const allowed = ['approved', 'rejected', 'pending'];
            if (!status || !allowed.includes(status)) {
                return Response.error(res, "VALIDATION_ERROR", `Status must be one of: ${allowed.join(', ')}`, 400);
            }

            const [rows] = await pool.query(
                "SELECT id, id_file FROM guest_details WHERE id = ? AND booking_id = ? LIMIT 1",
                [guestId, bookingId]
            );
            if (!rows || rows.length === 0) {
                return Response.error(res, "NOT_FOUND", "Guest record not found for this booking.", 404);
            }
            if (!rows[0].id_file) {
                return Response.error(res, "VALIDATION_ERROR", "No document uploaded for this guest.", 400);
            }

            // Always update document_status (column guaranteed to exist from migration)
            await pool.query(
                "UPDATE guest_details SET document_status = ? WHERE id = ? AND booking_id = ?",
                [status, guestId, bookingId]
            );

            // Update rejection_reason separately — ensure column exists first using
            // MySQL-version-safe ALTER (catches error 1060 = column already exists)
            try {
                await pool.query(
                    "ALTER TABLE guest_details ADD COLUMN document_rejection_reason TEXT DEFAULT NULL"
                );
            } catch (e) {
                if (e.errno !== 1060) throw e; // 1060 = Duplicate column name, safe to ignore
            }
            await pool.query(
                "UPDATE guest_details SET document_rejection_reason = ? WHERE id = ? AND booking_id = ?",
                [rejection_reason || null, guestId, bookingId]
            );

            return Response.success(res, {
                guestId,
                bookingId,
                document_status: status,
                rejection_reason: rejection_reason || null,
            });
        } catch (err) {
            console.error("Manager updateDocumentStatus error:", err);
            return Response.error(res, "SERVER_ERROR", "Failed to update document status.", 500);
        }
    }

    /**
     * PATCH /api/manager/booking/:id/cancellation
     * Approve or reject a guest's cancellation request.
     * Body: { action: 'approve' | 'reject', refund_amount?: number, refund_notes?: string }
     */
    async manageCancellation(req, res) {
        try {
            const bookingId = req.params.id;

            const hasAccess = await Booking.managerHasBookingAccess(req.managerId, bookingId);
            if (!hasAccess) {
                return Response.error(res, "FORBIDDEN", "Access denied to this booking.", 403);
            }

            const { action, refund_amount, refund_notes } = req.body;
            if (!action || !["approve", "reject"].includes(action)) {
                return Response.error(res, "VALIDATION_ERROR", "Action must be 'approve' or 'reject'.", 400);
            }

            const [[booking]] = await pool.query(
                "SELECT id, cancellation_requested, currentStatus FROM bookings WHERE id = ? LIMIT 1",
                [bookingId]
            );
            if (!booking) {
                return Response.error(res, "NOT_FOUND", "Booking not found.", 404);
            }
            if (!booking.cancellation_requested) {
                return Response.error(res, "VALIDATION_ERROR", "No cancellation request exists for this booking.", 400);
            }

            if (action === "approve") {
                // Ensure refund columns exist (safe migration)
                try {
                    await pool.query("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10,2) DEFAULT NULL");
                    await pool.query("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_status VARCHAR(50) DEFAULT NULL");
                    await pool.query("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_notes TEXT DEFAULT NULL");
                } catch (e) {
                    if (e.errno !== 1060) throw e;
                }

                await pool.query(
                    `UPDATE bookings
                     SET currentStatus = 'Cancel',
                         refund_amount = ?,
                         refund_status = 'pending',
                         refund_notes = ?
                     WHERE id = ?`,
                    [refund_amount != null ? Number(refund_amount) : null, refund_notes || null, bookingId]
                );
                return Response.success(res, { bookingId, action: "approved", refund_status: "pending" });
            } else {
                // reject — clear the cancellation request
                await pool.query(
                    `UPDATE bookings
                     SET cancellation_requested = 0,
                         cancellation_reason = NULL,
                         cancellation_requested_at = NULL
                     WHERE id = ?`,
                    [bookingId]
                );
                return Response.success(res, { bookingId, action: "rejected" });
            }
        } catch (err) {
            console.error("Manager manageCancellation error:", err);
            return Response.error(res, "SERVER_ERROR", "Failed to process cancellation action.", 500);
        }
    }
}

module.exports = new ManagerController();
