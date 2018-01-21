var Promise     = require('bluebird')
  , winston     = require('winston')
  , _           = require('lodash')
  , redis       = require('redis')
  ;

Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);

function connect(options = {}) {
  let { db, host, port, password } = options;

  let opt = { db, host, port };

  if (password) {
    opt.password = password
  }

  let ret = redis.createClient(opt);

  ret.on('error', (err) => {
    winston.error('redis', err);
  });

  return ret;
}

module.exports = {
    connect : connect
};
