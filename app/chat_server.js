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
    // TODO: Set all users to offline.
    this.listenConnections();
    this.io.listen(this.port);
  }

  // TODO: Move to dbHandler ???
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
    this.userSockets[userId] = socket;
  }

  handleClientConnection(socket, username){
    dbHandler.findUser(username, (findUserError, user) => {
      if(!findUserError){
        if(user){
          console.log("Existent user connected: ", user);
          dbHandler.setUserConnectionStatus(user, true, (connectedError) => {
            if(!connectedError) this.sendUserInitialData(user, socket);
          });
        } else {
          dbHandler.saveUserUsername(username, (saveUserError, user) => {
            if(!saveUserError){
              console.log("Saved new user: ", user);
              printUserEvent(username, "entered the chat");
              this.sendUserInitialData(user, socket);
            }
          });
        }
      }
    });
  }

  sendUserInitialData(user, socket){
    let errors = false;
    dbHandler.onlineUsers((onUsersError, onlineUsers) => {
      if(!onUsersError){
        dbHandler.pendingMessages(user._id, (pendingError, pendingMessages) => {
          if(!pendingError){
            console.log("Pending messages: ", pendingMessages);
            socket.emit('init-connection-msg', {
              status: "connected",
              user,
              onlineUsers
            });
            socket.broadcast.emit('user-connected', user.username);
            this.saveUserSocket(user._id, socket);
            this.listenClientEvents(socket, user);
          }
        })
      }
    });
  }

  listenClientEvents(socket, user){

    socket.on('init-chat', (data) => {
      const receiverSocket = this.userSockets[data.receiverId];
      receiverSocket.emit('init-chat', { emitterId: user._id });
    });

    socket.on('accept-chat', (data) => {
      const emitterSocket = this.userSockets[data.receiverId];
      emitterSocket.emit('accept-chat', { receiverId: data.emitterId });
    });

    socket.on('chat-msg', (data) => {
      const { receiverId, emitterId } = data.message;
      const { message } = data;
      dbHandler.isSessionEstablished(emitterId, receiverId, (session) => {
        console.log("Chat message received!", data);
        if(session){
          dbHandler.isOnline(receiverId, (isOnError, isOnline) => {
            console.log("Is online:", isOnline);
            console.log("Is online error: ", isOnError);
            if(!isOnError){
              if(isOnline){
                console.log("Sending message!!!!");
                console.log("User sockets: ", this.userSockets);
                const receiverSocket = this.userSockets[receiverId];
                receiverSocket.emit('chat-msg', {
                  message
                });
              } else {
                console.log("Saving pendingMessage: ", message);
                dbHandler.savePendingMessage(receiverId, message);
              }
            }
          });
        }
      });
    });
 
    socket.on('disconnect', () => {
      dbHandler.setUserConnectionStatus(user, false, (err) => {
        if(!err){
          printUserEvent(user.username, "disconnected");
        } else {
          printUserEvent(user.username, "error on disconnect.");
        }
      });
    });

  }
}

function printUserEvent(username, event){
    console.log( "<" + username + "> " + event + "." );
}

module.exports = ChatServer;
