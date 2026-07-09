/**
 * Quick Health Check Script
 *
 * Quickly validates that the backend is running and critical endpoints respond.
 *
 * Usage:
 *   node scripts/quick-health-check.js [BASE_URL]
 *
 * Example:
 *   node scripts/quick-health-check.js http://localhost:3000
 */

const axios = require('axios');

const BASE_URL = process.argv[2] || 'http://localhost:3000';

const CRITICAL_ENDPOINTS = [
    { method: 'GET', path: '/api/properties/settings', name: 'Property Settings' },
    { method: 'GET', path: '/api/destinations', name: 'Destinations' },
    { method: 'GET', path: '/api/blogs', name: 'Blogs' },
    { method: 'GET', path: '/api/collections', name: 'Collections' },
    { method: 'GET', path: '/api/ext/formSettings', name: 'Form Settings' },
    { method: 'POST', path: '/api/ext/hostCalculatorSettings', name: 'Host Calculator' }
];

async function checkHealth() {
    console.log('\n🏥 Quick Health Check');
    console.log('━'.repeat(50));
    console.log(`Base URL: ${BASE_URL}\n`);

    let passed = 0;
    let failed = 0;

    for (const endpoint of CRITICAL_ENDPOINTS) {
        try {
            const start = Date.now();
            const response = await axios({
                method: endpoint.method,
                url: `${BASE_URL}${endpoint.path}`,
                timeout: 5000,
                validateStatus: () => true
            });
            const time = Date.now() - start;

            if (response.status >= 200 && response.status < 400) {
                console.log(`✅ ${endpoint.name.padEnd(25)} ${response.status}  ${time}ms`);
                passed++;
            } else {
                console.log(`⚠️  ${endpoint.name.padEnd(25)} ${response.status}  ${time}ms`);
                failed++;
            }
        } catch (error) {
            console.log(`❌ ${endpoint.name.padEnd(25)} ERR  ${error.message}`);
            failed++;
        }
    }

    console.log('\n' + '━'.repeat(50));
    console.log(`Results: ${passed} passed, ${failed} failed`);

    if (failed === 0) {
        console.log('✅ All critical endpoints are healthy!\n');
        process.exit(0);
    } else {
        console.log('❌ Some endpoints have issues!\n');
        process.exit(1);
    }
}

checkHealth().catch(err => {
    console.error('Health check failed:', err.message);
    process.exit(1);
});
