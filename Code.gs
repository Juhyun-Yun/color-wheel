// ==========================================
// 10색상환 친구들 - Apps Script 백엔드
// ==========================================

function doGet(e) {
  const action   = e && e.parameter ? e.parameter.action   : null;
  const callback = e && e.parameter ? e.parameter.callback : null;

  let result;
  try {
    switch (action) {
      case 'getStudentNames':
        result = { status: 'ok', data: getStudentNames() };
        break;
      case 'getArtworks':
        result = { status: 'ok', data: getArtworks() };
        break;
      case 'saveFeedback': {
        const rowId    = parseInt(e.parameter.rowId);
        const feedback = e.parameter.feedback || '';
        result = saveFeedback(rowId, feedback);
        break;
      }
      case 'logActivity': {
        const name     = decodeURIComponent(e.parameter.name     || '');
        const activity = decodeURIComponent(e.parameter.activity || '');
        const stage    = decodeURIComponent(e.parameter.stage    || '');
        logActivity(name, activity, stage);
        result = { status: 'ok' };
        break;
      }
      case 'savePeerComment': {
        const rowId   = parseInt(e.parameter.rowId);
        const author  = decodeURIComponent(e.parameter.author  || '');
        const comment = decodeURIComponent(e.parameter.comment || '');
        result = savePeerComment(rowId, author, comment);
        break;
      }
      case 'getPeerComments':
        result = { status: 'ok', data: getPeerComments() };
        break;
      case 'ping':
        result = { status: 'ok', data: 'pong' };
        break;
      default:
        result = { status: 'error', message: '알 수 없는 요청입니다.' };
    }
  } catch (err) {
    result = { status: 'error', message: err.toString() };
  }

  const json = JSON.stringify(result);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    if (params.action !== 'saveArtwork') throw new Error('알 수 없는 요청입니다.');
    const result = saveArtwork(params.data);
    return ContentService.createTextOutput(JSON.stringify({ status: 'ok', data: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ==========================================
// 학생 명단 조회 (최신 활동 포함)
// ==========================================
function getStudentNames() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // '학생 명단' 우선, 없으면 구버전 '명렬표' 사용
  let sheet = ss.getSheetByName('학생 명단') || ss.getSheetByName('명렬표');
  if (!sheet) {
    buildRosterSheet(ss.insertSheet('학생 명단', 1));
    sheet = ss.getSheetByName('학생 명단');
  } else {
    // '학생 명단'이 있는데 '명렬표'도 남아 있으면 자동 삭제
    const legacy = ss.getSheetByName('명렬표');
    if (legacy && ss.getSheetByName('학생 명단')) {
      ss.deleteSheet(legacy);
    }
    // 활동 열(C·D·E)이 없으면 자동 추가
    const lastCol = sheet.getLastColumn();
    if (lastCol < 3) {
      sheet.getRange(1, 3, 1, 3).setValues([['최신활동시각', '활동내용', '단계']]);
      sheet.getRange(1, 3, 1, 3).setFontWeight('bold').setBackground('#e8f0fe');
      sheet.setColumnWidth(3, 130);
      sheet.setColumnWidth(4, 200);
      sheet.setColumnWidth(5, 110);
    }
  }

  const SKIP = /^(번호|예시|이름|홍길동|임시|test|sample|\s*[-―—]\s*)/i;
  const all  = sheet.getDataRange().getValues();
  if (!all.length) return [];

  const firstCell  = String(all[0][0] || '').trim().toLowerCase();
  const HEADER_WORDS = ['번호', '이름', 'no', 'number', '#'];
  const hasHeader  = HEADER_WORDS.includes(firstCell);
  const dataRows   = hasHeader ? all.slice(1) : all;
  const hasNumCol  = dataRows.length > 0 && typeof dataRows[0][0] === 'number';

  return dataRows
    .filter(row => {
      const name = hasNumCol ? String(row[1] || '').trim() : String(row[0] || '').trim();
      return name && !SKIP.test(name);
    })
    .map((row, idx) => {
      const num      = hasNumCol ? row[0] : idx + 1;
      const name     = hasNumCol ? String(row[1]).trim() : String(row[0]).trim();
      // C=최신활동시각, D=활동내용, E=단계 (신규 형식)
      const time     = String(row[2] || '').trim();
      const activity = String(row[3] || '').trim();
      const stage    = String(row[4] || '').trim();
      const lastActivity = (time || activity || stage) ? { time, activity, stage } : null;
      return { number: num, name, lastActivity };
    });
}


// ==========================================
// 활동 기록
// ==========================================

function logActivity(name, activity, stage) {
  const pureName = String(name).replace(/^\d+번\s*/, '').trim();
  if (!pureName) return;

  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const now = new Date();
  const fmt = Utilities.formatDate(now, 'Asia/Seoul', 'MM/dd HH:mm');

  // 학생 명단에서 해당 학생 행의 C(시각)·D(활동내용)·E(단계) 업데이트
  const roster = ss.getSheetByName('학생 명단') || ss.getSheetByName('명렬표');
  if (!roster) return;
  const rows = roster.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1] || '').trim() === pureName) {
      roster.getRange(i + 1, 3, 1, 3).setValues([[fmt, activity, stage]]);
      break;
    }
  }
}

