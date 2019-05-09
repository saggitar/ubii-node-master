const {MasterNode} = require('./node/masterNode');

const {Client} = require('./clients/client');
const {ClientManager} = require('./clients/clientManager');

const {DeviceManager} = require('./devices/deviceManager');
const {Watcher} = require('./devices/watcher');
const {Participant} = require('./devices/participant');
const {TopicMultiplexer} = require('./devices/topicMultiplexer');
const {TopicDemultiplexer} = require('./devices/topicDemultiplexer');

const {Session} = require('./sessions/session');
const {SessionManager} = require('./sessions/sessionManager');
const {Interaction} = require('./sessions/interaction');

const {ServiceManager} = require('./services/serviceManager');
const {ClientRegistrationService} = require('./services/clientRegistrationService');
const {DeviceRegistrationService} = require('./services/deviceRegistrationService');
const {SubscriptionService} = require('./services/subscriptionService');

module.exports = {
    'MasterNode': MasterNode,
    'Client': Client,
    'ClientManager': ClientManager,
    'DeviceManager': DeviceManager,
    'Watcher': Watcher,
    'Participant': Participant,
    'TopicMultiplexer': TopicMultiplexer,
    'TopicDemultiplexer': TopicDemultiplexer,
    'Session': Session,
    'SessionManager': SessionManager,
    'Interaction': Interaction,
    'ServiceManager': ServiceManager,
    'ClientRegistrationService': ClientRegistrationService,
    'DeviceRegistrationService': DeviceRegistrationService,
    'SubscriptionService': SubscriptionService
};
