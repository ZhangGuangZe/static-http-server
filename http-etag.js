const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');
const mime = require('mime');
const checksum = require('checksum');

const server = http.createServer((req, res) => {
  if (req.url === '/') req.url = '/index.html';

  let filePath = path.resolve(__dirname, path.join('www', url.fileURLToPath(`file:/${req.url}`))); // 解析请求的路径
  
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    const isDir = stats.isDirectory();
    if (isDir) {
      filePath = path.join(filePath, 'index.html');
    }
    if (fs.existsSync(filePath)) {
      checksum.file(filePath, (err, hash) => {
        hash = `"${hash}"`;
        
        const { ext } = path.parse(filePath);
        let status = 200;
        if (req.headers['if-none-match'] === hash) { // 根据资源修改时间判断是否使用缓存
          status = 304;
        }
        res.writeHead(status, {
          'Content-Type': mime.getType(ext),
          'etag': hash, // 资源内容签名
        });
        if (status === 200) { // 响应最新资源
          const resStream = fs.createReadStream(filePath); // 以流的方式读取文件内容，避免读取大文件造成 I/O 阻塞
          resStream.pipe(res); // pipe 方法可以将两个流连接起来，这样数据就会从上游流向下游
        } else {
          res.end(); // 不返回 body，继续使用缓存
        }
      });
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<h1>Not Found</h1>');
  }
});

server.on('clientError', (err, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(8080, () => {
  console.log('opened server on', server.address());
});