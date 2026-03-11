FROM node:25-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# Run in dev mode for local environment
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
