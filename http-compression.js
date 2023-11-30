const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');
const mime = require('mime');
const zlib = require('zlib');

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
      const { ext } = path.parse(filePath);
      const stats = fs.statSync(filePath);
      const timeStamp = req.headers['if-modified-since'];
      let status = 200;
      if (timeStamp && Number(timeStamp) === stats.mtimeMs) { // 根据资源修改时间判断是否使用缓存
        status = 304;
      }
      const mimeType = mime.getType(ext);
      const responseHeaders = {
        'Content-Type': mimeType,
        'Cache-Control': 'max-age=86400', // 缓存一天
        'Last-Modified': stats.mtimeMs // 资源最后修改时间
      };
      const acceptEncoding = req.headers['accept-encoding'];
      const compress = acceptEncoding && /^(text|application)\//.test(mimeType);
      if (compress) {
        // 返回任意一种客户端支持的压缩方式
        acceptEncoding.split(/\s*,\s*/).some(encoding => {
          if (encoding === 'gzip') {
            responseHeaders['Content-Encoding'] = 'gzip';
            return true;
          }
          if (encoding === 'deflate') {
            responseHeaders['Content-Encoding'] = 'deflate';
            return true;
          }
          if (encoding === 'br') {
            responseHeaders['Content-Encoding'] = 'br';
            return true;
          }
          return false;
        });
      }
      const compressEncoding = responseHeaders['Content-Encoding'];
      res.writeHead(status, responseHeaders);
      if (status === 200) { // 响应最新资源
        const fileStream = fs.createReadStream(filePath); // 以流的方式读取文件内容，避免读取大文件造成 I/O 阻塞

        if (compress && compressEncoding) {
          let comp;
          // 采用不同的压缩算法对文件进行压缩
          if (compressEncoding === 'gzip') {
            comp = zlib.createGzip();
          } else if (compressEncoding === 'deflate') {
            comp = zlib.createDeflate();
          } else {
            comp = zlib.createBrotliCompress();
          }
          fileStream.pipe(comp).pipe(res); // pipe 方法可以将两个流连接起来，这样数据就会从上游流向下游
        } else {
          fileStream.pipe(res);
        }
      } else {
        res.end(); // 不返回 body，继续使用缓存
      }
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