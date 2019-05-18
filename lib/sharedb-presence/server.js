const Backend = require('sharedb')
const util = require('sharedb/lib/util')
const { Connection, Doc, Agent } = Backend

class AgentWithPresence extends Agent {
  constructor (backend, stream) {
    super(backend, stream)
    this._agentPresence = new backend.presence.AgentPresence(this);
  }
  _subscribeToStream (collection, id, stream) {
    if (this.closed) return stream.destroy();
  
    var streams = this.subscribedDocs[collection] || (this.subscribedDocs[collection] = {});
  
    // If already subscribed to this document, destroy the previously subscribed stream
    var previous = streams[id];
    if (previous) previous.destroy();
    streams[id] = stream;
  
    var agent = this;
    stream.on('data', function(data) {
      if (data.error) {
        // Log then silently ignore errors in a subscription stream, since these
        // may not be the client's fault, and they were not the result of a
        // direct request by the client
        logger.error('Doc subscription stream error', collection, id, data.error);
        return;
      }
      if (agent._agentPresence.isPresenceMessage(data)) {
        agent._agentPresence.processPresenceData(data);
        return;
      }
  
      if (agent._isOwnOp(collection, data)) return;
      agent._sendOp(collection, id, data);
    });
    stream.on('end', function() {
      // The op stream is done sending, so release its reference
      var streams = agent.subscribedDocs[collection];
      if (!streams || streams[id] !== stream) return;
      delete streams[id];
      if (util.hasKeys(streams)) return;
      delete agent.subscribedDocs[collection];
    });
    this._agentPresence.subscribeToStream(collection, id, stream);
  }
  
  _handleMessage (request, callback) {
    if (this._agentPresence.isPresenceMessage(request)) {
      return this._agentPresence.handlePresenceMessage(request, callback);
    }
    return super._handleMessage(request, callback)
  }
}

class BackendWithPresence extends Backend {
  constructor (options, presence) {
    super(options)
    this.presence = presence
    this._backendPresence = new this.presence.BackendPresence(this);
  }
  connect () {
    const connection = super.connect.apply(this,arguments)
    // Expose the DocPresence passed in through the constructor
    // to the Doc class, which has access to the connection.
    connection.DocPresence = this.presence.DocPresence;
    connection._connectionPresence = new this.presence.ConnectionPresence(connection);
    return connection
  }
  listen (stream, req) {
    console.log('listening with presence')
    var agent = new AgentWithPresence(this, stream);
    this.trigger(this.MIDDLEWARE_ACTIONS.connect, agent, {stream: stream, req: req}, function(err) {
      if (err) return agent.close(err);
      agent._open();
    });
    return agent;
  }
  sendPresence (presence, callback) {
    this._backendPresence.sendPresence(presence, callback);
  }  
}

module.exports = BackendWithPresence