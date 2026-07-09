'use strict';
const Response = require("../helpers/responseHelper");
const booking = require("../models/bookingModel");
const Booking = new booking;
const smModel = require("../models/smModel");
const SMModel = new smModel;
const { format,differenceInDays,subDays,subWeeks,subMonths,subYears,addWeeks,addMonths,addYears,startOfWeek,endOfWeek,startOfMonth,endOfMonth,startOfYear,endOfYear } = require("date-fns");

class DashboardController{
    async index(req,res){
        const today = format(new Date(), 'yyyy-MM-dd');
        const yesterday = format(subDays(new Date(),1),'yyyy-MM-dd');
        const {bookings,tarrifs,rentals} = await Booking.todaysCheckouts();
        const properties = await SMModel.getFromTable('properties');
        const checkouts = bookings.length;
        const nights = rentals.length;
        
        const nbvs = tarrifs.map(t => t.nbv);
        const nbvTotal = Math.round(nbvs.reduce((sum, num) => sum + num, 0));
        const occupancy = Math.round((checkouts/properties.length)*100);
        var adr = 0;
        if(nights > 0){
            adr = Math.round(nbvTotal/nights);
        }
        var los = 0;
        if(checkouts > 0){
            los = Math.round(nights/checkouts);
        }

        const todaysRentals = rentals.filter(ri => ri.effDate == yesterday);
        const adult = todaysRentals.map(tr => tr.adult).reduce((sum, num) => sum + num, 0);
        const child = todaysRentals.map(tr => tr.child).reduce((sum, num) => sum + num, 0);
        const guests = `${adult} Adults<br>${child} Children`;

        var leadTime = 0;
        if(bookings.length > 0){
            const totalLeadTimes = bookings.map(b => differenceInDays(format(b.start, 'yyyy-MM-dd'),format(b.createDatetime, 'yyyy-MM-dd'))).reduce((sum, num) => sum + num, 0);
            leadTime = Math.round(totalLeadTimes/bookings.length,2);
        }
        const {bookingStats,rentalStats} = await Booking.todaysBookings();
        const stats = [];
        const cancelled = [];
        bookingStats.forEach(b =>{
            const nights = differenceInDays(format(b.end, 'yyyy-MM-dd'),format(b.start, 'yyyy-MM-dd'));
            b['nights'] =  nights;
            b.start = format(b.start,'MMM')+'<br>'+format(b.start,'dd');
            b.end = format(b.end,'MMM')+'<br>'+format(b.end,'dd');
            b['adr'] = Math.round((b.totalAmountAfterTax - b.taCommision)/nights); 
            if(b.currentStatus == 'Cancel' || b.currentStatus == 'Void'){
                b.guests = '-';
                cancelled.push(b);
            }else{
            const rental = rentalStats.find(r => r.booking_id == b.id);
            if (rental && rental.adults !== undefined && rental.children !== undefined) {
                b.guests = rental.adults + rental.children;
            } else {
                b.guests = '-';
            }
            stats.push(b);
            }
        });
        const activeBookings = bookingStats.filter(a => (a.currentStatus != 'Cancel' && a.currentStatus != 'Void'));
        const arrivals = activeBookings.filter(b => b.start == format(new Date(),'MMM')+'<br>'+format(new Date(),'dd'));
        const departures = activeBookings.filter(b => b.end == format(new Date(),'MMM')+'<br>'+format(new Date(),'dd'));
        //const arrivals = bookingStats.filter(b => b.start == format(new Date(),'MMM')+'<br>'+format(new Date(),'dd'));
        //const departures = bookingStats.filter(b => b.end == format(new Date(),'MMM')+'<br>'+format(new Date(),'dd'));
        const {props,channels,propTypes} = await Booking.pieChartsData();
        await res.render('dashboard/dashboard.ejs',{nbvTotal,nights,checkouts,occupancy,adr,los,guests,leadTime,stats,arrivals,departures,cancelled,props,channels,propTypes,revenues:await this.getRevenues()});
    }

