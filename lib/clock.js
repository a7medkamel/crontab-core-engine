var Promise     = require('bluebird')
  , winston     = require('winston')
  , _           = require('lodash')
  , config      = require('config-url')
  , async       = require('async')
  , ascoltatori = require('ascoltatori')
  , cron        = require('crontab-core-cron')
  ;

class Clock {
  constructor(options = {}) {
    let now = new Date();

    now.setSeconds(0);
    now.setMilliseconds(0);

    // snap min and max to minute boundry
    let min                   = now.getTime()
      , max                   = min + 60 * 1000
      , { handler = _.noop }  = options
      , redis                 = require('./redis').connect()
      ;

    let pubsub = Promise
                  .fromCallback((cb) => {
                    ascoltatori.build({
                      type            : 'redis',
                      redis           : require('redis'),
                      db              : config.get('pubsub.db'),
                      host            : config.getUrlObject('pubsub').host,
                      port            : config.getUrlObject('pubsub').port,
                      password        : config.get('pubsub.password')
                    }, cb);
                  });

    Object.assign(this, { min, max, handler, pubsub, redis });

    // todo [akamel] what if tick is called before this? needs synchronization
    pubsub.then((p) => p.publish('cron:cursor', min));
  }

  tick() {
    let { pubsub } = this;

    // todo [akamel] this might result in us working on a range that has passed, if we spent more than 60+ sec running last range
    let min = this.max
      , max = this.max + 60 * 1000; // move to next min
      ;

    pubsub
      .then((p) => Promise.fromCallback((cb) => p.publish('cron:cursor', this.min, cb)))
      .tap(() => {
        let at = new Date(min);

        winston.info(`done with up to ${at.toTimeString()}`);
      });

    Object.assign(this, { min, max });
  }

  exec(key, at) {
    let { redis } = this;

    return redis
            .getAsync(key)
            .then(JSON.parse)
            .then((crontab) => {
              let { jobs } = crontab;

              // 1. get jobs to run
              let next = _.chain(jobs).map((j) => _.extend({ at : cron.next(j.cron, at) }, j))
                , due  = next.filter((j) => j.at === at)
                ;

              return Promise
                      .resolve(due.value())
                      .tap((due) => {
                        if (_.size(due) === 0) {
                          winston.warn('exec', 'no items found to run', key, at, next.value());
                        }
                      })
                      .map((due) => {
                        // 2. execute command
                        this.handler({ key, ...due })
                      });
            });
  }

  // todo [akamel] can we have a race condition where we update the db and end up with2 entries in the 'set'?
  consume(min, max) {
    let { redis } = this;

    return Promise
            .fromCallback((cb) => {
              var offset  = 0
                , take    = 10 * 1000
                ;

              async.doWhilst((callback) => {
                Promise
                  .fromCallback((cb) => {
                    redis.zrangebyscore(['cron', min, '(' + max, 'WITHSCORES', 'LIMIT', offset, take], cb);
                  })
                  .then((res) => {
                    let chunks  = _.chunk(res, 2)
                      , count   = _.size(chunks)
                      , now     = new Date()
                      ;

                    offset += count;

                    // exec jobs
                    if (_.size(chunks)) {
                      _.each(chunks, (chunk) => {
                        let at    = parseInt(chunk[1])
                          , time  = new Date(at)
                          , key   = chunk[0]
                          ;

                        this.exec(key, at);

                        winston.info(`exec ${key} at ${time.toTimeString()}`);
                      });

                      var f = _.parseInt(_.first(chunks)[1])
                        , t = _.parseInt(_.last(chunks)[1])
                        ;

                      winston.info(now.toTimeString(), offset, 'from', new Date(f).toTimeString(), 'to', new Date(t).toTimeString());
                    }

                    return count;
                  })
                  .asCallback(callback)
              }, (c) => c === take, cb);
            });
  }

  monitor() {
    async.forever(
      (next) => {
        this
          .consume(this.min, this.max)
          .catch(() => {})
          .then(() => this.tick())
          .tap(() => {
            let now   = new Date().getTime()
              , diff  = this.min - now
              , in_ms = Math.max(0, diff)
              ;

            return Promise.delay(in_ms);
          })
          .catch((err) => {
            winston.error(err);
          })
          .asCallback(next);
      },
      (err) => {
          // if next is called with a value in its first parameter, it will appear
          // in here as 'err', and execution will stop.
      }
    );
  }
}

module.exports = Clock;
