var http = require('http');
var express = require('express');
var finalhandler = require('finalhandler');
var serveStatic = require('serve-static');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io').listen(server);
var bodyParser  = require("body-parser");

app.use(bodyParser.urlencoded({extended: true}));

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

const playerSchema = {
  playerSocket : { type: mongoose.SchemaTypes.String, required: true },
  playerPoints : { type: mongoose.SchemaTypes.Number, required: true },
  playerPosition: { type: mongoose.SchemaTypes.String, required: true }
};
const playerCollectionName = "points";
const pointSchema = mongoose.Schema(playerSchema);
const PointModel = mongoose.model(playerCollectionName,pointSchema);
var PointList = [];

const itemSchema =
{
    objectX: { type: mongoose.SchemaTypes.Number, required: true },
    objectY: { type: mongoose.SchemaTypes.Number, required: true }
};
const itemCollectionName = "items";
const placedSchema = mongoose.Schema(itemSchema);
const PlacedModel = mongoose.model(itemCollectionName,placedSchema);
var PlacedList = [];

var players = {};
var obstacles = {};
var destroyers = {};

var serve = serveStatic("./");
var playerNumber = 1;
var obstacleNumber = 0;
var destroyerNumber = 0;
var totalObstacleNumber = 0;
var totalDestroyerNumber = 0;
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
      updatePlayerDataBase(socket.id, players[socket.id].points, players[socket.id].position);
  });

  socket.on('winStateNone', function (winStateObject)
  {
      players[socket.id].winState = winStateObject.playerWinState;
  });

  socket.on('placeObstacle', function (placeInformation)
  {
      obstacles[totalObstacleNumber] =
      {
          objectX: placeInformation.x,
          objectY: placeInformation.y
      }
      newItemToDataBase(placeInformation.x,placeInformation.y);
      obstacleNumber++;
      totalObstacleNumber++;
      playersReady++;
      checkForRoundStart();
  });

  socket.on('placeDestroyer', function (placeInformation)
  {
      destroyers[totalDestroyerNumber] =
      {
          objectX: placeInformation.x,
          objectY: placeInformation.y
      }
      newItemToDataBase(placeInformation.x,placeInformation.y);
      destroyerNumber++;
      totalDestroyerNumber++;
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

app.get("/testConnect/:id", connectNoEmit);
app.get("/testDisconnect/:id", disconnectNoEmit);
app.post("/testPos/", createPosTable);
app.post("/testPlacing/", testPlacing);

function testPlacing(req, res)
{
    var placeInformation = req.body.object;
    obstacles[totalObstacleNumber] =
    {
        objectX: placeInformation.x,
        objectY: placeInformation.y
    }
    obstacleNumber++;
    totalObstacleNumber++;
    res.send(obstacles);
}

function connectNoEmit(req, res)
{
  socket = {};
  socket.id = req.params.id;
  players[socket.id] =
  {
      socketID: socket.id,
      playerX: 100,
      playerY: 450,
      winState: 'none',
      points: 0,
      position: "N/A"
  }
  res.send(players);
}

function disconnectNoEmit(req,res)
{
  socket = {};
  socket.id = req.params.id;
  delete players[socket.id];
  res.send(players);
}

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
            points: 0,
            position: "N/A"
        }
        newPlayerDataBase(socket.id, 0, "N/A");
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
        updatePlayerDataBase(socket.id, players[socket.id].points, players[socket.id].position)
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
            console.log(PointModel);
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
    PlacedModel.deleteMany({"objectX" : {$gt : -1}}, function(err, result) {
        if (err) {
            console.log(err);
        }
    });
    io.emit('gameStart');
}

function startRound()
{
    console.log("Start Round");
    createPosTable();
    io.emit('ClearObstacle');
    io.emit('posUpdate', players);
    io.emit('playersReady');

    io.emit('serverSideObstacles', obstacles);
    io.emit('serverSideDestroyers', destroyers);
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

function newPlayerDataBase(socketID, points, position)
{
  PointModel.create(
    {
      playerSocket: socketID,
      playerPoints: points,
      playerPosition: position
    });
}

function updatePlayerDataBase(socketID, points, position)
{
  PointModel.deleteOne({"playerSocket" : socketID}, function(err, result) {
      if (err) {
          console.log(err);
      }
  });

  PointModel.create(
    {
      playerSocket: socketID,
      playerPoints: points,
      playerPosition: position
    });
}

function newItemToDataBase(x, y)
{
    PlacedModel.create(
        {
            objectX: x,
            objectY: y
        });
}

function createPosTable()
{
    var first;
    var second;
    var third;
    var fourth;

    var highest = {};
    highest.points = -1;

    Object.keys(players).forEach(function (player)
    {
        if(players[player].points > highest.points)
        {
            highest = players[player];
            players[player].position = "1st";
        }
    });

    first = highest;

    highest = {};
    highest.points = -1;

    Object.keys(players).forEach(function (player)
    {
        if(players[player].points > highest.points && players[player].socketID != first.socketID)
        {
            highest = players[player];
            players[player].position = "2nd";
        }
    });

    second = highest;

    highest = {};
    highest.points = -1;

    Object.keys(players).forEach(function (player)
    {
        if(players[player].points > highest.points && players[player].socketID != first.socketID && players[player].socketID != second.socketID)
        {
            highest = players[player];
            players[player].position = "3rd";
        }
    });

    third = highest;

    highest = {};
    highest.points = -1;

    Object.keys(players).forEach(function (player)
    {
        if(players[player].points > highest.points && players[player].socketID != first.socketID && players[player].socketID != second.socketID && players[player].socketID != third.socketID)
        {
            highest = players[player];
            players[player].position = "4th";
        }
    });

    Object.keys(players).forEach(function (player)
    {
        updatePlayerDataBase(players[player].socketID, players[player].points, players[player].position);
    });
}

function createPosTable(req, res)
{
    var localPlayers = req.body.players;
    var first;
    var second;
    var third;
    var fourth;

    var highest = {};
    highest.points = -1;

    Object.keys(localPlayers).forEach(function (player)
    {
        if(localPlayers[player].points > highest.points)
        {
            highest = localPlayers[player];
            localPlayers[player].position = "1st";
        }
    });

    first = highest;

    highest = {};
    highest.points = -1;

    Object.keys(localPlayers).forEach(function (player)
    {
        if(localPlayers[player].points > highest.points && localPlayers[player].socketID != first.socketID)
        {
            highest = localPlayers[player];
            localPlayers[player].position = "2nd";
        }
    });

    second = highest;

    highest = {};
    highest.points = -1;

    Object.keys(localPlayers).forEach(function (player)
    {
        if(localPlayers[player].points > highest.points && localPlayers[player].socketID != first.socketID && localPlayers[player].socketID != second.socketID)
        {
            highest = localPlayers[player];
            localPlayers[player].position = "3rd";
        }
    });

    third = highest;

    highest = {};
    highest.points = -1;

    Object.keys(localPlayers).forEach(function (player)
    {
        if(localPlayers[player].points > highest.points && localPlayers[player].socketID != first.socketID && localPlayers[player].socketID != second.socketID && localPlayers[player].socketID != third.socketID)
        {
            highest = localPlayers[player];
            localPlayers[player].position = "4th";
        }
    });

    fourth = highest;

    res.send({firstPos: first, secondPos: second, thirdPos: third, fourthPos: fourth});
}
