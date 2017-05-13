/* **************************************************************
 *                  Synapse - Server
 * @author Marco Fernandez Pranno <mfernandezpranno@gmail.com>
 * @licence MIT
 * @link https://github.com/SynapseNetwork/Synapse-Server
 * @version 1.0
 * ************************************************************** */

"use strict";

const User = require('./user_model.js');

const Handler = {
  // TODO: Complete/Fix when email/password functionality is included.
  findUser: (username, done)=> {
    if (!username) return done(new Error("Find: Nor email or username provided."));
    User.findOne({
      $or: [{
        "username": new RegExp("^" + username, "i")
      }, {
        "email": username
      }]
    }, done);
  },

  // TODO: Complete/Fix when email/password functionality is included.
  isUser: (username, /* email, */ done) => {
    Handler.findUser(username, (err, res)=> {
      if (res) return done(err, true);
      else return done(err, false);
      // else {
      //   Handler.findUser(email, (err, res)=> {
      //     if (res) return done(err, true);
      //     else return done(err, false);
      //   });
      // }
    });
  },

  allUsers: (done) => {
    User.find({}, (err, res) => {
      done(err, res);
    });
  },

  clearPendingMessages: (userId, done) => {
    User.update({
      _id: userId
    }, {
      $set: { pendingMessages: [] }
    }, done);
  },

  setUserConnectionStatus: (userId, status, done) => {
    User.update({
      _id: userId
    }, {
      $set: { online: status }
    }, done);
  },

  findById: (userId, done) => {
    if (!userId) return done(new Error("Id not provided."));
    else User.findById(userId, done);
  },

  isOnline: (userId, done) => {
    if (!userId) return done(new Error("Id not provided."));
    else User.findById(userId, (err, res) => {
      if(!err){
        done(err, res.online);
      } else {
        done(new Error("User not found."))
      }
    });
  },

  setAllUsersOffline: () => {
    User.update({ online: true }, { online: false }, { multi: true }, (err, res) => {
      if(!err) console.log("All users set to offline.");
      else console.log("Error setting users offline: ", err);
    });
  },

  pendingMessages: (userId, done) => {
    if (!userId) return done(new Error("Id not provided."));
    else User.findById(userId, (err, res) => {
      if(!err){
        done(err, res.pendingMessages);
      } else {
        done(new Error("User not found."))
      }
    });
  },

  savePendingMessage: (receiverId, message) => {
    User.findByIdAndUpdate(receiverId,
      { $push: { pendingMessages: message }},
      (err, res) => {
        if(err) console.log(err);
      }
    );
  },

  isSessionEstablished: (userA, userB, done) => {
    done(true);
  },

// Save online users in object on memory, not on DB ???
// TODO: Study tradeoffs.
  onlineUsers: (done) => {
    User.find({online: true}, done);
  },

  saveUserUsername: (username, done) => {
    const newUser = new User({
      username: username,
      online: true
    });
    newUser.save((err, res)=> {
      done(err, res);
    });
  },

  removeUser: (userId, done)=> {
    this.findById(userId, (err, result)=> {
      if (err) done(err);
      else if (result) {
        result.remove((err)=> {
          done(err);
        });
      } else done(new Error("Remove: user not found"));
    });
  }
};

module.exports = Handler;
