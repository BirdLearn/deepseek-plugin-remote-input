/**
 * The phone-facing capture page: one self-contained document served by the
 * capture server. It collects text and photos, shrinks the photos, and posts
 * them back to the same origin.
 */

/** Copy in the phone's language; the page picks one set at load time. */
const COPY = {
  zh: {
    title: '投送到电脑',
    hint: '在这里输入文字或拍照，内容会直接进入电脑上的输入框。',
    placeholder: '输入要发送的文字…',
    camera: '拍照',
    gallery: '相册',
    send: '发送到电脑',
    sending: '发送中…',
    sent: '已发送 ✓ 电脑端输入框已收到',
    failed: '发送失败：',
    empty: '请先输入文字或选择图片',
    remove: '移除这张图片',
    photo: '照片',
  },
  en: {
    title: 'Send to computer',
    hint: 'Type text or take a photo here; it lands in the composer on your computer.',
    placeholder: 'Type the text to send…',
    camera: 'Camera',
    gallery: 'Photos',
    send: 'Send to computer',
    sending: 'Sending…',
    sent: 'Sent ✓ the composer on your computer received it',
    failed: 'Send failed: ',
    empty: 'Type some text or pick a photo first',
    remove: 'Remove this photo',
    photo: 'Photo',
  },
}

/**
 * Build the capture page.
 * @returns the complete HTML document.
 */
