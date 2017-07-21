# DSA 2017 Fieldwork Server

This is the MQTT server which is used during the fieldwork at Data Science Africa. It retrieves data from a sensor and publishes it to InfluxDB. The client is located at [janjongboom/dsa2017-fieldwork-fw](https://github.com/janjongboom/dsa2017-fieldwork-fw).

## How it works

It exposes two services:

* MQTT Service for simple sensor data (like temperature / moisture) on port 1883.
* UDP Service for data that needs high throughput (like accelerometer) on port 1884.

## How to install

1. Install [node.js](http://nodejs.org) 6.x or higher.
1. Install [Redis](https://redis.io).
1. Install dependencies:

    ```
    $ npm install
    ```

1. Then run the server via:

    ```
    $ node server.js
    ```

By default it does not store data. During the fieldwork you can receive the data from ARMs InfluxDB instance, via:

```
GET http://hello-linkerd-admin.eagleowl.online/query?db=example&q=
```

Then pass in a query.

**Numeric data**

```
# your device ID is the MAC address of the WiFi chip, where : is replaced

SELECT "value" FROM example..sensor_data WHERE deviceId='6001941fcff9' AND type='/temperature' AND time > now() - 10m
```

**Non-numeric data**

```
# your device ID is the MAC address of the WiFi chip, where : is replaced

SELECT "value" FROM example..other_data WHERE deviceId='6001941fcff9' AND type='/accelerometer' AND time > now() - 10m
```
