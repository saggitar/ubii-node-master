const express = require('express');
const http = require('http');
const https = require('https');
const bodyParser = require('body-parser');
const fs = require('fs');

const NetworkConfigManager = require('./networkConfigManager');

const configService = require('../config/configService');

class RESTServer {
  /**
   * Communication endpoint implementing the zmq reply pattern.
   * @param {*} port Port to bind.
   * @param {*} autoBind Should the socket bind directly after the initialization of the object?
   * If not, the start method must be called manually.
   */
  constructor(port = 5555, autoBind = true) {
    this.port = port;

    let ipLan = NetworkConfigManager.hostAdresses.ethernet;
    let ipWifi = NetworkConfigManager.hostAdresses.wifi;

    this.allowedOrigins = configService.getAllowedOrigins();
    this.allowedOrigins = this.allowedOrigins.concat([
      'http://' + ipLan + ':8080',
      'http://' + ipLan + ':8081',
      'http://' + ipWifi + ':8080',
      'http://' + ipWifi + ':8081',
      'http://localhost:8080',
      'http://localhost:8081'
    ]);
    this.allowedOrigins = this.allowedOrigins.map((string) => new RegExp(string));

    this.ready = false;

    if (autoBind) {
      this.start();
    }
  }

  start() {
    // init
    this.app = express();

    if (configService.useHTTPS()) {
      var credentials = {
        //ca: [fs.readFileSync(PATH_TO_BUNDLE_CERT_1), fs.readFileSync(PATH_TO_BUNDLE_CERT_2)],
        cert: fs.readFileSync(configService.getPathCertificate()),
        key: fs.readFileSync(configService.getPathPrivateKey())
      };
      this.server = https.createServer(credentials, this.app);
      this.endpoint = 'https://*:' + this.port;
    } else {
      this.server = http.createServer(this.app);
      this.endpoint = 'http://*:' + this.port;
    }

    // CORS
    this.app.use((req, res, next) => {
      //let validOrigin = this.allowedOrigins.find((element) => element === req.headers.origin);
      let validOrigin = this.allowedOrigins.some((allowed) => allowed.test(req.headers.origin));
      if (validOrigin) {
        res.header('Access-Control-Allow-Origin', req.headers.origin);
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      }

      next();
    });

    this.app.use(bodyParser.urlencoded({ extended: true }));

    // VARIANT A: PROTOBUF
    /*this.app.use(bodyParser.raw({
      type: 'application/octet-stream',
      limit: '10mb'
    }));*/

    /// VARIANT B: JSON
    this.app.use(bodyParser.json());

    this.server.listen(this.port, () => {
      this.open = true;
    });
  }

  stop() {
    this.ready = false;
    this.server.close();
  }

  /**
   * Set the message handling function to be called upon receiving a message. Also marks the this socket as ready to receive.
   * @param {*} route The route suffix after the endpoint where messages can be POSTed.
   * @param {*} callback Callback function that is called when a new message is received.
   * Callback should accept a request parameter and a response paramter.
   */
  onServiceMessageReceived(callback) {
    this.setRoutePOST('/services', callback);
    this.endpointServices = this.endpoint + '/services';
    this.ready = true;
  }

  setRoutePOST(route, callback) {
    this.app.post(route, callback);
  }

  toString() {
    let status = this.ready ? 'ready' : 'not ready';

    return 'REST-Server | ' + status + ' | POST service route ' + this.endpointServices;
  }
}

module.exports = RESTServer;
