FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./

ARG HUSKY=0 // Disable husky in Docker builds by default
ENV HUSKY=$HUSKY
RUN npm ci --omit=dev

# Copy prisma schema first
COPY prisma ./prisma

# Generate Prisma Client
RUN npx prisma generate

COPY . .

RUN npm run build

ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/server.js"]
