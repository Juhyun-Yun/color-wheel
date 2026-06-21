// ==========================================
// 10색상환 친구들 - 프론트엔드 (학급별 독립 운영)
// ==========================================

// --- 연결 주소 관리 ---
let GAS_URL = '';
let IS_STUDENT_URL = false;

function loadEndpoint() {
  const urlParam = new URLSearchParams(window.location.search).get('endpoint');
  if (urlParam) {
    localStorage.setItem('gas_endpoint', urlParam);
    GAS_URL = urlParam;
    IS_STUDENT_URL = true;
    return true;
  }
  const stored = localStorage.getItem('gas_endpoint');
  if (stored) {
    GAS_URL = stored;
    return true;
  }
  return false;
}

function saveEndpoint(url) {
  GAS_URL = url.trim();
  localStorage.setItem('gas_endpoint', GAS_URL);
}

function getStudentShareUrl() {
  if (!GAS_URL) return '';
  return window.location.origin + window.location.pathname + '?endpoint=' + encodeURIComponent(GAS_URL);
}

// --- JSONP 통신 (GET 요청 - CORS 없이 동작) ---
function jsonpGet(params) {
  return new Promise((resolve, reject) => {
    if (!GAS_URL) { reject(new Error('연결 주소가 설정되지 않았습니다.')); return; }

    const cbName = '_cb' + Date.now() + Math.random().toString(36).slice(2, 8);
    const script = document.createElement('script');
    const qp = new URLSearchParams({ ...params, callback: cbName });

    const cleanup = () => {
      delete window[cbName];
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('응답 시간이 초과되었습니다. (20초)'));
    }, 20000);

    window[cbName] = (data) => {
      clearTimeout(timer);
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error('연결에 실패했습니다.'));
    };

    script.src = GAS_URL + '?' + qp.toString();
    document.head.appendChild(script);
  });
}

async function apiGet(action, extra) {
  try {
    const result = await jsonpGet(Object.assign({ action }, extra || {}));
    return (result && result.data !== undefined) ? result.data : result;
  } catch (e) {
    console.error('통신 오류:', e);
    return null;
  }
}

// POST - 이미지처럼 큰 데이터는 GET URL에 담을 수 없으므로 별도 처리
async function apiPost(action, data) {
  if (!GAS_URL) return null;
  try {
    await fetch(GAS_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action }, data || {}))
    });
    return { status: 'sent' };
  } catch (e) {
    console.error('저장 오류:', e);
    return null;
  }
}

// --- 색상 데이터 ---
const colorData = [
  { name: "빨강", hex: "#FF3B30", feeling: "열정이 느껴져요.", keywords: ["열정", "용기"] },
  { name: "주황", hex: "#FF9500", feeling: "활기찬 기운이 가득해요.", keywords: ["즐거움", "활발"] },
  { name: "노랑", hex: "#FFCC00", feeling: "희망적인 빛이 나요.", keywords: ["희망", "밝음"] },
  { name: "연두", hex: "#AFDB42", feeling: "상쾌하고 싱그러워요.", keywords: ["싱싱함", "생명력"] },
  { name: "초록", hex: "#34C759", feeling: "편안해지는 자연의 색이에요.", keywords: ["안정", "휴식"] },
  { name: "청록", hex: "#00AF91", feeling: "신비로운 느낌이 담겨 있어요.", keywords: ["신비", "지혜"] },
  { name: "파랑", hex: "#007AFF", feeling: "시원한 하늘과 바다를 닮았어요.", keywords: ["신뢰", "정직"] },
  { name: "남색", hex: "#1D2B53", feeling: "무게감이 있고 진지해요.", keywords: ["깊음", "고요"] },
  { name: "보라", hex: "#8E55E9", feeling: "우아한 아이디어가 떠올라요.", keywords: ["우아", "꿈"] },
  { name: "자주", hex: "#D91B5C", feeling: "화려하고 개성이 뚜렷해요.", keywords: ["화려", "매력"] }
];

