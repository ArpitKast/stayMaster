const axios = require('axios');

// Test script to fix property inventory mapping
async function testFixInventory() {
    try {
        console.log('🔧 Testing Property Inventory Fix...\n');

        // Test fixing a specific property (Property ID 7 that was failing)
        console.log('1. Testing single property fix (Property ID 7):');
        const singlePropertyResponse = await axios.post('http://localhost:8085/api/properties/refresh-room-inventory', {
            property_id: '7'
        });
        
        console.log('✅ Single property fix result:', JSON.stringify(singlePropertyResponse.data, null, 2));
        console.log('\n');

        // Test fixing all properties
        console.log('2. Testing fix all properties:');
        const allPropertiesResponse = await axios.post('http://localhost:8085/api/properties/fix-all-inventories');
        
        console.log('✅ All properties fix result:', JSON.stringify(allPropertiesResponse.data, null, 2));
        console.log('\n');

        // Test blocking the previously failing property
        console.log('3. Testing block operation on Property ID 7:');
        const blockResponse = await axios.post('http://localhost:8085/api/hosts/block', {
            property_id: '7',
            blockType: 'Owner block',
            start: '2025-12-15',
            end: '2025-12-16',
            reason: 'Testing after fix',
            guestToken: 'test_token' // You'll need to provide a valid token
        });
        
        console.log('✅ Block operation result:', JSON.stringify(blockResponse.data, null, 2));

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

// Run the test
testFixInventory();

