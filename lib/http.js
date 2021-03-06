var express       = require('express')
  , Promise       = require('bluebird')
  , bodyParser    = require('body-parser')
  , _             = require('lodash')
  , winston       = require('winston')
  , morgan        = require('morgan')
  , http          = require('http')
  , cron          = require('crontab-core-cron')
  ;

let app     = express()
  , server  = http.createServer(app)
  ;

// app.set('view engine', 'pug');

// app.use(express.static('public'))

app.use(bodyParser.json());

app.use(morgan('short'));

app.post('/crontab', (req, res) => {
  let { id, text, meta } = req.body;

  // todo [akamel] move limit out of app
  let { limit } = app;

  if (app.scheduler) {
    app
      .scheduler
      .update_from_text(id, text, meta)
      .then(() => {
        res.send({ message : 'OK' });
      })
      .catch((err) => {
        winston.error(err);

        res.status(500).send({ message : err.message });
      });
  }
});

app.delete('/crontab/:id', (req, res) => {
  let { id } = req.params;

  Promise
    .try(() => {
      let { scheduler } = app;

      if (!scheduler) {
        throw new Error('scheduler not ready');
      }

      return scheduler.update(id, jobs);
    })
    .then(() => {
      res.send({ message : 'OK' });
    })
    .catch((err) => {
      winston.error(err);

      res.status(500).send({ message : err.message });
    });
});

function listen(options = {}) {
  return Promise
          .fromCallback((cb) => {
            server.listen(options.port, cb);
          })
          .then(() => app);
}

module.exports = {
  listen
};
