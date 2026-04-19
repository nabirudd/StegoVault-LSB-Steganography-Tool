/* ── Matrix rain ──────────────────────────────────────────────────────────── */
(function() {
  const canvas = document.getElementById('matrix-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()[]<>/\\|{}01';
  let cols, drops;
  const fontSize = 14;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    cols  = Math.floor(canvas.width / fontSize);
    drops = Array(cols).fill(1);
  }
  resize();
  window.addEventListener('resize', resize);

  function draw() {
    ctx.fillStyle = 'rgba(5,10,5,0.04)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#00ff41';
    ctx.font = fontSize + 'px Share Tech Mono, monospace';
    for (let i = 0; i < drops.length; i++) {
      const ch = chars[Math.floor(Math.random() * chars.length)];
      ctx.fillText(ch, i * fontSize, drops[i] * fontSize);
      if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    }
  }
  setInterval(draw, 45);
})();

/* ── Tab switching ────────────────────────────────────────────────────────── */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function toast(msg, isErr) {
  const tc  = document.getElementById('toast-container');
  const div = document.createElement('div');
  div.className = 'toast' + (isErr ? ' err' : '');
  div.textContent = msg;
  tc.appendChild(div);
  setTimeout(() => div.remove(), 3500);
}

function log(bodyId, text, cls) {
  const body = document.getElementById(bodyId);
  if (!body) return;
  const line = document.createElement('div');
  line.className = 'log-line ' + (cls || 'dim');
  line.textContent = text;
  body.appendChild(line);
  body.scrollTop = body.scrollHeight;
}

function bytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

function formatCapacity(used, total) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  return { pct, label: `${bytes(used)} / ${bytes(total)} used (${pct.toFixed(1)}%)` };
}

/* ── Password toggle ──────────────────────────────────────────────────────── */
document.querySelectorAll('.pass-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const inp = document.getElementById(btn.dataset.target);
    const icon = btn.querySelector('i');
    if (inp.type === 'password') {
      inp.type = 'text';
      icon.className = 'fas fa-eye-slash';
    } else {
      inp.type = 'password';
      icon.className = 'fas fa-eye';
    }
  });
});

/* ── Drop zone factory ────────────────────────────────────────────────────── */
function initDropZone(dropId, fileId, previewId, onFile) {
  const zone    = document.getElementById(dropId);
  const input   = document.getElementById(fileId);
  const preview = document.getElementById(previewId);
  const inner   = zone.querySelector('.drop-inner');

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      toast('Please upload a valid image file.', true);
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      preview.src = e.target.result;
      preview.style.display = 'block';
      if (inner) inner.style.display = 'none';
    };
    reader.readAsDataURL(file);
    onFile(file);
  }

  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', () => { if (input.files[0]) handleFile(input.files[0]); });
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    handleFile(e.dataTransfer.files[0]);
  });
}

/* ── Encode panel ─────────────────────────────────────────────────────────── */
let encFile = null;
let encCapBytes = 0;

initDropZone('enc-drop', 'enc-file', 'enc-preview', file => {
  encFile = file;
  loadEncodeInfo(file);
});

async function loadEncodeInfo(file) {
  const fd = new FormData();
  fd.append('image', file);
  log('enc-log-body', `Loading image: ${file.name} (${bytes(file.size)})`, 'info');
  try {
    const r = await fetch('/api/info', { method: 'POST', body: fd });
    const d = await r.json();
    if (!d.ok) { log('enc-log-body', 'Error: ' + d.message, 'err'); return; }
    encCapBytes = d.capacity;
    document.getElementById('enc-dim').textContent = `${d.width} × ${d.height} px`;
    document.getElementById('enc-cap').textContent = bytes(d.capacity) + ' max';
    document.getElementById('enc-meta').style.display = 'block';
    document.getElementById('enc-cap-wrap').style.display = 'block';
    updateCapacityBar();
    document.getElementById('enc-btn').disabled = false;
    log('enc-log-body', `Image loaded. Capacity: ${bytes(d.capacity)}`, 'ok');
  } catch (e) {
    log('enc-log-body', 'Failed to read image info.', 'err');
  }
}

function updateCapacityBar() {
  const msg   = document.getElementById('enc-message').value;
  const used  = new Blob([msg]).size;
  const fill  = document.getElementById('enc-fill');
  const label = document.getElementById('enc-cap-label');
  const usedEl = document.getElementById('enc-used');
  if (encCapBytes <= 0) return;
  const { pct, label: lbl } = formatCapacity(used, encCapBytes);
  fill.style.width = pct + '%';
  fill.classList.toggle('warn', pct > 60 && pct <= 85);
  fill.classList.toggle('full', pct > 85);
  label.textContent = lbl;
  if (usedEl) usedEl.textContent = bytes(used);
}

const msgTA = document.getElementById('enc-message');
if (msgTA) {
  msgTA.addEventListener('input', () => {
    const len = msgTA.value.length;
    const blen = new Blob([msgTA.value]).size;
    document.getElementById('enc-chars').textContent = len;
    document.getElementById('enc-bytes').textContent = blen;
    updateCapacityBar();
  });
}

