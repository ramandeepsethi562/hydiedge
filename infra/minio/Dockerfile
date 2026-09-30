FROM node:22-alpine
WORKDIR /s3-server
RUN mkdir -p /data/hydiems-screenshots /data/hydiems-recordings /data/hydiems-exports
RUN cat << 'EOF' > /s3-server/server.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_DIR = '/data';

function safeFilePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
  const resolved = path.resolve(DATA_DIR, clean);
  if (!resolved.startsWith(path.resolve(DATA_DIR))) {
    return null;
  }
  return resolved;
}

const s3Server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, HEAD, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  if (req.url.startsWith('/minio/health/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'OK', engine: 'HydiEms-NVMe-S3-Gateway' }));
  }

  const targetPath = safeFilePath(req.url);
  if (!targetPath) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  if (req.method === 'PUT') {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const writeStream = fs.createWriteStream(targetPath);
    req.pipe(writeStream);
    writeStream.on('finish', () => {
      res.setHeader('ETag', `"${Date.now().toString(16)}"`);
      res.writeHead(200);
      res.end();
    });
    writeStream.on('error', (err) => {
      res.writeHead(500);
      res.end(err.message);
    });
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    if (!fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      return res.end('<?xml version="1.0" encoding="UTF-8"?><ListBucketResult><Name>hydiems</Name></ListBucketResult>');
    }
    const stat = fs.statSync(targetPath);
    res.writeHead(200, { 'Content-Length': stat.size });
    if (req.method === 'HEAD') return res.end();
    return fs.createReadStream(targetPath).pipe(res);
  }

  if (req.method === 'DELETE') {
    if (fs.existsSync(targetPath) && !fs.statSync(targetPath).isDirectory()) {
      fs.unlinkSync(targetPath);
    }
    res.writeHead(204);
    return res.end();
  }

  res.writeHead(200);
  res.end('OK');
});

s3Server.listen(9000, '0.0.0.0', () => {
  console.log('HydiEms S3 NVMe Object Storage Server listening on :9000');
});

const consoleServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ service: 'HydiEms S3 NVMe Console', status: 'ONLINE', dataDir: DATA_DIR }));
});
consoleServer.listen(9001, '0.0.0.0');
EOF
EXPOSE 9000 9001
CMD ["node", "/s3-server/server.js"]
