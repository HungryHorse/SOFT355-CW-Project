var http = require('http');
var express = require('express');
var finalhandler = require('finalhandler');
var serveStatic = require('serve-static');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io').listen(server);

var players = {};
var obstacles = {};
var destroyers = {};

var serve = serveStatic("./");
var playerNumber = 1;
var playerInWinState = 0;


app.use(express.static('./'));//Serving static file

io.on('connection', function (socket) {
  connect(socket);
  socket.on('disconnect', function () {
    disconnect(socket);
  });

  // when a player moves, update the player data
  socket.on('playerMovement', function (movementData) {
    players[socket.id].playerX = movementData.playerX;
    players[socket.id].playerY = movementData.playerY;
    // emit a message to all players about the player that moved
    socket.broadcast.emit('playerMoved', players[socket.id]);
  });

  socket.on('winState', function (winStateObject)
  {
      players[socket.id].winState = winStateObject.playerWinState;
      playerInWinState++;
      checkForRoundEnd();
      socket.broadcast.emit('winStateUpdated', players[socket.id]);
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
            socketID: socket.id,
            playerX: 100,
            playerY: 450,
            winState: 'none'
        }
        playerNumber++;
        // send the players object to the new player
        socket.emit('currentPlayers', players);
        // update all other players of the new player
        socket.broadcast.emit('newPlayer', players[socket.id]);

        checkForGameStart(socket);
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
            console.log("A player has disconnected.");
            delete players[socket.id];
            playerNumber--;
        }
        else
        {
            console.log("Last player has disconnected.");
            delete players[socket.id];
            playerNumber--;
        }
        io.emit('disconnect', socket.id);
    }
}

function checkForGameStart(socket)
{
    var gameStart = true;

    if(playerNumber <= 4)
    {
        gameStart = false
    }

    if(gameStart)
    {
        startGame();
    }
}

function checkForRoundEnd()
{
    var gameEnd = true;
    if(playerInWinState < 4)
    {
        gameEnd = false;
    }

    if(gameEnd)
    {
        endRound();
    }
}

function startGame()
{
    console.log("Game Start");
    io.emit('gameStart');
}

function endRound()
{
    console.log("End Round");
    playerInWinState = 0;
}
