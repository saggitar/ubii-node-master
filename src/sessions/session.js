const EventEmitter = require('events');

const uuidv4 = require('uuid/v4');
const { proto } = require('@tum-far/ubii-msg-formats');
const SessionStatus = proto.ubii.sessions.SessionStatus;
const namida = require('@tum-far/namida');

const ProcessingModuleManager = require('../processing/processingModuleManager');

const TIMEOUT_START_REMOTE_PMS = 10000;

class Session extends EventEmitter {
  constructor(
    specs = {
      /*id,
      name = '',
      tags = [],
      description = '',
      authors = [],
      processingModules = [],
      ioMappings = []*/
    },
    masterNodeID,
    topicData,
    deviceManager,
    processingModuleManager
  ) {
    super();

    // take over specs
    specs && Object.assign(this, JSON.parse(JSON.stringify(specs)));
    // new instance is getting new ID
    this.id = uuidv4();
    this.processingModules = this.processingModules || [];
    this.ioMappings = this.ioMappings || [];

    this.masterNodeID = masterNodeID;
    this.topicData = topicData;
    this.deviceManager = deviceManager;
    this.processingModuleManager = processingModuleManager;

    this.lockstepPMs = new Map();
    this.localPMs = [];
    this.remotePMs = new Map();

    this.initialize();

    this.status = SessionStatus.CREATED;
  }

  initialize() {
    // setup for processing modules
    for (let pmSpec of this.processingModules) {
      pmSpec.sessionId = this.id;
      // if PM isn't assigned to run on a particular node, run here
      //TODO: check if dedicated processing nodes are available to run it (requires load balancing and communication)
      if (!pmSpec.nodeId) pmSpec.nodeId = this.masterNodeID;

      // should PM run on this node?
      if (pmSpec.nodeId === this.masterNodeID) {
        let pm = this.processingModuleManager.getModuleBySpecs(pmSpec, this.id);
        if (!pm) {
          pm = this.processingModuleManager.createModule(pmSpec);
        }
        if (pm) {
          pmSpec.id = pm.id;
          this.localPMs.push(pmSpec);
        } else {
          namida.logFailure(
            this.toString(),
            'could not instantiate processing module ' + pmSpec.name
          );
          return false;
        }
      }
      //PM should run on a different node, group PMs by node ID they're running on
      else {
        if (!this.remotePMs.has(pmSpec.nodeId)) {
          this.remotePMs.set(pmSpec.nodeId, []);
        }
        pmSpec.id = uuidv4(); // assign ID to PM spec before starting remotely
        this.remotePMs.get(pmSpec.nodeId).push(pmSpec);
      }

      // fill out ID for I/O mapping for this PM
      // if multiple PMs specified within this session have the same name referenced by the mapping and no specific ID is given by the mapping,
      // it is assumed it doesn't matter which PM receives which I/O mapping as they're all instances of the same PM
      let ioMapping = this.ioMappings.find(
        (mapping) => !mapping.processingModuleId && mapping.processingModuleName === pmSpec.name
      );
      if (ioMapping) ioMapping.processingModuleId = pmSpec.id;

      // gather PMs running in lockstep, group PMs by node ID they're running on
      if (pmSpec.processingMode && pmSpec.processingMode.lockstep) {
        if (!this.lockstepPMs.has(pmSpec.nodeId)) {
          this.lockstepPMs.set(pmSpec.nodeId, []);
        }
        this.lockstepPMs.get(pmSpec.nodeId).push(pmSpec);
      }
    }

    if (this.remotePMs.size > 0) {
      this.processingModuleManager.addListener(
        ProcessingModuleManager.EVENTS.PM_STARTED,
        this.onProcessingModuleStarted
      );
    }

    this.processingModuleManager.applyIOMappings(this.ioMappings, this.id);
  }

  start() {
    if (this.status === SessionStatus.RUNNING) {
      namida.logFailure('Session ' + this.id, "can't be started again, already processing");
      return false;
    }

    if (!this.processingModules || this.processingModules.length === 0) {
      namida.logFailure('Session ' + this.id, 'session has no processing modules to start');
      return false;
    }

    this.status = SessionStatus.RUNNING;

    // start processing modules
    this.localPMs.forEach((pm) => {
      this.processingModuleManager.getModuleByID(pm.id).start();
    });
    this.pmAwaitingRemoteStart = [];
    this.remotePMs.forEach((pm) => {
      this.pmAwaitingRemoteStart.push(pm);
    });
    if (this.pmAwaitingRemoteStart.length > 0) {
      setTimeout(() => {
        this.emit(Session.EVENTS.START_FAILURE, this.pmAwaitingRemoteStart);
      }, TIMEOUT_START_REMOTE_PMS);
    }

    // start lockstep cycles
    this.tLastLockstepPass = Date.now();
    this.lockstepProcessingPass();

    return true;
  }

