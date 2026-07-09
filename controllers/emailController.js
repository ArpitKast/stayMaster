'use strict';
const Response = require("../helpers/responseHelper");
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

class EmailController {
    constructor() {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
            console.error('[EmailController] EMAIL_USER and EMAIL_PASSWORD env vars are required');
        }
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });
    }

    // Send booking confirmation email
    async sendBookingConfirmation(req, res) {
        try {
            const { 
                guestEmail, 
                guestName, 
                propertyName, 
                checkIn, 
                checkOut, 
                bookingId,
                totalAmount,
                ownerEmail 
            } = req.body;

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: guestEmail,
                cc: ownerEmail,
                subject: `Booking Confirmation - ${propertyName}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #008489;">Booking Confirmation</h2>
                        <p>Dear ${guestName},</p>
                        <p>Your booking has been confirmed!</p>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3>Booking Details:</h3>
                            <p><strong>Booking ID:</strong> ${bookingId}</p>
                            <p><strong>Property:</strong> ${propertyName}</p>
                            <p><strong>Check-in:</strong> ${checkIn}</p>
                            <p><strong>Check-out:</strong> ${checkOut}</p>
                            <p><strong>Total Amount:</strong> ₹${totalAmount}</p>
                        </div>
                        
                        <p>We look forward to hosting you!</p>
                        <p>Best regards,<br>Staymaster Team</p>
                    </div>
                `
            };

            await this.transporter.sendMail(mailOptions);
            
            return Response.success(res, { 
                message: 'Booking confirmation email sent successfully' 
            }, 200);

        } catch (error) {
            console.error('Error sending booking confirmation email:', error);
            return Response.error(res, "ERROR", error.message, 500);
        }
    }

    // Send booking cancellation email
    async sendBookingCancellation(req, res) {
        try {
            const { 
                guestEmail, 
                guestName, 
                propertyName, 
                bookingId,
                cancellationReason,
                refundAmount,
                ownerEmail 
            } = req.body;

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: guestEmail,
                cc: ownerEmail,
                subject: `Booking Cancellation - ${propertyName}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #FF5252;">Booking Cancellation</h2>
                        <p>Dear ${guestName},</p>
                        <p>Your booking has been cancelled.</p>
                        
                        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3>Cancellation Details:</h3>
                            <p><strong>Booking ID:</strong> ${bookingId}</p>
                            <p><strong>Property:</strong> ${propertyName}</p>
                            <p><strong>Reason:</strong> ${cancellationReason || 'Not specified'}</p>
                            ${refundAmount ? `<p><strong>Refund Amount:</strong> ₹${refundAmount}</p>` : ''}
                        </div>
                        
                        <p>If you have any questions, please contact our support team.</p>
                        <p>Best regards,<br>Staymaster Team</p>
                    </div>
                `
            };

            await this.transporter.sendMail(mailOptions);
            
            return Response.success(res, { 
                success: true, 
                message: 'Booking cancellation email sent successfully' 
            });

        } catch (error) {
            console.error('Error sending booking cancellation email:', error);
            return Response.error(res, "ERROR", error.message, 500);
        }
    }

    // Send monthly report email
    async sendMonthlyReport(req, res) {
        try {
            const { 
                ownerEmail, 
                ownerName, 
                reportData,
                month,
                year,
                attachmentPath 
            } = req.body;

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: ownerEmail,
                subject: `Monthly Report - ${month} ${year}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #008489;">Monthly Report - ${month} ${year}</h2>
                        <p>Dear ${ownerName},</p>
                        <p>Please find your monthly property report attached.</p>
                        
                        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3>Summary:</h3>
                            <p><strong>Total Revenue:</strong> ₹${reportData.totalRevenue || 0}</p>
                            <p><strong>Total Bookings:</strong> ${reportData.totalBookings || 0}</p>
                            <p><strong>Occupancy Rate:</strong> ${reportData.occupancyRate || 0}%</p>
                            <p><strong>Average Daily Rate:</strong> ₹${reportData.averageDailyRate || 0}</p>
                        </div>
                        
                        <p>Thank you for being a valued property owner!</p>
                        <p>Best regards,<br>Staymaster Team</p>
                    </div>
                `,
                attachments: attachmentPath ? [
                    {
                        filename: `Monthly-Report-${month}-${year}.pdf`,
                        path: attachmentPath
                    }
                ] : []
            };

            await this.transporter.sendMail(mailOptions);
            
            return Response.success(res, { 
                success: true, 
                message: 'Monthly report email sent successfully' 
            });

        } catch (error) {
            console.error('Error sending monthly report email:', error);
            return Response.error(res, "ERROR", error.message, 500);
        }
    }

    // Send guest details and booking summary (Enhanced for owners app)
    async sendBookingDetails(req, res) {
        try {
            const { 
                ownerEmail,
                ownerName,
                bookingDetails,
                guestDetails
            } = req.body;

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: ownerEmail,
                subject: `Booking Details - ${bookingDetails.property_name}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #008489;">Booking Details</h2>
                        <p>Dear ${ownerName},</p>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3>Property Information:</h3>
                            <p><strong>Property:</strong> ${bookingDetails.property_name}</p>
                            <p><strong>Booking ID:</strong> ${bookingDetails.booking_id}</p>
                            <p><strong>Check-in:</strong> ${bookingDetails.check_in_date}</p>
                            <p><strong>Check-out:</strong> ${bookingDetails.check_out_date}</p>
                            <p><strong>Total Amount:</strong> ₹${bookingDetails.total_amount}</p>
                        </div>
                        
                        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3>Guest Information:</h3>
                            <p><strong>Guest Name:</strong> ${guestDetails.name}</p>
                            <p><strong>Email:</strong> ${guestDetails.email}</p>
                            <p><strong>Phone:</strong> ${guestDetails.phone}</p>
                            <p><strong>Group Type:</strong> ${guestDetails.group_type || 'Not specified'}</p>
                            <p><strong>Purpose of Visit:</strong> ${guestDetails.purpose_of_visit || 'Not specified'}</p>
                            <p><strong>Number of Guests:</strong> ${guestDetails.adults} Adults, ${guestDetails.children} Children</p>
                        </div>
                        
                        <p>Best regards,<br>Staymaster Team</p>
                    </div>
                `
            };

            await this.transporter.sendMail(mailOptions);
            
            return Response.success(res, { 
                success: true, 
                message: 'Booking details email sent successfully' 
            });

        } catch (error) {
            console.error('Error sending booking details email:', error);
            return Response.error(res, "ERROR", error.message, 500);
        }
    }

    // Send revenue loss notification for blocked dates
    async sendRevenueLossNotification(req, res) {
        try {
            const { 
                ownerEmail,
                ownerName,
                propertyName,
                blockDetails,
                estimatedLoss
            } = req.body;

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: ownerEmail,
                subject: `Revenue Impact Notification - ${propertyName}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #FF9800;">Revenue Impact Notification</h2>
                        <p>Dear ${ownerName},</p>
                        
                        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3>Block Details:</h3>
                            <p><strong>Property:</strong> ${propertyName}</p>
                            <p><strong>Block Type:</strong> ${blockDetails.block_type}</p>
                            <p><strong>Start Date:</strong> ${blockDetails.start_date}</p>
                            <p><strong>End Date:</strong> ${blockDetails.end_date}</p>
                            <p><strong>Reason:</strong> ${blockDetails.reason}</p>
                        </div>
                        
                        <div style="background-color: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3>Estimated Revenue Impact:</h3>
                            <p><strong>Potential Revenue Loss:</strong> ₹${estimatedLoss.amount}</p>
                            <p><strong>Number of Nights:</strong> ${estimatedLoss.nights}</p>
                            <p><strong>Based on:</strong> Historical pricing data</p>
                        </div>
                        
                        <p>This is an automated notification to keep you informed about potential revenue impacts.</p>
                        <p>Best regards,<br>Staymaster Team</p>
                    </div>
                `
            };

            await this.transporter.sendMail(mailOptions);
            
            return Response.success(res, { 
                success: true, 
                message: 'Revenue loss notification sent successfully' 
            });

        } catch (error) {
            console.error('Error sending revenue loss notification:', error);
            return Response.error(res, "ERROR", error.message, 500);
        }
    }

    // Send generic notification email
    async sendNotification(req, res) {
        try {
            const { 
                to, 
                subject, 
                message, 
                type = 'info' 
            } = req.body;

            const backgroundColor = {
                'info': '#d1ecf1',
                'success': '#d4edda',
                'warning': '#fff3cd',
                'error': '#f8d7da'
            };

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: to,
                subject: subject,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: ${backgroundColor[type]}; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3>${subject}</h3>
                            <p>${message}</p>
                        </div>
                        <p>Best regards,<br>Staymaster Team</p>
                    </div>
                `
            };

            await this.transporter.sendMail(mailOptions);
            
            return Response.success(res, { 
                success: true, 
                message: 'Notification email sent successfully' 
            });

        } catch (error) {
            console.error('Error sending notification email:', error);
            return Response.error(res, "ERROR", error.message, 500);
        }
    }
}

module.exports = EmailController; 