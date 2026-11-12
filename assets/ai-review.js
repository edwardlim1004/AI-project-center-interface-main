const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = selector => document.querySelector(selector);
let review = null;
let activeTab = 'independent';

function chip(text, state='pass') {
  return `<span class="result-chip ${state}">${escapeHtml(text || '미검증')}</span>`;
}

function renderDecisionSummary() {
  const d = review.decision;
  const unresolved = review.claims.filter(item => item.result !== 'pass');
  $('#decision-summary').innerHTML = `<div class="decision-main ${d.state.startsWith('BLOCKED') ? 'blocked' : 'pending'}"><span class="decision-icon">${d.state.startsWith('BLOCKED') ? '!' : '?'}</span><div><span class="eyebrow">현재 판단</span><h2>${escapeHtml(d.label)}</h2><p>${escapeHtml(d.reason)}</p></div></div><div class="decision-facts"><div><b>이번 변경</b><span>${escapeHtml(review.change_target)}</span></div><div><b>확인된 것</b><span>${review.summary.find(x=>x.label==='재현 확인')?.value || '—'}개 주장 재현 · ${review.gates.filter(x=>x.state==='pass').length}개 검사 통과</span></div><div><b>남은 조치</b><span>${unresolved.length ? unresolved.map(x=>`${x.id} 근거 보완`).join(', ') : '없음'}</span></div><div><b>다음 단계</b><span>미확인 자료를 보완한 뒤 새 패킷으로 재검토</span></div></div>`;
}

function renderEvents() {
  $('#event-timeline').innerHTML = review.audit_events.map(event => `<article class="event-item"><div class="event-time"><b>${escapeHtml(event.at)}</b><span>${escapeHtml(event.phase)}</span></div><div class="event-dot"></div><div class="event-content"><div class="event-heading"><b>${escapeHtml(event.action)}</b><span>${escapeHtml(event.actor)}</span></div><dl><div><dt>무엇을</dt><dd>${escapeHtml(event.what)}</dd></div><div><dt>어떻게</dt><dd>${escapeHtml(event.how)}</dd></div><div><dt>왜</dt><dd>${escapeHtml(event.why)}</dd></div><div><dt>결과</dt><dd>${escapeHtml(event.outcome)}</dd></div></dl></div></article>`).join('');
}

function renderSteps() {
  $('#steps').innerHTML = review.steps.map((step, index) => `<div class="step ${step.state}"><span class="step-num">${step.state === 'done' ? '✓' : index + 1}</span><span class="step-label">${escapeHtml(step.label)}</span></div>`).join('');
}

function renderSummary() {
  $('#summary-cards').innerHTML = review.summary.map(card => `<article class="summary-card ${escapeHtml(card.tone)}"><div class="summary-label">${escapeHtml(card.label)}</div><div class="summary-value">${escapeHtml(card.value)}</div><div class="summary-help">${escapeHtml(card.help)}</div></article>`).join('');
}

function renderModels() {
  const cross = activeTab === 'cross';
  if (cross) {
    $('#model-grid').innerHTML = review.cross_review.map(item => `<article class="model-card cross-card"><div class="model-top"><strong class="model-name">익명 검토자 ${escapeHtml(item.reviewer)}</strong><span class="reviewer-tag">${escapeHtml(item.reviewer)} → ${escapeHtml(item.target)} 검토</span></div><div class="cross-target"><b>${escapeHtml(item.claim_id)} 주장</b><span>${escapeHtml(review.claims.find(x=>x.id===item.claim_id)?.claim || '')}</span></div><span class="model-verdict ${item.verdict==='동의'?'ok':'conditional'}">${escapeHtml(item.verdict)}</span><p class="cross-reason"><b>판단 이유</b> ${escapeHtml(item.reason)}</p><p class="cross-reason"><b>확인 근거</b> ${escapeHtml(item.evidence)}</p><div class="model-status"><b>검토 결과</b> ${escapeHtml(item.outcome)}</div></article>`).join('');
    return;
  }
  $('#model-grid').innerHTML = review.models.map(model => `<article class="model-card"><div class="model-top"><strong class="model-name">${escapeHtml(model.name)}</strong><span class="reviewer-tag">독립 1차 · ${escapeHtml(model.submitted_at)}</span></div><p class="model-description"><b>검토한 내용</b><br>${escapeHtml(model.summary)}</p><span class="model-verdict ${escapeHtml(model.verdict_type)}">${escapeHtml(model.first_verdict)}</span><div class="model-stats"><div><b>${model.evidence_count}</b><span>근거 제시</span></div><div><b>${model.counterexample_count}</b><span>반례</span></div><div><b>${model.unverified_count}</b><span>미확인</span></div></div><p class="model-rationale"><b>왜 이렇게 판단했나</b><br>${escapeHtml(model.rationale)}</p><div class="model-status">${escapeHtml(model.status)} · 제출 ${escapeHtml(model.submission)}</div></article>`).join('');
}