    async getRevenues(revDate=new Date()){
        try {
            const revenues = {};
            revenues['weekStart'] = startOfWeek(revDate);
            revenues['weekEnd'] = endOfWeek(revDate);
            revenues['weekDisplay'] = `${format(startOfWeek(revDate),'MMM dd,yyyy')}-${format(endOfWeek(revDate),'MMM dd,yyyy')}`;
            revenues['weeklyData'] = await this.getWeeklyBreakup(revDate);
            //console.log(revenues['weeklyData']['current']);
            //console.log(revenues['weeklyData']['previous']);
            revenues['monthStart'] = startOfMonth(revDate);
            revenues['monthEnd'] = endOfMonth(revDate);
            revenues['monthDisplay'] = `${format(startOfMonth(revDate),'MMM dd,yyyy')}-${format(endOfMonth(revDate),'MMM dd,yyyy')}`;
            revenues['monthlyData'] = await this.getMonthlyBreakup(revDate);
            //console.log(revenues['monthlyData']['current']);
            revenues['yearStart'] = startOfYear(revDate);
            revenues['yearEnd'] = endOfYear(revDate);
            revenues['yearDisplay'] = `${format(startOfYear(revDate),'MMM dd,yyyy')}-${format(endOfYear(revDate),'MMM dd,yyyy')}`;
            revenues['yearlyData'] = await this.getYearlyBreakup(revDate);
            //console.log(revenues['yearlyData']['current']);
            //console.log(revenues['yearlyData']['previous']);
            return revenues;
        } catch (error) {
            /*
             * Do NOT let a data retrieval issue crash the entire dashboard. Log the error for debugging and
             * return a default structure so that the EJS template can still render without throwing
             * "Cannot read properties of undefined" type errors.
             */
            console.error('Error while calculating revenues:', error);

            const fallback = {
                weekStart: startOfWeek(revDate),
                weekEnd: endOfWeek(revDate),
                weekDisplay: `${format(startOfWeek(revDate),'MMM dd,yyyy')}-${format(endOfWeek(revDate),'MMM dd,yyyy')}`,
                weeklyData: { current: [], previous: [], total: 0, previousTotal: 0 },
                monthStart: startOfMonth(revDate),
                monthEnd: endOfMonth(revDate),
                monthDisplay: `${format(startOfMonth(revDate),'MMM dd,yyyy')}-${format(endOfMonth(revDate),'MMM dd,yyyy')}`,
                monthlyData: { current: [], previous: [], total: 0, previousTotal: 0 },
                yearStart: startOfYear(revDate),
                yearEnd: endOfYear(revDate),
                yearDisplay: `${format(startOfYear(revDate),'MMM dd,yyyy')}-${format(endOfYear(revDate),'MMM dd,yyyy')}`,
                yearlyData: { current: [], previous: [], total: 0, previousTotal: 0 }
            };
            return fallback;
        }
    }

    async getWeeklyBreakup(revDate){
        const data = {};
        var current =  await this.getRevenueBreakup(startOfWeek(revDate),endOfWeek(revDate));
        current.forEach(c=>{
            c.date = format(c.end,'EEE');
        });
        data["current"] = current;
        var previous = await this.getRevenueBreakup(subWeeks(startOfWeek(revDate),1),subWeeks(endOfWeek(revDate),1));
        previous.forEach(p=>{
            p.date = format(p.end,'EEE');
        });
        data["previous"] = previous;
        data["total"] = (data.current || []).reduce((sum, c) => sum + (Number(c.total) || Number(c.amount) || 0), 0);
        data["previousTotal"] = (data.previous || []).reduce((sum, p) => sum + (Number(p.total) || Number(p.amount) || 0), 0);
        return data;
    }

    async getMonthlyBreakup(revDate){
        const data = {};
        var current =  await this.getRevenueBreakup(startOfMonth(revDate),endOfMonth(revDate));
        current.forEach(c=>{
            c.date = format(c.end,'dd');
        });
        data["current"] = current;
        var previous = await this.getRevenueBreakup(subMonths(startOfMonth(revDate),1),subMonths(endOfMonth(revDate),1));
        previous.forEach(p=>{
            p.date = format(p.end,'EEE');
        });
        data["previous"] = previous;
        data["total"] = (data.current || []).reduce((sum, c) => sum + (Number(c.total) || Number(c.amount) || 0), 0);
        data["previousTotal"] = (data.previous || []).reduce((sum, p) => sum + (Number(p.total) || Number(p.amount) || 0), 0);
        return data;
    }

    async getYearlyBreakup(revDate){
        const data = {};
        data["current"] =  await this.getRevenueBreakupByMonth(startOfYear(revDate),endOfYear(revDate));
        data["previous"] =  await this.getRevenueBreakupByMonth(subYears(startOfYear(revDate),1),subYears(endOfYear(revDate),1));
        /*current.forEach(c=>{
            c.date = format(c.end,'EEEE');
        });
        data["current"] = current;
        data["previous"] = [];*/
        data["total"] = (data.current || []).reduce((sum, c) => sum + (Number(c.total) || Number(c.amount) || 0), 0);
        data["previousTotal"] = (data.previous || []).reduce((sum, p) => sum + (Number(p.total) || Number(p.amount) || 0), 0);
        return data;
    }

    async getRevenueBreakup(start,end){
        var currentStart = format(start,'yyyy-MM-dd');
        var currentEnd = format(end,'yyyy-MM-dd');
        return await Booking.revenueByDay(currentStart,currentEnd,format);
    }

