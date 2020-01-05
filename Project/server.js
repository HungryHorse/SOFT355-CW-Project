var http = require('http');
var express = require('express');
var finalhandler = require('finalhandler');
var serveStatic = require('serve-static');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io').listen(server);

var players = {};

var serve = serveStatic("./");
var playerNumber = 1;


app.use(express.static('./'));//Serving static file

io.on('connection', function (socket) {
  connect(socket);
  socket.on('disconnect', function () {
    disconnect(socket);
  });
});

server.listen(9000, function() {
    console.log("Server running at: http://localhost:" + 9000)
});

function connect(socket)
{
    if(playerNumber <= 4)
    {
        console.log("Player " + playerNumber + " has connected.");
        players[socket.id] =
        {
            playerID: playerNumber
        }
        playerNumber++;
    }
    else
    {
        console.log("connection failed too many players");
    }
}

function disconnect(socket)
{
    if(players[socket.id] != null)
    {
        if(playerNumber > 2)
        {
            console.log("Player " + players[socket.id].playerID + " has disconnected.");
            delete players[socket.id];
            playerNumber--;
        }
        else
        {
            console.log("Last player has disconnected.");
            delete players[socket.id];
            playerNumber--;
        }
    }
}

function playerDeath(playerNumber)
{
    console.log("Player " + playerNumber + " has died");
}
