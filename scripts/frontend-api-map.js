/**
 * Frontend to API Mapping
 *
 * This file documents which frontend components depend on which API endpoints.
 * Use this to identify frontend changes needed when APIs are modified.
 *
 * Usage:
 *   node scripts/frontend-api-map.js [--component=NAME] [--endpoint=PATH] [--format=json|table]
 */

// ============================================================================
// FRONTEND COMPONENT TO API MAPPING
// ============================================================================

const FRONTEND_API_MAP = {
    // -------------------------------------------------------------------------
    // AUTHENTICATION COMPONENTS
    // -------------------------------------------------------------------------
    'LoginComponent': {
        path: 'frontend/src/app/pages/login/login.component.ts',
        endpoints: [
            { method: 'POST', path: '/api/ext/generateOTP', purpose: 'Send OTP to phone' },
            { method: 'POST', path: '/api/ext/loginWithOTP', purpose: 'Verify OTP and login' }
        ],
        dependencies: ['ApiService', 'DataService'],
        notes: 'Uses same OTP flow as ConfirmBookingComponent - candidate for shared component'
    },

    'AdminLoginComponent': {
        path: 'frontend/src/app/admin/admin-login/admin-login.component.ts',
        endpoints: [
            { method: 'POST', path: '/api/users/login', purpose: 'Admin authentication' },
            { method: 'GET', path: '/api/properties/settingsWithUsers', purpose: 'Get property settings' }
        ],
        dependencies: ['AdminService', 'DataService'],
        notes: ''
    },

    // -------------------------------------------------------------------------
    // BOOKING COMPONENTS
    // -------------------------------------------------------------------------
    'ConfirmBookingComponent': {
        path: 'frontend/src/app/pages/booking/confirm-booking/confirm-booking.component.ts',
        endpoints: [
            { method: 'POST', path: '/api/ext/generateOTP', purpose: 'Send OTP for booking' },
            { method: 'POST', path: '/api/ext/loginWithOTP', purpose: 'Verify OTP' },
            { method: 'POST', path: '/api/ext/createBooking', purpose: 'Create booking' },
            { method: 'POST', path: '/api/ext/generateOrderId', purpose: 'RazorPay order ID' }
        ],
        dependencies: ['ApiService', 'DataService'],
        notes: 'Critical booking flow - test thoroughly after any API changes'
    },

    'ConfirmedBookingComponent': {
        path: 'frontend/src/app/pages/booking/confirmed-booking/confirmed-booking.component.ts',
        endpoints: [
            { method: 'GET', path: '/api/ext/myBooking/:id', purpose: 'Get booking details' }
        ],
        dependencies: ['ApiService'],
        notes: ''
    },

    // -------------------------------------------------------------------------
    // PROPERTY/STAY COMPONENTS
    // -------------------------------------------------------------------------
    'StayComponent': {
        path: 'frontend/src/app/pages/stay/stay.component.ts',
        endpoints: [
            { method: 'GET', path: '/api/properties/settings', purpose: 'Get property list' },
            { method: 'POST', path: '/api/ext/checkAvailability', purpose: 'Check availability' }
        ],
        dependencies: ['ApiService'],
        notes: ''
    },

    'StayDescriptionComponent': {
        path: 'frontend/src/app/pages/stay-description/stay-description.component.ts',
        endpoints: [
            { method: 'POST', path: '/api/ext/availabilityAndDetails', purpose: 'Get property details with availability' }
        ],
        dependencies: ['ApiService'],
        notes: 'Called twice in component - potential optimization'
    },

    'StayDestinationComponent': {
        path: 'frontend/src/app/modal/stay-destination/stay-destination.component.ts',
        endpoints: [
            { method: 'POST', path: '/api/ext/calendarAvailability', purpose: 'Calendar data' },
            { method: 'POST', path: '/api/ext/calendarAvailabilityImproved', purpose: 'Enhanced calendar data' }
        ],
        dependencies: ['ApiService'],
        notes: ''
    },

    'AllPropertiesComponent': {
        path: 'frontend/src/app/pages/all-properties/all-properties.component.ts',
        endpoints: [
            { method: 'GET', path: '/api/properties/settings', purpose: 'Get all properties' }
        ],
        dependencies: ['ApiService'],
        notes: ''
    },

    // -------------------------------------------------------------------------
    // HOME COMPONENTS
    // -------------------------------------------------------------------------
    'NewHomeComponent': {
        path: 'frontend/src/app/pages/new-home/new-home.component.ts',
        endpoints: [
            { method: 'POST', path: '/api/ext/homeAvailability', purpose: 'Home page search' },
            { method: 'GET', path: '/api/properties/settings', purpose: 'Property settings' },
            { method: 'GET', path: '/api/ext/formSettings', purpose: 'Form configuration' },
            { method: 'POST', path: '/api/ext/submitForm', purpose: 'Submit enquiry form' }
        ],
        dependencies: ['ApiService'],
        notes: 'Main landing page - critical component'
    },

    // -------------------------------------------------------------------------
    // HOST COMPONENTS
    // -------------------------------------------------------------------------
    'HostComponent': {
        path: 'frontend/src/app/pages/host/host.component.ts',
        endpoints: [
            { method: 'POST', path: '/api/ext/hostEnquiry', purpose: 'Submit host enquiry' },
            { method: 'POST', path: '/api/ext/hostCalculatorSettings', purpose: 'Earnings calculator config' },
            { method: 'POST', path: '/api/ext/generateHostOTP', purpose: 'Host OTP' },
            { method: 'GET', path: '/api/ext/formSettings', purpose: 'Form configuration' },
            { method: 'POST', path: '/api/ext/submitForm', purpose: 'Submit form' }
        ],
        dependencies: ['ApiService'],
        notes: ''
    },

    // -------------------------------------------------------------------------
    // USER COMPONENTS
    // -------------------------------------------------------------------------
    'ProfileComponent': {
        path: 'frontend/src/app/user/profile/profile.component.ts',
        endpoints: [
            { method: 'POST', path: '/api/ext/getProfile', purpose: 'Get user profile' },
            { method: 'POST', path: '/api/ext/updateProfile', purpose: 'Update user profile' }
        ],
        dependencies: ['ApiService', 'DataService'],
        notes: ''
    },

    'TripsComponent': {
        path: 'frontend/src/app/user/trips/trips.component.ts',
        endpoints: [
            { method: 'POST', path: '/api/ext/myTrips', purpose: 'Get user trips' }
        ],
        dependencies: ['ApiService'],
        notes: ''
    },

    // -------------------------------------------------------------------------
    // BLOG COMPONENTS
    // -------------------------------------------------------------------------
    'BlogsComponent': {
        path: 'frontend/src/app/pages/blogs/blogs.component.ts',
        endpoints: [
            { method: 'GET', path: '/api/blogs', purpose: 'Get all blogs' },
            { method: 'GET', path: '/api/blogs/categories', purpose: 'Get categories' }
        ],
        dependencies: ['HttpClient'],
        notes: 'Uses direct HttpClient instead of ApiService - inconsistent'
    },

    'BlogDetailComponent': {
        path: 'frontend/src/app/pages/blog-detail/blog-detail.component.ts',
        endpoints: [
            { method: 'GET', path: '/api/blogs/:id', purpose: 'Get single blog' },
            { method: 'GET', path: '/api/blogs', purpose: 'Get related blogs' }
        ],
        dependencies: ['HttpClient'],
        notes: 'Uses direct HttpClient instead of ApiService - inconsistent'
    },

    // -------------------------------------------------------------------------
    // CONTACT COMPONENTS
    // -------------------------------------------------------------------------
    'ContactUsComponent': {
        path: 'frontend/src/app/pages/contact-us/contact-us.component.ts',
        endpoints: [
            { method: 'POST', path: '/api/ext/submitForm', purpose: 'Submit contact form' }
        ],
        dependencies: ['ApiService'],
        notes: ''
    },

    // -------------------------------------------------------------------------
    // ADMIN COMPONENTS
    // -------------------------------------------------------------------------
    'DashboardComponent': {
        path: 'frontend/src/app/admin/dashboard/dashboard.component.ts',
        endpoints: [
            { method: 'GET', path: '/admin/', purpose: 'Dashboard data' },
            { method: 'GET', path: '/admin/revenues', purpose: 'Revenue stats' }
        ],
        dependencies: ['AdminService'],
        notes: ''
    },

    'BookingsComponent': {
        path: 'frontend/src/app/admin/bookings/bookings.component.ts',
        endpoints: [
            { method: 'GET', path: '/admin/bookings', purpose: 'Get bookings list' },
            { method: 'GET', path: '/admin/bookings/edit/:id', purpose: 'Edit booking' }
        ],
        dependencies: ['AdminService'],
        notes: ''
    },

    'GuestsComponent': {
        path: 'frontend/src/app/admin/guests/guests.component.ts',
        endpoints: [
            { method: 'GET', path: '/admin/guests', purpose: 'Get guests list' }
        ],
        dependencies: ['AdminService'],
        notes: ''
    },

    'CustomerServiceComponent': {
        path: 'frontend/src/app/admin/customer-service/customer-service.component.ts',
        endpoints: [
            { method: 'GET', path: '/admin/services', purpose: 'Get service requests' },
            { method: 'POST', path: '/admin/service/create', purpose: 'Create service request' },
            { method: 'POST', path: '/admin/service/updateStatus', purpose: 'Update status' }
        ],
        dependencies: ['AdminService'],
        notes: ''
    },

    'AddNewPropertyComponent': {
        path: 'frontend/src/app/admin/properties/add-new-property/add-new-property.component.ts',
        endpoints: [
            { method: 'GET', path: '/api/destinations', purpose: 'Get destinations' },
            { method: 'POST', path: '/api/properties/', purpose: 'Create property' }
        ],
        dependencies: ['AdminService', 'ApiService'],
        notes: ''
    }
};

