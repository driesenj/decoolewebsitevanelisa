// Firestore wrapper with an offline fallback. Everything the site does live goes through here:
// Messenger messages (group + private rooms), "wie bezocht mijn profiel", poll votes and photo hearts.
import { firebaseConfig } from './firebase-config.js';
import { store } from './util.js';

const V = '10.12.2';
let fs, m;
export const db = { enabled: false, error: null };

export async function initDb() {
  if (!firebaseConfig || !firebaseConfig.projectId) return db;
  try {
    const [{ initializeApp }, mod] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
    ]);
    m = mod;
    fs = m.getFirestore(initializeApp(firebaseConfig));
    db.enabled = true;
  } catch (e) {
    console.warn('Firebase niet beschikbaar, offline modus:', e);
    db.error = e;
  }
  return db;
}

const docData = (d) => {
  const x = d.data({ serverTimestamps: 'estimate' });
  return { id: d.id, ...x, createdAt: x.createdAt?.toDate ? x.createdAt.toDate() : new Date(), pending: d.metadata.hasPendingWrites };
};

// ---- guestbook ------------------------------------------------------------------------------------
// Offline: entries are kept in localStorage so the writer at least sees their own message.
const LOCAL_GB = 'gb.local';
const localListeners = new Set();
const localList = () => store.get(LOCAL_GB, []).map(e => ({ ...e, createdAt: new Date(e.createdAt), local: true }));
// Chat messages live in the "guestbook" collection (that is what the rules file calls it).
db.onMessages = (cb) => {
  if (!db.enabled) { localListeners.add(cb); cb(localList()); return () => localListeners.delete(cb); }
  const q = m.query(m.collection(fs, 'guestbook'), m.orderBy('createdAt', 'desc'), m.limit(300));
  return m.onSnapshot(q, snap => cb(snap.docs.map(docData)), err => { console.warn('messages', err); db.error = err; cb([]); });
};
db.addMessage = async ({ name, message, room = 'group' }) => {
  // group messages carry no room field (works with the original rules too); private rooms need the updated rules
  const clean = { name: name.slice(0, 40), message: message.slice(0, 600) };
  if (room && room !== 'group') clean.room = String(room).slice(0, 40);
  if (!db.enabled) {
    const list = store.get(LOCAL_GB, []);
    list.unshift({ ...clean, id: 'local-' + Date.now(), createdAt: new Date().toISOString() });
    store.set(LOCAL_GB, list);
    for (const cb of localListeners) cb(localList());
    return { local: true };
  }
  await m.addDoc(m.collection(fs, 'guestbook'), { ...clean, createdAt: m.serverTimestamp() });
  return { local: false };
};

// ---- visitors --------------------------------------------------------------------------------------
db.onVisitors = (cb) => {
  if (!db.enabled) { cb([]); return () => { }; }
  const q = m.query(m.collection(fs, 'visitors'), m.orderBy('createdAt', 'desc'), m.limit(60));
  return m.onSnapshot(q, snap => cb(snap.docs.map(docData)), err => console.warn('visitors', err));
};
db.addVisitor = async (name) => {
  if (!db.enabled) return;
  await m.addDoc(m.collection(fs, 'visitors'), { name: name.slice(0, 40), createdAt: m.serverTimestamp() });
};

// ---- poll ------------------------------------------------------------------------------------------
db.onVotes = (pollId, cb) => {
  if (!db.enabled) { cb(store.get('poll.local.' + pollId, [])); return () => { }; }
  const q = m.query(m.collection(fs, 'votes'), m.where('poll', '==', pollId));
  return m.onSnapshot(q, snap => cb(snap.docs.map(d => d.data().option)), err => console.warn('votes', err));
};
db.vote = async (pollId, option) => {
  if (!db.enabled) { const k = 'poll.local.' + pollId; store.set(k, [...store.get(k, []), option]); return; }
  await m.addDoc(m.collection(fs, 'votes'), { poll: pollId, option: option.slice(0, 40), createdAt: m.serverTimestamp() });
};

// ---- photo hearts ----------------------------------------------------------------------------------
const LOCAL_LIKES = 'likes.local';
db.onLikes = (cb) => {
  if (!db.enabled) { cb(store.get(LOCAL_LIKES, {})); return () => { }; }
  return m.onSnapshot(m.collection(fs, 'likes'), snap => {
    const map = {}; snap.forEach(d => { map[d.id] = d.data().count || 0; }); cb(map);
  }, err => console.warn('likes', err));
};
db.like = async (photoId) => {
  if (!db.enabled) { const l = store.get(LOCAL_LIKES, {}); l[photoId] = (l[photoId] || 0) + 1; store.set(LOCAL_LIKES, l); return; }
  await m.setDoc(m.doc(fs, 'likes', photoId), { count: m.increment(1) }, { merge: true });
};
