FROM node:22-alpine
WORKDIR /workspace

COPY package.json ./
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/database ./packages/database
COPY apps/api ./apps/api
COPY downloads ./downloads

RUN npm install
RUN npm run build --workspace=@hydiems/shared
RUN npm run build --workspace=@hydiems/database
RUN npm run build --workspace=@hydiems/api

RUN chown -R node:node /workspace
USER node

WORKDIR /workspace/apps/api
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/server.js"]
