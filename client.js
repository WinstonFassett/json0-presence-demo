const ShareDBWithPresence = require('./lib/sharedb-presence/client')
const presence = require('./lib/sharedb-presence/stateless')
const HtmlTextCollabExt = require('@convergence/html-text-collab-ext');
const StringBinding = require('sharedb-string-binding');
const { hcl } = require('d3-color');

// Open WebSocket connection to ShareDB server
const socket = new WebSocket('ws://' + window.location.host);
const connection = new ShareDBWithPresence.Connection(socket, presence);

// Sample user names for local testing.
const names = ['Peter', 'Anna', 'John', 'Ole', 'Niels'];

// Colors for names. Fixed chroma and lightness, varying hue.
const colors = names.map((name, i) => hcl(i / names.length * 360, 90, 35));

// Returns a color for a user name.
const uidColor = uid => colors[names.findIndex(x => x === uid)];

// Renders the user name and color at the top.
const renderNameplate = uid => {
  const nameplate = document.getElementById('nameplate');
  nameplate.style = 'background-color: ' + uidColor(uid) + ';';
  nameplate.innerText = uid;
};

const textarea = document.getElementById('example');

// Update presence data when textarea is focused.
textarea.addEventListener('focus', () => {
  updateCursorText(
    [textarea.selectionStart, textarea.selectionStart],
    uid,
    'example'
  );
});

// Create local Doc instance.
const doc = connection.get('examples', 'example');

// Generate a random uid and display it.
const uid = names[Math.floor(Math.random() * names.length)];
renderNameplate(uid);

const collaborators = {};

doc.subscribe(function(err) {
  if (err) throw err;

  const binding = new StringBinding(textarea, doc, ['example']);
  binding.setup();

  const textEditor = new HtmlTextCollabExt.CollaborativeTextEditor({
    control: textarea,
    onSelectionChanged: selection =>
      updateCursorText([selection.anchor, selection.target], uid, 'example')
  });

  const selectionManager = textEditor.selectionManager();

  // When we receive information about updated presences, update the ui.
  doc.on('presence', (srcList, submitted) => {
    srcList.forEach(src => {
      if (!doc.presence[src]) return;

      // Unpack the json0 presence object.
      const presence = doc.presence[src];
      const presencePath = presence.p;
      const presenceType = presence.t;
      const subPresence = presence.s;

      // Unpack the text0 sub-presence object.
      const userid = subPresence.u;
      if (
        userid !== uid &&
        subPresence &&
        subPresence.s &&
        subPresence.s.length > 0
      ) {
        const sel = subPresence.s[0];

        if (!collaborators[userid]) {
          collaborators[userid] = selectionManager.addCollaborator(
            userid,
            userid,
            uidColor(userid)
          );
        }

        collaborators[userid].setSelection({
          anchor: sel[0],
          target: sel[1]
        });

        collaborators[userid].flashCursorToolTip(2);
      }
    });
  });
});

// Submits presence to the ShareDB document for the current cursor/selection.
function updateCursorText(range, uid, text) {
  if (range) {
    doc.submitPresence({
      p: [text],
      t: 'text0',
      s: {
        u: uid,
        c: 0,
        s: [range]
      }
    });
  }
}
