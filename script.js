// === 연결 주소 관리 ===
// 학생용 링크(#c=...)로 들어오면 그 주소를 사용하고, 아니면 저장된(선생님이 설정한) 주소를 사용합니다.
const STORAGE_KEY = 'connectedAppUrl';
let _connectedUrl = null;
let _isStudentLink = false;

function readUrlFromHash() {
    const hash = window.location.hash || '';
    const match = hash.match(/#c=(.+)/);
    if (!match) return null;
    try { return decodeURIComponent(match[1]); } catch (e) { return match[1]; }
}

function initConnection() {
    const fromHash = readUrlFromHash();
    if (fromHash) {
        _connectedUrl = fromHash;
        _isStudentLink = true;
        return;
    }
    _connectedUrl = localStorage.getItem(STORAGE_KEY) || null;
    _isStudentLink = false;
}

function getConnectedUrl() {
    return _connectedUrl;
}

function saveConnectedUrl(url) {
    _connectedUrl = url;
    localStorage.setItem(STORAGE_KEY, url);
}

function buildStudentLink(execUrl) {
    const base = window.location.origin + window.location.pathname;
    return base + '#c=' + encodeURIComponent(execUrl);
}

initConnection();

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

// 루브릭 정의
const selfEvalCriteria = [
    { key: 'feeling', label: '🎨 내가 고른 기분에 어울리는 색을 사용했어요' },
    { key: 'variety', label: '🌈 다양한 색을 활용해서 표현했어요' },
    { key: 'effort', label: '💖 정성을 다해서 그렸어요' }
];

const friendEvalCriteria = [
    { key: 'feeling', label: '🎨 기분에 어울리는 색을 잘 골랐어요' },
    { key: 'variety', label: '🌈 색을 다양하게 사용했어요' },
    { key: 'creativity', label: '✨ 표현이 창의적이에요' }
];

const state = {
    isDrawing: false, paintColor: '#FF3B30', currentTheme: 'energy', canvasMode: 'blank',
    paintTool: 'brush',
    creationWheelState: new Array(10).fill(null), currentMixture: { R: 0, Y: 0, B: 0 },
    selectedColorFromPool: null,
    viewedColors: new Set(),
    progress: { explore: false, create: false, paint: false },
    pendingArtwork: null,
    pendingComment: { artId: null, ratings: {} },
    currentSelfEval: { ratings: {} },
    galleryCache: []
};

// === API ===
let _jsonpCounter = 0;
function jsonpRequest(url, params, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const callbackName = '_jsonp_cb_' + (_jsonpCounter++) + '_' + Date.now();
        const qs = Object.keys(params).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');
        const script = document.createElement('script');

        function cleanup() {
            delete window[callbackName];
            if (script.parentNode) script.parentNode.removeChild(script);
        }

        script.onerror = () => { cleanup(); reject(new Error('연결 주소에 접속할 수 없어요.')); };
        const timer = setTimeout(() => { cleanup(); reject(new Error('응답 시간이 초과되었어요.')); }, timeoutMs);
        window[callbackName] = (data) => { clearTimeout(timer); cleanup(); resolve(data); };

        script.src = url + (url.includes('?') ? '&' : '?') + qs + '&callback=' + callbackName;
        document.body.appendChild(script);
    });
}

async function apiGet(action) {
    const url = getConnectedUrl();
    if (!url) { console.warn('연결된 주소가 없습니다.'); return null; }
    try {
        return await jsonpRequest(url, { action });
    } catch (e) { console.error("API Get Error:", e); return null; }
}

async function apiPost(action, data = {}) {
    const url = getConnectedUrl();
    if (!url) { console.warn('연결된 주소가 없습니다.'); return null; }
    try {
        await fetch(url, {
            method: 'POST', mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action, ...data })
        });
        return { status: 'sent' };
    } catch (e) { console.error("API Post Error:", e); return null; }
}

