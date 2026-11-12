const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = selector => document.querySelector(selector);
let review = null;
let activeTab = 'independent';

function chip(text, state='pass') {
  const label = state === 'pass' ? '통과' : state === 'warn' ? '확인 필요' : state === 'fail' ? '차단' : '미검증';
  return `<span class="result-chip ${state}">${escapeHtml(text || label)}</span>`;
}

function renderSteps() {
  $('#steps').innerHTML = review.steps.map((step, index) => `<div class="step ${step.state}"><span class="step-num">${step.state === 'done' ? '✓' : index + 1}</span><span class="step-label">${escapeHtml(step.label)}</span></div>`).join('');
}

function renderSummary() {
  $('#summary-cards').innerHTML = review.summary.map(card => `<article class="summary-card ${escapeHtml(card.tone)}"><div class="summary-label">${escapeHtml(card.label)}</div><div class="summary-value">${escapeHtml(card.value)}</div><div class="summary-help">${escapeHtml(card.help)}</div></article>`).join('');
}

function renderModels() {
  const cross = activeTab === 'cross';
  $('#model-grid').innerHTML = review.models.map((model, index) => {
    const label = cross ? `검토자 ${String.fromCharCode(65 + index)}` : model.name;
    const verdict = cross ? review.cross_review[index]?.verdict || '확인 필요' : model.first_verdict;
    const type = cross ? (verdict === '동의' ? 'ok' : 'conditional') : model.verdict_type;
    const stats = cross
      ? `<div class="model-stats"><div><b>${escapeHtml(review.cross_review[index]?.id || '—')}</b><span>익명 라벨</span></div><div><b>2건</b><span>상대 주장 검토</span></div><div><b>${escapeHtml(verdict)}</b><span>교차 판정</span></div></div>`
      : `<div class="model-stats"><div><b>${model.evidence_count}</b><span>근거 항목</span></div><div><b>${model.counterexample_count}</b><span>반례</span></div><div><b>${model.unverified_count}</b><span>미검증</span></div></div>`;
    return `<article class="model-card"><div class="model-top"><strong class="model-name">${escapeHtml(label)}</strong><span class="reviewer-tag">${cross ? '모델명 비공개' : '1차 독립 제출'}</span></div><p class="model-description">${escapeHtml(cross ? review.cross_review[index]?.finding || '' : '다른 모델의 응답을 보지 않고 동일 패킷을 검토')}</p><span class="model-verdict ${type}">● ${escapeHtml(verdict)}</span>${stats}<div class="model-status">${escapeHtml(cross ? '자기 제출물은 교차검토 입력에서 제외' : model.status)}</div></article>`;
  }).join('');
}

function renderClaims() {
  const labelMap = Object.fromEntries(review.mapping.map(entry => [entry.model, entry.label]));
  const order = activeTab === 'cross'
    ? Object.entries(labelMap).map(([model, label]) => ({model, label})).sort((a, b) => a.label.localeCompare(b.label))
    : [{model: 'ChatGPT', label: 'ChatGPT'}, {model: 'Claude', label: 'Claude'}, {model: 'Gemini', label: 'Gemini'}];
  document.querySelector('.evidence-panel thead').innerHTML = `<tr><th>주장</th><th>근거 출처</th>${order.map(entry => `<th>${escapeHtml(entry.label)}</th>`).join('')}<th>Python 재현</th></tr>`;
  $('#claims-body').innerHTML = review.claims.map(item => `<tr><td class="claim-name">${escapeHtml(item.claim)}</td><td class="source-ref">${escapeHtml(item.source)}</td>${order.map(entry => {
    const value = item[entry.model.toLowerCase()] || '확인 필요';
    const state = value === '유보' || value === '반대' || value === '반례 제시' ? 'warn' : 'pass';
    return `<td>${chip(value, state)}</td>`;
  }).join('')}<td>${chip(item.python, item.result)}</td></tr>`).join('');
}

