// localStorage persistence layer
const Storage = {
  _key(prefix, topicId) { return `ks_${prefix}_${topicId}`; },

  // ── Wrong answers ──
  getWrongIds(topicId) {
    try { return JSON.parse(localStorage.getItem(this._key('wrong', topicId)) || '[]'); }
    catch(e) { return []; }
  },
  addWrongId(topicId, qid) {
    const ids = this.getWrongIds(topicId);
    if (!ids.includes(qid)) { ids.push(qid); localStorage.setItem(this._key('wrong', topicId), JSON.stringify(ids)); }
  },
  removeWrongId(topicId, qid) {
    const ids = this.getWrongIds(topicId).filter(id => id !== qid);
    localStorage.setItem(this._key('wrong', topicId), JSON.stringify(ids));
  },

  // ── Bookmarks ──
  getBookmarkIds(topicId) {
    try { return JSON.parse(localStorage.getItem(this._key('bookmark', topicId)) || '[]'); }
    catch(e) { return []; }
  },
  toggleBookmark(topicId, qid) {
    const ids = this.getBookmarkIds(topicId);
    const idx = ids.indexOf(qid);
    if (idx >= 0) ids.splice(idx, 1); else ids.push(qid);
    localStorage.setItem(this._key('bookmark', topicId), JSON.stringify(ids));
    return idx < 0 ? 'added' : 'removed';
  },
  isBookmarked(topicId, qid) { return this.getBookmarkIds(topicId).includes(qid); },

  // ── Stats ──
  getStats(topicId) {
    try {
      return JSON.parse(localStorage.getItem(this._key('stats', topicId)) || '{"totalAnswered":0,"totalCorrect":0}');
    } catch(e) { return {totalAnswered:0,totalCorrect:0}; }
  },
  recordAnswer(topicId, isCorrect) {
    const s = this.getStats(topicId);
    s.totalAnswered++; if (isCorrect) s.totalCorrect++;
    localStorage.setItem(this._key('stats', topicId), JSON.stringify(s));
  },
  getAllStats() {
    // Returns combined stats for all topics
    const result = {};
    TOPIC_INDEX.forEach(t => { result[t.id] = this.getStats(t.id); });
    return result;
  }
};