const GAS_URL = "https://script.google.com/macros/s/AKfycbxj09j_ojuZynR0mJW1GX3gTpoyg7tDKiDNEXnDsU-fMAsuxf9pWAf8klboajgWX8tJrw/exec";

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
    selectedColorFromPool: null
};

// API 통신 함수들
async function apiGet(action) {
    if (GAS_URL.includes("YOUR_GAS")) {
        console.warn("GAS_URL이 설정되지 않았습니다.");
        return null;
    }
    try {
        const response = await fetch(`${GAS_URL}?action=${action}`);
        return await response.json();
    } catch (e) {
        console.error("API Get Error:", e);
        return null;
    }
}

async function apiPost(action, data = {}) {
    if (GAS_URL.includes("YOUR_GAS")) {
        console.warn("GAS_URL이 설정되지 않았습니다.");
        return null;
    }
    try {
        const response = await fetch(GAS_URL, {
            method: 'POST',
            mode: 'no-cors', // GAS POST는 no-cors로 보내야 하는 경우가 많음 (리다이렉션 때문)
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...data })
        });
        return { status: 'sent' }; // no-cors에서는 응답을 읽을 수 없음
    } catch (e) {
        console.error("API Post Error:", e);
        return null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
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
        ctx.lineWidth = brushInput.value;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = state.paintColor;
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

    function stopPaint() {
        state.isDrawing = false;
        ctx.beginPath();
    }

    canvas.onmousedown = startPaint;
    window.addEventListener('mousemove', movePaint);
    window.addEventListener('mouseup', stopPaint);
    canvas.addEventListener('touchstart', (e) => { startPaint(e); if (e.cancelable) e.preventDefault(); }, { passive: false });
    window.addEventListener('touchmove', movePaint, { passive: false });
    window.addEventListener('touchend', stopPaint);

    // --- Student Names Fetch ---
    const nameSelect = document.getElementById('student-name-input');
    async function loadStudentNames() {
        const names = await apiGet('getStudentNames');
        if (names) {
            nameSelect.innerHTML = '<option value="">선택하세요</option>';
            names.forEach(n => { const o = document.createElement('option'); o.value = n; o.innerText = n; nameSelect.appendChild(o); });
        } else {
            // Fallback: 스프레드시트 연결 실패 시 30명 생성
            for (let i = 1; i <= 30; i++) {
                const o = document.createElement('option');
                o.value = "학생 " + i;
                o.innerText = "학생 " + i;
                nameSelect.appendChild(o);
            }
        }
    }
    loadStudentNames();

    // --- App Navigation ---
    document.getElementById('start-btn').onclick = () => {
        if (nameSelect.value) {
            document.getElementById('welcome-name').innerText = nameSelect.value;
            document.getElementById('login-overlay').classList.add('hidden');
            mainApp.classList.remove('hidden');
            initExplore();
            handleResize();
        }
    };

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

    // --- Gallery View ---
    async function initGallery() {
        const grid = document.getElementById('gallery-grid');
        grid.innerHTML = '<p style="padding:20px; text-align:center; width:100%;">작품을 불러오고 있어요... 🎨</p>';
        const artworks = await apiGet('getArtworks');
        if (artworks) {
            renderGallery(artworks);
        } else {
            renderGallery([
                { rowId: 2, name: "학생1", theme: "energy", imageData: "https://via.placeholder.com/300x200", feedback: "색감이 아주 강렬하고 멋져요!" }
            ]);
        }
    }

    function renderGallery(artworks) {
        const grid = document.getElementById('gallery-grid');
        grid.innerHTML = '';
        if (artworks.length === 0) {
            grid.innerHTML = '<p style="padding:40px; text-align:center; width:100%; color:#636e72;">아직 등록된 작품이 없어요. 😢</p>';
            return;
        }
        artworks.forEach(art => {
            const card = document.createElement('div');
            card.className = 'glass-card';
            card.style.padding = '15px'; card.style.display = 'flex'; card.style.flexDirection = 'column'; card.style.gap = '10px';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="font-size:1.1rem;">${art.name}</strong>
                    <span style="font-size:0.8rem; padding:4px 8px; border-radius:8px; background:#f1f2f6; color:#6c5ce7; font-weight:700;">${art.theme === 'energy' ? '열정' : art.theme === 'spring' ? '싱그러움' : '시원함'}</span>
                </div>
                <img src="${art.imageData}" style="width:100%; border-radius:12px; border:1px solid #eee; cursor:pointer;" onclick="window.open('${art.imageData}')">
                <div style="margin-top:5px;">
                    <label style="font-size:0.8rem; font-weight:800; color:#636e72;">선생님 한마디:</label>
                    <div style="display:flex; gap:8px; margin-top:5px;">
                        <input type="text" id="fb-${art.rowId}" value="${art.feedback}" placeholder="칭찬 한마디 써주세요!" style="flex:1; padding:8px 12px; border:2px solid #eee; border-radius:10px; font-size:0.85rem; font-family:inherit;">
                        <button onclick="submitFeedback(${art.rowId})" class="primary-btn" style="padding:8px 15px; font-size:0.8rem;">저장</button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    window.submitFeedback = async (rowId) => {
        const feedback = document.getElementById(`fb-${rowId}`).value;
        await apiPost('saveFeedback', { rowId, feedback });
        alert('피드백 저장을 요청했습니다! (처리 중)');
    };

    document.getElementById('refresh-gallery').onclick = initGallery;

    // --- Explore View ---
    function initExplore() {
        const wheel = document.getElementById('color-wheel'); wheel.innerHTML = '';
        colorData.forEach((c, i) => {
            const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
            el.setAttribute("d", createSlicePath(200, 200, 180, i * 36, (i + 1) * 36));
            el.setAttribute("fill", c.hex);
            el.onclick = () => {
                wheel.style.transform = `rotate(${-(i + 0.5) * 36}deg)`;
                document.getElementById('color-card').classList.remove('hidden');
                document.getElementById('intro-card').classList.add('hidden');
                document.getElementById('color-name').innerText = c.name;
                document.getElementById('color-feeling').innerText = c.feeling;
                document.getElementById('color-indicator').style.backgroundColor = c.hex;
            };
            wheel.appendChild(el);
            addWheelLabel(wheel, i, c.name, "white");
        });
    }

    // --- Creation View ---
    function initCreation() {
        const wheel = document.getElementById('creation-wheel'); wheel.innerHTML = '';
        renderPool();
        updateBowl();
        for (let i = 0; i < 10; i++) {
            const slot = document.createElementNS("http://www.w3.org/2000/svg", "path");
            slot.setAttribute("d", createSlicePath(200, 200, 180, i * 36, (i + 1) * 36));
            slot.setAttribute("fill", "#f1f2f6"); slot.setAttribute("stroke", "white");
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
            addWheelLabel(wheel, i, colorData[i].name, "#636e72");
        }
    }

    function renderPool() {
        const pool = document.getElementById('primary-pool');
        pool.innerHTML = '';
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
        if (ratioDisplay) ratioDisplay.innerText = `빨강: ${R} | 노랑: ${Y} | 파랑: ${B}`;
        if (total === 0) {
            resP.style.backgroundColor = 'transparent'; resN.innerText = '물감을 섞어보세요';
            document.getElementById('bowl-content').style.backgroundColor = 'transparent'; return;
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
    }
    document.getElementById('clear-bowl').onclick = () => {
        state.currentMixture = { R: 0, Y: 0, B: 0 }; state.selectedColorFromPool = null; updateBowl();
    };
    document.getElementById('check-creation').onclick = () => {
        if (state.creationWheelState.every((s, i) => s === colorData[i].name)) confetti();
    };

    // --- Paint View ---
    document.getElementById('bg-mode-blank').onclick = () => { state.canvasMode = 'blank'; updatePaintUI(); };
    document.getElementById('bg-mode-outline').onclick = () => { state.canvasMode = 'outline'; updatePaintUI(); };
    document.getElementById('theme-warm-energy').onclick = () => { state.currentTheme = 'energy'; updatePaintUI(); };
    document.getElementById('theme-warm-spring').onclick = () => { state.currentTheme = 'spring'; updatePaintUI(); };
    document.getElementById('theme-cool-winter').onclick = () => { state.currentTheme = 'cool'; updatePaintUI(); };

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
            };
            palette.appendChild(d);
        });
        ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (state.canvasMode === 'outline') drawTree();
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

    document.getElementById('save-canvas').onclick = async () => {
        const imageData = canvas.toDataURL();
        const studentName = document.getElementById('welcome-name').innerText;
        const theme = state.currentTheme;
        const link = document.createElement('a');
        link.download = `${studentName}_그림.png`; link.href = imageData; link.click();
        await apiPost('saveArtwork', { data: { name: studentName, imageData: imageData, theme: theme } });
        alert('저장 요청을 보냈습니다!');
    };

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

