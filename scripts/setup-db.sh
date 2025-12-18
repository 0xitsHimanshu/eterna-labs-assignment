#!/bin/bash

# Setup script for PostgreSQL database
# Usage: ./scripts/setup-db.sh

echo "Setting up Order Execution database..."

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL is not installed. Please install PostgreSQL first."
    exit 1
fi

# Create database (will fail if it already exists, which is fine)
createdb order_execution 2>/dev/null || echo "Database 'order_execution' already exists or creation failed."

echo "Database setup complete!"
echo "The schema will be automatically created when you start the application."

