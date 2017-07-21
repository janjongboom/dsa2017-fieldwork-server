'use strict';

const mosca = require('mosca');
const promisify = require('es6-promisify');
const request = require('request');
const dgram = require('dgram');
const udpServer = dgram.createSocket('udp4');
const Struct = require('struct');

const eagle_owl_url = process.env['EAGLE_OWL'];
if (!eagle_owl_url) {
  console.log('EAGLE_OWL environment variable not provided. Does not store data.');
}

// MQTT Server

const listener = {
  type: 'redis',
  redis: require('redis'),
  db: 12,
  host: 'localhost',
  port: 6379,
  return_buffers: true, // to handle binary payloads
  maxInflightMessages: 10000
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

// UDP Server
udpServer.on('listening', () => {
  var address = udpServer.address();
  console.log('UDP Server is up and running at port', address.port);
});

let messages = {};

udpServer.on('message', (message, remote) => {
  let key = remote.address + ':' + remote.port;

  // messages come in two... wait for the second one
  if (!(key in messages)) {
    setTimeout(() => {
      let totalLength = messages[key].reduce((curr, m) => curr + m.length, 0);
      if (totalLength === 1470 + 528) {
        // now my message is complete
        let pos = 0;
        let buffer = Buffer.concat(messages[key]);

        let entry = Struct()
          .chars('mac', 17)
          .array('x', 330, 'word16Sbe')
          .array('y', 330, 'word16Sbe')
          .array('z', 330, 'word16Sbe');

        entry._setBuff(buffer);

        entry.fields.x.length = entry.fields.y.length = entry.fields.z.length = 330;

        console.log('Got accelerometer data for', entry.fields.mac);
        // read the data via `Array.from(entry.fields.x)`

        // So here you have the MAC address of the device (in deviceId) and the type (e.g. temperature) and the value
        // Now we can send it somewhere...
        if (!eagle_owl_url) return;

        let deviceId = entry.fields.mac.replace(/:/g, '');
        let type = '/accelerometer';

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
                payload: new Buffer(JSON.stringify({
                  // for some reason x[0] is always borked... whatever...
                  x: Array.from(entry.fields.x).slice(1),
                  y: Array.from(entry.fields.y).slice(1),
                  z: Array.from(entry.fields.z).slice(1),
                })).toString('base64')
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

      }
      else {
        console.log('msg was incomplete after 200 ms...', totalLength);
      }
      delete messages[key];
    }, 200);
  }

  messages[key] = messages[key] || [];
  messages[key].push(message);

  console.log('UDP Receive', remote.address, remote.port, message.length);
});

udpServer.bind(1884, '0.0.0.0');

// If you want to send something back to the device, use:
/* server.publish({
      topic: topic,
      payload: newValue,
      qos: 0,
      retain: false
    }); */
