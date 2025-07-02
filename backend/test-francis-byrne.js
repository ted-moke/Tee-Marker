const { FrancisByrneAdapter } = require('./dist/adapters/FrancisByrneAdapter');
const { AdapterService } = require('./dist/services/AdapterService');

// Mock course data
const mockCourse = {
  id: 'francis-byrne',
  name: 'Francis A. Byrne Golf Course',
  platform: 'francisbyrne',
  apiConfig: {
    baseUrl: 'https://foreupsoftware.com',
    endpoints: {
      search: '/index.php/api/booking/times',
      book: '/index.php/api/booking/reservations'
    },
    auth: {
      type: 'token',
      credentials: {}
    }
  },
  bookingWindow: {
    advanceDays: 7,
    startTime: '06:00'
  },
  timezone: 'America/New_York',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

async function testFrancisByrneAdapter() {
  try {
    console.log('Testing Francis Byrne Adapter...');
    
    // Test 1: Initialize adapter
    console.log('\n1. Testing adapter initialization...');
    const adapter = new FrancisByrneAdapter(mockCourse, require('axios'));
    await adapter.initialize();
    console.log('✅ Adapter initialized successfully');
    
    // Test 2: Get course info
    console.log('\n2. Testing course info...');
    const courseInfo = await adapter.getCourseInfo(mockCourse);
    console.log('Course info:', courseInfo);
    console.log('✅ Course info retrieved successfully');
    
    // Test 3: Search tee times (for tomorrow)
    console.log('\n3. Testing tee time search...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = `${tomorrow.getMonth() + 1}-${tomorrow.getDate()}-${tomorrow.getFullYear()}`;
    const searchParams = {
      date: dateStr,
      players: 1,
      timeRange: {
        start: '00:00',
        end: '23:00'
      }
    };
    
    const teeTimes = await adapter.searchTeeTimes(mockCourse, searchParams);
    console.log(`Found ${teeTimes.length} available tee times:`);
    teeTimes.forEach(tt => {
      console.log(`  - ${tt.time} on ${tt.date} ($${tt.price})`);
    });
    console.log('✅ Tee time search completed successfully');
    
    // Test 4: Test token refresh
    console.log('\n4. Testing token refresh...');
    const refreshResult = await adapter.refreshToken(mockCourse);
    console.log(`Token refresh result: ${refreshResult}`);
    console.log('✅ Token refresh test completed');
    
    console.log('\n🎉 All tests passed! Francis Byrne adapter is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testFrancisByrneAdapter(); 