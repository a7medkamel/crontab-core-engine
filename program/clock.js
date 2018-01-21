var Clock = require('../lib/clock');

let handler = (e) => {
  console.log('handler', e);
};

(new Clock({ handler })).monitor();
