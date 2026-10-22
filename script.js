(() => {
  'use strict';
  const config = window.RAKSHA_CONFIG || { DEMO_MODE: true, API_BASE_URL: '', SCAN_ENDPOINT: '/api/scan', REQUEST_TIMEOUT_MS: 12000 };
  const $ = (selector) => document.querySelector(selector);
  const form = $('#scanForm');
  const input = $('#urlInput');
  const error = $('#scanError');
  const resultBox = $('#resultBox');
  const scanButton = $('#scanButton');
  const toast = $('#toast');
  let toastTimer;
  const history = [];

  $('#year').textContent = new Date().getFullYear();

  const menuToggle = $('#menuToggle');
  const nav = $('#mainNav');
  menuToggle.addEventListener('click', () => {
    const open = menuToggle.getAttribute('aria-expanded') !== 'true';
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    nav.classList.toggle('nav-open', open);
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    nav.classList.remove('nav-open'); menuToggle.setAttribute('aria-expanded', 'false'); menuToggle.setAttribute('aria-label', 'Open navigation');
  }));

  function showToast(message) {
    toast.textContent = message; toast.classList.add('toast-visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('toast-visible'), 3200);
  }
  function normalizeUrl(raw) {
    let value = raw.trim();
    if (!value) throw new Error('Enter a URL to analyze.');
    if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
    let parsed;
    try { parsed = new URL(value); } catch { throw new Error('That URL does not look valid. Check the address and try again.'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only HTTP and HTTPS URLs can be checked.');
    if (!parsed.hostname || !parsed.hostname.includes('.')) throw new Error('Enter a full domain, such as example.com.');
    return parsed;
  }
  function demoAnalyze(parsed) {
    const host = parsed.hostname.toLowerCase();
    const full = `${host}${parsed.pathname}${parsed.search}`.toLowerCase();
    const signals = [];
    let score = 0;
    if (parsed.protocol !== 'https:') { score += 25; signals.push({ level: 'warning', text: 'The URL does not use HTTPS.' }); }
    if (host.includes('xn--')) { score += 30; signals.push({ level: 'danger', text: 'The domain contains punycode, which can be used in look-alike domains.' }); }
    if (/(login|verify|urgent|secure|account|update|wallet|payment|kyc|free-prize|claim)/i.test(full)) { score += 18; signals.push({ level: 'warning', text: 'The address contains terms often seen in credential or payment lures.' }); }
    if (/\d{5,}/.test(host)) { score += 12; signals.push({ level: 'warning', text: 'The domain contains a long sequence of digits.' }); }
    if (host.split('.').length >= 4) { score += 12; signals.push({ level: 'warning', text: 'The hostname has several subdomain levels.' }); }
    if (host.length > 35) { score += 10; signals.push({ level: 'warning', text: 'The hostname is unusually long.' }); }
    if (/@/.test(parsed.href)) { score += 35; signals.push({ level: 'danger', text: 'The URL includes an @ symbol, which can make addresses misleading.' }); }
    if (!signals.length) signals.push({ level: 'neutral', text: 'No obvious demo heuristics were triggered. This does not establish that the site is safe.' });
    score = Math.min(score, 100);
    const status = score >= 45 ? 'danger' : score >= 20 ? 'warning' : 'neutral';
    return { status, score, signals, hostname: host, mode: 'demo', checkedAt: new Date().toISOString() };
  }
  async function scanWithBackend(parsed) {
    if (!config.API_BASE_URL) throw new Error('Backend mode is enabled, but API_BASE_URL is empty in config.js.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(config.REQUEST_TIMEOUT_MS) || 12000);
    try {
      const response = await fetch(`${config.API_BASE_URL.replace(/\/$/, '')}${config.SCAN_ENDPOINT || '/api/scan'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: parsed.href }), signal: controller.signal
      });
      if (!response.ok) throw new Error(`The scan service returned HTTP ${response.status}.`);
      const data = await response.json();
      // Expected response contract: { status: "safe"|"suspicious"|"dangerous", score?: number, signals?: string[]|{text,level}[] }
      const rawStatus = String(data.status || data.risk || 'unknown').toLowerCase();
      const status = ['danger', 'dangerous', 'malicious', 'high'].includes(rawStatus) ? 'danger' : ['warning', 'suspicious', 'medium'].includes(rawStatus) ? 'warning' : ['safe', 'low', 'clean'].includes(rawStatus) ? 'safe' : 'neutral';
      const rawSignals = Array.isArray(data.signals) ? data.signals : Array.isArray(data.reasons) ? data.reasons : [];
      const signals = rawSignals.map(item => typeof item === 'string' ? { level: status, text: item } : ({ level: item.level || status, text: String(item.text || item.message || 'Signal returned by backend') }));
      if (!signals.length) signals.push({ level: 'neutral', text: 'The backend did not return detailed signals.' });
      return { status, score: Number.isFinite(Number(data.score)) ? Number(data.score) : null, signals, hostname: parsed.hostname, mode: 'backend', checkedAt: new Date().toISOString() };
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('The scan request timed out. Please try again.');
      throw err;
    } finally { clearTimeout(timeout); }
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  function renderResult(result) {
    const titles = { danger: 'High-risk signals found', warning: 'Caution advised', neutral: 'No obvious demo signals', safe: 'Backend reports low risk' };
    const labels = { danger: 'HIGH RISK', warning: 'SUSPICIOUS', neutral: 'UNCONFIRMED', safe: 'LOW RISK' };
    const icon = { danger: '!', warning: '!', neutral: '?', safe: '✓' };
    const signalsHtml = result.signals.map(signal => `<li><span class="signal-mark ${escapeHtml(signal.level || 'neutral')}">${(signal.level === 'danger' || signal.level === 'warning') ? '!' : '•'}</span><span>${escapeHtml(signal.text)}</span></li>`).join('');
    const scoreText = result.score === null || result.score === undefined ? 'Not provided' : `${Math.max(0, Math.min(100, result.score))}/100`;
    resultBox.innerHTML = `<div class="result-heading"><span class="result-symbol ${result.status}">${icon[result.status] || '?'}</span><div><span class="risk-label ${result.status}">${labels[result.status] || 'UNCONFIRMED'}</span><h3>${titles[result.status] || 'Result received'}</h3><p class="result-host">${escapeHtml(result.hostname)}</p></div><div class="score-chip"><small>Risk score</small><b>${scoreText}</b></div></div><ul class="signal-list">${signalsHtml}</ul><p class="result-disclaimer">${result.mode === 'demo' ? 'Demo heuristic only. No threat-intelligence database was queried.' : 'Result supplied by the connected backend. Verify the backend methodology before relying on it.'}</p>`;
    history.unshift({ host: result.hostname, status: result.status, time: new Date(result.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    if (history.length > 5) history.pop();
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); error.hidden = true; error.textContent = '';
    let parsed;
    try { parsed = normalizeUrl(input.value); }
    catch (err) { error.textContent = err.message; error.hidden = false; input.focus(); return; }
    scanButton.disabled = true; scanButton.innerHTML = '<span class="spinner"></span> Checking';
    resultBox.innerHTML = '<div class="result-placeholder loading-state"><span class="spinner large"></span><b>Reviewing URL signals…</b><p>Please wait a moment.</p></div>';
    try {
      const result = config.DEMO_MODE ? demoAnalyze(parsed) : await scanWithBackend(parsed);
      renderResult(result);
    } catch (err) {
      resultBox.innerHTML = `<div class="result-placeholder error-state"><span class="placeholder-icon">!</span><b>Could not complete the check</b><p>${escapeHtml(err.message || 'Please try again.')}</p></div>`;
    } finally { scanButton.disabled = false; scanButton.innerHTML = 'Analyze <span>→</span>'; }
  });

  $('#safetyTipButton').addEventListener('click', () => {
    const message = $('#tipMessage'); message.hidden = !message.hidden;
    $('#safetyTipButton').innerHTML = message.hidden ? 'Read a quick safety tip <span>→</span>' : 'Hide safety tip <span>↑</span>';
  });
  document.querySelectorAll('[data-demo-info]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault(); showToast('Live scam-language analysis will be available after backend integration.');
  }));
  document.querySelectorAll('a[href="#scanner"]').forEach(link => {
    if (link.textContent.toLowerCase().includes('hear a sample')) link.addEventListener('click', () => {
      if (!('speechSynthesis' in window)) { showToast('Speech playback is not supported by this browser.'); return; }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance('सावधान। किसी अनजान व्यक्ति के कहने पर पैसे ट्रांसफर न करें। पहले आधिकारिक स्रोत से पुष्टि करें।');
      utterance.lang = 'hi-IN'; utterance.rate = 0.9; window.speechSynthesis.speak(utterance);
    });
  });
})();
