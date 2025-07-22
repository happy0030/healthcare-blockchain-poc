const axios = require('axios');

async function testEmergencyAccess() {
    console.log('=== Emergency Access Performance Test ===\n');
    
    const iterations = 50;
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        try {
            // Simulate emergency break-glass activation
            await axios.post('http://localhost:3000/api/doctor/break-glass', {
                doctorId: 'D999',
                patientId: 'P001',
                reason: 'Emergency test scenario'
            });
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            times.push(duration);
            
            console.log(`Test ${i + 1}: ${duration}ms`);
            
        } catch (error) {
            console.error(`Test ${i + 1} failed:`, error.message);
        }
        
        // Wait a bit between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Calculate statistics
    const avgTime = times.reduce((a, b) => a + b) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    console.log('\n=== RESULTS ===');
    console.log(`Average Time: ${avgTime.toFixed(0)}ms`);
    console.log(`Min Time: ${minTime}ms`);
    console.log(`Max Time: ${maxTime}ms`);
    console.log(`Success Rate: ${(times.length / iterations * 100).toFixed(1)}%`);
    console.log(`Under 3 seconds: ${times.filter(t => t < 3000).length}/${iterations}`);
}

testEmergencyAccess().catch(console.error);