/**
 * API Test Runner for TheStayMaster Backend
 *
 * Usage:
 *   node scripts/api-test-runner.js [options]
 *
 * Options:
 *   --base-url=http://localhost:3000  Base URL for API
 *   --category=all                    Test category (all, auth, booking, property, etc.)
 *   --verbose                         Show detailed output
 *   --output=json                     Output format (json, console, html)
 *   --save-report                     Save report to file
 *
 * Example:
 *   node scripts/api-test-runner.js --base-url=http://localhost:3000 --verbose --save-report
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:8080',
    timeout: 10000,
    verbose: false,
    saveReport: false,
    category: 'all'
};

// Parse command line arguments
process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--base-url=')) CONFIG.baseUrl = arg.split('=')[1];
    if (arg.startsWith('--category=')) CONFIG.category = arg.split('=')[1];
    if (arg === '--verbose') CONFIG.verbose = true;
    if (arg === '--save-report') CONFIG.saveReport = true;
});

// ============================================================================
// API ENDPOINT DEFINITIONS
// ============================================================================

const API_ENDPOINTS = {
    // -------------------------------------------------------------------------
    // AUTHENTICATION ENDPOINTS
    // -------------------------------------------------------------------------
    auth: [
        {
            name: 'Generate Guest OTP',
            method: 'POST',
            path: '/api/ext/generateOTP',
            body: { phone: '9999999999' },
            expectedStatus: [200, 400],
            frontendComponents: ['LoginComponent', 'ConfirmBookingComponent'],
            requiredFields: ['success'],
            category: 'auth'
        },
        {
            name: 'Login with OTP',
            method: 'POST',
            path: '/api/ext/loginWithOTP',
            body: { phone: '9999999999', otp: '123456' },
            expectedStatus: [200, 401],
            frontendComponents: ['LoginComponent', 'ConfirmBookingComponent'],
            requiredFields: ['success'],
            category: 'auth'
        },
        {
            name: 'Admin Login',
            method: 'POST',
            path: '/api/users/login',
            body: { email: 'test@test.com', password: 'test' },
            expectedStatus: [200, 401],
            frontendComponents: ['AdminLoginComponent'],
            requiredFields: ['success'],
            category: 'auth'
        },
        {
            name: 'Generate Host OTP',
            method: 'POST',
            path: '/api/ext/generateHostOTP',
            body: { phone: '9999999999' },
            expectedStatus: [200, 400],
            frontendComponents: ['HostComponent'],
            requiredFields: ['success'],
            category: 'auth'
        },
        {
            name: 'Host Login with OTP',
            method: 'POST',
            path: '/api/hosts/loginWithOTP',
            body: { phone: '9999999999', otp: '123456' },
            expectedStatus: [200, 401],
            frontendComponents: ['HostLoginComponent'],
            requiredFields: ['success'],
            category: 'auth'
        }
    ],

    // -------------------------------------------------------------------------
    // USER/PROFILE ENDPOINTS
    // -------------------------------------------------------------------------
    user: [
        {
            name: 'Get User Profile',
            method: 'POST',
            path: '/api/ext/getProfile',
            body: {},
            expectedStatus: [200, 401],
            frontendComponents: ['ProfileComponent'],
            requiredFields: ['success'],
            requiresAuth: true,
            category: 'user'
        },
        {
            name: 'Update User Profile',
            method: 'POST',
            path: '/api/ext/updateProfile',
            body: { name: 'Test User' },
            expectedStatus: [200, 401],
            frontendComponents: ['ProfileComponent'],
            requiredFields: ['success'],
            requiresAuth: true,
            category: 'user'
        },
        {
            name: 'Get My Trips',
            method: 'POST',
            path: '/api/ext/myTrips',
            body: {},
            expectedStatus: [200, 401],
            frontendComponents: ['TripsComponent'],
            requiredFields: ['success'],
            requiresAuth: true,
            category: 'user'
        }
    ],

    // -------------------------------------------------------------------------
    // PROPERTY ENDPOINTS
    // -------------------------------------------------------------------------
    property: [
        {
            name: 'Get Property Settings',
            method: 'GET',
            path: '/api/properties/settings',
            expectedStatus: [200],
            frontendComponents: ['StayComponent', 'NewHomeComponent', 'AllPropertiesComponent'],
            requiredFields: ['properties'],
            category: 'property'
        },
        {
            name: 'Get Property Settings With Users',
            method: 'GET',
            path: '/api/properties/settingsWithUsers',
            expectedStatus: [200],
            frontendComponents: ['AdminLoginComponent'],
            requiredFields: [],
            category: 'property'
        },
        {
            name: 'Get Properties List',
            method: 'GET',
            path: '/api/properties/list',
            expectedStatus: [200, 401],
            frontendComponents: ['AdminService'],
            requiredFields: [],
            requiresAuth: true,
            category: 'property'
        },
        {
            name: 'Create Property',
            method: 'POST',
            path: '/api/properties/',
            body: { name: 'Test Property' },
            expectedStatus: [200, 201, 400, 401],
            frontendComponents: ['AddNewPropertyComponent'],
            requiredFields: [],
            requiresAuth: true,
            category: 'property',
            skipInAutoTest: true // Don't auto-create properties
        }
    ],

    // -------------------------------------------------------------------------
    // AVAILABILITY & BOOKING ENDPOINTS
    // -------------------------------------------------------------------------
    booking: [
        {
            name: 'Check Availability',
            method: 'POST',
            path: '/api/ext/checkAvailability',
            body: {
                property_id: 1,
                check_in: '2026-03-01',
                check_out: '2026-03-05'
            },
            expectedStatus: [200, 400],
            frontendComponents: ['StayComponent'],
            requiredFields: ['success'],
            category: 'booking'
        },
        {
            name: 'Home Availability',
            method: 'POST',
            path: '/api/ext/homeAvailability',
            body: {
                destination: 1,
                check_in: '2026-03-01',
                check_out: '2026-03-05',
                guests: 2
            },
            expectedStatus: [200, 400],
            frontendComponents: ['NewHomeComponent'],
            requiredFields: ['success'],
            category: 'booking'
        },
        {
            name: 'Availability And Details',
            method: 'POST',
            path: '/api/ext/availabilityAndDetails',
            body: {
                property_id: 1,
                check_in: '2026-03-01',
                check_out: '2026-03-05'
            },
            expectedStatus: [200, 400],
            frontendComponents: ['StayDescriptionComponent'],
            requiredFields: ['success'],
            category: 'booking'
        },
        {
            name: 'Calendar Availability',
            method: 'POST',
            path: '/api/ext/calendarAvailability',
            body: { property_id: 1, month: 3, year: 2026 },
            expectedStatus: [200, 400],
            frontendComponents: ['StayDestinationComponent'],
            requiredFields: [],
            category: 'booking'
        },
        {
            name: 'Calendar Availability Improved',
            method: 'POST',
            path: '/api/ext/calendarAvailabilityImproved',
            body: { property_id: 1, month: 3, year: 2026 },
            expectedStatus: [200, 400],
            frontendComponents: ['StayDestinationComponent'],
            requiredFields: [],
            category: 'booking'
        },
        {
            name: 'Create Booking',
            method: 'POST',
            path: '/api/ext/createBooking',
            body: {
                property_id: 1,
                check_in: '2026-03-01',
                check_out: '2026-03-05',
                guests: 2
            },
            expectedStatus: [200, 400, 401],
            frontendComponents: ['ConfirmBookingComponent'],
            requiredFields: ['success'],
            requiresAuth: true,
            category: 'booking',
            skipInAutoTest: true // Don't auto-create bookings
        },
        {
            name: 'Get Booking Details',
            method: 'GET',
            path: '/api/ext/myBooking/1',
            expectedStatus: [200, 404, 401],
            frontendComponents: ['ConfirmedBookingComponent'],
            requiredFields: [],
            requiresAuth: true,
            category: 'booking'
        },
        {
            name: 'Generate Order ID (RazorPay)',
            method: 'POST',
            path: '/api/ext/generateOrderId',
            body: { amount: 1000 },
            expectedStatus: [200, 400, 401],
            frontendComponents: ['ConfirmBookingComponent'],
            requiredFields: [],
            requiresAuth: true,
            category: 'booking'
        }
    ],

    // -------------------------------------------------------------------------
    // HOST ENDPOINTS
    // -------------------------------------------------------------------------
    host: [
        {
            name: 'Host Enquiry',
            method: 'POST',
            path: '/api/ext/hostEnquiry',
            body: {
                name: 'Test Host',
                email: 'test@test.com',
                phone: '9999999999'
            },
            expectedStatus: [200, 400],
            frontendComponents: ['HostComponent'],
            requiredFields: ['success'],
            category: 'host'
        },
        {
            name: 'Host Calculator Settings',
            method: 'POST',
            path: '/api/ext/hostCalculatorSettings',
            body: {},
            expectedStatus: [200],
            frontendComponents: ['HostComponent'],
            requiredFields: [],
            category: 'host'
        },
        {
            name: 'Get Host Properties',
            method: 'POST',
            path: '/api/hosts/properties',
            body: {},
            expectedStatus: [200, 401],
            frontendComponents: ['HostDashboardComponent'],
            requiredFields: [],
            requiresAuth: true,
            category: 'host'
        },
        {
            name: 'Host Performance',
            method: 'POST',
            path: '/api/hosts/performance',
            body: { property_id: 1 },
            expectedStatus: [200, 401],
            frontendComponents: ['HostDashboardComponent'],
            requiredFields: [],
            requiresAuth: true,
            category: 'host'
        },
        {
            name: 'Host Earnings By Month',
            method: 'POST',
            path: '/api/hosts/earningsByMonth',
            body: { property_id: 1, month: 1, year: 2026 },
            expectedStatus: [200, 401],
            frontendComponents: ['HostDashboardComponent'],
            requiredFields: [],
            requiresAuth: true,
            category: 'host'
        },
        {
            name: 'Host Block Dates',
            method: 'POST',
            path: '/api/hosts/block',
            body: { property_id: 1, start: '2026-03-01', end: '2026-03-05' },
            expectedStatus: [200, 400, 401],
            frontendComponents: ['HostCalendarComponent'],
            requiredFields: [],
            requiresAuth: true,
            category: 'host',
            skipInAutoTest: true
        },
        {
            name: 'Host Unblock Dates',
            method: 'POST',
            path: '/api/hosts/unblock',
            body: { property_id: 1, start: '2026-03-01', end: '2026-03-05' },
            expectedStatus: [200, 400, 401],
            frontendComponents: ['HostCalendarComponent'],
            requiredFields: [],
            requiresAuth: true,
            category: 'host',
            skipInAutoTest: true
        }
    ],

    // -------------------------------------------------------------------------
    // BLOG ENDPOINTS
    // -------------------------------------------------------------------------
    blog: [
        {
            name: 'Get All Blogs',
            method: 'GET',
            path: '/api/blogs',
            expectedStatus: [200],
            frontendComponents: ['BlogsComponent', 'BlogDetailComponent'],
            requiredFields: [],
            category: 'blog'
        },
        {
            name: 'Get Blog Categories',
            method: 'GET',
            path: '/api/blogs/categories',
            expectedStatus: [200],
            frontendComponents: ['BlogsComponent'],
            requiredFields: [],
            category: 'blog'
        },
        {
            name: 'Get Single Blog',
            method: 'GET',
            path: '/api/blogs/1',
            expectedStatus: [200, 404],
            frontendComponents: ['BlogDetailComponent'],
            requiredFields: [],
            category: 'blog'
        }
    ],

    // -------------------------------------------------------------------------
    // COLLECTION ENDPOINTS
    // -------------------------------------------------------------------------
    collection: [
        {
            name: 'Get All Collections',
            method: 'GET',
            path: '/api/collections',
            expectedStatus: [200],
            frontendComponents: ['CollectionsComponent'],
            requiredFields: [],
            category: 'collection'
        },
        {
            name: 'Get Single Collection',
            method: 'GET',
            path: '/api/collections/1',
            expectedStatus: [200, 404],
            frontendComponents: ['CollectionDetailComponent'],
            requiredFields: [],
            category: 'collection'
        }
    ],

    // -------------------------------------------------------------------------
    // DESTINATION ENDPOINTS
    // -------------------------------------------------------------------------
    destination: [
        {
            name: 'Get All Destinations',
            method: 'GET',
            path: '/api/destinations',
            expectedStatus: [200],
            frontendComponents: ['AdminService', 'AddNewPropertyComponent'],
            requiredFields: [],
            category: 'destination'
        },
        {
            name: 'Get Single Destination',
            method: 'GET',
            path: '/api/destinations/1',
            expectedStatus: [200, 404],
            frontendComponents: [],
            requiredFields: [],
            category: 'destination'
        }
    ],

    // -------------------------------------------------------------------------
    // FORM ENDPOINTS
    // -------------------------------------------------------------------------
    form: [
        {
            name: 'Get Form Settings',
            method: 'GET',
            path: '/api/ext/formSettings',
            expectedStatus: [200],
            frontendComponents: ['NewHomeComponent', 'HostComponent'],
            requiredFields: [],
            category: 'form'
        },
        {
            name: 'Submit Form',
            method: 'POST',
            path: '/api/ext/submitForm',
            body: {
                name: 'Test User',
                email: 'test@test.com',
                phone: '9999999999',
                message: 'Test message'
            },
            expectedStatus: [200, 400],
            frontendComponents: ['HostComponent', 'ContactUsComponent', 'NewHomeComponent'],
            requiredFields: ['success'],
            category: 'form',
            skipInAutoTest: true // Don't spam form submissions
        }
    ],

    // -------------------------------------------------------------------------
    // SETTINGS ENDPOINTS
    // -------------------------------------------------------------------------
    settings: [
        {
            name: 'Get Settings',
            method: 'GET',
            path: '/api/settings',
            expectedStatus: [200],
            frontendComponents: ['SettingsComponent'],
            requiredFields: [],
            category: 'settings'
        }
    ],

    // -------------------------------------------------------------------------
    // ADMIN ENDPOINTS
    // -------------------------------------------------------------------------
    admin: [
        {
            name: 'Admin Dashboard',
            method: 'GET',
            path: '/admin/',
            expectedStatus: [200, 302, 401],
            frontendComponents: ['AdminDashboardComponent'],
            requiredFields: [],
            requiresAuth: true,
            category: 'admin'
        },
        {
            name: 'Admin Me',
            method: 'GET',
            path: '/admin/me',
            expectedStatus: [200, 401],
            frontendComponents: ['AdminDashboardComponent'],
            requiredFields: [],
            requiresAuth: true,
            category: 'admin'
        },
        {
            name: 'Admin Revenues',
            method: 'GET',
            path: '/admin/revenues',
            expectedStatus: [200, 401],
            frontendComponents: ['RevenueComponent'],
            requiredFields: [],
            requiresAuth: true,
            category: 'admin'
        },
        {
            name: 'Admin Bookings',
            method: 'GET',
            path: '/admin/bookings',
            expectedStatus: [200, 401],
            frontendComponents: ['BookingsComponent'],
            requiredFields: [],
            requiresAuth: true,
            category: 'admin'
        },
        {
            name: 'Admin Guests',
            method: 'GET',
            path: '/admin/guests',
            expectedStatus: [200, 401],
            frontendComponents: ['GuestsComponent'],
            requiredFields: [],
            requiresAuth: true,
            category: 'admin'
        },
        {
            name: 'Admin Services',
            method: 'GET',
            path: '/admin/services',
            expectedStatus: [200, 401],
            frontendComponents: ['CustomerServiceComponent'],
            requiredFields: [],
            requiresAuth: true,
            category: 'admin'
        }
    ]
};

// ============================================================================
// TEST RUNNER CLASS
// ============================================================================

class APITestRunner {
    constructor(config) {
        this.config = config;
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            errors: [],
            details: [],
            frontendImpact: {},
            timestamp: new Date().toISOString()
        };
        this.authToken = null;
    }

    async run() {
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║          TheStayMaster API Test Runner                     ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log(`║  Base URL: ${this.config.baseUrl.padEnd(46)}║`);
        console.log(`║  Category: ${this.config.category.padEnd(46)}║`);
        console.log('╚════════════════════════════════════════════════════════════╝\n');

        // Get all endpoints to test
        const endpoints = this.getEndpointsToTest();
        this.results.total = endpoints.length;

        console.log(`Testing ${endpoints.length} endpoints...\n`);

        for (const endpoint of endpoints) {
            await this.testEndpoint(endpoint);
        }

        this.printSummary();

        if (this.config.saveReport) {
            await this.saveReport();
        }

        return this.results;
    }

    getEndpointsToTest() {
        let endpoints = [];

        if (this.config.category === 'all') {
            Object.values(API_ENDPOINTS).forEach(categoryEndpoints => {
                endpoints = endpoints.concat(categoryEndpoints);
            });
        } else if (API_ENDPOINTS[this.config.category]) {
            endpoints = API_ENDPOINTS[this.config.category];
        }

        return endpoints.filter(e => !e.skipInAutoTest);
    }

    async testEndpoint(endpoint) {
        const startTime = Date.now();
        const result = {
            name: endpoint.name,
            method: endpoint.method,
            path: endpoint.path,
            category: endpoint.category,
            frontendComponents: endpoint.frontendComponents,
            status: 'pending',
            responseStatus: null,
            responseTime: null,
            error: null,
            responseStructure: null
        };

        try {
            const url = `${this.config.baseUrl}${endpoint.path}`;
            const options = {
                method: endpoint.method,
                url: url,
                timeout: this.config.timeout,
                validateStatus: () => true, // Don't throw on any status
                headers: {}
            };

            if (endpoint.body && ['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
                options.data = endpoint.body;
                options.headers['Content-Type'] = 'application/json';
            }

            if (endpoint.requiresAuth && this.authToken) {
                options.headers['Authorization'] = `Bearer ${this.authToken}`;
            }

            const response = await axios(options);
            const responseTime = Date.now() - startTime;

            result.responseStatus = response.status;
            result.responseTime = responseTime;
            result.responseStructure = this.getResponseStructure(response.data);

            // Check if status is expected
            if (endpoint.expectedStatus.includes(response.status)) {
                result.status = 'passed';
                this.results.passed++;
                this.printResult('✓', endpoint.name, response.status, responseTime, 'green');
            } else {
                result.status = 'failed';
                result.error = `Unexpected status: ${response.status} (expected: ${endpoint.expectedStatus.join(', ')})`;
                this.results.failed++;
                this.results.errors.push({
                    endpoint: endpoint.name,
                    error: result.error
                });
                this.printResult('✗', endpoint.name, response.status, responseTime, 'red');

                // Track frontend impact
                this.trackFrontendImpact(endpoint, result.error);
            }

            // Check required fields
            if (result.status === 'passed' && endpoint.requiredFields.length > 0) {
                const missingFields = this.checkRequiredFields(response.data, endpoint.requiredFields);
                if (missingFields.length > 0) {
                    result.status = 'failed';
                    result.error = `Missing required fields: ${missingFields.join(', ')}`;
                    this.results.passed--;
                    this.results.failed++;
                    this.results.errors.push({
                        endpoint: endpoint.name,
                        error: result.error
                    });
                    this.trackFrontendImpact(endpoint, result.error);
                }
            }

        } catch (error) {
            result.status = 'error';
            result.error = error.message;
            result.responseTime = Date.now() - startTime;
            this.results.failed++;
            this.results.errors.push({
                endpoint: endpoint.name,
                error: error.message
            });
            this.printResult('✗', endpoint.name, 'ERR', result.responseTime, 'red');
            this.trackFrontendImpact(endpoint, error.message);
        }

        this.results.details.push(result);
    }

    getResponseStructure(data) {
        if (data === null || data === undefined) return 'null';
        if (Array.isArray(data)) {
            return `array[${data.length}]${data.length > 0 ? `: ${Object.keys(data[0] || {}).slice(0, 5).join(', ')}...` : ''}`;
        }
        if (typeof data === 'object') {
            return Object.keys(data).slice(0, 10).join(', ');
        }
        return typeof data;
    }

    checkRequiredFields(data, requiredFields) {
        const missing = [];
        for (const field of requiredFields) {
            if (data === null || data === undefined || !(field in data)) {
                missing.push(field);
            }
        }
        return missing;
    }

    trackFrontendImpact(endpoint, error) {
        for (const component of endpoint.frontendComponents) {
            if (!this.results.frontendImpact[component]) {
                this.results.frontendImpact[component] = [];
            }
            this.results.frontendImpact[component].push({
                endpoint: endpoint.path,
                method: endpoint.method,
                error: error
            });
        }
    }

    printResult(icon, name, status, time, color) {
        const colors = {
            green: '\x1b[32m',
            red: '\x1b[31m',
            yellow: '\x1b[33m',
            reset: '\x1b[0m'
        };
        const c = colors[color] || '';
        const r = colors.reset;

        const statusStr = String(status).padEnd(4);
        const timeStr = `${time}ms`.padStart(7);
        console.log(`  ${c}${icon}${r} ${name.padEnd(45)} ${statusStr} ${timeStr}`);

        if (this.config.verbose && status === 'ERR') {
            console.log(`      └─ Error details logged`);
        }
    }

    printSummary() {
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║                      TEST SUMMARY                          ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log(`║  Total:   ${String(this.results.total).padEnd(47)}║`);
        console.log(`║  \x1b[32mPassed:  ${String(this.results.passed).padEnd(47)}\x1b[0m║`);
        console.log(`║  \x1b[31mFailed:  ${String(this.results.failed).padEnd(47)}\x1b[0m║`);
        console.log(`║  Skipped: ${String(this.results.skipped).padEnd(47)}║`);
        console.log('╚════════════════════════════════════════════════════════════╝');

        // Print frontend impact
        const impactedComponents = Object.keys(this.results.frontendImpact);
        if (impactedComponents.length > 0) {
            console.log('\n╔════════════════════════════════════════════════════════════╗');
            console.log('║              FRONTEND COMPONENTS IMPACTED                  ║');
            console.log('╠════════════════════════════════════════════════════════════╣');
            for (const component of impactedComponents) {
                const issues = this.results.frontendImpact[component];
                console.log(`║  \x1b[33m${component.padEnd(56)}\x1b[0m║`);
                for (const issue of issues) {
                    console.log(`║    └─ ${issue.method} ${issue.endpoint.substring(0, 45).padEnd(45)}║`);
                }
            }
            console.log('╚════════════════════════════════════════════════════════════╝');
        }

        // Print errors
        if (this.results.errors.length > 0 && this.config.verbose) {
            console.log('\n╔════════════════════════════════════════════════════════════╗');
            console.log('║                      ERROR DETAILS                         ║');
            console.log('╠════════════════════════════════════════════════════════════╣');
            for (const err of this.results.errors) {
                console.log(`║  ${err.endpoint.substring(0, 56).padEnd(56)}║`);
                console.log(`║    └─ ${err.error.substring(0, 51).padEnd(51)}║`);
            }
            console.log('╚════════════════════════════════════════════════════════════╝');
        }
    }

    async saveReport() {
        const reportDir = path.join(__dirname, '../test-reports');
        if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportPath = path.join(reportDir, `api-test-report-${timestamp}.json`);

        fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
        console.log(`\n📄 Report saved: ${reportPath}`);

        // Also save HTML report
        const htmlPath = path.join(reportDir, `api-test-report-${timestamp}.html`);
        fs.writeFileSync(htmlPath, this.generateHTMLReport());
        console.log(`📄 HTML Report saved: ${htmlPath}`);
    }

    generateHTMLReport() {
        const passRate = ((this.results.passed / this.results.total) * 100).toFixed(1);

        return `<!DOCTYPE html>
<html>
<head>
    <title>API Test Report - TheStayMaster</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .stat { padding: 20px; border-radius: 8px; text-align: center; flex: 1; }
        .stat.total { background: #e3f2fd; }
        .stat.passed { background: #e8f5e9; }
        .stat.failed { background: #ffebee; }
        .stat h2 { margin: 0; font-size: 36px; }
        .stat p { margin: 5px 0 0; color: #666; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f8f9fa; font-weight: bold; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .impact { background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .impact h3 { margin-top: 0; color: #856404; }
        .component { background: #ffeeba; padding: 10px; margin: 10px 0; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 API Test Report</h1>
        <p>Generated: ${this.results.timestamp}</p>

        <div class="summary">
            <div class="stat total">
                <h2>${this.results.total}</h2>
                <p>Total Tests</p>
            </div>
            <div class="stat passed">
                <h2>${this.results.passed}</h2>
                <p>Passed (${passRate}%)</p>
            </div>
            <div class="stat failed">
                <h2>${this.results.failed}</h2>
                <p>Failed</p>
            </div>
        </div>

        <h2>Test Results</h2>
        <table>
            <tr>
                <th>Endpoint</th>
                <th>Method</th>
                <th>Path</th>
                <th>Status</th>
                <th>Response</th>
                <th>Time</th>
            </tr>
            ${this.results.details.map(d => `
            <tr>
                <td>${d.name}</td>
                <td>${d.method}</td>
                <td>${d.path}</td>
                <td class="${d.status}">${d.status.toUpperCase()}</td>
                <td>${d.responseStatus || 'N/A'}</td>
                <td>${d.responseTime}ms</td>
            </tr>
            `).join('')}
        </table>

        ${Object.keys(this.results.frontendImpact).length > 0 ? `
        <div class="impact">
            <h3>⚠️ Frontend Components Requiring Updates</h3>
            ${Object.entries(this.results.frontendImpact).map(([component, issues]) => `
            <div class="component">
                <strong>${component}</strong>
                <ul>
                    ${issues.map(i => `<li>${i.method} ${i.endpoint}: ${i.error}</li>`).join('')}
                </ul>
            </div>
            `).join('')}
        </div>
        ` : ''}

        ${this.results.errors.length > 0 ? `
        <h2>Error Details</h2>
        <table>
            <tr><th>Endpoint</th><th>Error</th></tr>
            ${this.results.errors.map(e => `
            <tr><td>${e.endpoint}</td><td>${e.error}</td></tr>
            `).join('')}
        </table>
        ` : ''}
    </div>
</body>
</html>`;
    }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
    const runner = new APITestRunner(CONFIG);

    try {
        await runner.run();
        process.exit(runner.results.failed > 0 ? 1 : 0);
    } catch (error) {
        console.error('Test runner failed:', error);
        process.exit(1);
    }
}

main();
