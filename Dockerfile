# Team workspace server image (used by Fly.io or any host that runs containers).
# No packages are installed: the app uses only what comes with Node.js.
FROM node:22-slim
WORKDIR /app
COPY package.json index.html ./
COPY css ./css
COPY js ./js
COPY server ./server
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 DATA_DIR=/data
EXPOSE 8080
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.js"]
