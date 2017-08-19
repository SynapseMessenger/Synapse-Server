/* **************************************************************
 *                  Synapse - Server
 * @author Marco Fernandez Pranno <mfernandezpranno@gmail.com>
 * @licence MIT
 * @link https://github.com/SynapseNetwork/Synapse-Server
 * @version 1.0
 * ************************************************************** */

"use strict";

const socketIO = require('socket.io');
const mongoose = require('mongoose');
const express = require('express');
const path = require('path');

const dbHandler = require('./db/handler.js');
const dbConfig = require('./config/database.js');

const INDEX = path.join(__dirname, 'index.html');
const env = process.env.NODE_ENV || 'development';
const wsPort = process.env.PORT || 9090;

class ChatServer {
  constructor() {
    this.userSockets = {};
  }

  start() {
    this.server = express()
                  .use((req, res) => res.sendFile(INDEX) )
                  .listen(wsPort, () => console.log(`Listening on ${ wsPort }`));
    this.io = socketIO(this.server);
    this.initDatabase();
    this.listenConnections();
  }

  initDatabase() {
    mongoose.Promise = global.Promise;
    mongoose.connect(dbConfig.url, { useMongoClient: true });
    const db = mongoose.connection;
    db.on('error', function(err) {
      console.error('DB connection error:' + err);
    });
    db.once('open', function() {
      console.log(`> Synapse Server running in [${env}].`);
      console.log('> Success connecting to database.');
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
              console.log(`[existing user connected] ${username}`);
              this.sendUserInitialData(user, socket);
            }
          });
        } else {
          dbHandler.saveUserUsername(username, (saveUserError, user) => {
            if(!saveUserError){
              console.log(`[new user connected] ${username}`);
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
        socket.emit('init-connection-msg', {
          user,
          allUsers
        });
        this.saveUserSocket(user._id, socket);
        this.listenClientEvents(socket, user);
        this.notifyUserStatus(user, 'user-connected');
      } else console.log('Error sending user initial data.');
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

  listenClientEvents(socket, user) {
    socket.on('chat-msg', (data) => {
      const { receiverId, emitterId } = data.message;
      const { message } = data;
      dbHandler.isOnline(receiverId, (isOnError, isOnline) => {
        if (!isOnError && isOnline) {
          const receiverSocket = this.userSockets[receiverId];
          if (receiverSocket) {
            receiverSocket.emit('chat-msg', {
              message
            });
          } else {
            console.log("Error: Socket not found.");
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
