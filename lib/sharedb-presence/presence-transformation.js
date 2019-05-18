const json = {}
json.createPresence = function(presenceData) {
  return presenceData;
};

json.comparePresence = function(pres1, pres2) {
  return JSON.stringify(pres1) === JSON.stringify(pres2);
};

json.transformPresence = function(presence, op, isOwnOp) {
  // Don't transform path-only presence objects.
  if(!presence.t) return presence;

   for (var i = 0; i < op.length; i++) {
    var c = op[i];

     // convert old string ops to use subtype for backwards compatibility
    if (c.si != null || c.sd != null) {
      convertFromText(c);
    }

     // Transform against subtype ops.
    if (c.t && c.t === presence.t && json.pathMatches(c.p, presence.p)) {
      presence = Object.assign({}, presence, {
        s: subtypes[presence.t].transformPresence(presence.s, c.o, isOwnOp)
      });
    }

     // convert back to old string ops
    if (c.t === 'text0') {
      convertToText(c);
    }

     // TODO transform against non-subtype ops.
  };
  return presence;
};

const text = {}

text.createPresence = function(presenceData) {
  return presenceData;
};

 // Draws from https://github.com/Teamwork/ot-rich-text/blob/master/src/Operation.js
text.transformPresence = function(presence, operation, isOwnOperation) {
  var user = presence.u;
  var change = presence.c;
  var selections = presence.s;
  var side = isOwnOperation ? 'right' : 'left';
  var newSelections = new Array(selections.length);

   for (var i = 0, l = selections.length; i < l; ++i) {
    newSelections[i] = [
      text.transformCursor(selections[i][0], operation, side),
      text.transformCursor(selections[i][1], operation, side)
    ];
  }

   return {
    u: user,
    c: change,
    s: newSelections
  }
}

 text.comparePresence = function(pres1, pres2) {
  return JSON.stringify(pres1) === JSON.stringify(pres2);
};

const subtypes = {
  json0: json,
  json: json,
  text0: text,
  text: text
}

function transformPresence (type, presence, operation, isOwnOperation) {
  return subtypes[type.name].transformPresence(presence, operation, isOwnOperation)
}
transformPresence.subtypes = subtypes

module.exports = {
  transform: transformPresence,
  subtypes: subtypes,
  supportsType: function (type) { 
    return !!subtypes[type.name] 
  },
  createPresence: function (type, data) { return subtypes[type.name].createPresence(data) }
}