# crontab-core-engine

## Install

```bash
// clone repository and run
npm install
```

## Dependency
Expects Redis to be running on localhost. Config can be changed in `default.json`.

## Run

You can either manually start the required processes or use `pm2`

### Manual

Start 2 separate processes
1. ./lib/time/program.js
1. ./lib/scheduling/program.js

> cwd need to be the root of this repository

### PM2 (Node Process Manager 2)

```bash
npm install -g pm2
```

```bash
pm2 start ecosystem.config.js
```

> cwd need to be the root of this repository

## Usage

### Create a Crontab Entry

HTTP POST http://localhost:8670/crontab
```json
{
	"id" : "foo",
	"text" : "* * * * * PAYLOAD_A \n 0 * * * * PAYLOAD_B"
}
```

`text` is in crontab format; each line represents a crontab job.

https://en.wikipedia.org/wiki/Cron

In this example, `PAYLOAD_A` will be triggered every minutes and `PAYLOAD_B` will be triggered once an hour.

### Delete
HTTP DELETE http://localhost:8670/crontab/:id

ex: http://localhost:8670/crontab/foo

## Handle Job Execution

In this fork of `taskmill-core-cron` you need to change the `handler` method in `./lib/time/program.js` to execute your desired behavior.

The current handler will console.log() the event

> This will be refactored in a future version of this fork.
