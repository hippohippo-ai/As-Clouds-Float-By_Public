// gallery.js —— 诗词配图（含本地上传图片）与 Lightbox（含印章叠加）
import { state, els } from './state.js';
import { getImages, deleteImage } from './database.js';

const STAMP_SRC = './云浮集_YunFuJi/99_其他/Stamp.png';

function getStampConfig(poem) {
  if (!poem) return { enabled: true, position: 'top-left', size: '15%', inset: '3.5%', opacity: 0.92, rotate: '0deg' };
  const cfg = poem.stamp;
  if (!cfg) return { enabled: true, position: 'top-left', size: '15%', inset: '3.5%', opacity: 0.92, rotate: '0deg' };
  if (cfg.enabled === false) return { enabled: false };
  return {
    enabled: cfg.enabled !== false,
    position: cfg.position || 'top-left',
    size: cfg.size || '15%',
    inset: cfg.inset || '3.5%',
    opacity: cfg.opacity != null ? cfg.opacity : 0.92,
    rotate: cfg.rotate || '0deg',
    x: cfg.x,
    y: cfg.y,
  };
}

function applyStampStyle(el, cfg) {
  if (!el) return;
  if (!cfg || cfg.enabled === false) {
    el.style.display = 'none';
    return;
  }
  el.style.display = '';
  const size = cfg.size || '15%';
  const inset = cfg.inset || '3.5%';
  const opacity = cfg.opacity != null ? cfg.opacity : 0.92;
  const rotate = cfg.rotate || '0deg';
  el.style.width = size;
  el.style.opacity = String(opacity);
  el.style.top = '';
  el.style.left = '';
  el.style.right = '';
  el.style.bottom = '';
  el.style.transform = '';
  const transforms = [];
  if (rotate && rotate !== '0deg' && rotate !== '0' && rotate !== '0%') {
    transforms.push(`rotate(${rotate})`);
  }
  // 自定义 x/y 坐标优先级最高
  if (cfg.x != null || cfg.y != null) {
    if (cfg.x != null) el.style.left = cfg.x;
    if (cfg.y != null) el.style.top = cfg.y;
    el.style.right = 'auto';
    el.style.bottom = 'auto';
  } else {
    const posRaw = String(cfg.position || 'top-left').trim();
    const pos = posRaw.toLowerCase();
    // 自定义百分比坐标如 "12% 8%" 或 "20px 10px"
    if ((pos.includes('%') || pos.includes('px')) && pos.includes(' ')) {
      const parts = posRaw.split(/\s+/);
      el.style.left = parts[0];
      el.style.top = parts[1] || parts[0];
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    } else {
      switch (pos) {
        case 'top-right':
        case 'tr':
        case 'right-top':
          el.style.top = inset;
          el.style.right = inset;
          el.style.left = 'auto';
          el.style.bottom = 'auto';
          break;
        case 'bottom-left':
        case 'bl':
        case 'left-bottom':
          el.style.bottom = inset;
          el.style.left = inset;
          el.style.top = 'auto';
          el.style.right = 'auto';
          break;
        case 'bottom-right':
        case 'br':
        case 'right-bottom':
          el.style.bottom = inset;
          el.style.right = inset;
          el.style.top = 'auto';
          el.style.left = 'auto';
          break;
        case 'center':
        case 'middle':
        case 'centre':
        case 'c':
          el.style.top = '50%';
          el.style.left = '50%';
          el.style.right = 'auto';
          el.style.bottom = 'auto';
          transforms.push('translate(-50%, -50%)');
          break;
        default:
          el.style.top = inset;
          el.style.left = inset;
          el.style.right = 'auto';
          el.style.bottom = 'auto';
          break;
      }
    }
  }
  el.style.transform = transforms.join(' ');
}

function createStampOverlay(cfg) {
  const stamp = document.createElement('img');
  stamp.src = STAMP_SRC;
  stamp.alt = '印章';
  stamp.className = 'stamp-overlay';
  stamp.loading = 'lazy';
  stamp.draggable = false;
  applyStampStyle(stamp, cfg);
  return stamp;
}