const mixingRatios = {
  "빨강": { R: 1, Y: 0, B: 0 }, "주황": { R: 1, Y: 2, B: 0 }, "노랑": { R: 0, Y: 1, B: 0 },
  "연두": { R: 0, Y: 2, B: 1 }, "초록": { R: 0, Y: 1, B: 1 }, "청록": { R: 0, Y: 1, B: 2 },
  "파랑": { R: 0, Y: 0, B: 1 }, "남색": { R: 1, Y: 0, B: 2 }, "보라": { R: 1, Y: 0, B: 1 }, "자주": { R: 2, Y: 0, B: 1 }
};

const state = {
  isDrawing: false, paintColor: '#FF3B30', currentTheme: 'energy', canvasMode: 'blank',
  creationWheelState: new Array(10).fill(null), currentMixture: { R: 0, Y: 0, B: 0 },
  selectedColorFromPool: null, eraserMode: false
};

// ==========================================
// DOMContentLoaded
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('drawing-canvas');
  const ctx = canvas.getContext('2d');
  const brushInput = document.getElementById('brush-size');
  const mainApp = document.getElementById('main-app');

  canvas.width = 1200;
  canvas.height = 800;
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // --- 엔드포인트 로드 및 UI 초기화 ---
  const hasEndpoint = loadEndpoint();
  initSettingsUI(hasEndpoint);
  if (hasEndpoint) loadStudentNames();

  // --- 학생 드롭다운 토글 ---
  const ddTrigger = document.getElementById('student-dropdown-trigger');
  const ddMenu    = document.getElementById('student-dropdown-menu');
  ddTrigger.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = !ddMenu.classList.contains('hidden');
    ddMenu.classList.toggle('hidden', isOpen);
    ddTrigger.classList.toggle('open', !isOpen);
  });
  document.addEventListener('click', () => {
    ddMenu.classList.add('hidden');
    ddTrigger.classList.remove('open');
  });

  // --- 그리기 이벤트 ---
  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    const cy = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
    return {
      x: (cx - rect.left) * (canvas.width / rect.width),
      y: (cy - rect.top) * (canvas.height / rect.height)
    };
  }

  function startPaint(e) {
    state.isDrawing = true;
    const { x, y } = getPos(e);
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineWidth = state.eraserMode ? Math.max(Number(brushInput.value) * 2, 24) : brushInput.value;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = state.eraserMode ? 'white' : state.paintColor;
    ctx.lineTo(x, y); ctx.stroke();
  }

  function movePaint(e) {
    if (!state.isDrawing) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y); ctx.stroke();
    if (e.cancelable) e.preventDefault();
  }

  function stopPaint() { state.isDrawing = false; ctx.beginPath(); }

  canvas.onmousedown = startPaint;
  window.addEventListener('mousemove', movePaint);
  window.addEventListener('mouseup', stopPaint);
  canvas.addEventListener('touchstart', (e) => { startPaint(e); if (e.cancelable) e.preventDefault(); }, { passive: false });
  window.addEventListener('touchmove', movePaint, { passive: false });
  window.addEventListener('touchend', stopPaint);

  // --- 로그인 ---
  function enterApp(name) {
    document.getElementById('welcome-name').textContent = name || '탐험가';
    document.getElementById('login-overlay').classList.add('hidden');
    mainApp.classList.remove('hidden');
    initExplore();
    handleResize();
    if (name && GAS_URL) {
      apiGet('logActivity', {
        name: encodeURIComponent(name),
        activity: encodeURIComponent('앱 입장'),
        stage: encodeURIComponent('01 탐험하기')
      });
    }
  }

  document.getElementById('start-btn').onclick = () => {
    const name = document.getElementById('student-name-input').value;
    if (!name) return;
    enterApp(name);
  };

  document.getElementById('guest-start-btn').onclick = () => enterApp('');

  // --- 내비게이션 ---
  document.querySelectorAll('.index-btn, .next-step-btn').forEach(btn => {
    btn.onclick = () => {
      const target = btn.dataset.target;
      if (!target) return;
      document.querySelectorAll('.index-btn').forEach(b => b.classList.toggle('active', b.dataset.target === target));
      document.querySelectorAll('.view-content').forEach(v => v.classList.toggle('active', v.id === target));
      if (target === 'create-wheel-view') initCreation();
      if (target === 'paint-view') updatePaintUI();
      if (target === 'gallery-view') initGallery();
      handleResize();
    };
  });

  // --- 갤러리 ---
  async function initGallery() {
    const grid = document.getElementById('gallery-grid');
    grid.innerHTML = '<p style="padding:20px; text-align:center; width:100%;">작품을 불러오는 중... 🎨</p>';
    const [artworks, comments] = await Promise.all([
      apiGet('getArtworks'),
      apiGet('getPeerComments')
    ]);
    renderGallery(artworks || [], comments || []);
  }

  function renderGallery(artworks, comments) {
    const grid = document.getElementById('gallery-grid');
    grid.innerHTML = '';
    if (!artworks.length) {
      grid.innerHTML = '<p style="padding:40px; text-align:center; width:100%; color:#636e72;">아직 등록된 작품이 없어요. 😢</p>';
      return;
    }

    const commentsByRowId = {};
    (comments || []).forEach(c => {
      if (!commentsByRowId[c.rowId]) commentsByRowId[c.rowId] = [];
      commentsByRowId[c.rowId].push(c);
    });

    const myName = document.getElementById('welcome-name').textContent;

    artworks.forEach(art => {
      const themeLabel   = art.theme === 'energy' ? '열정' : art.theme === 'spring' ? '싱그러움' : '시원함';
      const artComments  = commentsByRowId[art.rowId] || [];
      const isOwn        = art.name === myName;

      const commentsHtml = artComments.map(c =>
        '<div class="peer-comment-item">' +
          '<span class="peer-comment-author">' + c.author + '</span>' +
          '<span class="peer-comment-text">' + c.comment + '</span>' +
          '<span class="peer-comment-time">' + c.time + '</span>' +
        '</div>'
      ).join('');

      const selfEvalHtml = art.selfEval
        ? '<div class="self-eval-display">✏️ 자기 평가: ' + art.selfEval + '</div>'
        : '';

      const card = document.createElement('div');
      card.className = 'glass-card';
      card.style.cssText = 'padding:15px; display:flex; flex-direction:column; gap:10px;';
      card.innerHTML =
        '<div style="display:flex; justify-content:space-between; align-items:center;">' +
          '<strong style="font-size:1.1rem;">' + art.name + '</strong>' +
          '<span style="font-size:0.8rem; padding:4px 8px; border-radius:8px; background:#f1f2f6; color:#6c5ce7; font-weight:700;">' + themeLabel + '</span>' +
        '</div>' +
        '<img src="' + art.imageData + '" style="width:100%; border-radius:12px; border:1px solid #eee; cursor:pointer;" onclick="window.open(\'' + art.imageData + '\')">' +
        selfEvalHtml +
        '<div>' +
          '<label style="font-size:0.8rem; font-weight:800; color:#636e72;">선생님 한마디:</label>' +
          '<div style="display:flex; gap:8px; margin-top:5px;">' +
            '<input type="text" id="fb-' + art.rowId + '" value="' + art.feedback.replace(/"/g, '&quot;') + '" placeholder="칭찬 한마디 써주세요!"' +
              ' style="flex:1; padding:8px 12px; border:2px solid #eee; border-radius:10px; font-size:0.85rem; font-family:inherit;">' +
            '<button onclick="submitFeedback(' + art.rowId + ')" class="primary-btn" style="padding:8px 15px; font-size:0.8rem;">저장</button>' +
          '</div>' +
        '</div>' +
        '<div class="peer-section">' +
          '<div class="peer-section-label">💬 동료 댓글 (' + artComments.length + ')</div>' +
          (commentsHtml ? '<div class="peer-comments-list">' + commentsHtml + '</div>' : '') +
          (!isOwn
            ? '<div class="peer-input-row">' +
                '<input type="text" id="pc-' + art.rowId + '" placeholder="응원 댓글을 달아봐요!" class="peer-comment-input">' +
                '<button onclick="submitPeerComment(' + art.rowId + ')" class="primary-btn" style="padding:8px 15px; font-size:0.8rem;">등록</button>' +
              '</div>'
            : '<p class="my-art-note">내 작품이에요 ✨</p>'
          ) +
        '</div>';
      grid.appendChild(card);
    });
  }

  window.submitFeedback = async (rowId) => {
    const feedback = document.getElementById('fb-' + rowId).value;
    const result = await apiGet('saveFeedback', { rowId: rowId, feedback: encodeURIComponent(feedback) });
    if (result && result.status === 'ok') {
      alert('피드백을 저장했습니다!');
    } else {
      alert('저장 요청을 보냈습니다.');
    }
  };

  window.submitPeerComment = async (rowId) => {
    const input   = document.getElementById('pc-' + rowId);
    const comment = (input.value || '').trim();
    if (!comment) return;
    const myName = document.getElementById('welcome-name').textContent;
    if (!myName || myName === '탐험가') {
      alert('이름을 선택한 후 댓글을 달 수 있어요!');
      return;
    }
    input.disabled = true;
    await apiGet('savePeerComment', {
      rowId,
      author:  encodeURIComponent(myName),
      comment: encodeURIComponent(comment)
    });
    input.value    = '';
    input.disabled = false;
    initGallery();
  };

  document.getElementById('refresh-gallery').onclick = initGallery;

  // --- 01 탐험하기 ---
  function initExplore() {
    const wheel     = document.getElementById('color-wheel');
    const nextBtn   = document.getElementById('explore-next-btn');
    const explored  = new Set();
    wheel.innerHTML = '';

    function checkAllExplored() {
      if (explored.size >= colorData.length) {
        nextBtn.disabled = false;
        nextBtn.textContent = '다음 단계로 가기 ➔';
      } else {
        nextBtn.textContent = '다음 단계로 가기 (' + explored.size + '/' + colorData.length + ')';
      }
    }
    checkAllExplored();

    colorData.forEach((c, i) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      el.setAttribute('d', createSlicePath(200, 200, 180, i * 36, (i + 1) * 36));
      el.setAttribute('fill', c.hex);
      el.style.cursor = 'pointer';
      el.onclick = () => {
        wheel.style.transform = 'rotate(' + (-(i + 0.5) * 36) + 'deg)';
        document.getElementById('color-card').classList.remove('hidden');
        document.getElementById('intro-card').classList.add('hidden');
        document.getElementById('color-name').textContent = c.name;
        document.getElementById('color-feeling').textContent = c.feeling;
        document.getElementById('color-indicator').style.backgroundColor = c.hex;
        // 체크 표시 — 이미 본 색은 테두리 추가
        if (!explored.has(i)) {
          explored.add(i);
          el.setAttribute('stroke', 'white');
          el.setAttribute('stroke-width', '3');
          el.setAttribute('opacity', '0.85');
          checkAllExplored();
        }
      };
      wheel.appendChild(el);
      addWheelLabel(wheel, i, c.name, 'white');
    });
  }

  // --- 02 완성하기 ---
  function initCreation() {
    const wheel = document.getElementById('creation-wheel');
    wheel.innerHTML = '';
    renderPool();
    updateBowl();
    for (let i = 0; i < 10; i++) {
      const slot = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      slot.setAttribute('d', createSlicePath(200, 200, 180, i * 36, (i + 1) * 36));
      slot.setAttribute('fill', '#f1f2f6');
      slot.setAttribute('stroke', 'white');
      slot.onclick = () => {
        if (state.selectedColorFromPool && state.selectedColorFromPool.name === colorData[i].name) {
          slot.setAttribute('fill', state.selectedColorFromPool.hex);
          state.creationWheelState[i] = state.selectedColorFromPool.name;
          state.currentMixture = { R: 0, Y: 0, B: 0 };
          state.selectedColorFromPool = null;
          updateBowl();
        }
      };
      wheel.appendChild(slot);
      addWheelLabel(wheel, i, colorData[i].name, '#636e72');
    }
  }

  function renderPool() {
    const pool = document.getElementById('primary-pool');
    pool.innerHTML = '';
    [{ id: 'R', n: '빨강', c: '#FF3B30' }, { id: 'Y', n: '노랑', c: '#FFCC00' }, { id: 'B', n: '파랑', c: '#007AFF' }].forEach(p => {
      const d = document.createElement('div');
      d.className = 'primary-piece'; d.style.backgroundColor = p.c; d.textContent = p.n;
      d.onclick = () => {
        if (state.currentMixture.R + state.currentMixture.Y + state.currentMixture.B < 5) {
          state.currentMixture[p.id]++;
          updateBowl();
        }
      };
      pool.appendChild(d);
    });
  }

  function updateBowl() {
    const { R, Y, B } = state.currentMixture;
    const total = R + Y + B;
    const resP = document.getElementById('mix-result-preview');
    const resN = document.getElementById('mix-result-name');
    const ratioDisplay = document.getElementById('mix-ratio-display');
    if (ratioDisplay) ratioDisplay.textContent = '빨강: ' + R + ' | 노랑: ' + Y + ' | 파랑: ' + B;
    if (total === 0) {
      resP.style.backgroundColor = 'transparent';
      resN.textContent = '물감을 섞어보세요';
      document.getElementById('bowl-content').style.backgroundColor = 'transparent';
      return;
    }
    let matched = '';
    for (const n in mixingRatios) {
      const t = mixingRatios[n];
      if (t.R === R && t.Y === Y && t.B === B) { matched = n; break; }
    }
    const hex = matched
      ? colorData.find(c => c.name === matched).hex
      : 'rgb(' + Math.round(255 * R / total + 255 * Y / total) + ',' + Math.round(59 * R / total + 204 * Y / total + 122 * B / total) + ',' + Math.round(48 * R / total + 255 * B / total) + ')';
    document.getElementById('bowl-content').style.backgroundColor = hex;
    resP.style.backgroundColor = hex;
    resN.textContent = matched || '섞는 중...';
    state.selectedColorFromPool = { name: matched, hex: hex };
  }

  document.getElementById('clear-bowl').onclick = () => {
    state.currentMixture = { R: 0, Y: 0, B: 0 };
    state.selectedColorFromPool = null;
    updateBowl();
  };

  document.getElementById('check-creation').onclick = () => {
    if (state.creationWheelState.every((s, i) => s === colorData[i].name)) confetti();
  };

  // --- 03 그리기 ---
  document.getElementById('bg-mode-blank').onclick = () => { state.canvasMode = 'blank'; updatePaintUI(); };
  document.getElementById('bg-mode-outline').onclick = () => { state.canvasMode = 'outline'; updatePaintUI(); };
  document.getElementById('theme-warm-energy').onclick = () => { state.currentTheme = 'energy'; updatePaintUI(); };
  document.getElementById('theme-warm-spring').onclick = () => { state.currentTheme = 'spring'; updatePaintUI(); };
  document.getElementById('theme-cool-winter').onclick = () => { state.currentTheme = 'cool'; updatePaintUI(); };

  function updatePaintUI() {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    const activeMode = document.getElementById('bg-mode-' + state.canvasMode);
    if (activeMode) activeMode.classList.add('active');
    const exImg = document.getElementById('theme-example-img');
    exImg.src = state.currentTheme === 'spring' ? 'calm.png' : state.currentTheme === 'energy' ? 'energy_ex.png' : 'cool_ex.png';
    const palette = document.getElementById('restricted-palette');
    palette.innerHTML = '';
    const filter = state.currentTheme === 'energy' ? ['자주', '빨강', '주황', '노랑'] :
      state.currentTheme === 'spring' ? ['청록', '초록', '연두', '노랑'] : ['청록', '파랑', '남색', '보라'];
    colorData.filter(c => filter.includes(c.name)).forEach(c => {
      const d = document.createElement('div');
      d.className = 'palette-color'; d.style.backgroundColor = c.hex;
      if (state.paintColor === c.hex) d.classList.add('active');
      d.onclick = () => {
        document.querySelectorAll('.palette-color').forEach(p => p.classList.remove('active'));
        d.classList.add('active'); state.paintColor = c.hex;
        state.eraserMode = false;
        document.getElementById('eraser-btn').classList.remove('active');
        canvas.style.cursor = 'crosshair';
      };
      palette.appendChild(d);
    });
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (state.canvasMode === 'outline') drawTree();
  }

  function drawTree() {
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    const w = 1200, h = 800, cx = w / 2, cy = h * 0.9;
    ctx.beginPath(); ctx.moveTo(cx - 30, cy); ctx.lineTo(cx - 15, cy - 200); ctx.lineTo(cx + 15, cy - 200); ctx.lineTo(cx + 30, cy); ctx.closePath(); ctx.stroke();
    const pts = [
      { x: cx, y: cy - 200, br: [{ x: cx - 160, y: cy - 350, cs: [90, 60, 30] }, { x: cx + 160, y: cy - 350, cs: [100, 70, 35] }, { x: cx, y: cy - 480, cs: [110, 75, 40] }] },
      { x: cx - 15, y: cy - 110, br: [{ x: cx - 300, y: cy - 180, cs: [75, 45] }, { x: cx - 250, y: cy - 50, cs: [60, 35] }] },
      { x: cx + 15, y: cy - 130, br: [{ x: cx + 280, y: cy - 250, cs: [85, 50] }, { x: cx + 220, y: cy - 70, cs: [65, 40] }] }
    ];
    pts.forEach(p => p.br.forEach(b => {
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      b.cs.forEach(r => { ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.stroke(); });
    }));
    ctx.beginPath(); ctx.moveTo(0, h * 0.95); ctx.bezierCurveTo(w * 0.3, h * 0.85, w * 0.7, h * 1, w, h * 0.95); ctx.stroke();
  }

  document.getElementById('eraser-btn').onclick = () => {
    state.eraserMode = !state.eraserMode;
    document.getElementById('eraser-btn').classList.toggle('active', state.eraserMode);
    canvas.style.cursor = state.eraserMode ? 'cell' : 'crosshair';
  };

  document.getElementById('clear-canvas').onclick = () => {
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (state.canvasMode === 'outline') drawTree();
  };

  let selfEvalRating = 0;

  async function doSaveArtwork(selfEval) {
    const imageData   = canvas.toDataURL();
    const studentName = document.getElementById('welcome-name').textContent;
    const theme       = state.currentTheme;
    const link = document.createElement('a');
    link.download = studentName + '_그림.png'; link.href = imageData; link.click();
    await apiPost('saveArtwork', { data: { name: studentName, imageData, theme, selfEval } });
    alert('그림을 저장했습니다! 🎨');
  }

  document.getElementById('save-canvas').onclick = () => {
    const studentName = document.getElementById('welcome-name').textContent;
    if (GAS_URL && studentName && studentName !== '탐험가') {
      selfEvalRating = 0;
      document.querySelectorAll('.star-btn').forEach(b => { b.textContent = '☆'; });
      document.getElementById('self-eval-comment').value = '';
      document.getElementById('self-eval-modal').classList.remove('hidden');
    } else {
      doSaveArtwork(null);
    }
  };

  document.querySelectorAll('.star-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selfEvalRating = parseInt(btn.dataset.rating);
      document.querySelectorAll('.star-btn').forEach((b, i) => {
        b.textContent = i < selfEvalRating ? '⭐' : '☆';
      });
    });
  });

  document.getElementById('self-eval-submit').onclick = async () => {
    const comment = document.getElementById('self-eval-comment').value.trim();
    const rating  = selfEvalRating || 3;
    document.getElementById('self-eval-modal').classList.add('hidden');
    await doSaveArtwork({ comment, rating });
  };

  document.getElementById('self-eval-cancel').onclick = async () => {
    document.getElementById('self-eval-modal').classList.add('hidden');
    await doSaveArtwork(null);
  };

  // --- 리사이즈 ---
  function handleResize() {
    const scale = Math.min((window.innerWidth - 60) / 1520, (window.innerHeight - 50) / 880, 1);
    if (mainApp && !mainApp.classList.contains('hidden')) mainApp.style.transform = 'scale(' + scale + ')';
  }
  window.onresize = handleResize;
  window.addEventListener('load', handleResize);

  // --- 유틸 ---
  function createSlicePath(cx, cy, r, startA, endA) {
    const x1 = cx + r * Math.cos(Math.PI * startA / 180);
    const y1 = cy + r * Math.sin(Math.PI * startA / 180);
    const x2 = cx + r * Math.cos(Math.PI * endA / 180);
    const y2 = cy + r * Math.sin(Math.PI * endA / 180);
    return 'M ' + cx + ' ' + cy + ' L ' + x1 + ' ' + y1 + ' A ' + r + ' ' + r + ' 0 0 1 ' + x2 + ' ' + y2 + ' Z';
  }

  function addWheelLabel(parent, index, text, color) {
    const angle = (index + 0.5) * 36 * (Math.PI / 180);
    const r = 135; const x = 200 + r * Math.cos(angle); const y = 200 + r * Math.sin(angle);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', x); label.setAttribute('y', y); label.setAttribute('fill', color);
    label.setAttribute('text-anchor', 'middle'); label.setAttribute('dominant-baseline', 'middle');
    label.setAttribute('font-weight', '800'); label.setAttribute('font-size', '14px');
    label.setAttribute('pointer-events', 'none');
    label.setAttribute('transform', 'rotate(' + (index + 0.5) * 36 + ', ' + x + ', ' + y + ')');
    label.textContent = text;
    parent.appendChild(label);
  }
});

