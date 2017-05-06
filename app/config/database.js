/* **************************************************************
 *                  Synapse - Server
 * @author Marco Fernandez Pranno <mfernandezpranno@gmail.com>
 * @licence MIT
 * @link https://github.com/SynapseNetwork/Synapse-Server
 * @version 1.0
 * ************************************************************** */

"use strict";

module.exports = {
  schema: {
    user: "user"
  },
  regexp: {
    username: /^[a-zA-Z0-9_-]{4,25}$/,
    email: /^[\w-\.]+@[a-z_]+(\.[a-z]{2,3})+$/,
    password: /^[\w@#$*?¿\\\/\^\|':;,.\-%&(){}¡!~]{8,25}$/
  }
};
