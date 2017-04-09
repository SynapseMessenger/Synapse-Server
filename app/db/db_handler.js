"use strict";

const User = require('./user_model.js');

function isUser (username, email, done) {
  Handler.findUser(username, (err, res)=> {
    if (res) return done(err, true);
    else {
      Handler.findUser(email, (err, res)=> {
        if (res) return done(err, true);
        else return done(err, false);
      });
    }
  });
}

const Handler = {
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

  findById: (userId, done)=> {
    if (!userId) return done(new Error("Id not provided."));
    else User.findById(userId, done);
  },

  onlineUsers: (done) => {
    User.find({online: true}, done);
  },

  saveUser: (newUserData, done)=> {
    if (!newUserData.username || !newUserData.email || !newUserData.password)
      done(new Error("Save: User info incorrect"));

    isUser(newUserData.username, newUserData.email, (err, isUser)=> {
      if (err) done(err);
      else if (isUser === true) done(new Error("Save: User already exists"));
      else {
        const newUser = new User({
          username: newUserData.username,
          email: newUserData.email,
          password: newUserData.password
        });
        newUser.save((err, res)=> {
          done(err, res);
        });
      }
    });
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
  },

  updateUser: (userId, changes, done)=> {
    if (!userId) done(new Error("No id provided"));
    else {
      isUser(changes.username, changes.email, (err, res)=> {
        if (!res) {
          User.update({
            _id: userId
          }, {
            $set: changes
          }, done);
        } else done(new Error("Update: username/email already exists"));
      });
    }
  }
};

module.exports = Handler;