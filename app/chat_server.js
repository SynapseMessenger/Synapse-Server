"use strict";

const socketIo = require('socket.io');
const mongoose = require('mongoose');
const dbHandler = require('./db/db_handler.js');

class ChatServer {
  constructor(port, dbUrl) {
    this.io = socketIo();
    this.port = port || 9090;
    this.dbUrl =  dbUrl || 'mongodb://localhost/synapse_server';
    this.userSockets = {};
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
    console.log("saving user socket", userId, typeof userId);
    this.userSockets[userId] = socket;
  }

  handleClientConnection(socket, username){
    dbHandler.saveUserUsername(username, (err, res) => {
      if(!err){
        printUserEvent(username, "entered the chat");
        const userId = res._id;
        this.saveUserSocket(userId, socket);
        dbHandler.onlineUsers((err, onlineUsers) => {
          if(!err){
            socket.emit('init-connection-msg', {
              status: "connected",
              user: res,
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
      console.log("init-chat", message);
      console.log("receiver id: ", message.receiverId, typeof message.receiverId)
      const receiverSocket = this.userSockets[message.receiverId];
      debugger;
      receiverSocket.emit('init-chat', { emitterId: user._id });
    });

    socket.on('accept-chat', (message) => {
      console.log("accept-chat", message);
      const emitterSocket = this.userSockets[message.emitterId];
      emitterSocket.emit('accept-chat', { receiverId: message.userId });
    });

    socket.on('chat-msg', (message) => {
      console.log("chat-msg", message);
      if(this.isSessionEstablished(message.emitterId, message.receiverId)){
        const receiverSocket = this.userSockets[message.receiverId];
        // console.log("user sockets: ", this.userSockets);
        // console.log("receiver id: ", message.receiverId, typeof message.receiverId)
        // console.log("Receiver socket: ", receiverSocket);
        receiverSocket.emit('chat-msg', { emitterId: message.emitterId, message: message.text });
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
