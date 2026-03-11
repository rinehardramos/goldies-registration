FROM node:25-slim

WORKDIR /app

# Install build dependencies for better-sqlite3 if needed
# Better-sqlite3 often needs python and make/g++ to build from source
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

# Ensure the data directory exists for SQLite
RUN mkdir -p /data

EXPOSE 5001

CMD ["node", "index.js"]
