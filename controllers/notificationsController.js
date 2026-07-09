'use strict';
const Response = require("../helpers/responseHelper");
const NotificationModel = require('../models/notificationModel');
const PushNotificationHelper = require('../helpers/pushNotificationHelper');

const Notifications = new NotificationModel();
const PushHelper = new PushNotificationHelper();

class NotificationsController {
    async registerDevice(req, res) {
        try {
            const { deviceToken, fcmToken, platform = 'host_app' } = req.body;
            // Accept both deviceToken and fcmToken as aliases
            const token = deviceToken || fcmToken;
            const userId = req.user?.id || req.guest?.id;

            if (!token) {
                return Response.error(res, "ERROR", 'deviceToken or fcmToken is required', 400);
            }
            if (!userId) {
                return Response.error(res, "ERROR", 'User not resolved from token', 401);
            }

            const tokenId = await Notifications.saveDeviceToken(userId, token, platform);
            return Response.success(res, { tokenId }, 201);
        } catch (error) {
            console.error('registerDevice error:', error);
            return Response.error(res, "ERROR", 'Unable to save device token', 500);
        }
    }

    async send(req, res) {
        const { title, body, data = {}, userIds = [] } = req.body;
        const currentUserId = req.user?.id || req.guest?.id;
        const targetUserIds = Array.isArray(userIds) && userIds.length ? userIds : (currentUserId ? [currentUserId] : []);

        if (!title || !body) {
            return Response.error(res, "ERROR", 'title and body are required', 400);
        }
        if (!targetUserIds.length) {
            return Response.error(res, "ERROR", 'No target users found', 400);
        }

        try {
            const tokens = await Notifications.tokensForUsers(targetUserIds);
            const sendResult = await PushHelper.sendToTokens({ tokens, title, body, data });

            const status =
                sendResult?.skipped ? 'skipped' : sendResult?.failure === 0 ? 'sent' : 'partial';

            const notificationIds = await Promise.all(
                targetUserIds.map((userId) =>
                    Notifications.createNotification({
                        userId,
                        title,
                        body,
                        data,
                        status,
                        response: sendResult,
                    })
                )
            );

            return Response.success(res, {
                message: sendResult?.skipped ? sendResult.message : 'Notification queued',
                tokens: tokens.length,
                notificationIds,
                fcm: sendResult,
            }, 200);
        } catch (error) {
            console.error('Notification send error:', error);
            await Promise.all(
                targetUserIds.map((userId) =>
                    Notifications.createNotification({
                        userId,
                        title,
                        body,
                        data,
                        status: 'failed',
                        response: { error: error.message || 'FCM error' },
                    })
                )
            );
            return Response.error(res, "ERROR", 'Failed to dispatch notification', 500);
        }
    }

    async list(req, res) {
        try {
            const userId = req.user?.id || req.guest?.id;
            if (!userId) {
                // No auth — return empty state without error
                return Response.success(res, { notifications: [], unread: 0 }, 200);
            }
            const notifications = await Notifications.notificationsForUser(userId);
            const unread = await Notifications.unreadCount(userId);
            return Response.success(res, { notifications, unread }, 200);
        } catch (error) {
            console.error('Notifications list error:', error);
            return Response.error(res, "ERROR", 'Unable to fetch notifications', 500);
        }
    }

    async markRead(req, res) {
        try {
            const userId = req.user?.id || req.guest?.id;
            const { id } = req.params;
            const { read = true } = req.body;
            if (!userId) {
                return Response.error(res, "ERROR", 'User not resolved from token', 401);
            }
            if (!id) {
                return Response.error(res, "ERROR", 'Notification id required', 400);
            }
            const changed = await Notifications.markRead(id, userId, Boolean(read));
            const unread = await Notifications.unreadCount(userId);
            return Response.success(res, { updated: changed, unread }, 200);
        } catch (error) {
            console.error('Notification markRead error:', error);
            return Response.error(res, "ERROR", 'Unable to update notification', 500);
        }
    }

    async markAllRead(req, res) {
        try {
            const userId = req.user?.id || req.guest?.id;
            if (!userId) {
                return Response.error(res, "ERROR", 'User not resolved from token', 401);
            }
            const updated = await Notifications.markAllRead(userId);
            const unread = await Notifications.unreadCount(userId);
            return Response.success(res, { updated, unread }, 200);
        } catch (error) {
            console.error('Notification markAllRead error:', error);
            return Response.error(res, "ERROR", 'Unable to update notifications', 500);
        }
    }

    /**
     * Send push notification when booking is confirmed
     * @param {Array} hostIds - Array of host user IDs to notify
     * @param {Object} bookingData - Booking information (propertyName, bookingId, checkIn, checkOut, guestName)
     */
    async sendBookingConfirmationNotification(hostIds, bookingData) {
        try {
            if (!Array.isArray(hostIds) || hostIds.length === 0) {
                console.log('No host IDs provided for booking confirmation notification');
                return { success: false, message: 'No hosts to notify' };
            }

            const { propertyName, bookingId, checkIn, checkOut, guestName } = bookingData;
            
            const title = 'New Booking Confirmed';
            const body = `${guestName || 'A guest'} has booked ${propertyName || 'your property'}. Check-in: ${checkIn || 'N/A'}`;
            
            const data = {
                type: 'booking_confirmed',
                bookingId: bookingId || '',
                propertyName: propertyName || '',
                checkIn: checkIn || '',
                checkOut: checkOut || '',
                guestName: guestName || ''
            };

            // Get device tokens for all hosts
            const tokens = await Notifications.tokensForUsers(hostIds);
            
            if (tokens.length === 0) {
                console.log('No device tokens found for hosts');
                // Still create notification records even if no tokens
                await Promise.all(
                    hostIds.map((userId) =>
                        Notifications.createNotification({
                            userId,
                            title,
                            body,
                            data,
                            status: 'skipped',
                            response: { message: 'No device tokens registered' },
                        })
                    )
                );
                return { success: true, message: 'Notifications created but no devices to send to', tokens: 0 };
            }

            // Send push notifications
            const sendResult = await PushHelper.sendToTokens({ tokens, title, body, data });

            const status = sendResult?.skipped ? 'skipped' : sendResult?.failure === 0 ? 'sent' : 'partial';

            // Create notification records for all hosts
            const notificationIds = await Promise.all(
                hostIds.map((userId) =>
                    Notifications.createNotification({
                        userId,
                        title,
                        body,
                        data,
                        status,
                        response: sendResult,
                    })
                )
            );

            return {
                success: true,
                message: sendResult?.skipped ? sendResult.message : 'Booking confirmation notifications sent',
                tokens: tokens.length,
                notificationIds,
                fcm: sendResult,
            };
        } catch (error) {
            console.error('Error sending booking confirmation notification:', error);
            // Try to create notification records even on error
            try {
                await Promise.all(
                    hostIds.map((userId) =>
                        Notifications.createNotification({
                            userId,
                            title: 'New Booking Confirmed',
                            body: bookingData.guestName 
                                ? `${bookingData.guestName} has booked ${bookingData.propertyName || 'your property'}`
                                : 'A new booking has been confirmed',
                            data: {
                                type: 'booking_confirmed',
                                bookingId: bookingData.bookingId || '',
                                propertyName: bookingData.propertyName || '',
                            },
                            status: 'failed',
                            response: { error: error.message || 'Notification send error' },
                        })
                    )
                );
            } catch (notifError) {
                console.error('Error creating notification records:', notifError);
            }
            return { success: false, message: 'Failed to send booking confirmation notification', error: error.message };
        }
    }
}

module.exports = NotificationsController;
