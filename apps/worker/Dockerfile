FROM node:22-alpine
WORKDIR /workspace

COPY package.json ./
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/database ./packages/database
COPY apps/worker ./apps/worker

RUN npm install
RUN npm run build --workspace=@hydiems/shared
RUN npm run build --workspace=@hydiems/database
RUN npm run build --workspace=@hydiems/worker

WORKDIR /workspace/apps/worker
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
