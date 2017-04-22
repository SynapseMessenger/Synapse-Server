"use strict";

const socketIo = require('socket.io');
const mongoose = require('mongoose');
const dbHandler = require('./db/db_handler.js');

class ChatServer {
  constructor(port, dbUrl) {
    this.io = socketIo();
    this.port = port || 9090;
    this.dbUrl =  dbUrl || 'mongodb://localhost/synapse_server';
    this.userSockets = new Map();
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

  saveUserSocket(userId, socket){
    this.userSockets.set(userId, socket);
    console.log("User sockets: ", this.userSockets.entries());
  }

  handleClientConnection(socket, username){
    dbHandler.saveUserUsername(username, (err, res) => {
      if(!err){
        printUserEvent(username, "entered the chat");
        this.saveUserSocket(res._id, socket);
        console.log("Saved user: ", res);
        dbHandler.onlineUsers((err, onlineUsers) => {
          if(!err){
            socket.emit('init-connection-msg', {
              status: "connected",
              onlineUsers
            });
            this.listenClientEvents(socket, res);
            socket.broadcast.emit('user-connected', username);
          }
        });
      } else {
        console.log("Error saving user: ", err);
      }
    });
  }

  isSessionEstablished(userA, userB){
    return true;
  }

  listenClientEvents(socket, user){

    socket.on('init-chat', (message) => {
      const receiverSocket = this.userSockets.get(message.receiverId);
      receiverSocket.emit('init-chat', { emiterId: user._id });
    });

    socket.on('accept-chat', (message) => {
      const emiterSocket = this.userSockets.get(message.emiterId);
      emiterSocket.emit('accept-chat', { receiverId: message.user._id });
    });

    socket.on('chat-msg', (message) => {
      if(isSessionEstablished(message.user._id, message.receiverId)){
        const receiverSocket = this.userSockets.get(message.receiverId);
        receiverSocket.emit('chat-msg', { emiterId: message.user._id, message: message.text });
      }
    });
 
    socket.on('disconnect', () => {
      printUserEvent(user.username, "disconnected");
    });

  }
}

function printUserEvent(username, event){
    console.log( "<" + username + "> " + event + "." );
}

module.exports = ChatServer;
