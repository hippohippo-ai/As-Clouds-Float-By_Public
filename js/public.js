// public.js —— 加密公开版入口：密码门 → 解密数据 → 启动原站点
import { unlock, resolveAsset } from './crypto.js';

const STORAGE_KEY = 'yfj_public_password';

const GATE_STYLE = `
  body.yfj-locked { overflow: hidden; }
  .yfj-gate {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: radial-gradient(ellipse at 50% 18%, rgba(247,244,235,.97) 0%, rgba(239,234,223,.99) 55%, rgba(228,221,207,1) 100%);
    opacity: 1;
    transition: opacity .36s ease;
  }
  .yfj-gate.is-hiding { opacity: 0; pointer-events: none; }
  .yfj-gate-card {
    width: min(420px, 100%);
    padding: 44px 36px 32px;
    text-align: center;
    background: rgba(255,253,247,.92);
    border: 1px solid rgba(38,61,56,.22);
    box-shadow: 0 30px 80px rgba(38,61,56,.14), inset 0 0 0 6px rgba(255,253,247,.6), inset 0 0 0 7px rgba(38,61,56,.08);
    font-family: "Noto Serif SC", "Songti SC", "STSong", serif;
    color: #263d38;
  }
  .yfj-gate-en {
    margin: 0 0 14px;
    font-size: 11px;
    letter-spacing: .34em;
    text-transform: uppercase;
    color: #a4654d;
  }
  .yfj-gate-title {
    margin: 0;
    font-size: 30px;
    font-weight: 600;
    letter-spacing: .18em;
  }
  .yfj-gate-sub {
    margin: 12px 0 0;
    font-size: 13px;
    letter-spacing: .16em;
    color: #77766f;
  }
  .yfj-gate-rule {
    width: 56px;
    height: 1px;
    margin: 24px auto 26px;
    background: linear-gradient(90deg, transparent, rgba(164,101,77,.55), transparent);
  }
  .yfj-gate-form { display: flex; flex-direction: column; gap: 12px; }
  .yfj-gate-label {
    font-size: 12px;
    letter-spacing: .18em;
    color: #77766f;
    text-align: left;
  }
  .yfj-gate-input {
    box-sizing: border-box;
    width: 100%;
    padding: 12px 14px;
    font: inherit;
    font-size: 16px;
    letter-spacing: .08em;
    color: #263d38;
    background: rgba(247,244,235,.75);
    border: 1px solid rgba(38,61,56,.22);
    border-radius: 2px;
    outline: none;
    transition: border-color .2s ease, box-shadow .2s ease;
  }
  .yfj-gate-input:focus {
    border-color: rgba(164,101,77,.7);
    box-shadow: 0 0 0 3px rgba(164,101,77,.12);
  }
  .yfj-gate-input:disabled { opacity: .6; }
  .yfj-gate-button {
    margin-top: 6px;
    padding: 12px 16px;
    font: inherit;
    font-size: 15px;
    letter-spacing: .3em;
    color: #f7f4eb;
    background: #263d38;
    border: 1px solid #263d38;
    border-radius: 2px;
    cursor: pointer;
    transition: background .2s ease, border-color .2s ease, opacity .2s ease;
  }
  .yfj-gate-button:hover:not(:disabled) { background: #a4654d; border-color: #a4654d; }
  .yfj-gate-button:disabled { cursor: wait; opacity: .65; }
  .yfj-gate-msg {
    min-height: 1.4em;
    margin: 16px 0 0;
    font-size: 13px;
    letter-spacing: .08em;
    color: #a4654d;
  }
  @media (max-width: 480px) {
    .yfj-gate-card { padding: 34px 24px 26px; }
    .yfj-gate-title { font-size: 26px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .yfj-gate { transition: none; }
  }
`;

function readRemembered() {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function remember(password) {
  try {
    sessionStorage.setItem(STORAGE_KEY, password);
  } catch {
    // 隐私模式下无法写入时，仅本次会话继续可用。
  }
}

function forget() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略。
  }
}

function installStyle() {
  const style = document.createElement('style');
  style.textContent = GATE_STYLE;
  document.head.appendChild(style);
}

function createGate() {
  const gate = document.createElement('div');
  gate.className = 'yfj-gate';
  gate.innerHTML = `
    <div class="yfj-gate-card" role="dialog" aria-modal="true" aria-labelledby="yfj-gate-title">
      <p class="yfj-gate-en">As Clouds Float By</p>
      <h1 class="yfj-gate-title" id="yfj-gate-title">云浮怪骨集</h1>
      <p class="yfj-gate-sub">此卷以密语封存</p>
      <div class="yfj-gate-rule"></div>
      <form class="yfj-gate-form">
        <label class="yfj-gate-label" for="yfj-gate-password">阅读密码</label>
        <input class="yfj-gate-input" id="yfj-gate-password" type="password" autocomplete="current-password" spellcheck="false" placeholder="请输入密码">
        <button class="yfj-gate-button" type="submit">开 卷</button>
      </form>
      <p class="yfj-gate-msg" role="status" aria-live="polite"></p>
    </div>
  `;
  document.body.appendChild(gate);

  const form = gate.querySelector('form');
  const input = gate.querySelector('input');
  const button = gate.querySelector('button');
  const message = gate.querySelector('.yfj-gate-msg');
  let busy = false;

  function setBusy(next, text) {
    busy = next;
    input.disabled = next;
    button.disabled = next;
    gate.classList.toggle('is-busy', next);
    if (text !== undefined) message.textContent = text;
  }

  return {
    gate,
    form,
    input,
    message,
    setBusy,
    isBusy: () => busy,
    fail(text) {
      setBusy(false, text);
      input.focus();
      input.select();
    },
    hide() {
      gate.classList.add('is-hiding');
      setTimeout(() => gate.remove(), 380);
    },
  };
}

installStyle();
document.body.classList.add('yfj-locked');

const gate = createGate();
let started = false;

async function start(password, shouldRemember) {
  if (started) return;
  started = true;

  const data = await unlock(password);
  window.__YUNFUJI_DATA__ = data;
  window.__YUNFUJI_ASSETS__ = data.assets || {};
  window.__YUNFUJI_RESOLVE_ASSET__ = resolveAsset;

  if (shouldRemember) remember(password);

  gate.hide();
  document.body.classList.remove('yfj-locked');
  await import('./script.js');
}

async function attempt(password, shouldRemember) {
  gate.setBusy(true, '正在展开…');
  try {
    await start(password, shouldRemember);
  } catch (error) {
    started = false;
    forget();
    const wrongPassword = error && error.name === 'OperationError';
    gate.fail(wrongPassword ? '密码不正确' : '暂时无法解锁，请稍后再试');
    console.warn('解锁失败：', error);
  }
}

gate.form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (gate.isBusy()) return;
  const password = gate.input.value;
  if (!password) {
    gate.message.textContent = '请输入阅读密码';
    gate.input.focus();
    return;
  }
  attempt(password, true);
});

const remembered = readRemembered();
if (remembered) {
  attempt(remembered, false);
} else {
  gate.input.focus();
}
