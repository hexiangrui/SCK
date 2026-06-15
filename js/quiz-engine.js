// Quiz engine: question management, answer checking, scoring
const Engine = {
  currentQuestions: [],   // all questions for current session
  currentIndex: 0,
  mode: 'practice',       // 'practice' | 'exam' | 'wrong' | 'bookmark'
  examAnswers: [],        // answers during exam mode

  // ── Load questions based on mode ──
  loadQuestions(topicId, mode) {
    this.mode = mode;
    const all = DataCache.get(topicId);
    if (!all || all.length === 0) { this.currentQuestions = []; return []; }

    if (mode === 'wrong') {
      const ids = Storage.getWrongIds(topicId);
      this.currentQuestions = all.filter(q => ids.includes(q.id));
    } else if (mode === 'bookmark') {
      const ids = Storage.getBookmarkIds(topicId);
      this.currentQuestions = all.filter(q => ids.includes(q.id));
    } else {
      // practice or exam - use all, shuffle for exam
      this.currentQuestions = [...all];
      if (mode === 'exam') this.shuffle();
    }
    this.currentIndex = 0;
    this.examAnswers = [];
    return this.currentQuestions;
  },

  shuffle() {
    for (let i = this.currentQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.currentQuestions[i], this.currentQuestions[j]] = [this.currentQuestions[j], this.currentQuestions[i]];
    }
  },

  getCurrent() {
    if (this.currentIndex >= this.currentQuestions.length) return null;
    return this.currentQuestions[this.currentIndex];
  },

  getProgress() { return { current: this.currentIndex + 1, total: this.currentQuestions.length }; },

  // ── Check answer ──
  checkAnswer(question, userAnswer) {
    if (!question || !userAnswer) return false;
    const correct = question.answer;
    if (question.type === 'fill_blank') {
      // Compare normalized text
      return correct.some(a =>
        userAnswer.some(ua => ua.trim().toLowerCase() === a.trim().toLowerCase())
      );
    }
    // For choice types: compare sorted arrays
    const sortedUser = [...userAnswer].sort();
    const sortedCorrect = [...correct].sort();
    return sortedUser.length === sortedCorrect.length &&
           sortedUser.every((v, i) => v === sortedCorrect[i]);
  },

  // ── Navigate ──
  next() { this.currentIndex++; return this.getCurrent(); },
  hasMore() { return this.currentIndex < this.currentQuestions.length - 1; },

  // ── Exam scoring ──
  recordExamAnswer(qid, userAnswer, isCorrect) {
    this.examAnswers.push({ qid, userAnswer, isCorrect });
  },
  getExamScore() {
    const total = this.examAnswers.length;
    const correct = this.examAnswers.filter(a => a.isCorrect).length;
    return { total, correct, percent: total > 0 ? Math.round(correct / total * 100) : 0 };
  },
  getExamWrongIds() {
    return this.examAnswers.filter(a => !a.isCorrect).map(a => a.qid);
  }
};

// ── Data cache (lazy-load JSON files) ──
const DataCache = {
  _data: {},
  get(topicId) {
    return this._data[topicId] || [];
  },
  set(topicId, questions) { this._data[topicId] = questions; },
  async load(topicId) {
    if (this._data[topicId]) return this._data[topicId];
    try {
      const resp = await fetch(`data/${TOPIC_INDEX.find(t => t.id === topicId).file}`);
      const data = await resp.json();
      this._data[topicId] = data;
      return data;
    } catch(e) {
      console.error('Failed to load:', topicId, e);
      return [];
    }
  }
};