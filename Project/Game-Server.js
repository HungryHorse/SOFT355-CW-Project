var express = require("express");
var http = require("http");
var WebSocketServer = require("websocket").server;
// Initialise the Express app.
app = express();
// Initialise a HTTP server using the Express app.
server = http.createServer(app);

const port = 9010;
server.listen(port, function() {
  console.log("Listening on " + port);
});
