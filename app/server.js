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
const dbHandler = require('./db/handler.js');
const dbConfig = require('./config/database.js');
const wsConfig = require('./config/websockets.js');

class ChatServer {
  constructor() {
    this.io = socketIo();
    this.port = wsConfig.port;
    this.dbUrl =  dbConfig.url;
    this.userSockets = {};
  }

  start() {
    this.initDatabase();
    this.listenConnections();
    this.io.listen(this.port);
  }

  initDatabase() {
    mongoose.Promise = global.Promise;
    mongoose.connect(this.dbUrl, { useMongoClient: true });
    const db = mongoose.connection;
    db.on('error', function(err) {
      console.error('DB connection error:' + err);
    });
    db.once('open', function() {
      console.log("Synapse Server - Database connected successfully.");
      dbHandler.setAllUsersOffline();
    });
  }

  listenConnections() {
    this.io.on('connection', (socket) => {
      const username = socket.handshake.query.username;
      if(username){
        this.handleClientConnection(socket, username);
      } else {
        socket.disconnect(0);
      }
    });
  }

  saveUserSocket(userId, socket) {
    this.userSockets[userId] = socket;
  }

  handleClientConnection(socket, username) {
    dbHandler.findUser(username, (findUserError, user) => {
      if(!findUserError) {
        if(user) {
          dbHandler.setUserConnectionStatus(user, true, (connectedError) => {
            if(!connectedError) {
              console.log(`[connected] ${username}`);
              this.sendUserInitialData(user, socket);
            }
          });
        } else {
          dbHandler.saveUserUsername(username, (saveUserError, user) => {
            if(!saveUserError){
              console.log(`[connected] ${username}`);
              this.sendUserInitialData(user, socket);
            }
          });
        }
      }
    });
  }

  sendUserInitialData(user, socket) {
    let errors = false;
    dbHandler.allUsers((onUsersError, allUsers) => {
      if(!onUsersError){
        dbHandler.pendingMessages(user._id, (pendingError, pendingMessages) => {
          if(!pendingError){
            socket.emit('init-connection-msg', {
              user,
              allUsers,
              pendingMessages
            });
            this.saveUserSocket(user._id, socket);
            this.listenClientEvents(socket, user);
            this.notifyUserStatus(user, 'user-connected');
            dbHandler.clearPendingMessages(user._id, (err, res) => {
              if(err) console.log("Error clearing pending messages: ", err);
            });
          }
        })
      }
    });
  }

  notifyUserStatus(user, eventName) {
    dbHandler.onlineUsers((err, res) => {
      if (!err) {
        res.forEach(usuario => {
          if(usuario._id !== user._id) {
            this.userSockets[usuario._id].emit(eventName, user);
          }
        });
      } else {
        console.log('Error: notifyConnectedUser.onlineUsers');
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

    socket.on('receive-key', data => {
      const userSocket = this.userSockets[data.userId];
      if (userSocket) {
        userSocket.emit('receive-key', data);
      }
    });

    socket.on('request-key', (data) => {
      const generatorSocket = this.userSockets[data.generatorId];
      if (generatorSocket) {
        generatorSocket.emit('request-key', data);
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
            // TODO: Fix this.
            // dbHandler.savePendingMessage(receiverId, message);
          }
        }
      });
    });
 
    socket.on('disconnect', () => {
      dbHandler.setUserConnectionStatus(user, false, (err) => {
        if(!err){
          console.log(`[disconnected] ${user.username}`);
          this.notifyUserStatus(user, 'user-disconnected');
        } else {
          console.log(`[disconnected] ${user.username}`);
        }
      });
    });

  }
}

module.exports = ChatServer;
