# Zero-dependency Node.js stateful API server configuration
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy all workspace files
COPY . .

# Expose server port
EXPOSE 8282

# Start the Node.js server
CMD ["node", "server.js"]
