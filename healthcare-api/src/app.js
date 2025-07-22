const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const FabricNetwork = require('./fabric/network');
const patientRoutes = require('./routes/patient');
const doctorRoutes = require('./routes/doctor');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize Fabric network
const fabricNetwork = new FabricNetwork();

// Connect to network on startup
async function startServer() {
    try {
        await fabricNetwork.connect();
        app.locals.contract = fabricNetwork.getContract();

        // Routes
        app.use('/api/patient', patientRoutes);
        app.use('/api/doctor', doctorRoutes);

        // Health check
        app.get('/health', (req, res) => {
            res.json({ status: 'OK', message: 'Healthcare API is running' });
        });

        // Start server
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await fabricNetwork.disconnect();
    process.exit(0);
});

startServer();
