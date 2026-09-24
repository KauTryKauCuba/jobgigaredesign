# Plain (non-standalone) Next.js image — full node_modules copied in, built
# and served with `next start`. Simpler and more reliable than a standalone
# build here, at the cost of a bigger image, since this app uses sharp
# (native bindings) and several server-only libs that standalone's file
# tracing can miss.
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 4100
CMD ["npm", "run", "start"]
