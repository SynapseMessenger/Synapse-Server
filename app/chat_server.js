/* **************************************************************
 *                  Synapse - Server
 * @author Marco Fernandez Pranno <mfernandezpranno@gmail.com>
 * @licence MIT
 * @link https://github.com/SynapseNetwork/Synapse-Server
 * @version 1.0
 * ************************************************************** */

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
    this.initDatabase();
    this.listenConnections();
    this.io.listen(this.port);
  }

  // TODO: Move to dbHandler ???
  initDatabase(){
    mongoose.Promise = global.Promise;
    mongoose.connect(this.dbUrl);
    const db = mongoose.connection;
    db.on('error', function(err) {
      console.error('DB connection error:' + err);
    });
    db.once('open', function() {
      console.log("Synapse Server - Database connected successfully.");
      dbHandler.setAllUsersOffline();
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
          dbHandler.setUserConnectionStatus(user, true, (connectedError) => {
            if(!connectedError) this.sendUserInitialData(user, socket);
          });
        } else {
          dbHandler.saveUserUsername(username, (saveUserError, user) => {
            if(!saveUserError){
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
    dbHandler.allUsers((onUsersError, allUsers) => {
      if(!onUsersError){
        dbHandler.pendingMessages(user._id, (pendingError, pendingMessages) => {
          if(!pendingError){
            socket.emit('init-connection-msg', {
              status: "connected",
              user,
              allUsers,
              pendingMessages
            });
            socket.broadcast.emit('user-connected', user.username);
            this.saveUserSocket(user._id, socket);
            this.listenClientEvents(socket, user);
            dbHandler.clearPendingMessages(user._id, (err, res) => {
              if(err) console.log("Error clearing pending messages: ", err);
            });
          }
        })
      }
    });
  }

  listenClientEvents(socket, user){

    socket.on('init-chat', (data) => {
      const receiverSocket = this.userSockets[data.receiverId];
      if (receiverSocket) {
        receiverSocket.emit('init-chat', { emitterId: user._id });
      } else {
        console.log("Error: Socket not found on: init-chat.");
      }
    });

    socket.on('accept-chat', (data) => {
      dbHandler.isOnline(data.receiverId, (isOnError, isOnline) => {
        if (!isOnError) {
          if (isOnline) {
            const emitterSocket = this.userSockets[data.receiverId];
            if (emitterSocket) {
              emitterSocket.emit('accept-chat', { receiverId: data.emitterId });
            } else {
              console.log("Error: Socket not found on: accept-chat.");
            }
          }
        }
      });
    });

    socket.on('chat-msg', (data) => {
      const { receiverId, emitterId } = data.message;
      const { message } = data;
      dbHandler.isSessionEstablished(emitterId, receiverId, (session) => {
        if (session) {
          dbHandler.isOnline(receiverId, (isOnError, isOnline) => {
            if (!isOnError) {
              if (isOnline) {
                const receiverSocket = this.userSockets[receiverId];
                if (receiverSocket) {
                  receiverSocket.emit('chat-msg', {
                    message
                  });
                } else {
                  console.log("Error: Socket not found on: accept-chat.");
                }
              } else {
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
