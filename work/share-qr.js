/* Render the selected public link on this device when the share panel is opened. */
(() => {
  'use strict';
  const dialog = document.getElementById('exp-share-dialog');
  const panel = document.getElementById('exp-qr');
  const select = document.getElementById('exp-qr-kind');
  const canvas = document.getElementById('exp-qr-image');
  const download = document.getElementById('exp-qr-save');
  const message = document.getElementById('exp-qr-message');
  function render() {
    if (!panel.open || !dialog.open) return;
    const replay = select.value === 'replay';
    canvas.hidden = download.hidden = true;
    download.removeAttribute('href');
    try {
      const url = new URL(document.getElementById(replay ? 'exp-replay-link' : 'exp-share-link').value);
      if (!['http:', 'https:'].includes(url.protocol)) throw Error('Invalid link');
      const qr = qrcode(0, 'M');
      qr.addData(url.href, 'Byte');
      qr.make();
      const count = qr.getModuleCount();
      const quiet = 4, cell = 8;
      canvas.width = canvas.height = (count + 2 * quiet) * cell;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000';
      for (let y = 0; y < count; y++) {
        for (let x = 0; x < count; x++) {
          if (qr.isDark(y, x)) ctx.fillRect((x + quiet) * cell, (y + quiet) * cell, cell, cell);
        }
      }
      download.href = canvas.toDataURL('image/png');
      download.download = replay ? 'earth-online-replay-qr.png' : 'earth-online-challenge-qr.png';
      canvas.hidden = download.hidden = false;
      message.textContent = replay ? '扫码查看这次远征的逐站回放。' : '扫码以相同种子和角色开始挑战。';
    } catch {
      message.textContent = '二维码生成失败，可复制分享窗口中的链接。';
    }
  }
  panel.addEventListener('toggle', render);
  select.addEventListener('change', render);
  dialog.addEventListener('close', () => {
    panel.open = false;
    select.value = 'replay';
  });
})();
