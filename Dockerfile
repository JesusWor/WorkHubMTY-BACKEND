FROM node:18-alpine AS build
WORKDIR /backend
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3001
RUN npm run build
CMD ["npm", "run", "start"]