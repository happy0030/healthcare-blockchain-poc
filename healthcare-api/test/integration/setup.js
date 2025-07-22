const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

class TestSetup {
    constructor() {
        this.apiClient = null;
        this.baseURL = 'http://localhost:3000/api';
    }

    async initializeAPI() {
        this.apiClient = axios.create({
            baseURL: this.baseURL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Wait for API to be ready
        await this.waitForAPI();
    }

    async waitForAPI(maxAttempts = 30, delay = 1000) {
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const response = await this.apiClient.get('/health');
                if (response.data.status === 'OK') {
                    console.log('API is ready');
                    return;
                }
            } catch (error) {
                console.log(`Waiting for API... attempt ${i + 1}/${maxAttempts}`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        throw new Error('API failed to start');
    }

    async initializeLedger() {
        try {
            const response = await this.apiClient.post('/doctor/init-ledger');
            if (response.data.success) {
                console.log('Ledger initialized successfully');
            }
        } catch (error) {
            console.log('Ledger might already be initialized');
        }
    }

    async cleanup() {
        // Cleanup test data if needed
    }
}

module.exports = TestSetup;