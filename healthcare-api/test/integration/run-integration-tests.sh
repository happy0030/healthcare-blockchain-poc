#!/bin/bash

echo "Starting Healthcare Blockchain Integration Tests..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Store current directory
CURRENT_DIR=$(pwd)

# Ensure the blockchain network is running
echo "Setting up blockchain network..."
cd ~/blockchain-healthcare/fabric-samples/test-network
./network.sh down
./network.sh up createChannel -ca -c healthchannel

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to start blockchain network${NC}"
    exit 1
fi

# Deploy the chaincode
echo "Deploying chaincode..."
cd ~/blockchain-healthcare
./clean-deploy.sh

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to deploy chaincode${NC}"
    exit 1
fi

# Start the API server in background
echo "Starting API server..."
cd ~/blockchain-healthcare/healthcare-api
npm run dev &
API_PID=$!

# Wait for API to be ready (check health endpoint)
echo "Waiting for API to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}API is ready!${NC}"
        break
    fi
    echo "Waiting for API... attempt $i/30"
    sleep 2
done

# Run integration tests
echo "Running integration tests..."
cd ~/blockchain-healthcare/healthcare-api
npm test

# Capture test exit code
TEST_EXIT_CODE=$?

# Cleanup
echo "Cleaning up..."
kill $API_PID 2>/dev/null

# Return to original directory
cd $CURRENT_DIR

# Report results
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}All integration tests passed!${NC}"
else
    echo -e "${RED}Integration tests failed with exit code: $TEST_EXIT_CODE${NC}"
fi

# Exit with test result
exit $TEST_EXIT_CODE