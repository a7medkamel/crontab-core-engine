var Promise       = require('bluebird')
  , winston       = require('winston')
  , _             = require('lodash')
  , async         = require('async')
  , cron          = require('crontab-core-cron')
  ;

class Scheduler {
  constructor(options) {
    let { redis_options } = options;

    this.max = 0;

    this.cargo = async.cargo((keys, cb) => this.reschedule_keys(keys).asCallback(cb), 10 * 1000);

    let redis = require('./redis').connect(redis_options);

    let pubsub = require('./pubsub').connect(redis_options);

    Object.assign(this, { pubsub, redis });

    pubsub.then((p) => p.subscribe('cron:cursor', (e, msg) => {
      let max = parseInt(msg)
        , at  = new Date(max)
        ;

      winston.info(e, 'done with items scheduled up to', at.toTimeString());
      this.max = max;
    }));
  }

  delete(id) {
    let { redis } = this;

    let key = `cron:${id}`;

    return redis
            .delAsync(key)
            .then(() => {
              // todo [akamel] perf, this will do a get before reschedule, might be ok since async anyway
              return this.reschedule_keys([key]);
            });
  }

  update(id, jobs, meta) {
    let { redis } = this;

    // todo [akamel] if jobs is empty, delete entry
    let key   = `cron:${id}`
      , data  = { key, jobs, meta }
      ;

    return redis
            .setAsync(key, JSON.stringify(data))
            .then(() => {
              return this.reschedule_keys([key]);
            });
  }

  reschedule_keys(keys) {
    if (_.size(keys) === 0) {
      return Promise.delay(10);
    }

    let { redis } = this;

    return redis
            .mgetAsync(keys)
            .then((res) => _.map(res, JSON.parse))
            .then((ct) => Scheduler.schedule(redis, ct));
            // winston.info('updated', remote, branch, text);
  }

  monitor() {
    // todo [akamel] this is a problem.. first it does 0 => 0 whe consumer is not up, second, we don't need it to run every 50ms... just detect change to min
    let take = 10 * 1000;

    async.forever(
      (next) => {
        this
          .completed(take)
          .then((keys) => {
            let count = _.size(keys);

            if (count) {
              this.cargo.push(keys, _.after(count, next));
            } else {
              _.delay(next, 10 * 1000);
            }
          });
      },
      (err) => {
        // never exit
      }
    );
  }

  completed(take) {
    let { redis, max } = this;

    return Promise
            .fromCallback((cb) => {
              redis.zrangebyscore(['cron', 0, '(' + max, 'WITHSCORES', 'LIMIT', 0, take], cb);
            })
            .then((res) => {
              var chunks  = _.chunk(res, 2)
                , keys    = _.map(chunks, (c) => c[0])
                , count   = _.size(chunks)
                ;

              winston.info(new Date().toTimeString(), 'zrangebyscore', 0, '(', new Date(_.parseInt(max)).toTimeString(), 'WITHSCORES', 'LIMIT', 0, take, 'found', count);

              return keys;
            });
  }

  flush_all() {
    return this.redis.delAsync('cron');
  }

  static soonest(crons, options = {}) {
    let { after } = options;

    if (_.isUndefined(after)) {
      after = new Date().getTime() + 1000 // in case getTime is same as current run
    }

    return _.chain(crons).map((c) => cron.next(c, after)).min().value();
  }

  // [{ key, jobs [{ cron, command }] }]
  static schedule(redis, crontabs) {
    if (!_.isArray(crontabs)) {
      crontabs = [crontabs];
    }

    let op = _
              .chain(crontabs)
              .map((ct) => {
                let crons = _.map(ct.jobs, (j) => j.cron)
                  , key   = ct.key
                  , at    = Scheduler.soonest(crons)
                  ;

                return [ at, key ];
              })
              .groupBy((i) => i[0]? 'add' : 'rem')
              .value();


    let async = [];

    if (_.size(op['add'])) {
      let arg = _.concat('cron', _.flatten(op['add']));
      winston.info('add', arg);
      async.push(redis.zaddAsync(arg));
    }

    if (_.size(op['rem'])) {
      let arg = _.concat('cron', _.flatten(_.map(op['rem'], (t) => t[1])));
      winston.info('rem', arg);
      async.push(redis.zremAsync(arg));
    }

    return Promise.all(async);
  }
}

module.exports = Scheduler;
