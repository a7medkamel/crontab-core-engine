var config    = require('config')
  , Scheduler = require('./scheduler')
  , http      = require('./http')
  ;

let scheduler = new Scheduler();

scheduler.monitor();

http.listen({ port : config.get('cron.port')  }).then((app) => { app.scheduler = scheduler; });
