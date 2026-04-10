(function() {
  'use strict';

  var script = document.currentScript || document.querySelector('script[data-workspace]');
  if (!script) return;

  var WORKSPACE_ID = script.getAttribute('data-workspace');
  var COLOR = script.getAttribute('data-color') || '#0891B2';
  var GREETING = script.getAttribute('data-greeting') || 'Hi! How can we help you?';
  var BTN_TEXT = script.getAttribute('data-button-text') || 'Chat with us';
  var API_BASE = script.src ? script.src.replace(/\/widget\.js.*$/, '') : '';

  var VISITOR_KEY = 'tracktio_visitor_' + WORKSPACE_ID;
  var SUBMITTED_KEY = 'tracktio_submitted_' + WORKSPACE_ID;

  function getVisitorId() {
    var id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = 'v_' + Math.random().toString(36).substr(2, 12) + Date.now().toString(36);
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  }

  function hasSubmitted() {
    var ts = localStorage.getItem(SUBMITTED_KEY);
    if (!ts) return false;
    // Prevent duplicates for 24 hours
    return (Date.now() - parseInt(ts, 10)) < 86400000;
  }

  function markSubmitted() {
    localStorage.setItem(SUBMITTED_KEY, Date.now().toString());
  }

  // --- Styles ---
  var css = [
    '#tracktio-widget-wrap{position:fixed;bottom:20px;right:20px;z-index:999999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}',
    '#tracktio-widget-btn{width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,.2);transition:transform .2s,box-shadow .2s}',
    '#tracktio-widget-btn:hover{transform:scale(1.08);box-shadow:0 6px 20px rgba(0,0,0,.25)}',
    '#tracktio-widget-btn svg{width:26px;height:26px;fill:#fff}',
    '#tracktio-chat{display:none;width:350px;height:500px;background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.18);flex-direction:column;overflow:hidden;position:absolute;bottom:68px;right:0}',
    '#tracktio-chat.open{display:flex}',
    '#tracktio-chat-header{padding:16px 20px;color:#fff;font-size:15px;font-weight:600;display:flex;align-items:center;justify-content:space-between}',
    '#tracktio-chat-header button{background:none;border:none;color:#fff;cursor:pointer;font-size:20px;line-height:1;opacity:.8}',
    '#tracktio-chat-header button:hover{opacity:1}',
    '#tracktio-chat-body{flex:1;padding:20px;overflow-y:auto;display:flex;flex-direction:column;gap:12px}',
    '.tracktio-bubble{background:#f3f4f6;padding:12px 16px;border-radius:12px 12px 12px 4px;font-size:14px;line-height:1.5;color:#374151;max-width:90%;align-self:flex-start}',
    '.tracktio-form{display:flex;flex-direction:column;gap:10px;width:100%}',
    '.tracktio-form input,.tracktio-form textarea{width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:inherit;outline:none;transition:border-color .15s;box-sizing:border-box}',
    '.tracktio-form input:focus,.tracktio-form textarea:focus{border-color:' + COLOR + '}',
    '.tracktio-form textarea{resize:none;min-height:60px}',
    '.tracktio-form button[type=submit]{padding:10px 16px;border:none;border-radius:8px;color:#fff;font-size:14px;font-weight:600;cursor:pointer;transition:opacity .15s}',
    '.tracktio-form button[type=submit]:hover{opacity:.9}',
    '.tracktio-form button[type=submit]:disabled{opacity:.6;cursor:not-allowed}',
    '.tracktio-success{text-align:center;padding:20px 0}',
    '.tracktio-success svg{width:48px;height:48px;margin:0 auto 12px}',
    '.tracktio-success p{font-size:14px;color:#374151;line-height:1.5}',
    '.tracktio-err{color:#dc2626;font-size:12px;margin-top:-4px}',
    '@media(max-width:480px){#tracktio-chat{width:100vw;height:100vh;bottom:0;right:0;border-radius:0;position:fixed;top:0;left:0}#tracktio-widget-wrap{bottom:12px;right:12px}}'
  ].join('\n');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // --- DOM ---
  var wrap = document.createElement('div');
  wrap.id = 'tracktio-widget-wrap';

  var chatIcon = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/><path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/></svg>';
  var closeIcon = '&#10005;';
  var checkSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="' + COLOR + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/></svg>';

  // Button
  var btn = document.createElement('button');
  btn.id = 'tracktio-widget-btn';
  btn.style.backgroundColor = COLOR;
  btn.innerHTML = chatIcon;
  btn.setAttribute('aria-label', BTN_TEXT);
  btn.title = BTN_TEXT;

  // Chat window
  var chat = document.createElement('div');
  chat.id = 'tracktio-chat';
  chat.setAttribute('role', 'dialog');
  chat.setAttribute('aria-label', 'Chat');

  function renderForm() {
    var alreadySubmitted = hasSubmitted();
    chat.innerHTML = '<div id="tracktio-chat-header" style="background:' + COLOR + '">'
      + '<span>' + BTN_TEXT + '</span>'
      + '<button type="button" id="tracktio-close">' + closeIcon + '</button></div>'
      + '<div id="tracktio-chat-body">'
      + '<div class="tracktio-bubble">' + escapeHtml(GREETING) + '</div>'
      + (alreadySubmitted ? renderSuccess()
        : '<form class="tracktio-form" id="tracktio-form">'
        + '<input type="text" name="name" placeholder="Your name" required maxlength="100" />'
        + '<input type="tel" name="phone" placeholder="WhatsApp / Phone number" required maxlength="30" />'
        + '<textarea name="message" placeholder="How can we help?" required maxlength="1000" rows="3"></textarea>'
        + '<button type="submit" style="background:' + COLOR + '">Send message</button>'
        + '</form>')
      + '</div>';
    bindEvents();
  }

  function renderSuccess() {
    return '<div class="tracktio-success">' + checkSvg
      + '<p><strong>Thank you!</strong><br/>We\'ll contact you via WhatsApp shortly.</p></div>';
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function bindEvents() {
    var closeBtn = document.getElementById('tracktio-close');
    if (closeBtn) closeBtn.onclick = toggleChat;

    var form = document.getElementById('tracktio-form');
    if (form) form.onsubmit = handleSubmit;
  }

  var isOpen = false;
  function toggleChat() {
    isOpen = !isOpen;
    if (isOpen) {
      renderForm();
      chat.classList.add('open');
      btn.innerHTML = closeIcon.replace('&#10005;', '&times;');
      btn.style.fontSize = '24px';
      btn.style.color = '#fff';
    } else {
      chat.classList.remove('open');
      btn.innerHTML = chatIcon;
      btn.style.fontSize = '';
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    var form = e.target;
    var submitBtn = form.querySelector('button[type=submit]');
    var name = form.name.value.trim();
    var phone = form.phone.value.trim();
    var message = form.message.value.trim();

    // Remove previous errors
    var prev = form.querySelectorAll('.tracktio-err');
    for (var i = 0; i < prev.length; i++) prev[i].remove();

    if (!name || !phone || !message) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    var payload = {
      workspaceId: WORKSPACE_ID,
      name: name,
      phone: phone,
      message: message,
      pageUrl: window.location.href,
      visitorId: getVisitorId()
    };

    fetch(API_BASE + '/api/widget/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function(res) { return res.json().then(function(d) { return { ok: res.ok, data: d }; }); })
    .then(function(result) {
      if (result.ok && result.data.success) {
        markSubmitted();
        var body = document.getElementById('tracktio-chat-body');
        var f = document.getElementById('tracktio-form');
        if (f) f.outerHTML = renderSuccess();
      } else {
        var err = document.createElement('div');
        err.className = 'tracktio-err';
        err.textContent = result.data.error || 'Something went wrong. Please try again.';
        form.appendChild(err);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send message';
      }
    })
    .catch(function() {
      var err = document.createElement('div');
      err.className = 'tracktio-err';
      err.textContent = 'Network error. Please try again.';
      form.appendChild(err);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send message';
    });
  }

  btn.onclick = toggleChat;
  wrap.appendChild(chat);
  wrap.appendChild(btn);

  if (document.body) {
    document.body.appendChild(wrap);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      document.body.appendChild(wrap);
    });
  }
})();
