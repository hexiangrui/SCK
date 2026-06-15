// UI rendering
const UI = {
  // ── Home screen ──
  renderTopics(filter = '') {
    const list = document.getElementById('topic-list');
    const searchLower = filter.toLowerCase();
    const filtered = TOPIC_INDEX.filter(t =>
      !searchLower || t.name.toLowerCase().includes(searchLower) ||
      t.sourceDocuments.some(d => d.toLowerCase().includes(searchLower))
    );
    let html = '';
    // AI generate panel (only if key configured)
    if (AI.hasKey()) {
      html += `<div class="ai-panel">
        <div class="ai-panel-header">🤖 AI 智能出题</div>
        <div style="display:flex;gap:6px;padding:0 0 8px">
          <select id="ai-topic-select" class="ai-select">${TOPIC_INDEX.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}</select>
          <select id="ai-question-count" class="ai-select" style="max-width:60px">
            <option value="5">5</option><option value="10">10</option><option value="20">20</option>
          </select>
        </div>
        <button class="btn-primary" style="width:100%;font-size:14px" onclick="window.aiGenerateQuestions()">⚡ 生成新题</button>
        <p id="ai-gen-status" class="ai-status"></p>
      </div>`;
    }
    html += filtered.map(t => `
      <div class="topic-card" onclick="window.selectTopic('${t.id}')">
        <div class="topic-icon">${t.icon}</div>
        <div class="topic-info">
          <div class="topic-name">${t.name}</div>
          <div class="topic-sources">${t.sourceDocuments.slice(0, 2).join('、')}${t.sourceDocuments.length > 2 ? '…' : ''}</div>
        </div>
        <div class="topic-count">${t.questionCount || 0}题</div>
      </div>
    `).join('');
    html += `<div style="text-align:center;padding:12px;margin-top:8px">
      <button style="background:none;border:1px solid var(--border);border-radius:16px;padding:6px 16px;font-size:13px;color:var(--text2)" onclick="window.showSettings()">⚙️ 设置</button>
    </div>`;
    list.innerHTML = html;
  },

  // ── Screen navigation ──
  show(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('screen-' + screenId);
    if (el) el.classList.add('active');
  },

  // ── Quiz screen ──
  renderQuiz(topicId) {
    const topic = TOPIC_INDEX.find(t => t.id === topicId);
    document.getElementById('quiz-title').textContent = topic ? topic.shortName : '';
    this.updateProgress();
    this.renderQuestion();
  },

  updateProgress() {
    const prog = Engine.getProgress();
    const el = document.getElementById('quiz-progress');
    el.textContent = prog.total > 0 ? `${prog.current}/${prog.total}` : '0/0';
  },

  renderQuestion() {
    const q = Engine.getCurrent();
    const container = document.getElementById('quiz-content');
    if (!q) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">🎉</div><p>${Engine.mode === 'exam' ? '考试结束！' : '没有更多题目了'}</p></div>`;
      if (Engine.mode === 'exam') this.showResult();
      return;
    }

    const typeLabels = { single_choice: '单选题', multi_choice: '多选题', true_false: '判断题', fill_blank: '填空题' };
    const typeClasses = { single_choice: 'type-single', multi_choice: 'type-multi', true_false: 'type-true', fill_blank: 'type-fill' };

    let html = `<div class="question-card">
      <span class="question-type ${typeClasses[q.type]}">${typeLabels[q.type]}</span>
      <div class="question-text">${this._escapeHtml(q.question)}</div>`;

    if (q.type === 'fill_blank') {
      if (window._aiScoring) {
        html += `<div style="text-align:center;padding:20px;color:var(--text2)">
          <div class="ai-loading"></div><p>AI 正在评估你的答案...</p></div>`;
      } else {
        html += `<input type="text" class="fill-input" id="fill-answer" placeholder="请输入答案" autocomplete="off">
          <button class="btn-primary" style="margin-top:12px;width:100%" onclick="window.submitFill()">确认提交</button>`;
      }
    } else {
      const options = q.options || [];
      const selected = window._currentSelection || [];
      html += options.map(o => `
        <div class="option-item${selected.includes(o.key) ? ' selected' : ''}"
             data-key="${o.key}"
             onclick="${q.type === 'single_choice' || q.type === 'true_false' ? "window.selectSingle('" + o.key + "')" : "window.toggleMulti('" + o.key + "')"}">
          <span class="option-key">${o.key}</span>
          <span>${this._escapeHtml(o.text)}</span>
        </div>
      `).join('');
      html += `<button class="btn-primary" style="margin-top:16px;width:100%" onclick="window.submitAnswer()">${q.type === 'multi_choice' ? '提交答案' : '确认'}</button>`;
    }

    if (window._showFeedback) {
      html += this._renderFeedback(q);
    }

    html += `</div>`;
    html += `<div class="btn-nav">
      <button class="btn-bookmark" onclick="window.toggleBookmark()">${Storage.isBookmarked(window._currentTopicId, q.id) ? '⭐' : '☆'}</button>
      ${window._showFeedback ? '<button class="btn-primary" onclick="window.nextQuestion()">下一题 →</button>' : ''}
    </div>`;

    container.innerHTML = html;
  },

  _renderFeedback(q) {
    const isCorrect = window._lastCorrect;
    const aiFb = window._aiFeedback;
    const cls = isCorrect ? 'feedback-correct' : 'feedback-wrong';
    let aiInfo = '';
    if (aiFb && q.type === 'fill_blank') {
      aiInfo = `<p style="margin-top:4px;font-size:13px">🤖 AI评分：${aiFb.score}分 — ${aiFb.feedback || ''}</p>`;
    }
    return `<div class="feedback-box show ${cls}">
      <strong>${isCorrect ? '✓ 回答正确！' : '✗ 回答错误'}</strong>
      ${aiInfo}
      ${!isCorrect ? `<p style="margin-top:4px">正确答案：<b>${q.answer.join('、')}</b></p>` : ''}
      ${q.explanation ? `<p style="margin-top:6px">📖 ${this._escapeHtml(q.explanation)}</p>` : ''}
      ${q.source ? `
        <div class="source-block">
          <div class="source-label">📄 出处：${this._escapeHtml(q.source.document)} ${q.source.article || ''}</div>
          <div class="source-quote">${this._escapeHtml(q.source.quote || '')}</div>
        </div>
      ` : ''}
    </div>`;
  },

  // ── Setup screen ──
  renderSetup() {
    // No dynamic content needed; HTML is static
  },

  // ── Settings screen ──
  renderSettings() {
    const keyInput = document.getElementById('settings-key-input');
    if (keyInput) keyInput.value = AI.getKey();
    const cacheCount = document.getElementById('cache-count');
    if (cacheCount) cacheCount.textContent = AICache.totalCount();
    const msg = document.getElementById('settings-msg');
    if (msg) msg.textContent = '';
  },

  // ── Result screen ──
  showResult() {
    const score = Engine.getExamScore();
    this.show('result');
    const scoreColor = score.percent >= 80 ? 'var(--success)' : score.percent >= 60 ? 'var(--warning)' : 'var(--danger)';
    document.getElementById('result-score').innerHTML = `<span style="color:${scoreColor}">${score.percent}</span><span style="font-size:24px">分</span>`;
    document.getElementById('result-detail').innerHTML = `共 <b>${score.total}</b> 题 | 答对 <b style="color:var(--success)">${score.correct}</b> 题 | 答错 <b style="color:var(--danger)">${score.total - score.correct}</b> 题`;
  },

  // ── Stats screen ──
  renderStats() {
    const allStats = Storage.getAllStats();
    const container = document.getElementById('stats-content');
    const items = TOPIC_INDEX.filter(t => allStats[t.id] && allStats[t.id].totalAnswered > 0);
    if (items.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p>还没有学习记录，快去答题吧</p></div>';
      return;
    }
    container.innerHTML = items.map(t => {
      const s = allStats[t.id];
      const pct = s.totalAnswered > 0 ? Math.round(s.totalCorrect / s.totalAnswered * 100) : 0;
      return `<div class="stat-item">
        <span class="stat-name">${t.icon} ${t.shortName}</span>
        <div class="stat-bar"><div class="stat-bar-fill" style="width:${pct}%"></div></div>
        <span class="stat-percent">${pct}%</span>
      </div>`;
    }).join('');
  },

  _escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};