// ==========================================
// 전체 제출 현황
// ==========================================
// ==========================================
// 작품 저장
// ==========================================
function saveArtwork(data) {
  const { name, imageData, theme, selfEval } = data;
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName('작품제출');
  if (!sheet) {
    sheet = ss.insertSheet('작품제출');
    sheet.appendRow(['일시', '이름', '주제', '작품링크', '선생님피드백', '자기평가']);
    sheet.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#e8f0fe');
  } else if (sheet.getLastColumn() < 6) {
    sheet.getRange(1, 6).setValue('자기평가').setFontWeight('bold').setBackground('#e8f0fe');
  }

  const folderName = '10색상환_갤러리_' + ss.getId().slice(0, 8);
  let folders = DriveApp.getFoldersByName(folderName);
  let folder  = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

  const contentType = imageData.substring(5, imageData.indexOf(';'));
  const bytes = Utilities.base64Decode(imageData.split(',')[1]);
  const blob  = Utilities.newBlob(bytes, contentType, name + '_' + theme + '_' + Date.now() + '.png');
  const file  = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileUrl = 'https://drive.google.com/uc?export=view&id=' + file.getId();
  const selfEvalText = selfEval
    ? (selfEval.rating + '점 | ' + (selfEval.comment || ''))
    : '';
  sheet.appendRow([new Date(), name, theme, fileUrl, '', selfEvalText]);

  const themeLabel = theme === 'energy' ? '열정적인 기분' : theme === 'spring' ? '싱그러운 기분' : '시원한 기분';
  try { logActivity(name, '그림 저장 — ' + themeLabel, '03 그리기'); } catch (e) {}

  return { fileUrl };
}

// ==========================================
// 작품 목록
// ==========================================
function getArtworks() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('작품제출');
  if (!sheet || sheet.getLastRow() <= 1) return [];

  return sheet.getDataRange().getValues().slice(1).map((row, i) => ({
    rowId:     i + 2,
    timestamp: row[0] ? Utilities.formatDate(new Date(row[0]), 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : '',
    name:      String(row[1] || ''),
    theme:     String(row[2] || ''),
    imageData: String(row[3] || ''),
    feedback:  String(row[4] || ''),
    selfEval:  String(row[5] || '')
  }));
}

// ==========================================
// 피드백 저장
// ==========================================
function saveFeedback(rowId, feedback) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('작품제출');
  if (!sheet) return { status: 'error', message: '작품제출 시트가 없습니다.' };

  sheet.getRange(rowId, 5).setValue(decodeURIComponent(feedback));

  const name = String(sheet.getRange(rowId, 2).getValue() || '');
  if (name) try { logActivity(name, '선생님 피드백 받음', '04 갤러리'); } catch (e) {}

  return { status: 'ok' };
}

// ==========================================
// 동료 평가
// ==========================================
function savePeerComment(rowId, author, comment) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('동료평가');
  if (!sheet) {
    sheet = ss.insertSheet('동료평가');
    sheet.getRange(1, 1, 1, 4).setValues([['일시', '작성자', '작품번호', '댓글']]);
    sheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#e8f0fe');
    sheet.setColumnWidth(1, 130);
    sheet.setColumnWidth(2, 100);
    sheet.setColumnWidth(3, 80);
    sheet.setColumnWidth(4, 300);
  }
  const pureName = String(author).replace(/^\d+번\s*/, '').trim();
  sheet.appendRow([new Date(), pureName || author, rowId, comment]);
  try { logActivity(author, '동료 작품에 댓글 작성', '04 갤러리'); } catch (e) {}
  return { status: 'ok' };
}

