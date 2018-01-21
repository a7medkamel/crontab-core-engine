var Promise       = require('bluebird')
  , config        = require('config-url')
  , ascoltatori   = require('ascoltatori')
  , redis         = require('redis')
  ;

function connect() {
  return Promise
          .fromCallback((cb) => {
            ascoltatori.build({
                type            : 'redis'
              , redis
              , db              : config.get('pubsub.db')
              , host            : config.getUrlObject('pubsub').host
              , port            : config.getUrlObject('pubsub').port
              , password        : config.get('pubsub.password')
            }, cb);
          });
}

module.exports = {
  connect
}
