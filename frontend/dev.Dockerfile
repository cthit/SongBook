FROM node:15-alpine
WORKDIR /usr/src/app
COPY --chown=node:node package.json ./
RUN yarn install --network-timeout 10000000

COPY --chown=node:node src src
COPY --chown=node:node public public
COPY --chown=node:node config-overrides.js ./

CMD yarn start