  stop() {
    if (this.status !== SessionStatus.RUNNING) {
      return false;
    }

    this.status = SessionStatus.STOPPED;

    if (this.remotePMs.size > 0) {
      this.processingModuleManager.removeListener(
        ProcessingModuleManager.EVENTS.PM_STARTED,
        this.onProcessingModuleStarted
      );
    }

    for (let processingModule of this.localPMs) {
      this.processingModuleManager.getModuleByID(processingModule.id).stop();
    }

    this.lockstepPMs = new Map();
    this.localPMs = [];
    this.remotePMs = new Map();

    return true;
  }

  onProcessingModuleStarted(remotePMSpec) {
    console.info('session onProcessingModuleStarted');
    console.info(remotePMSpec);

    let index = this.pmAwaitingRemoteStart.findIndex(
      (pm) => pm.sessionId === this.id && pm.id === remotePMSpec.id
    );
    if (index !== -1) {
      this.pmAwaitingRemoteStart.splice(index, 1);
    }
    console.info(this.pmAwaitingRemoteStart);
  }

  lockstepProcessingPass() {
    // timing
    let tNow = Date.now();
    let deltaTime = tNow - this.tLastLockstepPass;
    this.tLastLockstepPass = tNow;

    // gather inputs
    let processingPromises = [];
    this.lockstepPMs.forEach((pms, clientID) => {
      // one request per client
      let lockstepProcessingRequest = {
        processingModuleIds: [],
        records: [],
        deltaTimeMs: deltaTime
      };

      pms.forEach((pm) => {
        lockstepProcessingRequest.processingModuleIds.push(pm.id);

        // gather inputs for all PMs running under client ID
        let inputMappings = this.ioMappings.find((element) => element.processingModuleId === pm.id)
          .inputMappings;
        if (inputMappings) {
          pm.inputs.forEach((input) => {
            let inputMapping = inputMappings.find(
              (element) => element.inputName === input.internalName
            );
            let topicSource = inputMapping[inputMapping.topicSource] || inputMapping.topicSource;
            // single topic input
            if (typeof topicSource === 'string') {
              let topicdataEntry = this.topicData.pull(topicSource);
              let record = { topic: topicSource };
              record.type = topicdataEntry.type;
              record[topicdataEntry.type] = topicdataEntry.data;
              lockstepProcessingRequest.records.push(record);
            }
            // topic muxer input
            else if (typeof topicSource === 'object') {
              let records = this.deviceManager.getTopicMux(topicSource.id).get();
              lockstepProcessingRequest.records.push(...records);
            }
          });
        }
      });

      // send out request, save promise
      processingPromises.push(
        this.processingModuleManager
          .sendLockstepProcessingRequest(clientID, lockstepProcessingRequest)
          .then((lockstepProcessingReply) => {
            // sanity check making sure all PMs were included
            let allProcessingModulesReplied = lockstepProcessingRequest.processingModuleIds.every(
              (id) => lockstepProcessingReply.processingModuleIds.includes(id)
            );
            if (!allProcessingModulesReplied) {
              let missingIDs = lockstepProcessingRequest.processingModuleIds.filter(
                (id) => !lockstepProcessingReply.processingModuleIds.includes(id)
              );
              let message = 'not all ProcessingModules replied during lockstep pass, missing are:';
              missingIDs.forEach((id) => {
                let pm = this.processingModuleManager.getModuleByID(id);
                message += '\n' + pm.toString();
              });
              namida.logFailure(this.toString(), message);
            }

            // publish received records to topicdata
            lockstepProcessingReply.records.forEach((record) => {
              this.topicData.publish(record.topic, record[record.type], record.type);
            });
          })
      );
    });

    Promise.all(processingPromises).then(() => {
      setImmediate(() => {
        this.lockstepProcessingPass();
      });
    });
  }

  toProtobuf() {
    return {
      id: this.id,
      name: this.name,
      authors: this.authors,
      tags: this.tags,
      description: this.description,
      processingModules: this.processingModules,
      ioMappings: this.ioMappings
    };
  }

  toString() {
    return 'Session ' + this.name + ' (ID ' + this.id + ')';
  }
}

Session.EVENTS = Object.freeze({
  START_FAILURE: 1
});

module.exports = { Session };
