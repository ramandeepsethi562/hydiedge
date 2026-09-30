FROM node:22-alpine AS base
WORKDIR /app

COPY package.json ./
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN npm install
RUN npm run build --workspace=@hydiems/shared

WORKDIR /app/apps/web
RUN npm run build

RUN chown -R node:node /app
USER node

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "run", "start"]
