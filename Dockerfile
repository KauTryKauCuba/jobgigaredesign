# Plain (non-standalone) Next.js image — full node_modules copied in, built
# and served with `next start`. Simpler and more reliable than a standalone
# build here, at the cost of a bigger image, since this app uses sharp
# (native bindings) and several server-only libs that standalone's file
# tracing can miss.
FROM node:24-alpine

WORKDIR /app

# ffmpeg for video pitches (480p MP4 conversion), from Alpine's own package
# mirror — ffmpeg-static (an optional dependency, used for local dev) would
# otherwise download its binary from github.com during `npm ci`, which fails
# the whole build whenever that download can't be reached. If it does fail
# now, npm just skips the optional package; FFMPEG_BIN is what the app uses.
RUN apk add --no-cache ffmpeg
ENV FFMPEG_BIN=/usr/bin/ffmpeg

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 4100
CMD ["npm", "run", "start"]
