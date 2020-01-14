const { DEFAULT_TOPICS } = require('@tum-far/ubii-msg-formats');

const { Service } = require('./../service.js');
const SessionDatabase = require('../../storage/sessionDatabase');

class SessionStartService extends Service {
  constructor(sessionManager) {
    super(DEFAULT_TOPICS.SERVICES.SESSION_START);

    this.sessionManager = sessionManager;
  }

  reply(message) {
    if (typeof message === 'undefined') {
      return {
        error: {
          title: 'SessionStartService Error',
          message: 'No session specifications given'
        }
      }
    }

    // check session manager for existing session by ID
    if (this.sessionManager.getSession(message.id)) {
      try {
        this.sessionManager.startSessionByID(message.id);
      } catch (error) {
        return {
          error: {
            title: 'SessionStartService Error',
            message: error.toString(),
            stack: error.stack && error.stack.toString()
          }
        }
      }

      return {
        success: {
          title: 'SessionStartService Success',
          message: 'Started existing session with ID ' + message.id
        }
      }
    }

    // check session database for existing session by ID
    if (SessionDatabase.hasSession(message.id)) {
      try {
        let specs = SessionDatabase.getSession(message.id);
        let session = this.sessionManager.createSession(specs);
        this.sessionManager.startSessionByID(session.id);
      } catch (error) {
        return {
          error: {
            title: 'SessionStartService Error',
            message: error.toString(),
            stack: error.stack && error.stack.toString()
          }
        }
      }

      return {
        success: {
          title: 'SessionStartService Success',
          message: 'Loaded existing session with ID ' + message.id + ' from database'
        }
      }
    }

    // try creating new session from message
    try {
      let session = this.sessionManager.createSession(message);
      this.sessionManager.startSessionByID(session.id);
    } catch (error) {
      return {
        error: {
          title: 'SessionStartService Error',
          message: error.toString(),
          stack: error.stack && error.stack.toString()
        }
      }
    }

    return {
      success: {
        title: 'SessionStartService Success',
        message: 'Created new session from message'
      }
    };
  }
}

module.exports = {
  'SessionStartService': SessionStartService,
};