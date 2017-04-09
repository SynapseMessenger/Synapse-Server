"use strict";

const socketIo = require('socket.io');
const mongoose = require('mongoose');
const dbHandler = require('./db/db_handler.js');

class ChatServer {
  constructor(port, dbUrl) {
    this.io = socketIo();
    this.port = port || 9090;
    this.dbUrl =  dbUrl || 'mongodb://localhost/synapse_server';
  }

  start(){
    this.connectToDB();
    this.listenConnections();
    this.io.listen(this.port);
  }

  connectToDB(){
    mongoose.Promise = global.Promise;
    mongoose.connect(this.dbUrl);
    const db = mongoose.connection;
    db.on('error', function(err) {
      console.error('DB connection error:' + err);
    });
    db.once('open', function() {
      console.log("Synapse Server - Database connected successfully.");
    });
  }

  listenConnections(){
    this.io.on('connection', (socket) => {
      let username = socket.handshake.query.username;
      if(username){
        this.handleClientConnection(socket, username);
      } else {
        socket.disconnect(0);
      }
    });
  }

  handleClientConnection(socket, username){
    dbHandler.saveUserUsername(username, (err, res) => {
      if(!err){
        printUserEvent(username, "entered the chat");
        dbHandler.onlineUsers((err, onlineUsers) => {
          if(!err){
            socket.emit('init-connection-msg', {
              status: "connected",
              onlineUsers
            });
            this.listenClientEvents(socket, username);
            socket.broadcast.emit('user-connected', username);
          }
        });
      } else {
        console.log("Error saving user: ", err);
      }
    });
  }

  listenClientEvents(socket, username){
    socket.on('client-msg', (client_message) => {
      socket.broadcast.emit('client-msg', client_message);
    });
 
    socket.on('disconnect', () => {
      printUserEvent(username, "disconnected");
    });
  }
}

function printUserEvent(username, event){
    console.log( "<" + username + "> " + event + "." );
}

module.exports = ChatServer;