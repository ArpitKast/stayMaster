#!/usr/bin/env node

/**
 * API Testing Script
 * Tests all API endpoints to verify they are working properly
 * 
 * Usage: node scripts/api-test.js [--base-url=http://localhost:8080]
 */

require('dotenv').config();
const axios = require('axios');

// Simple color functions
const colorize = {
    green: (str) => `\x1b[32m${str}\x1b[0m`,
    red: (str) => `\x1b[31m${str}\x1b[0m`,
    yellow: (str) => `\x1b[33m${str}\x1b[0m`,
    cyan: (str) => `\x1b[36m${str}\x1b[0m`,
    gray: (str) => `\x1b[90m${str}\x1b[0m`,
    bold: (str) => `\x1b[1m${str}\x1b[0m`
};

// Helper to chain colors
function color(str) {
    return {
        green: () => colorize.green(str),
        red: () => colorize.red(str),
        yellow: () => colorize.yellow(str),
        cyan: () => colorize.cyan(str),
        gray: () => colorize.gray(str),
        bold: () => colorize.bold(str)
    };
}

// Configuration
const BASE_URL = process.argv.find(arg => arg.startsWith('--base-url='))?.split('=')[1] || process.env.API_BASE_URL || 'http://127.0.0.1:8080';
const TIMEOUT = 10000; // 10 seconds

// Check if server is running before starting tests
async function checkServerRunning() {
    try {
        const response = await axios.get(`${BASE_URL}/api/ext/generateToken`, { 
            timeout: 2000,
            family: 4 // Force IPv4
        });
        return true;
    } catch (error) {
        return false;
    }
}

// Test results
let passed = 0;
let failed = 0;
let skipped = 0;
const results = [];

// Helper function to make API calls
async function testEndpoint(name, method, url, data = null, headers = {}) {
    const startTime = Date.now();
    try {
        const config = {
            method,
            url: `${BASE_URL}${url}`,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            timeout: TIMEOUT,
            validateStatus: () => true, // Don't throw on any status
            family: 4 // Force IPv4 to avoid IPv6 connection issues
        };

        if (data) {
            config.data = data;
        }

        const response = await axios(config);
        const duration = Date.now() - startTime;

        // Check if response follows Response helper format
        const hasResponseFormat = response.data && (
            (response.data.success !== undefined) || 
            (response.data.error !== undefined) ||
            (response.status >= 200 && response.status < 300)
        );

        if (response.status >= 200 && response.status < 500) {
            passed++;
            results.push({
                name,
                status: 'PASS',
                statusCode: response.status,
                duration,
                hasResponseFormat
            });
            console.log(colorize.green(`✓ ${name}`), colorize.gray(`(${response.status})`), colorize.gray(`${duration}ms`));
            return { success: true, response };
        } else {
            failed++;
            results.push({
                name,
                status: 'FAIL',
                statusCode: response.status,
                duration,
                error: `Status ${response.status}`
            });
            console.log(colorize.red(`✗ ${name}`), colorize.red(`(${response.status})`));
            return { success: false, response };
        }
    } catch (error) {
        const duration = Date.now() - startTime;
        failed++;
        results.push({
            name,
            status: 'FAIL',
            duration,
            error: error.message
        });
        console.log(colorize.red(`✗ ${name}`), colorize.red(`- ${error.message}`));
        return { success: false, error };
    }
}

// Get auth token for protected routes
let authToken = null;
let guestToken = null;

async function getAuthToken() {
    try {
        // Try to login or generate token
        const response = await axios.get(`${BASE_URL}/api/ext/generateToken`, {
            timeout: 5000,
            family: 4 // Force IPv4
        });
        if (response.data && response.data.data && response.data.data.token) {
            authToken = response.data.data.token;
            return authToken;
        }
    } catch (error) {
        console.log(colorize.yellow('Warning: Could not get auth token'));
    }
    return null;
}

