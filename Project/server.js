var http = require('http');
var express = require('express');
var finalhandler = require('finalhandler');
var serveStatic = require('serve-static');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io').listen(server);

//mongoose
var mongoose = require('mongoose');
const uri = "mongodb+srv://HungryHorse:gamepw@jackbrewercluster-oq2qw.mongodb.net/test?retryWrites=true&w=majority"
mongoose.connect(uri, {useNewUrlParser: true, useUnifiedTopology : true});
const db = mongoose.connection;
db.on("error", () => {
    console.log("> Error occurred from the database");
});
db.once("open", () => {
    console.log("> Successfully connected to the database");
});

const schema = {
  playerSocket : { type: mongoose.SchemaTypes.String, required: true },
  playerPoints : { type: mongoose.SchemaTypes.Number, required: true }
};
const collectionName = "points";
const pointSchema = mongoose.Schema(schema);
const PointModel = mongoose.model(collectionName,pointSchema);
var PointList = [];

var players = {};
var obstacles = {};
var destroyers = {};

var serve = serveStatic("./");
var playerNumber = 1;
var obstacleNumber = 0;
var destroyerNumber = 0;
var playerInWinState = 0;
var playersReady = 0;


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
      if(players[socket.id].winState == 'win')
      {
          players[socket.id].points += 1;
      }
      checkForRoundEnd();
      socket.broadcast.emit('winStateUpdated', players[socket.id]);
  });

  socket.on('winStateNone', function (winStateObject)
  {
      players[socket.id].winState = winStateObject.playerWinState;
  });

  socket.on('placeObstacle', function (placeInformation)
  {
      obstacles[obstacleNumber] =
      {
          objectX: placeInformation.x,
          objectY: placeInformation.y
      }
      obstacleNumber++;
      playersReady++;
      checkForRoundStart();
  });

  socket.on('placeDestroyer', function (placeInformation)
  {
      destroyers[destroyerNumber] =
      {
          objectX: placeInformation.x,
          objectY: placeInformation.y
      }
      destroyerNumber++;
      playersReady++;
      checkForRoundStart();
  });

  socket.on('requestScoreUpdate', function ()
  {
      socket.emit('scoreUpdate', players[socket.id]);
  });
});

server.listen(9000, function() {
    console.log("Server running at: http://localhost:" + 9000)
});

function connect(socket)
{
    if(playerNumber <= 2)
    {
        console.log("Player " + playerNumber + " has connected.");
        players[socket.id] =
        {
            socketID: socket.id,
            playerX: 100,
            playerY: 450,
            winState: 'none',
            points: 0
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
        sendToDataBase(socket.id, players[socket.id].points)
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
            delete obstacles;
            delete destroyers;
        }
        io.emit('disconnect', socket.id);
    }
}

function checkForGameStart(socket)
{
    var gameStart = true;

    if(playerNumber <= 2)
    {
        gameStart = false
    }

    if(gameStart)
    {
        startGame();
    }
}

function checkForRoundStart()
{
    var roundStart = true;
    if(playersReady < 2)
    {
        roundStart = false;
    }

    if(roundStart)
    {
        startRound();
    }
}

function checkForRoundEnd()
{
    var gameEnd = true;
    if(playerInWinState < 2)
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

function startRound()
{
    console.log("Start Round");
    io.emit('serverSideObstacles', obstacles);
    io.emit('serverSideDestroyers', destroyers);
    io.emit('playersReady');
}

function endRound()
{
    console.log("End Round");
    playerInWinState = 0;
    obstacleNumber = 0;
    destroyerNumber = 0;
    playerInWinState = 0;
    playersReady = 0;
    io.emit('newRound');
    io.emit('serverSideObstacles', obstacles);
    io.emit('serverSideDestroyers', destroyers);
    io.emit('currentPlayers', players);
    io.emit('gameStart');
}

function sendToDataBase(socketID, points)
{
  PointModel.create(
    {
      playerSocket: socketID,
      playerPoints: points
    });
}
