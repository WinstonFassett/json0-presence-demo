const http = require('http');
const express = require('express');
const ShareDBWithPresence = require('./lib/sharedb-presence/server');
const WebSocket = require('ws');
const WebSocketJSONStream = require('websocket-json-stream');
const presence = require('./lib/sharedb-presence/stateless')

const backend = new ShareDBWithPresence({
  disableDocAction: true,
  disableSpaceDelimitedActions: true
}, presence);
createDoc(startServer);

// Create initial document.
function createDoc(callback) {
  const connection = backend.connect();
  const doc = connection.get('examples', 'example');
  doc.fetch(function(err) {
    if (err) throw err;
    if (doc.type === null) {
      doc.create({ example: '' }, 'json0', callback);
      return;
    }
    callback();
  });
}

// Create a web server to serve files and listen to WebSocket connections
function startServer() {
  const app = express();
  app.use(express.static('static'));
  const server = http.createServer(app);

  const wss = new WebSocket.Server({ server: server });
  wss.on('connection', function(ws, req) {
    const stream = new WebSocketJSONStream(ws);
    backend.listen(stream);
  });

  server.listen(8080);
  console.log('Listening on http://localhost:8080');
}