function updateLightboxStamp() {
  if (!els.lightboxStamp) return;
  const poem = state.allPoems[state.currentPoemIndex];
  const cfg = getStampConfig(poem);
  // lightbox 中同样显示印章；若该诗无图但 lightbox 已打开则仍按当前诗配置
  if (state.lightbox.images.length === 0) {
    els.lightboxStamp.style.display = 'none';
    return;
  }
  applyStampStyle(els.lightboxStamp, cfg);
  // 若该诗被显式禁用印章，则隐藏
  if (cfg.enabled === false) els.lightboxStamp.style.display = 'none';
}

  export async function renderPoemImages(poemId) {
    if (!els.poemImagesGallery) return [];
    els.poemImagesGallery.innerHTML = '';
    const poem = state.allPoems.find(p => p.id === poemId);
    const stampCfg = getStampConfig(poem);
    const staticImages = (await Promise.all((poem?.staticImages || []).map(async (path) => {
      const resolved = await window.__YUNFUJI_RESOLVE_ASSET__?.(path);
      return resolved || `./云浮集_YunFuJi/${path}`;
    }))).filter(Boolean);
    const dbImages = await getImages(poemId);
    const allUrls = [...staticImages, ...dbImages.map(img => img.dataUrl)];
    if (allUrls.length === 0) {
      // 无图时也隐藏 lightbox 印章
      if (els.lightboxStamp) els.lightboxStamp.style.display = 'none';
      return [];
    }
    staticImages.forEach((url, idx) => {
      const item = document.createElement('div');
      item.className = 'gallery-item';
      const imgEl = document.createElement('img');
      imgEl.src = url;
      imgEl.alt = '配图';
      imgEl.loading = 'lazy';
      imgEl.addEventListener('click', () => openLightbox(allUrls, idx));
      item.appendChild(imgEl);
      if (stampCfg.enabled !== false) {
        const stampEl = createStampOverlay(stampCfg);
        item.appendChild(stampEl);
      }
      els.poemImagesGallery.appendChild(item);
    });
    dbImages.forEach((img, idx) => {
      const globalIdx = staticImages.length + idx;
      const item = document.createElement('div');
      item.className = 'gallery-item';
      const imgEl = document.createElement('img');
      imgEl.src = img.dataUrl;
      imgEl.alt = '配图';
      imgEl.loading = 'lazy';
      imgEl.addEventListener('click', () => openLightbox(allUrls, globalIdx));
      const delBtn = document.createElement('button');
      delBtn.className = 'gallery-delete';
      delBtn.textContent = '×';
      delBtn.title = '删除图片';
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('确定要删除这张本地配图吗？')) {
          await deleteImage(img.id);
          renderPoemImages(poemId);
        }
      });
      item.appendChild(imgEl);
      if (stampCfg.enabled !== false) {
        const stampEl = createStampOverlay(stampCfg);
        item.appendChild(stampEl);
      }
      item.appendChild(delBtn);
      els.poemImagesGallery.appendChild(item);
    });
    const firstImg = els.poemImagesGallery.querySelector('img');
    if (firstImg && !firstImg.complete) {
      await new Promise(resolve => {
        firstImg.addEventListener('load', resolve, { once: true });
        firstImg.addEventListener('error', resolve, { once: true });
        setTimeout(resolve, 2000);
      });
    }
    return allUrls;
  }

  export function openLightbox(images, index) {
    if (!els.lightbox || images.length === 0) return;
    state.lightbox.images = images;
    state.lightbox.currentIndex = index;
    updateLightboxImage();
    updateLightboxStamp();
    els.lightbox.classList.add('active');
  }

  export function closeLightbox() {
    if (els.lightbox) els.lightbox.classList.remove('active');
  }

  export function updateLightboxImage() {
    if (els.lightboxImage && state.lightbox.images.length > 0) {
      els.lightboxImage.src = state.lightbox.images[state.lightbox.currentIndex];
    }
    updateLightboxStamp();
  }