function getPeerComments() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('동료평가');
  if (!sheet || sheet.getLastRow() <= 1) return [];
  return sheet.getDataRange().getValues().slice(1).map(row => ({
    time:    row[0] ? Utilities.formatDate(new Date(row[0]), 'Asia/Seoul', 'MM/dd HH:mm') : '',
    author:  String(row[1] || ''),
    rowId:   Number(row[2]),
    comment: String(row[3] || '')
  }));
}

// ==========================================
// 시트 초기 설정
// ==========================================
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss.getSheetByName('학생 명단')) {
    buildRosterSheet(ss.insertSheet('학생 명단', 1));
  }
  if (!ss.getSheetByName('작품제출')) {
    const s = ss.insertSheet('작품제출', 2);
    s.appendRow(['일시', '이름', '주제', '작품링크', '선생님피드백']);
    s.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#e8f0fe');
    s.setColumnWidth(4, 300);
    s.setColumnWidth(5, 300);
  }
  try {
    SpreadsheetApp.getUi().alert(
      '✅ 시트 설정 완료!\n\n' +
      '1. 학생 명단 시트에서 이름을 실제 학생 이름으로 수정하세요.\n' +
      '2. Apps Script → 배포 → 새 배포\n' +
      '   유형: 웹앱 / 실행: 나 / 액세스: 모든 사람\n' +
      '3. 생성된 .../exec 주소를 앱 ⚙️ 설정에 입력하세요.\n' +
      '4. 학생용 주소를 학생들에게 공유하세요!'
    );
  } catch (e) {}
}

function buildRosterSheet(s) {
  s.getRange(1, 1, 1, 5).setValues([['번호', '이름', '최신활동시각', '활동내용', '단계']]);
  s.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#e8f0fe');

  const rows = [];
  for (let i = 1; i <= 25; i++) rows.push([i, '학생' + i, '', '', '']);
  s.getRange(2, 1, 25, 5).setValues(rows);

  s.setColumnWidth(1, 60);
  s.setColumnWidth(2, 120);
  s.setColumnWidth(3, 130);
  s.setColumnWidth(4, 200);
  s.setColumnWidth(5, 110);
  s.setFrozenRows(1);
}

// ==========================================
// 메뉴
// ==========================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎨 10색상환 관리')
    .addItem('📋 시트 처음 설정하기', 'setupSheets')
    .addSeparator()
    .addItem('🔄 학생 명단 초기화 (학생1~25 리셋)', 'resetRoster')
    .addItem('📊 제출 현황 보기', 'showStats')
    .addItem('🗑️ 작품 기록 전체 삭제', 'clearArtworks')
    .addToUi();
}

function resetRoster() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('학생 명단을 학생1~학생25로 초기화할까요?', '', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('학생 명단')
             || SpreadsheetApp.getActiveSpreadsheet().getSheetByName('명렬표');
  if (!sheet) { ui.alert('학생 명단 시트가 없습니다.'); return; }
  const rows = [];
  for (let i = 1; i <= 25; i++) rows.push([i, '학생' + i]);
  sheet.getRange(2, 1, 25, 2).setValues(rows);  // 번호·이름만 초기화, 활동 열은 유지
  ui.alert('✅ 학생 명단을 초기화했습니다.');
}

function showStats() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('작품제출');
  const count = sheet ? Math.max(0, sheet.getLastRow() - 1) : 0;
  SpreadsheetApp.getUi().alert('📊 제출 현황\n\n총 제출 작품 수: ' + count + '개');
}

function clearArtworks() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('⚠️ 작품 기록을 전부 삭제할까요?\n이 작업은 되돌릴 수 없습니다.', '', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('작품제출');
  if (sheet && sheet.getLastRow() > 1) sheet.deleteRows(2, sheet.getLastRow() - 1);
  ui.alert('✅ 작품 기록을 삭제했습니다.');
}
