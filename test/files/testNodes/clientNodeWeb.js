const {
  RESTClient,
  WebsocketClient
} = require('@tum-far/ubii-msg-transport');
const {
  ServiceRequestTranslator,
  ServiceReplyTranslator,
  TopicDataTranslator
} = require('@tum-far/ubii-msg-formats');

class ClientNodeWeb {
  constructor(name,
              serviceHost,
              servicePort) {
    // Properties:
    this.name = name;
    this.serviceHost = serviceHost;
    this.servicePort = servicePort;

    // Translators:
    this.topicDataTranslator = new TopicDataTranslator();
    this.serviceRequestTranslator = new ServiceRequestTranslator();
    this.serviceReplyTranslator = new ServiceReplyTranslator();

    // Cache for specifications:
    this.clientSpecification = {};
    this.deviceSpecifications = new Map();

    // Service requests
    this.pendingServiceRequests = [];
    this.activeServiceRequest = null;
  }

  /**
   * Initialize this client.
   */
  async initialize() {
    return new Promise((resolve, reject) => {
      this.serviceClient = new RESTClient(this.serviceHost, this.servicePort);

      this.registerClient()
        .then(() => {
          this.initializeTopicDataClient(this.clientSpecification);
          resolve();
        })
        .catch((error) => {
          console.warn(error);
          reject();
        });
    });


    /*return new Promise((resolve, reject) => {
     this.initializeServiceClient((received) => {
     if (this.activeServiceRequest !== null) {
     // Resolve currently active service request.
     this.activeServiceRequest.processReply(received);

     // Process next pending service request.
     this.processNextServiceRequest();
     }

     // The reply is an error. Process the received error.
     if (received.error !== undefined && received.error !== null) {
     console.log(received.error.title + ' /// ' + received.error.message + ' /// ' + received.error.stack);
     }
     });
     resolve();
     })
     .then(() => {
     // Automatically register the client.
     return this.registerClient();
     })
     .then(() => {
     // Initialize the topicDataClient accroding to the clientspecification.
     this.initializeTopicDataClient(this.clientSpecification);
     });*/
  }

  /*initializeServiceClient(automatedServiceRequestProcessingCallback) {
   // Initialize the service client.
   this.serviceClient = new RESTClient(this.serviceHost, this.servicePort, (response) => {
   try {
   // Decode the received service reply buffer.
   let received = this.serviceReplyTranslator.createMessageFromBuffer(response);

   // Check the service reply if it should be processed automatically:
   automatedServiceRequestProcessingCallback(received);

   // Call the registered callback method with the received service reply message.
   this.onServiceMessageReceived(received);
   } catch (e) {
   (console.error || console.log).call(console, 'Ubii client service reply processing failed with an error: ' + (e.stack || e));
   }
   });
   }*/

  initializeTopicDataClient(clientSpecification) {
    this.topicDataClient = new WebsocketClient(
      clientSpecification.identifier,
      clientSpecification.topicDataHost,
      parseInt(clientSpecification.topicDataPortWs),
      (message) => {
        try {
          // Decode the buffer.
          let received = this.topicDataTranslator.createMessageFromBuffer(message);

          // Call callbacks.
          this.onTopicDataMessageReceived(received);
        } catch (e) {
          (console.error || console.log).call(console, 'Ubii Message Translator createMessageFromBuffer failed with an error: ' + (e.stack || e));
        }
      });
  }

  /**
   * Is this client already initialized?
   */
  isInitialized() {
    // Check if both clients are initialized.
    if (this.serviceClient === undefined || this.topicDataClient === undefined) {
      return false;
    }
    return true;
  }

  /**
   * Add the specified serviceRequest to the pending service requests list.
   * @param {*} serviceRequest
   */
  /*addServiceRequest(serviceRequest) {
   let startProcess = false;

   // Should we invoke the process?
   // If there is an active service request this is not necessary because it will process the next perning
   // service request automatically when its response is received.
   if (this.activeServiceRequest === null) {
   startProcess = true;
   }

   // Push the serviceRequest.
   this.pendingServiceRequests.push(serviceRequest);

   // Invoke the service request process if necessary.
   if (startProcess) {
   this.processNextServiceRequest();
   }
   }*/

  /**
   * Start the processing of the next pending service request if there is one.
   * Resets the activeServiceRequest otherwise.
   */

  /*processNextServiceRequest() {
   if (this.pendingServiceRequests.length > 0) {
   // There is a pending service request: Start the processing of this request.

   // Set the active service request to the next pending service request.
   this.activeServiceRequest = this.pendingServiceRequests.shift();

   // Send the request to the server.
   this.serviceClient.send(this.activeServiceRequest.formulateRequest());
   } else {
   // There are no pending service requests: Reset active service request.

   this.activeServiceRequest = null;
   }
   }*/

