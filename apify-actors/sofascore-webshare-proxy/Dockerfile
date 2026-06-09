FROM apify/actor-node-playwright-chrome:20

# Solo package.json (sin lockfile): npm como myuser no puede reescribir un
# package-lock.json copiado como root (EACCES, build 1.0.11 fallido).
COPY package.json ./
RUN npm install --omit=dev --no-package-lock
COPY . ./

RUN node --version && node -e 'console.log("Node OK")'

CMD npm start --silent
