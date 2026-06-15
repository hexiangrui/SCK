// AI question cache: localStorage persistence for AI-generated questions
const AICache = {
  PREFIX: 'ai_cache_',
  INDEX_KEY: 'ai_cache_index',
  TTL_MS: 7 * 24 * 60 * 60 * 1000, // 7 days

  // ── Index management ──
  _getIndex() {
    try { return JSON.parse(localStorage.getItem(this.INDEX_KEY) || '{}'); }
    catch(e) { return {}; }
  },
  _saveIndex(idx) { localStorage.setItem(this.INDEX_KEY, JSON.stringify(idx)); },

  // ── Save generated questions ──
  saveQuestions(topicId, questions) {
    if (!questions || !questions.length) return;
    const key = this.PREFIX + topicId;
    // Append to existing cache
    const existing = this.getQuestions(topicId);
    const merged = [...existing, ...questions];
    // Deduplicate by id
    const seen = new Set();
    const deduped = merged.filter(q => { if (seen.has(q.id)) return false; seen.add(q.id); return true; });
    localStorage.setItem(key, JSON.stringify(deduped));
    // Update index
    const idx = this._getIndex();
    idx[topicId] = Date.now();
    this._saveIndex(idx);
  },

  // ── Get cached questions ──
  getQuestions(topicId) {
    try { return JSON.parse(localStorage.getItem(this.PREFIX + topicId) || '[]'); }
    catch(e) { return []; }
  },

  // ── Check if cache is fresh ──
  isFresh(topicId) {
    const idx = this._getIndex();
    return idx[topicId] && (Date.now() - idx[topicId] < this.TTL_MS);
  },

  // ── Merge AI questions into topic's DataCache ──
  mergeIntoTopic(topicId) {
    const aiQuestions = this.getQuestions(topicId);
    if (!aiQuestions.length) return 0;
    const existing = DataCache.get(topicId) || [];
    const ids = new Set(existing.map(q => q.id));
    const newOnes = aiQuestions.filter(q => !ids.has(q.id));
    DataCache.set(topicId, [...existing, ...newOnes]);
    return newOnes.length;
  },

  // ── Clear cache for a topic ──
  clearTopic(topicId) {
    localStorage.removeItem(this.PREFIX + topicId);
    const idx = this._getIndex();
    delete idx[topicId];
    this._saveIndex(idx);
  },

  // ── Export all AI questions as JSON (for backup) ──
  exportAll() {
    const result = {};
    const idx = this._getIndex();
    Object.keys(idx).forEach(topicId => {
      result[topicId] = this.getQuestions(topicId);
    });
    return result;
  },

  // ── Get total cached count ──
  totalCount() {
    let count = 0;
    Object.keys(this._getIndex()).forEach(topicId => {
      count += this.getQuestions(topicId).length;
    });
    return count;
  }
};