  /**
   * Register this client at the masterNode.
   */
  async registerClient() {
    /*return new Promise((resolve, reject) => {
     // Create the serviceRequest.
     let serviceRequest = {
     formulateRequest: () => {
     let payload = {
     clientRegistration: {
     name: this.name,
     namespace: ''
     }
     };

     return this.serviceRequestTranslator.createBufferFromPayload(payload);
     },
     processReply: (reply) => {
     // The reply should be a client specification.
     if (reply.clientSpecification !== undefined && reply.clientSpecification !== null) {
     // Process the reply client specification.

     // Cache the client specification.
     this.clientSpecification = reply.clientSpecification;

     resolve();
     } else {
     // TODO: log error
     reject();
     }
     }
     };

     this.addServiceRequest(serviceRequest);
     });*/
    return new Promise((resolve, reject) => {
      let message = {
        clientRegistration: {
          name: this.name,
          namespace: ''
        }
      };

      this.serviceClient.send('/services', {buffer: this.serviceRequestTranslator.createBufferFromPayload(message)})
        .then((reply) => {
          let message = this.serviceReplyTranslator.createMessageFromBuffer(reply.buffer.data);
          if (message.clientSpecification !== undefined && message.clientSpecification !== null) {
            // Process the reply client specification.

            // Cache the client specification.
            this.clientSpecification = message.clientSpecification;

            resolve();
          }
        });
    });
  }

  /**
   * Register the specified device at the masterNode.
   * @param {String} deviceName
   * @param {*} deviceType
   */
  async registerDevice(deviceName, deviceType) {
    /*return new Promise((resolve, reject) => {
     // Create the serviceRequest.
     let serviceRequest = {
     formulateRequest: () => {
     let payload = {
     deviceRegistration: {
     name: deviceName,
     deviceType: deviceType,
     correspondingClientIdentifier: this.clientSpecification.identifier,
     }
     };

     return this.serviceRequestTranslator.createBufferFromPayload(payload);
     },
     processReply: (reply) => {
     // The reply should be a device specification.
     if (reply.deviceSpecification !== undefined && reply.deviceSpecification !== null) {
     // Process the reply client specification.
     this.deviceSpecifications.set(reply.deviceSpecification.name, reply.deviceSpecification);
     resolve();
     } else {
     // TODO: log error
     reject();
     }
     }
     };

     this.addServiceRequest(serviceRequest);*/


    //////
    return new Promise((resolve, reject) => {
      let message = {
        deviceRegistration: {
          name: deviceName,
          deviceType: deviceType,
          correspondingClientIdentifier: this.clientSpecification.identifier,
        }
      };

      this.serviceClient.send('/services', {buffer: this.serviceRequestTranslator.createBufferFromPayload(message)})
        .then((reply) => {
          let message = this.serviceReplyTranslator.createMessageFromBuffer(reply.buffer.data);
          console.info(message);
          // The reply should be a device specification.
          if (message.deviceSpecification !== undefined && message.deviceSpecification !== null) {
            // Process the reply client specification.
            this.deviceSpecifications.set(message.deviceSpecification.name, message.deviceSpecification);
            resolve();
          } else {
            // TODO: log error
            reject();
          }
        });
    });
  }

  /**
   * Subscribe and unsubscribe to the specified topics.
   * @param {*} deviceName
   * @param {*} subscribeTopics
   * @param {*} unsubscribeTopics
   */
  async subscribe(deviceName, subscribeTopics, unsubscribeTopics) {
    return new Promise((resolve, reject) => {
      // Create the serviceRequest.
      let serviceRequest = {
        formulateRequest: () => {
          let payload = {
            topic: '',
            subscribtion: {
              deviceIdentifier: this.deviceSpecifications.get(deviceName).identifier,
              subscribeTopics: subscribeTopics,
              unsubscribeTopics: unsubscribeTopics
            }
          };

          return this.serviceRequestTranslator.createBufferFromPayload(payload);
        },
        processReply: (reply) => {
          // The reply should be a success.
          if (reply.success !== undefined && reply.success !== null) {
            resolve();
          } else {
            // TODO: log error
            reject();
          }
        }
      };

      this.addServiceRequest(serviceRequest);
    });
  }

  /**
   * Publish the specified value of the specified type under the specified topic to the master node.
   * @param {String} deviceName
   * @param {String} topic
   * @param {String} type
   * @param {*} value
   */
  publish(deviceName, topic, type, value) {
    let payload, buffer;

    payload = {
      deviceIdentifier: this.deviceSpecifications.get(deviceName).identifier,
      topicDataRecord: {
        topic: topic
      }
    };
    payload.topicDataRecord[type] = value;

    buffer = this.topicDataTranslator.createBufferFromPayload(payload);

    this.topicDataClient.send(buffer);
  }

  onTopicDataMessageReceived(message) {

  }
}

module.exports = {
  ClientNodeWeb: ClientNodeWeb,
};