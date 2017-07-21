'use strict';

const mosca = require('mosca');
const promisify = require('es6-promisify');
const request = require('request');

const eagle_owl_url = process.env['EAGLE_OWL'];
if (!eagle_owl_url) {
  console.log('EAGLE_OWL environment variable not provided. Does not store data.');
}

const listener = {
  type: 'redis',
  redis: require('redis'),
  db: 12,
  host: 'localhost',
  port: 6379,
  return_buffers: true, // to handle binary payloads
};

const moscaSettings = {
  port: 1883,
  backend: listener,
  persistence: {
    factory: mosca.persistence.Redis
  }
};

let server = new mosca.Server(moscaSettings);

server.on('ready', () => {
  console.log('MQTT server is up and running at port 1883');
});

server.on('error', err => {
  console.error('Error while setting up MQTT server', err);
  process.exit(1);
});

server.on('published', function(packet, client) {
  if (!client) return;
  if (packet.topic.indexOf('$SYS') === 0) return;

  let split = packet.topic.split('/');
  let deviceId = split.splice(0, 1)[0].replace(/:/g, '');
  let type = '/' + split.join('/');

  let buffer = packet.payload.slice(0, packet.payload.length - 1);

  console.log('Packet received', deviceId, type, buffer.toString('utf-8'));

  // So here you have the MAC address of the device (in deviceId) and the type (e.g. temperature) and the value
  // Now we can send it somewhere...
  if (!eagle_owl_url) return;

  // We'll dump the data in ARM's InfluxDB instance, just to be used during DSA2017
  request.put({
    uri: eagle_owl_url,
    json: {
      notifications: [
        {
          ct: 'text/plain',
          'max-age': 0,
          ep: deviceId,
          path: type,
          payload: buffer.toString('base64')
        }
      ]
    }
  }, function(err, resp, body) {
    if (err) {
      console.log('Publishing', deviceId, type, 'failed...', err);
    }
    else if (resp.statusCode !== 200) {
      console.log('Publishing', deviceId, type, 'failed...', resp.statusCode, body);
    }
    else {
      console.log('Publishing', deviceId, type, 'succeeded');
    }
  });

});

// If you want to send something back to the device, use:
/* server.publish({
      topic: topic,
      payload: newValue,
      qos: 0,
      retain: false
    }); */