// Test Suite
async function runTests() {
    console.log('\n' + colorize.cyan('='.repeat(60)));
    console.log(colorize.bold(colorize.cyan('API Testing Suite')));
    console.log(colorize.cyan('='.repeat(60)));
    console.log(colorize.gray(`Base URL: ${BASE_URL}`));
    console.log(colorize.gray(`Testing at: ${new Date().toLocaleString()}\n`));

    // Check if server is running
    console.log(colorize.yellow('Checking if server is running...'));
    const serverRunning = await checkServerRunning();
    if (!serverRunning) {
        console.log(colorize.red('\n❌ ERROR: Server is not running!'));
        console.log(colorize.yellow('\nPlease start the server first:'));
        console.log(colorize.gray('  npm start'));
        console.log(colorize.gray('  or'));
        console.log(colorize.gray('  npm run dev'));
        console.log(colorize.yellow('\nThen run this test script again.\n'));
        process.exit(1);
    }
    console.log(colorize.green('✓ Server is running\n'));

    // Get auth token
    console.log(colorize.gray('Getting authentication token...'));
    authToken = await getAuthToken();
    if (authToken) {
        console.log(colorize.green('✓ Auth token obtained\n'));
    } else {
        console.log(colorize.yellow('⚠ No auth token, some tests will be skipped\n'));
    }

    const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};

    // ==================== USER APIs ====================
    console.log('\n' + colorize.bold('📋 USER APIs'));
    console.log(colorize.gray('-'.repeat(60)));

    await testEndpoint('POST /api/users/register', 'POST', '/api/users/register', {
        firstname: 'Test',
        lastname: 'User',
        email: `test${Date.now()}@example.com`,
        password: 'Test123!@#'
    });

    await testEndpoint('POST /api/users/login', 'POST', '/api/users/login', {
        email: 'test@example.com',
        password: 'test123'
    });

    if (authToken) {
        await testEndpoint('GET /api/users/current', 'GET', '/api/users/current', null, headers);
    }

    // ==================== API EXT Routes ====================
    console.log('\n' + colorize.bold('📋 API EXT Routes'));
    console.log(colorize.gray('-'.repeat(60)));

    await testEndpoint('GET /api/ext/generateToken', 'GET', '/api/ext/generateToken');

    await testEndpoint('POST /api/ext/checkAvailability', 'POST', '/api/ext/checkAvailability', {
        check_in_date: '2025-12-01',
        check_out_date: '2025-12-05',
        number_adults: 2,
        number_children: 0
    });

    await testEndpoint('POST /api/ext/homeAvailability', 'POST', '/api/ext/homeAvailability', {
        check_in_date: '2025-12-01',
        check_out_date: '2025-12-05',
        number_adults: 2,
        number_children: 0
    });

    await testEndpoint('POST /api/ext/generateOTP', 'POST', '/api/ext/generateOTP', {
        phone: '+919876543210'
    });

    if (authToken) {
        await testEndpoint('GET /api/ext/check', 'GET', '/api/ext/check', null, headers);
        await testEndpoint('POST /api/ext/getProfile', 'POST', '/api/ext/getProfile', {
            id: 1
        }, headers);
    }

    // ==================== AVAILABILITY APIs ====================
    console.log('\n' + colorize.bold('📋 AVAILABILITY APIs'));
    console.log(colorize.gray('-'.repeat(60)));

    await testEndpoint('POST /api/ext/availabilityAndDetails', 'POST', '/api/ext/availabilityAndDetails', {
        property_id: 1,
        check_in_date: '2025-12-01',
        check_out_date: '2025-12-05',
        number_adults: 2,
        number_children: 0
    });

    await testEndpoint('POST /api/ext/calendarAvailability', 'POST', '/api/ext/calendarAvailability', {
        property_id: 1
    });

    // ==================== DESTINATION APIs ====================
    console.log('\n' + colorize.bold('📋 DESTINATION APIs'));
    console.log(colorize.gray('-'.repeat(60)));

    await testEndpoint('GET /api/destinations', 'GET', '/api/destinations');

    // ==================== BANNER APIs ====================
    console.log('\n' + colorize.bold('📋 BANNER APIs'));
    console.log(colorize.gray('-'.repeat(60)));

    await testEndpoint('GET /api/banners', 'GET', '/api/banners');
    await testEndpoint('GET /api/banners?active_only=true', 'GET', '/api/banners?active_only=true');

    // ==================== BLOG APIs ====================
    console.log('\n' + colorize.bold('📋 BLOG APIs'));
    console.log(colorize.gray('-'.repeat(60)));

    await testEndpoint('GET /api/blogs', 'GET', '/api/blogs');
    await testEndpoint('GET /api/blogs/featured', 'GET', '/api/blogs/featured');

    // ==================== COLLECTION APIs ====================
    console.log('\n' + colorize.bold('📋 COLLECTION APIs'));
    console.log(colorize.gray('-'.repeat(60)));

    await testEndpoint('GET /api/collections', 'GET', '/api/collections');

    // ==================== CONTACT APIs ====================
    console.log('\n' + colorize.bold('📋 CONTACT APIs'));
    console.log(colorize.gray('-'.repeat(60)));

    await testEndpoint('POST /api/contacts', 'POST', '/api/contacts', {
        name: 'Test User',
        email: 'test@example.com',
        phone: '1234567890',
        message: 'Test message'
    });

    // ==================== LEAD APIs ====================
    console.log('\n' + colorize.bold('📋 LEAD APIs'));
    console.log(colorize.gray('-'.repeat(60)));

    await testEndpoint('POST /api/leads', 'POST', '/api/leads', {
        name: 'Test Lead',
        phone: '1234567890',
        email: 'lead@example.com',
        message: 'Test lead message',
        lead_source: 'form'
    });

    // ==================== SETTINGS APIs ====================
    console.log('\n' + colorize.bold('📋 SETTINGS APIs'));
    console.log(colorize.gray('-'.repeat(60)));

    await testEndpoint('GET /api/settings', 'GET', '/api/settings');
    await testEndpoint('GET /api/settings/form', 'GET', '/api/settings/form');

    // ==================== HOST APIs ====================
    console.log('\n' + colorize.bold('📋 HOST APIs'));
    console.log(colorize.gray('-'.repeat(60)));

    await testEndpoint('POST /api/hosts/generateOTP', 'POST', '/api/hosts/generateOTP', {
        phone: '+919876543210'
    });

    await testEndpoint('GET /api/hosts/hostCalculatorSettings', 'GET', '/api/hosts/hostCalculatorSettings');

    // ==================== INSTAGRAM APIs ====================
    console.log('\n' + colorize.bold('📋 INSTAGRAM APIs'));
    console.log(colorize.gray('-'.repeat(60)));

    await testEndpoint('GET /api/ext/instagram/reels', 'GET', '/api/ext/instagram/reels');

    // ==================== FORMS APIs ====================
    console.log('\n' + colorize.bold('📋 FORMS APIs'));
    console.log(colorize.gray('-'.repeat(60)));

    await testEndpoint('POST /api/ext/submitForm', 'POST', '/api/ext/submitForm', {
        form_type: 'contact_us',
        name: 'Test User',
        email: 'test@example.com',
        phone: '1234567890',
        comment: 'Test comment'
    });

    await testEndpoint('GET /api/ext/formSettings', 'GET', '/api/ext/formSettings');

    // ==================== Summary ====================
    console.log('\n' + colorize.cyan('='.repeat(60)));
    console.log(colorize.bold(colorize.cyan('TEST SUMMARY')));
    console.log(colorize.cyan('='.repeat(60)));
    console.log(colorize.gray(`Total Tests: ${passed + failed}`));
    console.log(colorize.bold(colorize.green(`Passed: ${passed}`)));
    console.log(colorize.bold(colorize.red(`Failed: ${failed}`)));
    console.log(colorize.bold(colorize.yellow(`Skipped: ${skipped}`)));

    // Response format check
    const withResponseFormat = results.filter(r => r.hasResponseFormat).length;
    const withoutResponseFormat = results.filter(r => r.hasResponseFormat === false).length;
    
    if (withResponseFormat > 0 || withoutResponseFormat > 0) {
        console.log('\n' + colorize.bold('📊 Response Format Analysis'));
        console.log(colorize.green(`Using Response Helper: ${withResponseFormat}`));
        console.log(colorize.yellow(`Not using Response Helper: ${withoutResponseFormat}`));
    }

    // Failed tests details
    const failedTests = results.filter(r => r.status === 'FAIL');
    if (failedTests.length > 0) {
        console.log('\n' + colorize.bold(colorize.red('❌ Failed Tests:')));
        failedTests.forEach(test => {
            console.log(colorize.red(`  - ${test.name}`));
            if (test.error) {
                console.log(colorize.gray(`    Error: ${test.error}`));
            }
        });
    }

    console.log('\n' + colorize.cyan('='.repeat(60)));
    
    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
    console.error('Fatal error running tests:', error);
    process.exit(1);
});