function renderClaims() {
  $('#claim-cards').innerHTML = review.claims.map(item => `<details class="claim-card" ${item.result==='warn'?'open':''}><summary><span class="claim-id">${escapeHtml(item.id)}</span><span class="claim-title">${escapeHtml(item.claim)}</span>${chip(item.python,item.result)}<span class="claim-expand">상세 보기</span></summary><div class="claim-detail"><div class="claim-overview"><div><b>근거 출처</b><span>${escapeHtml(item.source)}</span></div><div><b>현재 결론</b><span>${escapeHtml(item.explanation)}</span></div></div><div class="claim-positions"><h3>AI별 의견</h3><div class="position-grid">${review.models.map(model=>`<div class="position"><b>${escapeHtml(model.name)}</b>${chip(item[model.id],item[model.id]==='동의'?'pass':'warn')}<p>${escapeHtml(item.position_reasons[model.id])}</p></div>`).join('')}</div></div><div class="python-proof"><h3>Python 확인 내역</h3><div class="proof-grid"><div><b>검증 방법</b><span>${escapeHtml(item.validation)}</span></div><div><b>기대 결과</b><span>${escapeHtml(item.expected)}</span></div><div><b>관측 결과</b><span>${escapeHtml(item.actual)}</span></div><div><b>해석</b><span>${escapeHtml(item.python_reason)}</span></div></div></div>${item.open_issue?`<div class="open-issue"><b>남은 쟁점</b><span>${escapeHtml(item.open_issue)}</span></div>`:''}</div></details>`).join('');
}

function renderGates() {
  $('#gates').innerHTML = review.gates.map(gate => `<div class="gate-row ${escapeHtml(gate.state)}"><span class="gate-mark">${gate.state === 'pass' ? '✓' : gate.state === 'warn' ? '!' : '×'}</span><span class="gate-label">${escapeHtml(gate.label)}</span><b class="gate-value">${escapeHtml(gate.value)}</b><small class="gate-reason">${escapeHtml(gate.reason)}</small></div>`).join('');
  const callout = $('#decision-callout');
  callout.innerHTML = `<b>${escapeHtml(review.decision.label)}</b><span>${escapeHtml(review.decision.reason)}</span>`;
  callout.classList.toggle('block', review.decision.state.startsWith('BLOCKED'));
}

function renderMapping() {
  $('#mapping-body').innerHTML = `<div class="mapping-table"><table><thead><tr><th>익명 라벨</th><th>실제 모델명</th><th>제출 ID</th></tr></thead><tbody>${review.mapping.map(x => `<tr><td><b>${escapeHtml(x.label)}</b></td><td>${escapeHtml(x.model)}</td><td><code>${escapeHtml(x.submission)}</code></td></tr>`).join('')}</tbody></table></div><p class="mapping-message">관리자 기록 예시입니다. 실제 운영에서는 제한된 감사 로그에만 저장합니다.</p>`;
}

function renderKakao() {
  const k = review.kakao;
  $('#kakao-preview').innerHTML = `<div class="kakao-card"><div class="kakao-head"><span>${escapeHtml(k.title)}</span><span>시연 알림</span></div><p><b>판단:</b> ${escapeHtml(review.decision.label)}<br/>재현 확인 ${k.verified_claims}건 · 미해결 ${k.unresolved_issues}건 · 차단 ${k.blocked_issues}건<br/><b>요청:</b> ${escapeHtml(k.next_action)}<br/>패킷 <code>${escapeHtml(review.packet_hash)}</code></p><span class="kakao-link">${escapeHtml(k.approval_url)} →</span></div>`;
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
  }));
  $('#packet-button').addEventListener('click', () => openDialog('이번 검토에 사용한 자료', `<p>아래 구성은 시연용 예시입니다. 실제 운영에서는 모든 AI가 동일한 버전의 자료를 받습니다.</p><ul>${review.packet_contents.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul><p><b>패킷 지문:</b> <code>${escapeHtml(review.packet_hash)}</code></p><p><b>프롬프트 버전:</b> ${escapeHtml(review.prompt_version)}</p>`));
  $('#mapping-toggle').addEventListener('click', event => {
    const body = $('#mapping-body'); body.hidden = !body.hidden;
    event.currentTarget.setAttribute('aria-expanded', String(!body.hidden));
    event.currentTarget.textContent = body.hidden ? '관리자 매핑 보기' : '매핑 숨기기';
  });
  $('#hold-button').addEventListener('click', () => openDialog('보류·재검토', `<p><b>현재 남은 쟁점:</b> ${escapeHtml(review.claims.filter(x=>x.result!=='pass').map(x=>x.open_issue || x.claim).join(' / '))}</p><p>시연에서는 보류 기록이 저장되지 않습니다. 실제 운영에서는 보완 요청과 담당자, 기한, 새 패킷 ID를 감사 로그에 남깁니다.</p>`));
  document.querySelectorAll('.claim-card').forEach(card => card.addEventListener('toggle', () => card.querySelector('.claim-expand').textContent = card.open ? '접기' : '상세 보기'));
}

async function init() {
  try {
    const response = await fetch('data/ai-review-demo.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    review = await response.json();
    if (!review.demo) throw new Error('시연 데이터 표시가 없습니다.');
    $('#review-id').textContent = review.review_id;
    $('#review-status').textContent = '검토 보류 · 사용자 확인 필요';
    $('#packet-hash').textContent = review.packet_hash;
    $('#approval-packet-hash').textContent = review.packet_hash;
    $('#diff-hash').textContent = review.diff_hash;
    $('#as-of').textContent = review.as_of;
    $('#change-target').textContent = review.change_target;
    renderDecisionSummary(); renderEvents(); renderSteps(); renderSummary(); renderModels(); renderClaims(); renderGates(); renderMapping(); renderKakao(); wireActions();
  } catch (error) {
    document.querySelector('main').insertAdjacentHTML('afterbegin', `<div class="demo-banner"><b>데모 자료를 불러오지 못했습니다.</b><span>${escapeHtml(error.message)}</span></div>`);
  }
}
init();