// ============================================================================
// API TO FRONTEND REVERSE MAPPING
// ============================================================================

function generateAPIToFrontendMap() {
    const apiMap = {};

    for (const [component, data] of Object.entries(FRONTEND_API_MAP)) {
        for (const endpoint of data.endpoints) {
            const key = `${endpoint.method} ${endpoint.path}`;
            if (!apiMap[key]) {
                apiMap[key] = {
                    method: endpoint.method,
                    path: endpoint.path,
                    components: [],
                    purpose: endpoint.purpose
                };
            }
            apiMap[key].components.push({
                name: component,
                file: data.path
            });
        }
    }

    return apiMap;
}

// ============================================================================
// CLI FUNCTIONS
// ============================================================================

function findByComponent(componentName) {
    const component = FRONTEND_API_MAP[componentName];
    if (!component) {
        console.log(`Component "${componentName}" not found.`);
        console.log('Available components:', Object.keys(FRONTEND_API_MAP).join(', '));
        return null;
    }
    return { [componentName]: component };
}

function findByEndpoint(endpointPath) {
    const apiMap = generateAPIToFrontendMap();
    const results = {};

    for (const [key, data] of Object.entries(apiMap)) {
        if (data.path.includes(endpointPath)) {
            results[key] = data;
        }
    }

    return results;
}

