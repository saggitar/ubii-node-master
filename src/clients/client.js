const {
    TIME_UNTIL_PING,
    TIME_UNTIL_STANDBY,
    TIME_UNTIL_INACTIVE,
    SIGN_OF_LIFE_DELTA_TIME
} = require('./constants');
const namida = require('@tum-far/namida');

var clientStateEnum = Object.freeze({
    "active":"active",
    "standby":"standby",
    "inactive":"inactive"});

class Client {
    constructor(identifier, name, namespace, server) {
        this.identifier = identifier;
        this.name = name;
        this.namespace = namespace;
        this.server = server;
        this.state = clientStateEnum.active;
        this.registrationDate = new Date();
        this.lastSignOfLife = null;
    }

    /**
     * Get the current state.
     */
    getState(){
        return this.state;
    }

    /**
     * Update the lastSignOfLife vairable with the current date.
     */
    updateLastSignOfLife(){
        this.lastSignOfLife = new Date();
    }

    /**
     * Update relevant information of this client.
     */
    updateInformation(){
        this.updateLastSignOfLife();
    }

    /**
     * Send a message to the remote.
     * @param {*} message 
     */
    sendMessageToRemote(message) {
        this.server.send(this.identifier, message);
    }

    /**
     * Ping the remote.
     * @param {Function} onPongCallback Function called when the pong message is received.
     */
    pingRemote(onPongCallback) {
        this.server.ping(this.identifier, onPongCallback);
    }

    /**
     * Deactivate the client. This function takes care of all pending tasks to correctly remove an object.
     * (For example, all intervals are cleared).
     * Note: You should call this method before clearing all references to a Client object.
     */
    deactivate(){
        if(this.signOfLifeInterval !== undefined){
            clearInterval(this.signOfLifeInterval);
        }
    }

    /**
     * Start the life monitoring process with state tracking and remote pinging.
     */
    startLifeMonitoring(){
        this.updateLastSignOfLife();

        // Specify the ping behaviour.
        let signOfLifePingCallback = () => {
            try{
                this.updateLastSignOfLife();
            } catch (e) {
                namida.error('UpdateLastSignOfLife failed',
                    `UpdateLastSignOfLife of client with id ${this.identifier} failed with an error.`,
                    ''+(e.stack || e));
            }
        }

        // Ping the remote for the first time
        this.pingRemote(()=>{
            signOfLifePingCallback();
        })
        
        // Start an interval for regular pings and state checks.
        this.signOfLifeInterval = setInterval(()=>{
            // Determine the time since the last sign of life.
            let now = new Date();
            let difference = (now - this.lastSignOfLife);

            // Determine the current state. If the state changes, ouput the feedback on the server console.
            if(difference > TIME_UNTIL_STANDBY){
                if(difference > TIME_UNTIL_INACTIVE){
                    // The client has the state inactive.
                    if(this.state !== clientStateEnum.inactive){
                        namida.log(`Client State has changed`,
                            `Client with id ${this.identifier} is not available and is now in an inactive state.`);
                    }
                    this.state = clientStateEnum.inactive;
                }else{
                    // The client has the state standby.
                    if(this.state !== clientStateEnum.standby){
                        namida.log(`Client State has changed`,
                            `Client with id ${this.identifier} is not available and is now in an standby state.`);
                    }
                    this.state = clientStateEnum.standby;
                }
            }else{
                // The client has the state active.
                if(this.state !== clientStateEnum.active){
                    namida.log(`Client State has changed`,
                        `Client with id ${this.identifier} is available again and is now in an active state.`);
                }
                this.state = clientStateEnum.active;
            }

            // Should we ping the remote?
            if(difference > TIME_UNTIL_PING){
                this.pingRemote(()=>{
                    signOfLifePingCallback();
                });
            }
        }, SIGN_OF_LIFE_DELTA_TIME);
    }
}

module.exports = {
    'Client': Client,
    'clientStateEnum': clientStateEnum,
}