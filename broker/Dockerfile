# Small, production Node image for the token-exchange broker. Cloud Run
# injects PORT itself (server.js already reads process.env.PORT).
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js ./

EXPOSE 8080
CMD ["node", "server.js"]