function printTable(data) {
    console.log('\n' + '='.repeat(100));

    if (data.components) {
        // API to component format
        for (const [key, info] of Object.entries(data)) {
            console.log(`\n${info.method} ${info.path}`);
            console.log(`Purpose: ${info.purpose}`);
            console.log('Used by:');
            info.components.forEach(c => {
                console.log(`  - ${c.name} (${c.file})`);
            });
        }
    } else {
        // Component to API format
        for (const [name, info] of Object.entries(data)) {
            console.log(`\n📦 ${name}`);
            console.log(`   File: ${info.path}`);
            console.log('   Endpoints:');
            info.endpoints.forEach(e => {
                console.log(`     ${e.method.padEnd(6)} ${e.path}`);
                console.log(`            └─ ${e.purpose}`);
            });
            if (info.notes) {
                console.log(`   Notes: ${info.notes}`);
            }
        }
    }

    console.log('\n' + '='.repeat(100));
}

function printAllMappings() {
    console.log('\n╔════════════════════════════════════════════════════════════════════╗');
    console.log('║            FRONTEND COMPONENT → API ENDPOINT MAPPING              ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝\n');

    for (const [name, info] of Object.entries(FRONTEND_API_MAP)) {
        console.log(`\n📦 ${name}`);
        console.log(`   ${info.path}`);
        info.endpoints.forEach(e => {
            console.log(`   ├─ ${e.method.padEnd(6)} ${e.path}`);
        });
    }

    console.log('\n\n╔════════════════════════════════════════════════════════════════════╗');
    console.log('║            API ENDPOINT → FRONTEND COMPONENT MAPPING              ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝\n');

    const apiMap = generateAPIToFrontendMap();
    for (const [key, info] of Object.entries(apiMap)) {
        console.log(`\n🔗 ${info.method} ${info.path}`);
        info.components.forEach(c => {
            console.log(`   └─ ${c.name}`);
        });
    }
}

function generateImpactReport(changedEndpoints) {
    console.log('\n╔════════════════════════════════════════════════════════════════════╗');
    console.log('║                    FRONTEND IMPACT REPORT                         ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝\n');

    const apiMap = generateAPIToFrontendMap();
    const impactedComponents = new Set();

    for (const endpoint of changedEndpoints) {
        const key = Object.keys(apiMap).find(k => k.includes(endpoint));
        if (key && apiMap[key]) {
            console.log(`\n⚠️  Changed: ${key}`);
            console.log('   Impacted components:');
            apiMap[key].components.forEach(c => {
                impactedComponents.add(c.name);
                console.log(`   └─ ${c.name}`);
                console.log(`      File: ${c.file}`);
            });
        }
    }

    console.log('\n' + '─'.repeat(70));
    console.log(`\nTotal impacted components: ${impactedComponents.size}`);
    console.log('Components to update:', Array.from(impactedComponents).join(', '));
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

function main() {
    const args = process.argv.slice(2);
    let component = null;
    let endpoint = null;
    let format = 'table';

    args.forEach(arg => {
        if (arg.startsWith('--component=')) component = arg.split('=')[1];
        if (arg.startsWith('--endpoint=')) endpoint = arg.split('=')[1];
        if (arg.startsWith('--format=')) format = arg.split('=')[1];
    });

    if (component) {
        const result = findByComponent(component);
        if (result) {
            if (format === 'json') {
                console.log(JSON.stringify(result, null, 2));
            } else {
                printTable(result);
            }
        }
    } else if (endpoint) {
        const result = findByEndpoint(endpoint);
        if (format === 'json') {
            console.log(JSON.stringify(result, null, 2));
        } else {
            printTable(result);
        }
    } else {
        printAllMappings();
    }
}

// Export for use in other scripts
module.exports = {
    FRONTEND_API_MAP,
    generateAPIToFrontendMap,
    findByComponent,
    findByEndpoint,
    generateImpactReport
};

// Run if called directly
if (require.main === module) {
    main();
}
