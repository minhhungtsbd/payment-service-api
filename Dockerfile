FROM node:21.7-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Install playwright
RUN npx playwright install --with-deps chromium

# Build application using TypeScript compiler
RUN npm run build:tsc

# Expose port
EXPOSE 3000

# Start application
CMD [ "node", "./dist/main.js" ]