document.addEventListener('DOMContentLoaded', () => {
    // --- 연결 설정(⚙️) UI: 학생용 링크로 들어온 경우에는 노출하지 않음 ---
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsUrlInput = document.getElementById('settings-url-input');
    const settingsConnectBtn = document.getElementById('settings-connect-btn');
    const settingsStatus = document.getElementById('settings-status');
    const studentLinkArea = document.getElementById('student-link-area');
    const studentLinkInput = document.getElementById('student-link-input');
    const studentLinkCopyBtn = document.getElementById('student-link-copy-btn');
    const settingsCloseBtn = document.getElementById('settings-close-btn');

    if (_isStudentLink && settingsBtn) {
        settingsBtn.classList.add('hidden');
    } else if (settingsBtn) {
        settingsBtn.classList.remove('hidden');
        const savedUrl = getConnectedUrl();
        if (savedUrl) {
            settingsUrlInput.value = savedUrl;
            studentLinkInput.value = buildStudentLink(savedUrl);
            studentLinkArea.classList.remove('hidden');
        }
        settingsBtn.onclick = () => settingsModal.classList.remove('hidden');
        settingsCloseBtn.onclick = () => settingsModal.classList.add('hidden');

        settingsConnectBtn.onclick = async () => {
            const url = settingsUrlInput.value.trim();
            if (!url) { settingsStatus.innerText = '주소를 입력해주세요.'; return; }
            settingsStatus.innerText = '연결하는 중...';
            const prevUrl = _connectedUrl;
            _connectedUrl = url;
            const result = await apiGet('getStudentNames');
            if (result) {
                saveConnectedUrl(url);
                settingsStatus.innerText = '연결되었어요! ✅';
                studentLinkInput.value = buildStudentLink(url);
                studentLinkArea.classList.remove('hidden');
                loadStudentNames();
            } else {
                _connectedUrl = prevUrl;
                settingsStatus.innerText = '연결에 실패했어요. 주소를 확인해주세요.';
            }
        };

        studentLinkCopyBtn.onclick = () => {
            studentLinkInput.select();
            document.execCommand('copy');
            studentLinkCopyBtn.innerText = '복사됨!';
            setTimeout(() => { studentLinkCopyBtn.innerText = '복사'; }, 1500);
        };
    }

    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d');
    const brushInput = document.getElementById('brush-size');
    const mainApp = document.getElementById('main-app');

    canvas.width = 1200;
    canvas.height = 800;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
        const clientY = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    }

    function startPaint(e) {
        state.isDrawing = true;
        const { x, y } = getPos(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
        const sizeMultiplier = state.paintTool === 'eraser' ? 2.5 : 1;
        ctx.lineWidth = brushInput.value * sizeMultiplier;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = state.paintTool === 'eraser' ? '#ffffff' : state.paintColor;
        ctx.lineTo(x, y);
        ctx.stroke();
    }

    function movePaint(e) {
        if (!state.isDrawing) return;
        const { x, y } = getPos(e);
        ctx.lineTo(x, y);
        ctx.stroke();
        if (e.cancelable) e.preventDefault();
    }

    function stopPaint() { state.isDrawing = false; ctx.beginPath(); }

    canvas.onmousedown = startPaint;
    window.addEventListener('mousemove', movePaint);
    window.addEventListener('mouseup', stopPaint);
    canvas.addEventListener('touchstart', (e) => { startPaint(e); if (e.cancelable) e.preventDefault(); }, { passive: false });
    window.addEventListener('touchmove', movePaint, { passive: false });
    window.addEventListener('touchend', stopPaint);

    // --- 학생 명단 ---
    const nameSelect = document.getElementById('student-name-input');
    async function loadStudentNames() {
        const names = await apiGet('getStudentNames');
        if (names) {
            nameSelect.innerHTML = '<option value="">선택하세요</option>';
            names.forEach(n => { const o = document.createElement('option'); o.value = n; o.innerText = n; nameSelect.appendChild(o); });
        } else {
            for (let i = 1; i <= 30; i++) {
                const o = document.createElement('option');
                o.value = "학생 " + i; o.innerText = "학생 " + i;
                nameSelect.appendChild(o);
            }
        }
    }
    loadStudentNames();

    // --- 진행 상태 관리 ---
    function updateNavLocks() {
        document.querySelectorAll('.index-btn[data-requires]').forEach(btn => {
            const req = btn.dataset.requires;
            const unlocked = state.progress[req];
            btn.classList.toggle('locked', !unlocked);
        });
    }

    function setProgress(stage) {
        state.progress[stage] = true;
        updateNavLocks();
    }

    function navigateTo(target) {
        document.querySelectorAll('.index-btn').forEach(b => b.classList.toggle('active', b.dataset.target === target));
        document.querySelectorAll('.view-content').forEach(v => v.classList.toggle('active', v.id === target));
        if (target === 'create-wheel-view') initCreation();
        if (target === 'paint-view') updatePaintUI();
        if (target === 'gallery-view') initGallery();
        handleResize();
    }

    // --- 앱 시작 ---
    document.getElementById('start-btn').onclick = () => {
        if (nameSelect.value) {
            document.getElementById('welcome-name').innerText = nameSelect.value;
            document.getElementById('login-overlay').classList.add('hidden');
            mainApp.classList.remove('hidden');
            initExplore();
            updateNavLocks();
            handleResize();
        }
    };

    // --- 인덱스/다음 버튼 ---
    document.querySelectorAll('.index-btn').forEach(btn => {
        btn.onclick = () => {
            if (btn.classList.contains('locked')) {
                const stageMap = { explore: '01 단계', create: '02 단계', paint: '03 단계' };
                alert(`먼저 ${stageMap[btn.dataset.requires]}를 완료해야 해요!`);
                return;
            }
            const target = btn.dataset.target;
            if (target) navigateTo(target);
        };
    });

    document.querySelectorAll('.next-step-btn').forEach(btn => {
        btn.onclick = () => {
            if (btn.disabled || btn.classList.contains('locked')) return;
            const target = btn.dataset.target;
            if (target) navigateTo(target);
        };
    });

    // --- 01 탐험하기 ---
    function updateExploreProgress() {
        const count = state.viewedColors.size;
        document.getElementById('explore-progress-text').innerText = `${count} / 10 색깔을 알아봤어요`;
        document.getElementById('explore-progress-fill').style.width = `${count * 10}%`;
        const nextBtn = document.getElementById('explore-next-btn');
        if (count >= 10) {
            nextBtn.disabled = false;
            nextBtn.classList.remove('locked');
            document.getElementById('explore-next-label').innerText = '다음 단계로 가기 ➔';
            setProgress('explore');
        } else {
            nextBtn.disabled = true;
            nextBtn.classList.add('locked');
            document.getElementById('explore-next-label').innerText = `🔒 ${10 - count}가지 색을 더 알아봐야 해요`;
        }
    }

    function initExplore() {
        const wheel = document.getElementById('color-wheel'); wheel.innerHTML = '';
        state.viewedColors = new Set();
        colorData.forEach((c, i) => {
            const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
            el.setAttribute("d", createSlicePath(200, 200, 180, i * 36, (i + 1) * 36));
            el.setAttribute("fill", c.hex);
            el.dataset.colorName = c.name;
            el.onclick = () => {
                wheel.style.transform = `rotate(${-(i + 0.5) * 36}deg)`;
                document.getElementById('color-card').classList.remove('hidden');
                document.getElementById('intro-card').classList.add('hidden');
                document.getElementById('color-name').innerText = c.name;
                document.getElementById('color-feeling').innerText = c.feeling;
                document.getElementById('color-keywords').innerText = '#' + c.keywords.join('  #');
                document.getElementById('color-indicator').style.backgroundColor = c.hex;
                state.viewedColors.add(c.name);
                el.classList.add('viewed');
                updateExploreProgress();
            };
            wheel.appendChild(el);
            addWheelLabel(wheel, i, c.name, "white");
        });
        updateExploreProgress();
    }

    // --- 02 완성하기 ---
    function updateCreationProgress() {
        const filled = state.creationWheelState.filter(s => s !== null).length;
        document.getElementById('creation-progress-text').innerText = `${filled} / 10 칸을 채웠어요`;
        document.getElementById('creation-progress-fill').style.width = `${filled * 10}%`;
        if (filled === 10 && state.creationWheelState.every((s, i) => s === colorData[i].name)) {
            showCompletionModal();
            setProgress('create');
        }
    }

    function initCreation() {
        const wheel = document.getElementById('creation-wheel'); wheel.innerHTML = '';
        state.creationWheelState = new Array(10).fill(null);
        state.currentMixture = { R: 0, Y: 0, B: 0 };
        state.selectedColorFromPool = null;
        renderPool();
        updateBowl();
        for (let i = 0; i < 10; i++) {
            const slot = document.createElementNS("http://www.w3.org/2000/svg", "path");
            slot.setAttribute("d", createSlicePath(200, 200, 180, i * 36, (i + 1) * 36));
            slot.setAttribute("fill", "#f1f2f6"); slot.setAttribute("stroke", "white");
            slot.style.cursor = 'pointer';
            slot.onclick = () => {
                if (state.selectedColorFromPool && state.selectedColorFromPool.name === colorData[i].name) {
                    slot.setAttribute('fill', state.selectedColorFromPool.hex);
                    state.creationWheelState[i] = state.selectedColorFromPool.name;
                    state.currentMixture = { R: 0, Y: 0, B: 0 };
                    state.selectedColorFromPool = null;
                    updateBowl();
                    updateCreationProgress();
                } else if (state.selectedColorFromPool) {
                    slot.style.transition = 'none';
                    slot.setAttribute('fill', '#ffcccc');
                    setTimeout(() => slot.setAttribute('fill', state.creationWheelState[i] ? colorData.find(c => c.name === state.creationWheelState[i]).hex : '#f1f2f6'), 400);
                } else {
                    alert('먼저 물감을 섞어서 색을 만들어 보세요!');
                }
            };
            wheel.appendChild(slot);
            addWheelLabel(wheel, i, colorData[i].name, "#636e72");
        }
        updateCreationProgress();
    }

    function renderPool() {
        const pool = document.getElementById('primary-pool'); pool.innerHTML = '';
        [{ id: 'R', n: '빨강', c: '#FF3B30' }, { id: 'Y', n: '노랑', c: '#FFCC00' }, { id: 'B', n: '파랑', c: '#007AFF' }].forEach(p => {
            const d = document.createElement('div');
            d.className = 'primary-piece'; d.style.backgroundColor = p.c; d.innerText = p.n;
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
        const guide = document.getElementById('placement-guide');
        if (ratioDisplay) ratioDisplay.innerText = `빨강: ${R} | 노랑: ${Y} | 파랑: ${B}`;
        if (total === 0) {
            resP.style.backgroundColor = 'transparent'; resN.innerText = '물감을 섞어보세요';
            document.getElementById('bowl-content').style.backgroundColor = 'transparent';
            guide.classList.remove('ready');
            guide.innerHTML = '👉 물감을 섞어서 10가지 색 중 하나를 만들어 보세요!';
            state.selectedColorFromPool = null;
            return;
        }
        let matched = "";
        for (let n in mixingRatios) {
            const t = mixingRatios[n];
            if (t.R === R && t.Y === Y && t.B === B) { matched = n; break; }
        }
        const hex = matched ? colorData.find(c => c.name === matched).hex : `rgb(${Math.round(255 * R / total + 255 * Y / total)},${Math.round(59 * R / total + 204 * Y / total + 122 * B / total)},${Math.round(48 * R / total + 255 * B / total)})`;
        document.getElementById('bowl-content').style.backgroundColor = hex;
        resP.style.backgroundColor = hex; resN.innerText = matched || '섞는 중...';
        state.selectedColorFromPool = { name: matched, hex: hex };

        if (matched) {
            guide.classList.add('ready');
            guide.innerHTML = `✨ <strong>${matched}</strong>이(가) 만들어졌어요! 10색상환에서 <strong>${matched}</strong>의 위치를 클릭하세요!`;
        } else {
            guide.classList.remove('ready');
            guide.innerHTML = '🎨 아직 10가지 색이 아니에요. 비율을 조절해 보세요!';
        }
    }

    document.getElementById('clear-bowl').onclick = () => {
        state.currentMixture = { R: 0, Y: 0, B: 0 }; state.selectedColorFromPool = null; updateBowl();
    };

    function showCompletionModal() {
        const modal = document.getElementById('completion-modal');
        const svg = document.getElementById('completed-wheel-svg');
        svg.innerHTML = '';
        colorData.forEach((c, i) => {
            const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
            p.setAttribute("d", createSlicePath(200, 200, 180, i * 36, (i + 1) * 36));
            p.setAttribute("fill", c.hex);
            p.setAttribute("stroke", "white");
            p.setAttribute("stroke-width", "2");
            svg.appendChild(p);
            addWheelLabel(svg, i, c.name, "white");
        });
        modal.classList.remove('hidden');
        confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
    }

    document.getElementById('completion-next-btn').onclick = () => {
        document.getElementById('completion-modal').classList.add('hidden');
        navigateTo('paint-view');
    };

    // --- 03 그리기 ---
    document.getElementById('bg-mode-blank').onclick = () => { state.canvasMode = 'blank'; updatePaintUI(); };
    document.getElementById('bg-mode-outline').onclick = () => { state.canvasMode = 'outline'; updatePaintUI(); };
    document.getElementById('theme-warm-energy').onclick = () => { state.currentTheme = 'energy'; updatePaintUI(); };
    document.getElementById('theme-warm-spring').onclick = () => { state.currentTheme = 'spring'; updatePaintUI(); };
    document.getElementById('theme-cool-winter').onclick = () => { state.currentTheme = 'cool'; updatePaintUI(); };

    function setPaintTool(tool) {
        state.paintTool = tool;
        document.getElementById('tool-brush').classList.toggle('active', tool === 'brush');
        document.getElementById('tool-eraser').classList.toggle('active', tool === 'eraser');
        const wrapper = document.querySelector('.canvas-wrapper');
        if (wrapper) wrapper.classList.toggle('eraser-mode', tool === 'eraser');
        const label = document.getElementById('brush-size-label');
        if (label) label.innerText = tool === 'eraser' ? '지우개 굵기' : '붓 굵기';
    }
    document.getElementById('tool-brush').onclick = () => setPaintTool('brush');
    document.getElementById('tool-eraser').onclick = () => setPaintTool('eraser');

    function updatePaintUI() {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        const activeMode = document.getElementById(`bg-mode-${state.canvasMode}`);
        if (activeMode) activeMode.classList.add('active');
        const exImg = document.getElementById('theme-example-img');
        if (state.currentTheme === 'spring') exImg.src = 'calm.png';
        else if (state.currentTheme === 'energy') exImg.src = 'energy_ex.png';
        else exImg.src = 'cool_ex.png';
        const palette = document.getElementById('restricted-palette'); palette.innerHTML = '';
        let filter = state.currentTheme === 'energy' ? ["자주", "빨강", "주황", "노랑"] :
            state.currentTheme === 'spring' ? ["청록", "초록", "연두", "노랑"] :
                ["청록", "파랑", "남색", "보라"];
        colorData.filter(c => filter.includes(c.name)).forEach(c => {
            const d = document.createElement('div'); d.className = 'palette-color'; d.style.backgroundColor = c.hex;
            if (state.paintColor === c.hex) d.classList.add('active');
            d.onclick = () => {
                document.querySelectorAll('.palette-color').forEach(p => p.classList.remove('active'));
                d.classList.add('active'); state.paintColor = c.hex;
                setPaintTool('brush');
            };
            palette.appendChild(d);
        });
        ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (state.canvasMode === 'outline') drawTree();
        setPaintTool('brush');
    }

    function drawTree() {
        ctx.strokeStyle = "rgba(0,0,0,0.8)"; ctx.lineWidth = 6; ctx.lineCap = "round";
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

    document.getElementById('clear-canvas').onclick = () => {
        ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (state.canvasMode === 'outline') drawTree();
    };

    document.getElementById('save-canvas').onclick = () => {
        const imageData = canvas.toDataURL();
        const studentName = document.getElementById('welcome-name').innerText;
        const theme = state.currentTheme;
        state.pendingArtwork = { imageData, studentName, theme };
        openSelfEvalModal();
    };

    // --- 자기 평가 모달 ---
    function openSelfEvalModal() {
        state.currentSelfEval = { ratings: {} };
        const rubricEl = document.getElementById('self-eval-rubric');
        rubricEl.innerHTML = '';
        selfEvalCriteria.forEach(c => {
            rubricEl.appendChild(buildRubricItem(c, (key, val) => {
                state.currentSelfEval.ratings[key] = val;
            }));
        });
        document.getElementById('self-eval-text').value = '';
        document.getElementById('self-eval-modal').classList.remove('hidden');
    }

    document.getElementById('self-eval-cancel').onclick = () => {
        document.getElementById('self-eval-modal').classList.add('hidden');
        state.pendingArtwork = null;
        state.reuploadTarget = null;
    };

    document.getElementById('self-eval-submit').onclick = async () => {
        const incomplete = selfEvalCriteria.some(c => !state.currentSelfEval.ratings[c.key]);
        if (incomplete) { alert('모든 항목을 평가해 주세요!'); return; }
        const note = document.getElementById('self-eval-text').value;
        const art = state.pendingArtwork;
        if (!art) return;

        const link = document.createElement('a');
        link.download = `${art.studentName}_그림.png`; link.href = art.imageData; link.click();

        const selfEvalPayload = JSON.stringify({ ratings: state.currentSelfEval.ratings, note });

        if (state.reuploadTarget) {
            await apiPost('reuploadArtwork', {
                rowId: state.reuploadTarget.rowId,
                data: { name: art.studentName, imageData: art.imageData, theme: art.theme, selfEval: selfEvalPayload }
            });
            state.reuploadTarget = null;
            alert('수정한 작품을 다시 올렸어요! 친구들이 새로 댓글을 달 수 있어요. ✨');
        } else {
            await apiPost('saveArtwork', {
                data: { name: art.studentName, imageData: art.imageData, theme: art.theme, selfEval: selfEvalPayload }
            });
            alert('갤러리에 작품을 올렸어요! 친구들의 댓글을 기다려 봐요. 🎨');
        }

        document.getElementById('self-eval-modal').classList.add('hidden');
        state.pendingArtwork = null;
        setProgress('paint');
        navigateTo('gallery-view');
    };

    // --- 루브릭 빌더 ---
    function buildRubricItem(criterion, onChange) {
        const item = document.createElement('div');
        item.className = 'rubric-item';
        const label = document.createElement('div');
        label.className = 'rubric-item-label';
        label.innerText = criterion.label;
        item.appendChild(label);
        const stars = document.createElement('div');
        stars.className = 'rubric-stars';
        for (let i = 1; i <= 5; i++) {
            const btn = document.createElement('button');
            btn.className = 'star-btn';
            btn.innerText = '★';
            btn.onclick = () => {
                stars.querySelectorAll('.star-btn').forEach((b, idx) => {
                    b.classList.toggle('filled', idx < i);
                });
                onChange(criterion.key, i);
            };
            stars.appendChild(btn);
        }
        item.appendChild(stars);
        return item;
    }

    // --- 04 갤러리 ---
    async function initGallery() {
        const grid = document.getElementById('gallery-grid');
        grid.innerHTML = '<p style="padding:20px; text-align:center; width:100%;">작품을 불러오고 있어요... 🎨</p>';
        const artworks = await apiGet('getArtworks');
        state.galleryCache = Array.isArray(artworks) ? artworks : [];
        renderGallery(state.galleryCache);
    }

    function parseJSONSafe(s, fallback) {
        if (!s) return fallback;
        try { return JSON.parse(s); } catch (e) { return fallback; }
    }

    function calcAverageStars(comments) {
        if (!comments || comments.length === 0) return 0;
        let total = 0, count = 0;
        comments.forEach(c => {
            const r = c.ratings || {};
            Object.values(r).forEach(v => { total += v; count++; });
        });
        return count === 0 ? 0 : total / count;
    }

    function renderStars(avg) {
        const rounded = Math.round(avg);
        let html = '';
        for (let i = 1; i <= 5; i++) {
            html += `<span class="${i <= rounded ? '' : 'star-empty'}">★</span>`;
        }
        return html;
    }

    function renderGallery(artworks) {
        const grid = document.getElementById('gallery-grid');
        grid.innerHTML = '';
        if (artworks.length === 0) {
            grid.innerHTML = '<p style="padding:40px; text-align:center; width:100%; color:#636e72;">아직 등록된 작품이 없어요. 😢</p>';
            return;
        }
        const myName = document.getElementById('welcome-name').innerText;
        artworks.forEach(art => {
            const comments = parseJSONSafe(art.comments, []);
            const selfEval = parseJSONSafe(art.selfEval, null);
            const version = art.version || 1;
            const avg = calcAverageStars(comments);
            const isMine = art.name === myName;
            const myComment = comments.find(c => c.friend === myName && c.version === version);

            const card = document.createElement('div');
            card.className = 'gallery-card';
            const themeLabel = art.theme === 'energy' ? '열정' : art.theme === 'spring' ? '싱그러움' : '시원함';

            card.innerHTML = `
                <div class="gallery-card-header">
                    <strong>${escapeHtml(art.name)}${version > 1 ? `<span class="version-badge">수정 v${version}</span>` : ''}</strong>
                    <span class="theme-badge">${themeLabel}</span>
                </div>
                <img src="${art.imageData}" alt="${escapeHtml(art.name)}의 그림">
                <div class="gallery-stars">${renderStars(avg)}</div>
                ${selfEval && selfEval.note ? `<div class="self-eval-section"><strong>내 한마디:</strong> ${escapeHtml(selfEval.note)}</div>` : ''}
                <div class="gallery-actions">
                    <button class="secondary-btn view-comments-btn">💬 댓글 보기 (${comments.length})</button>
                    ${isMine ? `<button class="primary-btn reupload-btn">✏️ 수정해서 다시 올리기</button>` : `<button class="primary-btn comment-btn">${myComment ? '댓글 수정' : '댓글 달기'}</button>`}
                </div>
            `;

            card.querySelector('img').onclick = () => window.open(art.imageData);
            card.querySelector('.view-comments-btn').onclick = () => openCommentsModal(comments);

            if (isMine) {
                card.querySelector('.reupload-btn').onclick = () => {
                    if (confirm('그림을 수정하면 새 버전으로 올라가고 친구들이 다시 댓글을 달 수 있어요. 그리기로 이동할까요?')) {
                        state.reuploadTarget = { rowId: art.rowId, version: version };
                        navigateTo('paint-view');
                    }
                };
            } else {
                card.querySelector('.comment-btn').onclick = () => openCommentModal(art, myComment);
            }

            grid.appendChild(card);
        });
    }

    function escapeHtml(s) {
        if (s == null) return '';
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function openCommentModal(art, existingComment) {
        state.pendingComment = { artId: art.rowId, version: art.version || 1, ratings: existingComment ? { ...existingComment.ratings } : {} };
        document.getElementById('rubric-friend-name').innerText = art.name;
        const rubricEl = document.getElementById('friend-eval-rubric');
        rubricEl.innerHTML = '';
        friendEvalCriteria.forEach(c => {
            const item = buildRubricItem(c, (key, val) => { state.pendingComment.ratings[key] = val; });
            if (existingComment && existingComment.ratings && existingComment.ratings[c.key]) {
                const val = existingComment.ratings[c.key];
                item.querySelectorAll('.star-btn').forEach((b, idx) => { if (idx < val) b.classList.add('filled'); });
            }
            rubricEl.appendChild(item);
        });
        document.getElementById('friend-eval-text').value = existingComment ? existingComment.text || '' : '';
        document.getElementById('rubric-modal').classList.remove('hidden');
    }

    document.getElementById('friend-eval-cancel').onclick = () => {
        document.getElementById('rubric-modal').classList.add('hidden');
    };

    document.getElementById('friend-eval-submit').onclick = async () => {
        const incomplete = friendEvalCriteria.some(c => !state.pendingComment.ratings[c.key]);
        if (incomplete) { alert('모든 항목을 평가해 주세요!'); return; }
        const text = document.getElementById('friend-eval-text').value;
        const myName = document.getElementById('welcome-name').innerText;
        const newComment = {
            friend: myName,
            ratings: state.pendingComment.ratings,
            text,
            version: state.pendingComment.version,
            timestamp: new Date().toISOString()
        };

        // 1) 화면에 즉시 반영 (낙관적 업데이트)
        const target = state.galleryCache.find(a => a.rowId === state.pendingComment.artId);
        if (target) {
            const arr = parseJSONSafe(target.comments, []);
            const idx = arr.findIndex(c => c.friend === myName && (c.version || 1) === (newComment.version || 1));
            if (idx >= 0) arr[idx] = newComment; else arr.push(newComment);
            target.comments = JSON.stringify(arr);
            renderGallery(state.galleryCache);
        }

        // 2) 서버에도 저장 요청
        apiPost('addComment', {
            rowId: state.pendingComment.artId,
            comment: JSON.stringify(newComment)
        });

        document.getElementById('rubric-modal').classList.add('hidden');
        // 3) 잠시 후 서버에서 최신 데이터로 동기화
        setTimeout(initGallery, 2500);
    };

    function openCommentsModal(comments) {
        const list = document.getElementById('comments-list');
        list.innerHTML = '';
        if (comments.length === 0) {
            list.innerHTML = '<div class="comment-empty">아직 친구들이 댓글을 달지 않았어요. 🌱</div>';
        } else {
            comments.forEach(c => {
                const div = document.createElement('div');
                div.className = 'comment-item';
                const ratingsSum = Object.values(c.ratings || {}).reduce((a, b) => a + b, 0);
                const ratingsCount = Object.values(c.ratings || {}).length;
                const avg = ratingsCount ? ratingsSum / ratingsCount : 0;
                div.innerHTML = `
                    <div class="comment-item-header">
                        <span class="comment-name">${escapeHtml(c.friend)}${c.version && c.version > 1 ? ` <span class="version-badge">v${c.version}</span>` : ''}</span>
                        <span class="comment-stars">${renderStars(avg)}</span>
                    </div>
                    <div class="comment-text">${escapeHtml(c.text)}</div>
                `;
                list.appendChild(div);
            });
        }
        document.getElementById('comments-view-modal').classList.remove('hidden');
    }

    document.getElementById('comments-close').onclick = () => {
        document.getElementById('comments-view-modal').classList.add('hidden');
    };

    document.getElementById('refresh-gallery').onclick = initGallery;

    function handleResize() {
        const scale = Math.min((window.innerWidth - 60) / 1520, (window.innerHeight - 50) / 880, 1);
        if (mainApp && !mainApp.classList.contains('hidden')) mainApp.style.transform = `scale(${scale})`;
    }
    window.onresize = handleResize;
    window.addEventListener('load', handleResize);

    function createSlicePath(cx, cy, r, startA, endA) {
        const x1 = cx + r * Math.cos(Math.PI * startA / 180); const y1 = cy + r * Math.sin(Math.PI * startA / 180);
        const x2 = cx + r * Math.cos(Math.PI * endA / 180); const y2 = cy + r * Math.sin(Math.PI * endA / 180);
        return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
    }

    function addWheelLabel(parent, index, text, color) {
        const angle = (index + 0.5) * 36 * (Math.PI / 180);
        const r = 135; const x = 200 + r * Math.cos(angle); const y = 200 + r * Math.sin(angle);
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", x); label.setAttribute("y", y); label.setAttribute("fill", color);
        label.setAttribute("text-anchor", "middle"); label.setAttribute("dominant-baseline", "middle");
        label.setAttribute("font-weight", "800"); label.setAttribute("font-size", "14px"); label.setAttribute("pointer-events", "none");
        label.setAttribute("transform", `rotate(${(index + 0.5) * 36}, ${x}, ${y})`);
        label.textContent = text; parent.appendChild(label);
    }
});
