var Promise       = require('bluebird')
  , ascoltatori   = require('ascoltatori')
  , redis         = require('redis')
  ;

function connect(options = {}) {
  let { db, host, port, password } = options;

  return Promise
          .fromCallback((cb) => {
            ascoltatori.build({ type : 'redis', redis, db, host, port, password }, cb);
          });
}

module.exports = {
  connect
}
