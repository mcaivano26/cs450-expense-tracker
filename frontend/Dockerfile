FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 5175

# Listen on all network interfaces (0.0.0.0), not just the container's own localhost,
# so the browser on the host can reach the dev server through the published port 5175.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]