// ==========================================
// 학생 명단 로드
// ==========================================
async function loadStudentNames() {
  const list   = document.getElementById('student-list');
  const hidden = document.getElementById('student-name-input');
  const startBtn = document.getElementById('start-btn');

  list.innerHTML = '<p class="student-list-loading">명단을 불러오는 중...</p>';

  const result = await apiGet('getStudentNames');
  const students = (result && result.length > 0)
    ? result
    : Array.from({ length: 25 }, (_, i) => ({ number: i + 1, name: '학생' + (i + 1), lastActivity: null }));

  list.innerHTML = '';

  students.forEach(s => {
    const label = s.number + '번 ' + s.name;
    const act   = s.lastActivity; // { time, stage, activity } 또는 null

    const item = document.createElement('div');
    item.className = 'student-item';
    item.dataset.name = label;

    const actHtml = act
      ? '<div class="s-act-row">' +
          (act.time     ? '<span class="s-tag s-tag-time">'  + act.time     + '</span>' : '') +
          (act.stage    ? '<span class="s-tag s-tag-stage">' + act.stage    + '</span>' : '') +
          (act.activity ? '<span class="s-tag s-tag-act">'   + act.activity + '</span>' : '') +
        '</div>'
      : '<div class="s-act-row"><span class="s-no-act">활동 없음</span></div>';

    item.innerHTML =
      '<div class="s-main">' +
        '<span class="s-num">' + s.number + '번</span>' +
        '<span class="s-name">' + s.name + '</span>' +
      '</div>' +
      actHtml;

    item.onclick = e => {
      e.stopPropagation();
      list.querySelectorAll('.student-item').forEach(el => el.classList.remove('selected'));
      item.classList.add('selected');
      hidden.value = label;
      startBtn.disabled = false;
      document.getElementById('student-dropdown-label').textContent = label;
      document.getElementById('student-dropdown-menu').classList.add('hidden');
      document.getElementById('student-dropdown-trigger').classList.remove('open');
    };

    list.appendChild(item);
  });
}

