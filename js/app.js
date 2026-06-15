// Main app controller
window._currentTopicId = null;
window._currentSelection = [];
window._showFeedback = false;
window._lastCorrect = false;
window._submitted = false;
let TOPIC_INDEX = [];

// ── Init ──
async function init() {
  try {
    const resp = await fetch('data/index.json');
    TOPIC_INDEX = await resp.json();
  } catch(e) {
    TOPIC_INDEX = []; // Will show empty state
  }
  UI.renderTopics();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// ── Topic selection ──
window.selectTopic = async function(topicId) {
  window._currentTopicId = topicId;
  const questions = await DataCache.load(topicId);
  // Update question count in index
  const topic = TOPIC_INDEX.find(t => t.id === topicId);
  if (topic) { topic.questionCount = questions.length; UI.renderTopics(); }
  Engine.loadQuestions(topicId, 'practice');
  window.resetQuiz();
  UI.show('quiz');
  UI.renderQuiz(topicId);
};

// ── Mode switching ──
window.switchMode = function(mode) {
  Engine.loadQuestions(window._currentTopicId, mode);
  document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
  window.resetQuiz();
  UI.renderQuiz(window._currentTopicId);
  UI.updateProgress();
};

// ── Answer handling ──
window.selectSingle = function(key) {
  if (window._submitted) return;
  window._currentSelection = [key];
  UI.renderQuestion();
};

window.toggleMulti = function(key) {
  if (window._submitted) return;
  const idx = window._currentSelection.indexOf(key);
  if (idx >= 0) window._currentSelection.splice(idx, 1);
  else window._currentSelection.push(key);
  UI.renderQuestion();
};

window.submitAnswer = function() {
  if (window._currentSelection.length === 0) return;
  window._submitted = true;
  const q = Engine.getCurrent();
  if (!q) return;
  const isCorrect = Engine.checkAnswer(q, window._currentSelection);
  window._lastCorrect = isCorrect;
  window._showFeedback = true;

  // Record
  if (Engine.mode === 'exam') {
    Engine.recordExamAnswer(q.id, window._currentSelection, isCorrect);
  }
  Storage.recordAnswer(window._currentTopicId, isCorrect);
  if (!isCorrect) Storage.addWrongId(window._currentTopicId, q.id);
  else Storage.removeWrongId(window._currentTopicId, q.id);

  UI.renderQuestion();
};

window.submitFill = function() {
  const input = document.getElementById('fill-answer');
  if (!input || !input.value.trim()) return;
  window._currentSelection = [input.value.trim()];
  window.submitAnswer();
};

window.nextQuestion = function() {
  const q = Engine.next();
  window.resetQuiz();
  if (!q) {
    if (Engine.mode === 'exam') {
      UI.showResult();
    } else {
      UI.renderQuiz(window._currentTopicId);
    }
  } else {
    UI.renderQuestion();
    UI.updateProgress();
  }
};

window.resetQuiz = function() {
  window._currentSelection = [];
  window._showFeedback = false;
  window._lastCorrect = false;
  window._submitted = false;
};

// ── Bookmark ──
window.toggleBookmark = function() {
  const q = Engine.getCurrent();
  if (!q) return;
  Storage.toggleBookmark(window._currentTopicId, q.id);
  UI.renderQuestion();
};

// ── Navigation ──
window.goHome = function() {
  window._currentTopicId = null;
  window.resetQuiz();
  UI.show('home');
  UI.renderTopics();
};

window.searchQuestions = function(val) {
  UI.renderTopics(val);
};

// ── Review wrong from result ──
window.reviewWrong = function() {
  Engine.loadQuestions(window._currentTopicId, 'wrong');
  window.resetQuiz();
  UI.show('quiz');
  UI.renderQuiz(window._currentTopicId);
};

// ── Stats navigation (via bottom nav) ──
window.showStats = function() {
  UI.show('stats');
  UI.renderStats();
};

// ── Boot ──
document.addEventListener('DOMContentLoaded', init);