const encPass = document.getElementById('enc-pass');
if (encPass) {
  encPass.addEventListener('input', () => {
    const flags = document.getElementById('enc-flags');
    if (flags) flags.style.display = encPass.value ? 'block' : 'none';
  });
}

document.getElementById('enc-btn')?.addEventListener('click', async () => {
  if (!encFile) { toast('Upload an image first.', true); return; }
  const msg  = document.getElementById('enc-message').value.trim();
  const pass = document.getElementById('enc-pass').value;
  if (!msg)  { toast('Enter a message to hide.', true); return; }

  const btn = document.getElementById('enc-btn');
  btn.disabled = true;
  btn.classList.add('loading');
  log('enc-log-body', `Encoding message (${bytes(new Blob([msg]).size)})…`, 'info');
  if (pass) log('enc-log-body', 'Applying AES-256-GCM encryption…', 'info');

  const fd = new FormData();
  fd.append('image', encFile);
  fd.append('message', msg);
  fd.append('passphrase', pass);

  try {
    const r = await fetch('/api/encode', { method: 'POST', body: fd });
    const d = await r.json();
    btn.classList.remove('loading');
    btn.disabled = false;
    if (!d.ok) {
      log('enc-log-body', 'ERROR: ' + d.message, 'err');
      toast(d.message, true);
      return;
    }
    log('enc-log-body', 'Encoding complete.', 'ok');
    if (d.encrypted) log('enc-log-body', 'Payload encrypted with AES-256-GCM.', 'ok');
    log('enc-log-body', `Output size: ${bytes(d.size)}`, 'info');

    const resImg = document.getElementById('enc-result-img');
    const resDl  = document.getElementById('enc-download');
    const resMeta = document.getElementById('enc-result-meta');
    resImg.src = d.image;
    resDl.href = d.image;
    resMeta.innerHTML =
      `Payload: ${bytes(d.size)} &nbsp;·&nbsp; ` +
      (d.encrypted ? '<span style="color:var(--cyan)">🔒 AES-256-GCM Encrypted</span>' : '<span style="color:var(--yellow)">🔓 Plain LSB</span>');
    document.getElementById('enc-result').style.display = 'block';
    toast('Message hidden successfully!');
  } catch (e) {
    btn.classList.remove('loading');
    btn.disabled = false;
    log('enc-log-body', 'Network error: ' + e.message, 'err');
    toast('Network error.', true);
  }
});

/* ── Decode panel ─────────────────────────────────────────────────────────── */
let decFile = null;

initDropZone('dec-drop', 'dec-file', 'dec-preview', file => {
  decFile = file;
  loadDecodeInfo(file);
});

async function loadDecodeInfo(file) {
  const fd = new FormData();
  fd.append('image', file);
  log('dec-log-body', `Loaded: ${file.name} (${bytes(file.size)})`, 'info');
  try {
    const r = await fetch('/api/info', { method: 'POST', body: fd });
    const d = await r.json();
    if (!d.ok) return;
    document.getElementById('dec-dim').textContent = `${d.width} × ${d.height} px`;
    document.getElementById('dec-cap').textContent = bytes(d.capacity) + ' max';
    document.getElementById('dec-meta').style.display = 'block';
    document.getElementById('dec-btn').disabled = false;
    log('dec-log-body', 'Image ready. Click "Extract" to decode.', 'ok');
  } catch (e) {
    log('dec-log-body', 'Failed to read image.', 'err');
  }
}

document.getElementById('dec-btn')?.addEventListener('click', async () => {
  if (!decFile) { toast('Upload an image first.', true); return; }
  const pass = document.getElementById('dec-pass').value;

  const btn = document.getElementById('dec-btn');
  btn.disabled = true;
  btn.classList.add('loading');
  log('dec-log-body', 'Extracting LSB payload…', 'info');
  if (pass) log('dec-log-body', 'Decryption passphrase provided.', 'info');

  const fd = new FormData();
  fd.append('image', decFile);
  fd.append('passphrase', pass);

  try {
    const r = await fetch('/api/decode', { method: 'POST', body: fd });
    const d = await r.json();
    btn.classList.remove('loading');
    btn.disabled = false;
    if (!d.ok) {
      log('dec-log-body', 'ERROR: ' + d.message, 'err');
      toast(d.message, true);
      return;
    }
    log('dec-log-body', `Extracted ${d.length} characters.`, 'ok');
    if (d.length > 0) log('dec-log-body', 'Decoding successful.', 'ok');

    document.getElementById('dec-message-box').textContent = d.message;
    document.getElementById('dec-result-meta').innerHTML =
      `${d.length} chars · ` +
      (d.length > 0 && pass ? '<span style="color:var(--cyan)">🔒 Was encrypted</span>' : '<span style="color:var(--yellow)">🔓 Plain text</span>');
    document.getElementById('dec-result').style.display = 'block';
    toast('Message extracted!');
  } catch (e) {
    btn.classList.remove('loading');
    btn.disabled = false;
    log('dec-log-body', 'Network error: ' + e.message, 'err');
    toast('Network error.', true);
  }
});

document.getElementById('dec-copy')?.addEventListener('click', () => {
  const text = document.getElementById('dec-message-box').textContent;
  navigator.clipboard.writeText(text).then(() => toast('Copied to clipboard!')).catch(() => toast('Copy failed.', true));
});