export function mobilePage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>Phone capture</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 16px 16px calc(24px + env(safe-area-inset-bottom));
    font: 15px/1.5 -apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", Roboto, sans-serif;
    background: #f6f7f9; color: #16181d;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #15171b; color: #e8eaed; }
    textarea { background: #1e2126 !important; color: #e8eaed !important; border-color: #333840 !important; }
    button.secondary { background: #262a31 !important; color: #e8eaed !important; border-color: #3a3f47 !important; }
    .card { background: #1e2126 !important; border-color: #2c3138 !important; }
    .thumb { background: #262a31 !important; }
  }
  h1 { margin: 4px 0 6px; font-size: 19px; font-weight: 650; }
  p.hint { margin: 0 0 14px; font-size: 13px; opacity: 0.72; }
  textarea {
    width: 100%; min-height: 108px; padding: 10px 12px; resize: vertical;
    border: 1px solid #d4d7dd; border-radius: 12px; background: #fff; color: #16181d;
    font: inherit;
  }
  textarea:focus { outline: none; border-color: #4a7dff; }
  .row { display: flex; gap: 10px; margin-top: 10px; }
  button {
    flex: 1; padding: 12px 14px; border-radius: 12px; border: 1px solid transparent;
    font: inherit; font-weight: 600; cursor: pointer;
  }
  button:disabled { opacity: 0.5; }
  button.secondary { background: #fff; color: #16181d; border-color: #d4d7dd; }
  button.send { margin-top: 14px; width: 100%; background: #2f6bff; color: #fff; }
  .thumbs { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 0; padding: 0; list-style: none; }
  .thumbs:empty { display: none; }
  .thumb { position: relative; width: 76px; height: 76px; border-radius: 10px; overflow: hidden; background: #eceef1; }
  .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .thumb button {
    position: absolute; top: 3px; right: 3px; width: 22px; height: 22px; padding: 0;
    border-radius: 50%; background: rgba(0,0,0,0.62); color: #fff; font-size: 15px; line-height: 1;
  }
  .status { margin: 12px 0 0; min-height: 20px; font-size: 13px; opacity: 0.8; }
</style>
</head>
<body>
<h1 id="title"></h1>
<p class="hint" id="hint"></p>
<textarea id="text" rows="4"></textarea>
<div class="row">
  <button type="button" class="secondary" id="camera"></button>
  <button type="button" class="secondary" id="gallery"></button>
</div>
<input type="file" id="camera-input" accept="image/*" capture="environment" hidden>
<input type="file" id="gallery-input" accept="image/*" multiple hidden>
<ul class="thumbs" id="thumbs"></ul>
<button type="button" class="send" id="send"></button>
<p class="status" id="status" role="status"></p>
<script>
(function () {
  var COPY_ZH = ${JSON.stringify(COPY.zh)};
  var COPY_EN = ${JSON.stringify(COPY.en)};
  var copy = (navigator.language || 'zh').toLowerCase().indexOf('zh') === 0 ? COPY_ZH : COPY_EN;
  var key = new URLSearchParams(location.search).get('k') || '';
  var images = [];
  var el = {
    title: document.getElementById('title'),
    hint: document.getElementById('hint'),
    text: document.getElementById('text'),
    camera: document.getElementById('camera'),
    gallery: document.getElementById('gallery'),
    cameraInput: document.getElementById('camera-input'),
    galleryInput: document.getElementById('gallery-input'),
    thumbs: document.getElementById('thumbs'),
    send: document.getElementById('send'),
    status: document.getElementById('status'),
  };
  el.title.textContent = copy.title;
  el.hint.textContent = copy.hint;
  el.text.placeholder = copy.placeholder;
  el.camera.textContent = copy.camera;
  el.gallery.textContent = copy.gallery;
  el.send.textContent = copy.send;

  function setStatus(message) { el.status.textContent = message; }

  function renderThumbs() {
    el.thumbs.textContent = '';
    images.forEach(function (image, index) {
      var item = document.createElement('li');
      item.className = 'thumb';
      var preview = document.createElement('img');
      preview.src = image.url;
      preview.alt = copy.photo;
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', copy.remove);
      remove.addEventListener('click', function () {
        URL.revokeObjectURL(image.url);
        images.splice(index, 1);
        renderThumbs();
      });
      item.appendChild(preview);
      item.appendChild(remove);
      el.thumbs.appendChild(item);
    });
  }

  function readAsBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result).split(',')[1]); };
      reader.onerror = function () { reject(new Error('read failed')); };
      reader.readAsDataURL(blob);
    });
  }

  function drawScaled(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var image = new Image();
      image.onload = function () {
        var max = 1600;
        var scale = Math.min(1, max / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
        if (scale === 1 && file.size < 900 * 1024) { URL.revokeObjectURL(url); resolve(file); return; }
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
        canvas.height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
        var context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) { resolve(blob || file); }, 'image/jpeg', 0.85);
      };
      image.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      image.src = url;
    });
  }

  function addFiles(list) {
    var pending = Array.prototype.slice.call(list || []);
    if (pending.length === 0) return;
    Promise.all(pending.map(function (file) {
      if (!file.type || file.type.indexOf('image/') !== 0) return null;
      return drawScaled(file).then(function (blob) {
        return readAsBase64(blob).then(function (data) {
          return {
            name: file.name || 'photo.jpg',
            type: blob.type || file.type || 'image/jpeg',
            data: data,
            url: URL.createObjectURL(blob),
          };
        });
      });
    })).then(function (results) {
      results.forEach(function (result) { if (result !== null) images.push(result); });
      renderThumbs();
    }).catch(function () { setStatus(copy.failed + 'image'); });
  }

  el.camera.addEventListener('click', function () { el.cameraInput.click(); });
  el.gallery.addEventListener('click', function () { el.galleryInput.click(); });
  el.cameraInput.addEventListener('change', function (event) { addFiles(event.target.files); event.target.value = ''; });
  el.galleryInput.addEventListener('change', function (event) { addFiles(event.target.files); event.target.value = ''; });

  el.send.addEventListener('click', function () {
    var text = el.text.value;
    if (text.trim() === '' && images.length === 0) { setStatus(copy.empty); return; }
    el.send.disabled = true;
    el.send.textContent = copy.sending;
    setStatus('');
    var payload = {
      text: text,
      images: images.map(function (image) { return { name: image.name, type: image.type, data: image.data }; }),
    };
    fetch('/submit?k=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok || body.ok !== true) throw new Error(body.error || String(response.status));
        return body;
      });
    }).then(function () {
      el.text.value = '';
      images.forEach(function (image) { URL.revokeObjectURL(image.url); });
      images = [];
      renderThumbs();
      setStatus(copy.sent);
    }).catch(function (error) {
      setStatus(copy.failed + (error && error.message ? error.message : 'error'));
    }).then(function () {
      el.send.disabled = false;
      el.send.textContent = copy.send;
    });
  });
})();
</script>
</body>
</html>
`
}
