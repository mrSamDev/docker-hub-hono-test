FROM node:lts-alpine

WORKDIR /home/node

# Copy package.json and pnpm-lock.yaml first to leverage caching
COPY package.json pnpm-lock.yaml ./

# Install corepack and enable it as root
RUN npm install -g corepack && corepack enable

# Switch to the non-root user
USER node

# Install dependencies
RUN pnpm install

# Copy the rest of the application code
COPY . .

COPY --chown=node:node . .

# Build the application (e.g., transpile TypeScript, bundle JavaScript)
RUN pnpm build

ARG PORT
ENV PORT=$PORT

CMD ["node", "dist/index.js"]
