FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server/package*.json server/
COPY client/package*.json client/
RUN npm --prefix server ci --omit=dev && npm --prefix client ci
COPY . .
RUN npm --prefix client run build && rm -rf client/node_modules
ENV NODE_ENV=production PORT=4000
EXPOSE 4000
CMD ["node", "server/src/index.js"]
