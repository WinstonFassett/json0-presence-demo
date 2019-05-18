const sharedb = require('sharedb/lib/client');
class Connection {
  constructor () {
    sharedb.Connection.apply(this, arguments)
  }
}
Object.assign(Connection.prototype, sharedb.Connection.prototype)


class ConnectionWithPresence extends sharedb.Connection {
  constructor (socket, presence) {
    super(socket)
    this.presence = presence
    this.DocPresence = this.presence.DocPresence;
    this._connectionPresence = new this.presence.ConnectionPresence(this);

  }
  get (collectionName, id) {
    const doc = super.get(collectionName, id)
    Object.keys(DocPresenceMixin).forEach(key => {
      doc[key] = DocPresenceMixin[key].bind(doc)
    })
    doc._docPresence = new this.DocPresence(doc)
    doc.on('op', function (op, source) {
      var cacheOpPayload = {
        src: source ? doc.connection.id : null,
        op: op
      }
      if (Array.isArray(op)) {
        op.map(function (op) {
          cacheOpPayload = Object.assign({}, cacheOpPayload, {
            op: op
          })
          doc._docPresence.cacheOp(cacheOpPayload)
        })
        return
      }
      doc._docPresence.cacheOp(cacheOpPayload);
    })
    return doc
  }
  handleMessage (message) {
    var err = null;
    if (message.error) {
      // wrap in Error object so can be passed through event emitters
      err = new Error(message.error.message);
      err.code = message.error.code;
      // Add the message data to the error object for more context
      err.data = message;
      delete message.error;
    }
    if (this._connectionPresence.isPresenceMessage(message)) {
      return this._connectionPresence.handlePresenceMessage(err, message);
    }
    return super.handleMessage(message)
  }
}
const DocPresenceMixin  = {
  _handlePresence (err, presence) {
    this._docPresence.handlePresence(err, presence);
  },
  
  submitPresence (data, callback) {
    this._docPresence.submitPresence(data, callback);
  }  
}

module.exports = {
  Connection: ConnectionWithPresence
}