// ==========================================
// 설정 UI (⚙️)
// ==========================================
function initSettingsUI(hasEndpoint) {
  const modal = document.getElementById('settings-modal');
  const endpointInput = document.getElementById('endpoint-input');
  const saveBtn = document.getElementById('save-settings');
  const testBtn = document.getElementById('test-connection');
  const statusEl = document.getElementById('connection-status');
  const studentUrlSection = document.getElementById('student-url-section');
  const studentUrlDisplay = document.getElementById('student-url-display');
  const copyBtn = document.getElementById('copy-student-url');
  const noEndpointMsg = document.getElementById('no-endpoint-msg');
  const loginSection = document.getElementById('login-section');

  function refreshStudentUrl() {
    const url = getStudentShareUrl();
    if (url) {
      studentUrlSection.classList.remove('hidden');
      studentUrlDisplay.value = url;
    } else {
      studentUrlSection.classList.add('hidden');
    }
  }

  function showLoginReady() {
    if (noEndpointMsg) noEndpointMsg.classList.add('hidden');
    if (loginSection) loginSection.classList.remove('hidden');
  }

  // 초기 상태
  if (hasEndpoint) {
    endpointInput.value = GAS_URL;
    refreshStudentUrl();
    showLoginReady();
  } else {
    if (noEndpointMsg) noEndpointMsg.classList.remove('hidden');
    if (loginSection) loginSection.classList.add('hidden');
  }

  // 학생용 URL(?endpoint=)로 접속 시 선생님 설정 버튼 숨김
  if (IS_STUDENT_URL) {
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) settingsBtn.classList.add('hidden');
  }

  document.getElementById('settings-btn').onclick = () => modal.classList.remove('hidden');
  document.getElementById('close-settings').onclick = () => modal.classList.add('hidden');
  modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };

  testBtn.onclick = async () => {
    const url = endpointInput.value.trim();
    if (!url) { statusEl.textContent = '주소를 입력해 주세요.'; statusEl.style.color = '#e17055'; return; }
    statusEl.textContent = '연결 확인 중...'; statusEl.style.color = '#636e72';

    const prevUrl = GAS_URL;
    GAS_URL = url;
    try {
      const result = await jsonpGet({ action: 'ping' });
      if (result && result.status === 'ok') {
        statusEl.textContent = '✅ 연결 성공!'; statusEl.style.color = '#00b894';
      } else {
        statusEl.textContent = '⚠️ 응답 형식이 다릅니다.'; statusEl.style.color = '#e17055';
      }
    } catch (e) {
      statusEl.textContent = '❌ 연결 실패: ' + e.message; statusEl.style.color = '#e17055';
    }
    GAS_URL = prevUrl;
  };

  saveBtn.onclick = () => {
    const url = endpointInput.value.trim();
    if (!url) { alert('주소를 입력해 주세요.'); return; }
    saveEndpoint(url);
    refreshStudentUrl();
    statusEl.textContent = '✅ 저장되었습니다.'; statusEl.style.color = '#00b894';
    showLoginReady();
    loadStudentNames();
    setTimeout(() => modal.classList.add('hidden'), 1000);
  };

  copyBtn.onclick = () => {
    const url = studentUrlDisplay.value;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        copyBtn.textContent = '복사됨!';
        setTimeout(() => copyBtn.textContent = '복사', 2000);
      });
    } else {
      studentUrlDisplay.select();
      document.execCommand('copy');
      copyBtn.textContent = '복사됨!';
      setTimeout(() => copyBtn.textContent = '복사', 2000);
    }
  };
}
