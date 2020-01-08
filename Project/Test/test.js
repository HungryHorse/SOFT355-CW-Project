var chai = require("chai");
var chaiHttp = require("chai-http");
var app = require("../server.js").app;
chai.use(chaiHttp);

suite("Test the server", function()
{
  test("Test connection of player", function()
  {
    chai.request('http://localhost:9000').get("/testConnect/testID").end(function(err, res)
    {
      var id = "testID";
      chai.assert.equal(res.status, 200);
      chai.assert.equal(res.body[id].socketID, "testID");
      chai.assert.equal(res.body[id].playerX, 100);
      chai.assert.equal(res.body[id].playerY, 450);
    });
  });

  test("Place Object", function()
  {
    chai.request('http://localhost:9000').post("/testPlacing/").set('content-type', 'application/x-www-form-urlencoded').send({object : {x: 100, y:900}}).end(function(err, res)
    {
      chai.assert.equal(res.body[0].objectX, 100);
      chai.assert.equal(res.body[0].objectY, 900);
    });
  });

  test("Position Table", function()
  {
    chai.request('http://localhost:9000').post("/testPos/").set('content-type', 'application/x-www-form-urlencoded').send({players : [{socketID: "third",points: 2}, {socketID: "second",points: 3}, {socketID: "first",points: 5}, {socketID: "fourth",points: 0}]}).end(function(err, res)
    {
      chai.assert.equal(res.status, 200);
      chai.assert.equal(res.body.firstPos.socketID, "first");
      chai.assert.equal(res.body.secondPos.socketID, "second");
      chai.assert.equal(res.body.thirdPos.socketID, "third");
      chai.assert.equal(res.body.fourthPos.socketID, "fourth");
    });
  });

  test("Test disconnection of player", function()
  {
    chai.request('http://localhost:9000').get("/testDisconnect/testID").end(function(err, res)
    {
      var id = "testID";
      chai.expect(res.body).to.not.contain({id});
    });
  });

});
