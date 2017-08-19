/* **************************************************************
 *                  Synapse - Server
 * @author Marco Fernandez Pranno <mfernandezpranno@gmail.com>
 * @licence MIT
 * @link https://github.com/SynapseNetwork/Synapse-Server
 * @version 1.0
 * ************************************************************** */

"use strict";

let url = 'mongodb://localhost/synapse_server';

const user = process.env.DB_USER || null;
const password = process.env.DB_PASSWORD || null;
const dbInfo = process.env.DB_INFO || null;

if(user && password && process.env.NODE_ENV == 'production'){
  url = 'mongodb://'+ user + ':' + password + dbInfo;
}

module.exports = {
  schema: {
    user: "user"
  },
  regexp: {
    username: /^[a-zA-Z0-9_-]{4,25}$/,
    email: /^[\w-\.]+@[a-z_]+(\.[a-z]{2,3})+$/,
    password: /^[\w@#$*?¿\\\/\^\|':;,.\-%&(){}¡!~]{8,25}$/
  },
  url: url
};
