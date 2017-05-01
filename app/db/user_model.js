"use strict";

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const dbConfig = require('../config/database.js');

const saltRounds = 10;

const userSchema = mongoose.Schema({
  username: {
    type: String,
    required: true,
    match: [dbConfig.regexp.username, 'Invalid username'],
    unique: false // TODO: Change to unique
  },
  // email: {
  //   type: String,
  //   required: true,
  //   match: [dbConfig.regexp.email, 'Invalid email'],
  //   unique: true
  //
  // },
  // password: {
  //   type: String,
  //   required: true
  // },
  online: {
    type: Boolean,
    index: true,
    default: false
  },

  pendingMessages: [{
      text: String,
      emitterId: String,
      receiverId: String,
      time: Date
  }]
});

// Before saving the password, hash it.
userSchema.pre('save', function(next) {
  let doc = this;

  if (!doc.isModified('password')) return next();

  if (!dbConfig.regexp.password.test(doc.password))
    return next(new Error("Save: Password not valid"));

  bcrypt.hash(doc.password, saltRounds, (err, hash)=> {
    if(err) return next(err);

    doc.password = hash;
    return next();
  });
});

// Before update, hash password.
/*userSchema.pre('update', (next)=> {
  const query = this._update.$set;
  if (query.password) {
    if (!dbConfig.regexp.password.test(query.password)) {
      delete(query.password);
      return next(new Error("Update: Password not valid"));
    } else {
      bcrypt.hash(query.password, saltRounds, (err, hash)=> {
        if(err) {
          return next(err);
        } else {
          query.password = hash;
          return next();
        }
      });
    }
  }
});*/

// Methods

// Checks if password is valid to do so, we hash it and compare it to stored hash.
userSchema.methods.validPassword = (password, done)=> {
  if (!dbConfig.regexp.password.test(password)){
    return done(new Error("Invalid password"), false);
  } else {
    bcrypt.compare(password, this.password, (err, res)=> {
      return done(err, res);
    });
  }
};

module.exports = mongoose.model(dbConfig.schema.user, userSchema);