    async getRevenueBreakupByMonth(start,end){
        var currentStart = format(start,'yyyy-MM-dd');
        var currentEnd = format(end,'yyyy-MM-dd');
        return await Booking.revenueByMonth(currentStart,currentEnd,format);
    }

    async updateChart(req,res){
        const {duration, range, startDate} = req.body;
        var start;
        var end;
        var data = {};
        try {
            if(range == 'prev'){
                if(duration == 'week'){
                    start = subWeeks(startDate,1);
                    end = endOfWeek(start);
                    data = await this.getWeeklyBreakup(start);
                }
                if(duration == 'month'){
                    start = subMonths(startDate,1);
                    end = endOfMonth(start);
                    data = await this.getMonthlyBreakup(start);
                }
                if(duration == 'year'){
                    start = subYears(startDate,1);
                    end = endOfYear(start);
                    data = await this.getYearlyBreakup(start);
                }
            }else{
                if(duration == 'week'){
                    start = addWeeks(startDate,1);
                    end = endOfWeek(start);
                    data = await this.getWeeklyBreakup(start);
                }
                if(duration == 'month'){
                    start = addMonths(startDate,1);
                    end = endOfMonth(start);
                    data = await this.getMonthlyBreakup(start);
                }
                if(duration == 'year'){
                    start = addYears(startDate,1);
                    end = endOfYear(start);
                    data = await this.getYearlyBreakup(start);
                }
            }
            data['start'] = start;
            data['display'] = `${format(start,'MMM dd,yyyy')}-${format(end,'MMM dd,yyyy')}`;
            return Response.success(res, {data:data }, 200);
        } catch (error) {
            return Response.error(res, "ERROR", "Error fetching data", 400);
        }
    }

    async revenues(req,res){
        try {
            const data = await this.getRevenues();
            res.json({success:true,data:data});
        } catch (error) {
            console.log(error);
            return Response.error(res, "ERROR", error, 500);
        }
    }

    // New API for stacked chart data with property-wise breakdown
    async stackedEarningsData(req, res) {
        try {
            const { period = 'monthly', propertyId = null } = req.query;
            let start, end;
            
            // Determine date range based on period
            switch(period) {
                case 'weekly':
                    start = format(startOfWeek(new Date()), 'yyyy-MM-dd');
                    end = format(endOfWeek(new Date()), 'yyyy-MM-dd');
                    break;
                case 'yearly':
                    start = format(startOfYear(new Date()), 'yyyy-MM-dd');
                    end = format(endOfYear(new Date()), 'yyyy-MM-dd');
                    break;
                default: // monthly
                    start = format(startOfMonth(new Date()), 'yyyy-MM-dd');
                    end = format(endOfMonth(new Date()), 'yyyy-MM-dd');
            }

            // Get all properties
            const properties = await SMModel.getFromTable('properties');
            
            // Get revenue data by property
            const stackedData = await Booking.revenueByPropertyStacked(start, end, propertyId);
            
            // Format data for stacked chart
            const chartData = {
                labels: [],
                datasets: []
            };

            // Create color palette for properties
            const colors = [
                '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
            ];

            // Group data by property
            const propertyDataMap = {};
            properties.forEach((prop, index) => {
                propertyDataMap[prop.id] = {
                    label: prop.listing_name,
                    data: [],
                    backgroundColor: colors[index % colors.length],
                    borderColor: colors[index % colors.length],
                    borderWidth: 1
                };
            });

            // Organize revenue data by date and property
            const dateMap = {};
            stackedData.forEach(record => {
                const dateKey = format(new Date(record.date), period === 'weekly' ? 'EEE' : period === 'yearly' ? 'MMM' : 'dd');
                if (!dateMap[dateKey]) {
                    dateMap[dateKey] = {};
                }
                if (!dateMap[dateKey][record.property_id]) {
                    dateMap[dateKey][record.property_id] = 0;
                }
                dateMap[dateKey][record.property_id] += record.revenue || 0;
            });

            // Create labels and fill data arrays
            chartData.labels = Object.keys(dateMap).sort();
            
            chartData.labels.forEach(label => {
                properties.forEach(prop => {
                    const revenue = dateMap[label] && dateMap[label][prop.id] ? dateMap[label][prop.id] : 0;
                    propertyDataMap[prop.id].data.push(revenue);
                });
            });

            // Add datasets to chart data
            chartData.datasets = Object.values(propertyDataMap).filter(dataset => 
                dataset.data.some(value => value > 0) // Only include properties with revenue
            );

            res.json({
                success: true,
                data: {
                    chartData,
                    period,
                    dateRange: { start, end },
                    totalRevenue: stackedData.reduce((sum, record) => sum + (record.revenue || 0), 0)
                }
            });

        } catch (error) {
            console.error('Error in stackedEarningsData:', error);
            return Response.error(res, "ERROR", error.message, 500);
        }
    }
}
module.exports = DashboardController;