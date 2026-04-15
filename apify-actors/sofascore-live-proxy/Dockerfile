FROM apify/actor-node-playwright-chrome:20

COPY package*.json ./
RUN npm install --omit=dev
COPY . ./

# Test que Node funciona
RUN node --version && node -e 'console.log("Node OK")'

CMD npm start --silent
