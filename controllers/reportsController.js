'use strict';
const Response = require("../helpers/responseHelper");
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');

const booking = require("../models/bookingModel");
const Booking = new booking;
const property = require("../models/propertyModel");
const Property = new property;

class ReportsController {
    
    // Generate monthly report for a property owner
    async generateMonthlyReport(req, res) {
        try {
            const { propertyId, month, year, ownerId } = req.body;
            
            if (!propertyId || !month || !year) {
                return Response.error(res, "ERROR", "Property ID, month, and year are required", 400);
            }

            // Get report data
            const reportData = await this.getMonthlyReportData(propertyId, month, year);
            
            // Generate PDF
            const pdfPath = await this.createMonthlyReportPDF(reportData, month, year);
            
            return Response.success(res, {
                data: reportData,
                downloadPath: pdfPath,
                message: 'Monthly report generated successfully'
            }, 200);

        } catch (error) {
            console.error('Error generating monthly report:', error);
            return Response.error(res, "ERROR", error.message, 500);
        }
    }

    // Download monthly report PDF
    async downloadMonthlyReport(req, res) {
        try {
            const { propertyId, month, year } = req.params;
            
            const reportData = await this.getMonthlyReportData(propertyId, month, year);
            const pdfPath = await this.createMonthlyReportPDF(reportData, month, year);
            
            // Set headers for file download
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=Monthly-Report-${month}-${year}.pdf`);
            
            // Stream the PDF file
            const pdfStream = fs.createReadStream(pdfPath);
            pdfStream.pipe(res);
            
            // Clean up temporary file after download
            pdfStream.on('end', () => {
                setTimeout(() => {
                    if (fs.existsSync(pdfPath)) {
                        fs.unlinkSync(pdfPath);
                    }
                }, 5000);
            });

        } catch (error) {
            console.error('Error downloading monthly report:', error);
            return Response.error(res, "ERROR", error.message, 500);
        }
    }

    // Get monthly report data from database
    async getMonthlyReportData(propertyId, month, year) {
        try {
            const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
            const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month

            // Get property details
            const propertyDetails = await Property.find('properties', { id: propertyId });
            
            // Get bookings for the month
            const bookings = await Booking.getMonthlyBookings(propertyId, startDate, endDate);
            
            // Get revenue breakdown
            const revenueData = await Booking.getMonthlyRevenue(propertyId, startDate, endDate);
            
            // Calculate metrics
            const totalBookings = bookings.length;
            const totalRevenue = revenueData.reduce((sum, record) => sum + (record.revenue || 0), 0);
            const averageDailyRate = totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0;
            
            // Calculate occupancy rate
            const daysInMonth = new Date(year, month, 0).getDate();
            const bookedNights = bookings.reduce((sum, booking) => {
                const checkIn = new Date(booking.start);
                const checkOut = new Date(booking.end);
                const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
                return sum + nights;
            }, 0);
            const occupancyRate = Math.round((bookedNights / daysInMonth) * 100);

            return {
                property: propertyDetails,
                period: { month, year, startDate, endDate },
                summary: {
                    totalBookings,
                    totalRevenue: Math.round(totalRevenue),
                    averageDailyRate,
                    occupancyRate,
                    bookedNights,
                    daysInMonth
                },
                bookings,
                revenueData,
                generatedAt: new Date()
            };

        } catch (error) {
            console.error('Error getting monthly report data:', error);
            throw error;
        }
    }

    // Create PDF report
    async createMonthlyReportPDF(reportData, month, year) {
        return new Promise((resolve, reject) => {
            try {
                const fileName = `monthly-report-${reportData.property.id}-${month}-${year}-${Date.now()}.pdf`;
                const filePath = path.join(__dirname, '../temp', fileName);
                
                // Ensure temp directory exists
                const tempDir = path.dirname(filePath);
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                const doc = new PDFDocument();
                const stream = fs.createWriteStream(filePath);
                doc.pipe(stream);

                // Header
                doc.fontSize(20).text('Monthly Property Report', 50, 50);
                doc.fontSize(14).text(`${reportData.property.listing_name}`, 50, 80);
                doc.text(`Period: ${this.getMonthName(month)} ${year}`, 50, 100);
                doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`, 50, 120);

                // Summary Section
                doc.fontSize(16).text('Summary', 50, 160);
                doc.fontSize(12);
                doc.text(`Total Bookings: ${reportData.summary.totalBookings}`, 50, 190);
                doc.text(`Total Revenue: ₹${reportData.summary.totalRevenue.toLocaleString()}`, 50, 210);
                doc.text(`Average Daily Rate: ₹${reportData.summary.averageDailyRate.toLocaleString()}`, 50, 230);
                doc.text(`Occupancy Rate: ${reportData.summary.occupancyRate}%`, 50, 250);
                doc.text(`Booked Nights: ${reportData.summary.bookedNights} of ${reportData.summary.daysInMonth}`, 50, 270);

                // Bookings Table
                if (reportData.bookings.length > 0) {
                    doc.fontSize(16).text('Bookings Detail', 50, 320);
                    doc.fontSize(10);
                    
                    let y = 350;
                    doc.text('Check-in', 50, y);
                    doc.text('Check-out', 130, y);
                    doc.text('Nights', 210, y);
                    doc.text('Revenue', 260, y);
                    doc.text('Status', 320, y);
                    
                    y += 20;
                    doc.moveTo(50, y).lineTo(550, y).stroke();
                    y += 10;

                    reportData.bookings.forEach((booking, index) => {
                        if (y > 750) { // New page if needed
                            doc.addPage();
                            y = 50;
                        }
                        
                        doc.text(format(new Date(booking.start), 'dd MMM'), 50, y);
                        doc.text(format(new Date(booking.end), 'dd MMM'), 130, y);
                        
                        const nights = Math.ceil((new Date(booking.end) - new Date(booking.start)) / (1000 * 60 * 60 * 24));
                        doc.text(nights.toString(), 210, y);
                        doc.text(`₹${(booking.totalAmountAfterTax || 0).toLocaleString()}`, 260, y);
                        doc.text(booking.currentStatus || 'Confirmed', 320, y);
                        
                        y += 15;
                    });
                }

                // Footer
                doc.fontSize(8).text('Generated by StayMaster Property Management System', 50, doc.page.height - 50);

                doc.end();

                stream.on('finish', () => {
                    resolve(filePath);
                });

                stream.on('error', (error) => {
                    reject(error);
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    // Get month name from number
    getMonthName(monthNumber) {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return months[monthNumber - 1] || 'Unknown';
    }
}

module.exports = ReportsController; 