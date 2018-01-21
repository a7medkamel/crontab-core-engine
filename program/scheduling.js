var config    = require('config')
  , Scheduler = require('../lib/scheduler')
  , http      = require('../lib/http')
  ;

let scheduler = new Scheduler();

scheduler.monitor();

http.listen({ port : config.get('cron.port')  }).then((app) => { app.scheduler = scheduler; });