function renderGates() {
  $('#gates').innerHTML = review.gates.map(gate => `<div class="gate-row ${escapeHtml(gate.state)}"><span class="gate-mark">${gate.state === 'pass' ? '✓' : gate.state === 'warn' ? '!' : '×'}</span><span class="gate-label">${escapeHtml(gate.label)}</span><b class="gate-value">${escapeHtml(gate.value)}</b></div>`).join('');
  const callout = $('#decision-callout');
  callout.textContent = review.decision.label;
  callout.title = review.decision.reason;
  callout.classList.toggle('block', review.decision.state.startsWith('BLOCKED'));
}

function renderMapping() {
  $('#mapping-body').innerHTML = `<div class="mapping-table"><table><thead><tr><th>교차 라벨</th><th>실제 모델명</th><th>제출 ID</th></tr></thead><tbody>${review.mapping.map(x => `<tr><td><b>${escapeHtml(x.label)}</b></td><td>${escapeHtml(x.model)}</td><td><code>${escapeHtml(x.submission)}</code></td></tr>`).join('')}</tbody></table></div><p class="mapping-message">실제 운영에서는 관리자 감사 로그에서만 확인합니다. 이 표는 시연 데이터의 예시입니다.</p>`;
}

function renderKakao() {
  const k = review.kakao;
  $('#kakao-preview').innerHTML = `<div class="kakao-card"><div class="kakao-head"><span>${escapeHtml(k.title)}</span><span>검토 알림</span></div><p>검증된 주장 <b>${k.verified_claims}건</b> · 미해결 쟁점 <b>${k.unresolved_issues}건</b> · 차단 <b>${k.blocked_issues}건</b><br/>대상 해시 <code>${escapeHtml(review.packet_hash)}</code></p><span class="kakao-link">${escapeHtml(k.approval_url)} →</span></div>`;
}

function openDialog(title, html) {
  $('#dialog-title').textContent = title;
  $('#dialog-content').innerHTML = html;
  $('#info-dialog').showModal();
}

function wireActions() {
  document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
    activeTab = button.dataset.tab;
    document.querySelectorAll('[data-tab]').forEach(tab => {
      const active = tab === button;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    renderModels();
    renderClaims();
  }));
  $('#packet-button').addEventListener('click', () => openDialog('증거 패킷 구성', `<p>모든 모델에 같은 기준을 전달하려면 패킷 내용을 고정하고 SHA-256 지문을 기록합니다.</p><ul>${review.packet_contents.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul><p><b>현재 해시:</b> <code>${escapeHtml(review.packet_hash)}</code></p>`));
  $('#mapping-toggle').addEventListener('click', event => {
    const body = $('#mapping-body');
    body.hidden = !body.hidden;
    event.currentTarget.setAttribute('aria-expanded', String(!body.hidden));
    event.currentTarget.textContent = body.hidden ? '관리자 매핑 보기' : '매핑 숨기기';
  });
  $('#hold-button').addEventListener('click', () => openDialog('보류·재검토', '<p>실제 승인 기록 서버가 연결되지 않아 이 시연 화면에서는 상태를 변경하지 않습니다.</p>'));
}

async function init() {
  try {
    const response = await fetch('data/ai-review-demo.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    review = await response.json();
    if (!review.demo) throw new Error('시연 데이터 표시가 없습니다.');
    $('#review-id').textContent = review.review_id;
    $('#review-status').textContent = '승인 판단 대기 · 시연';
    $('#packet-hash').textContent = review.packet_hash;
    $('#approval-packet-hash').textContent = review.packet_hash;
    $('#diff-hash').textContent = review.diff_hash;
    $('#as-of').textContent = review.as_of;
    $('#change-target').textContent = review.change_target;
    renderSteps(); renderSummary(); renderModels(); renderClaims(); renderGates(); renderMapping(); renderKakao(); wireActions();
  } catch (error) {
    document.querySelector('main').insertAdjacentHTML('afterbegin', `<div class="demo-banner"><b>데모 자료를 불러오지 못했습니다.</b><span>${escapeHtml(error.message)}</span></div>`);
  }
}
init();
