/**
 * ============================================================
 * © 2026 GEG 화성(깊이 e끌림). All rights reserved.
 *
 * 본 코드는 「저작권법」상 보호받는 저작물입니다.
 * - 복제권(제16조)·공중송신권(제18조)·배포권(제20조)은
 *   저작권자에게 있습니다.
 * - 정식 경로로 받은 이용자라도 코드의 무단 복제·재배포·
 *   재판매·리브랜딩은 허용되지 않습니다.
 * - 무단 이용 시 「저작권법」 제136조(5년 이하 징역 또는
 *   5천만 원 이하 벌금) 및 제125조(손해배상) 적용 대상이
 *   될 수 있습니다.
 * - 이용 문의: bacusiki777@gmail.com, for2102@jimj.kr
 * ============================================================
 */

// 빌드 서명
const _BUILD_SIG = 'GEGHS-DEEPE-2026';

function getBuildInfo() {
  return { sig: _BUILD_SIG, owner: 'GEG 화성(깊이 e끌림)', year: 2026 };
}

// ============================================================
// 시트 이름 상수
// ============================================================
const SHEET_NAME_ROSTER = '명렬표';
const SHEET_NAME_ARTWORK = '작품제출';
const SHEET_NAME_GUIDE = '사용 설명';
const LEGACY_GUIDE_NAMES = ['📋 사용법', '사용 설명'];
const ROSTER_MAX = 30;
const ROSTER_PLACEHOLDER_PATTERN = /^학생\s*\d+$/;

// ============================================================
// 웹앱 진입점
// action 파라미터가 없으면 HTML 화면을, 있으면 JSON/JSONP 데이터를 돌려줍니다.
// (같은 배포 주소를 GitHub Pages 등 외부에 호스팅한 화면의 데이터 API로도 씁니다)
// ============================================================
function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const action = params.action;

  if (!action) {
    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('10색상환 친구들')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  }

  if (action === 'getStudentNames') {
    return createJsonResponse(getStudentNames(), params.callback);
  } else if (action === 'getArtworks') {
    return createJsonResponse(getArtworks(), params.callback);
  }
  return createJsonResponse({ status: 'error', message: 'Unknown action: ' + action }, params.callback);
}

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    let result;

    if (action === 'saveArtwork') {
      result = saveArtwork(params.data);
    } else if (action === 'reuploadArtwork') {
      result = reuploadArtwork(params.rowId, params.data);
    } else if (action === 'addComment') {
      result = addComment(params.rowId, params.comment);
    } else if (action === 'saveFeedback') {
      result = saveFeedback(params.rowId, params.feedback);
    } else {
      throw new Error('Invalid action: ' + action);
    }

    return createJsonResponse({ status: 'success', data: result });
  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() });
  }
}

// callback이 있으면 JSONP(<script> 태그) 응답으로, 없으면 순수 JSON으로 내려줍니다.
function createJsonResponse(data, callback) {
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(data) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// 명렬표 (학생 명단 + 최신 활동)
// A열 = 번호, B열 = 이름, C열 = 최신 활동
// ============================================================
function ensureRosterSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME_ROSTER);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME_ROSTER);
    const rows = [['번호', '이름', '최신 활동']];
    for (let i = 1; i <= ROSTER_MAX; i++) {
      rows.push([i, '학생' + i, '']);
    }
    sheet.getRange(1, 1, rows.length, 3).setValues(rows);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }

  const header = sheet.getRange(1, 1, 1, 2).getValues()[0];
  const isNewStructure = header[0] === '번호' && header[1] === '이름';
  if (!isNewStructure) {
    const lastRow = sheet.getLastRow();
    const oldValues = lastRow > 0 ? sheet.getRange(1, 1, lastRow, 1).getValues() : [];
    const existingNames = oldValues.map(r => r[0]).filter(v => v !== '' && v !== null);

    sheet.clear();
    const rows = [['번호', '이름', '최신 활동']];
    existingNames.forEach((name, idx) => rows.push([idx + 1, name, '']));
    sheet.getRange(1, 1, rows.length, 3).setValues(rows);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function getStudentNames() {
  const sheet = ensureRosterSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  return values
    .map(row => String(row[0] || '').trim())
    .filter(name => name !== '' && !ROSTER_PLACEHOLDER_PATTERN.test(name));
}

function updateLatestActivity(name, activityText) {
  if (!name) return;
  const sheet = ensureRosterSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const names = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  for (let i = 0; i < names.length; i++) {
    if (String(names[i][0]).trim() === name) {
      const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM/dd HH:mm');
      sheet.getRange(i + 2, 3).setValue(activityText + ' (' + stamp + ')');
      break;
    }
  }
}

// ============================================================
// 작품제출
// ============================================================
function ensureArtworkSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME_ARTWORK);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME_ARTWORK);
    sheet.appendRow(['일시', '이름', '주제', '작품링크', '자기평가', '친구댓글', '버전']);
  } else {
    const headerRange = sheet.getRange(1, 1, 1, Math.max(7, sheet.getLastColumn()));
    const headers = headerRange.getValues()[0];
    const desired = ['일시', '이름', '주제', '작품링크', '자기평가', '친구댓글', '버전'];
    let changed = false;
    desired.forEach((h, i) => {
      if (headers[i] !== h) { headers[i] = h; changed = true; }
    });
    if (changed) headerRange.setValues([headers]);
  }
  return sheet;
}

function ensureGalleryFolder() {
  const folderName = "10색상환_갤러리_작품";
  const folders = DriveApp.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
}

function uploadImageToDrive(name, theme, imageData) {
  const folder = ensureGalleryFolder();
  const contentType = imageData.substring(5, imageData.indexOf(';'));
  const bytes = Utilities.base64Decode(imageData.split(',')[1]);
  const blob = Utilities.newBlob(bytes, contentType, name + '_' + theme + '_' + new Date().getTime() + '.png');
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return "https://drive.google.com/uc?export=view&id=" + file.getId();
}

function saveArtwork(data) {
  const sheet = ensureArtworkSheet();
  const fileUrl = uploadImageToDrive(data.name, data.theme, data.imageData);
  sheet.appendRow([new Date(), data.name, data.theme, fileUrl, data.selfEval || "", "[]", 1]);
  updateLatestActivity(data.name, '그림 제출');
  return { status: "success", fileUrl: fileUrl };
}

function reuploadArtwork(rowId, data) {
  const sheet = ensureArtworkSheet();
  const fileUrl = uploadImageToDrive(data.name, data.theme, data.imageData);
  const current = sheet.getRange(rowId, 1, 1, 7).getValues()[0];
  const prevVersion = Number(current[6]) || 1;
  sheet.getRange(rowId, 1).setValue(new Date());
  sheet.getRange(rowId, 4).setValue(fileUrl);
  if (data.selfEval) sheet.getRange(rowId, 5).setValue(data.selfEval);
  sheet.getRange(rowId, 7).setValue(prevVersion + 1);
  updateLatestActivity(data.name, '그림 수정 제출 (v' + (prevVersion + 1) + ')');
  return { status: "success", fileUrl: fileUrl, version: prevVersion + 1 };
}

function getArtworks() {
  const sheet = ensureArtworkSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  return values.slice(1).map((row, index) => ({
    rowId: index + 2,
    timestamp: row[0],
    name: row[1],
    theme: row[2],
    imageData: row[3],
    selfEval: row[4] || "",
    comments: row[5] || "[]",
    version: Number(row[6]) || 1
  }));
}

function addComment(rowId, commentJson) {
  const sheet = ensureArtworkSheet();
  const existing = sheet.getRange(rowId, 6).getValue() || "[]";
  let arr;
  try { arr = JSON.parse(existing); if (!Array.isArray(arr)) arr = []; } catch (e) { arr = []; }
  const newComment = JSON.parse(commentJson);

  const existingIdx = arr.findIndex(c => c.friend === newComment.friend && (c.version || 1) === (newComment.version || 1));
  if (existingIdx >= 0) {
    arr[existingIdx] = newComment;
  } else {
    arr.push(newComment);
  }
  sheet.getRange(rowId, 6).setValue(JSON.stringify(arr));
  if (newComment.friend) updateLatestActivity(newComment.friend, '친구 작품에 댓글 남김');
  return { status: "success" };
}

function saveFeedback(rowId, feedback) {
  const sheet = ensureArtworkSheet();
  sheet.getRange(rowId, 8).setValue(feedback);
  return "피드백 저장 성공!";
}

// ============================================================
// 초기 설정
// ============================================================
function initialSetup() {
  ensureRosterSheet();
  ensureArtworkSheet();
  setupGuideSheet();
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎨 10색상환 친구들')
    .addItem('시트 처음 설정하기', 'initialSetup')
    .addItem('사용 설명 다시 만들기', 'setupGuideSheet')
    .addToUi();
}

// ============================================================
// 사용 설명 탭 생성
// ============================================================
function setupGuideSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const existingGuideSheets = LEGACY_GUIDE_NAMES
    .map(n => ss.getSheetByName(n))
    .filter(s => s !== null);

  let guideSheet;
  const allSheets = ss.getSheets();

  if (existingGuideSheets.length > 0 && allSheets.length === existingGuideSheets.length) {
    const tempName = '_temp_guide_' + new Date().getTime();
    guideSheet = ss.insertSheet(tempName);
    existingGuideSheets.forEach(s => ss.deleteSheet(s));
    guideSheet.setName(SHEET_NAME_GUIDE);
  } else {
    existingGuideSheets.forEach(s => ss.deleteSheet(s));
    guideSheet = ss.getSheetByName(SHEET_NAME_GUIDE);
    if (guideSheet) ss.deleteSheet(guideSheet);
    guideSheet = ss.insertSheet(SHEET_NAME_GUIDE);
  }

  guideSheet.activate();
  ss.moveActiveSheet(1);
  guideSheet.setTabColor('#6c5ce7');
  writeGuideContent(guideSheet);
}

function writeGuideContent(sheet) {
  const PRIMARY = '#6c5ce7';
  const PRIMARY_LIGHT = '#eeeaff';
  const SECTION_BG = '#f0eaff';
  const TABLE_HEADER_BG = '#f5f5f5';

  const rows = [];
  const formatJobs = [];

  function addRow(values) {
    rows.push(values);
    return rows.length;
  }

  const titleRow = addRow(['10색상환 친구들 — 시트 사용 설명', '', '']);
  formatJobs.push({ row: titleRow, type: 'title' });
  addRow(['', '', '']);

  let sectionNo = 1;

  // ── 섹션 1: 처음 사용할 때 설정하기 ──
  const setupHeaderRow = addRow([sectionNo + '. 처음 사용할 때 설정하기', '', '']);
  formatJobs.push({ row: setupHeaderRow, type: 'section' });
  sectionNo++;

  const setupTableHeaderRow = addRow(['단계', '내용', '']);
  formatJobs.push({ row: setupTableHeaderRow, type: 'tableHeader', numCols: 2 });

  let stepNo = 1;
  addRow(['①', '"명렬표" 탭에 있는 예시 이름(학생1, 학생2 …)을 지우고 우리 반 학생의 번호와 이름을 입력합니다.', '']);
  stepNo++;
  addRow(['②', '확장 프로그램 → Apps Script → 배포 → 새 배포 → 웹 앱 / 액세스: 모든 사용자 → 배포', '']);
  stepNo++;
  addRow(['③', "처음 1회만 진행합니다. 본인이 만든 사본이므로 안전합니다.\n⑴ '승인 필요'에서 '권한 검토'를 선택합니다.\n⑵ 본인 계정을 선택합니다.\n⑶ '확인되지 않은 앱' 화면에서 왼쪽 아래 '고급'을 누른 뒤 '(프로젝트 이름)(으)로 이동'을 선택합니다.\n⑷ 화면 맨 아래의 '허용'을 선택합니다.\n※ '고급'이 보이지 않으면 창을 최대화합니다.", '']);
  stepNo++;
  addRow(['④', '배포 후 표시된 웹앱 주소(.../exec)를 복사해서 학생들에게 링크로 공유합니다.', '']);
  stepNo++;

  const setupTableEndRow = setupTableHeaderRow + (stepNo - 1);
  formatJobs.push({ row: setupTableHeaderRow, endRow: setupTableEndRow, type: 'tableBody' });
  addRow(['', '', '']);

  // ── 재배포 안내 ──
  const redeployHeaderRow = addRow(['코드를 수정한 경우 — 재배포 방법', '', '']);
  formatJobs.push({ row: redeployHeaderRow, type: 'section' });

  const redeployTableHeaderRow = addRow(['단계', '내용', '']);
  formatJobs.push({ row: redeployTableHeaderRow, type: 'tableHeader', numCols: 2 });
  addRow(['①', '확장 프로그램 → Apps Script → [배포] → [배포 관리]를 선택합니다.', '']);
  addRow(['②', '목록에서 기존 배포 항목의 오른쪽 연필(✏️) 아이콘을 클릭합니다.', '']);
  addRow(['③', '버전을 [새 버전]으로 선택하고 [배포]를 누릅니다.\n※ 배포 URL은 변경되지 않으므로 학생들에게 다시 공유할 필요가 없습니다.', '']);
  formatJobs.push({ row: redeployTableHeaderRow, endRow: redeployTableHeaderRow + 3, type: 'tableBody' });
  addRow(['', '', '']);

  const tabListHeaderRow = addRow([sectionNo + '. 탭 목록', '', '']);
  formatJobs.push({ row: tabListHeaderRow, type: 'section' });
  sectionNo++;

  const tabTableHeaderRow = addRow(['탭 이름', '역할', '주의사항']);
  formatJobs.push({ row: tabTableHeaderRow, type: 'tableHeader', numCols: 3 });
  addRow(['명렬표', '학생 번호·이름 관리, 각 학생의 최신 활동 표시', '예시 이름(학생1~30)을 지우고 실제 이름으로 바꿔 사용하세요. 1행(머리글)과 탭 이름은 변경하지 마세요.']);
  addRow(['작품제출', '학생이 그린 그림과 자기평가·친구댓글을 시간순으로 자동 기록', '앱이 자동으로 기록합니다. 직접 수정하거나 행을 삭제하면 오류가 날 수 있습니다.']);
  addRow(['사용 설명', '앱 설정 방법과 각 탭의 사용 방법 안내', '탭 이름을 변경하거나 삭제하지 마세요.']);
  formatJobs.push({ row: tabTableHeaderRow, endRow: tabTableHeaderRow + 3, type: 'tableBody', numCols: 3 });
  addRow(['', '', '']);

  // ── 시트 내용 수정 안내 ──
  const noteHeaderRow = addRow([sectionNo + '. 시트 내용 수정 안내', '', '']);
  formatJobs.push({ row: noteHeaderRow, type: 'section' });
  sectionNo++;
  addRow(['데이터나 설정을 변경할 때는 앱 화면이 아니라 해당 시트 탭에서 직접 수정하세요. 탭 이름은 코드와 연결되어 있으므로 삭제하거나 변경하지 마세요.', '', '']);
  addRow(['', '', '']);

  const menuHeaderRow = addRow([sectionNo + '. 메뉴 사용법', '', '']);
  formatJobs.push({ row: menuHeaderRow, type: 'section' });
  sectionNo++;
  const menuTableHeaderRow = addRow(['메뉴 항목', '하는 일', '실행 시점']);
  formatJobs.push({ row: menuTableHeaderRow, type: 'tableHeader', numCols: 3 });
  addRow(['시트 처음 설정하기', '명렬표·작품제출 탭과 사용 설명 탭을 만들어 줍니다.', '사본을 만든 뒤 처음 한 번 실행합니다.']);
  addRow(['사용 설명 다시 만들기', '이 사용 설명 탭을 최신 내용으로 다시 만들어 줍니다.', '필요할 때 언제든 실행할 수 있습니다.']);
  formatJobs.push({ row: menuTableHeaderRow, endRow: menuTableHeaderRow + 2, type: 'tableBody', numCols: 3 });
  addRow(['', '', '']);

  const copyrightHeaderRow = addRow([sectionNo + '. 저작권 안내', '', '']);
  formatJobs.push({ row: copyrightHeaderRow, type: 'section' });
  sectionNo++;

  const copyrightText =
    '본 구글 시트 및 관련 자료(앱, 코드, 콘텐츠 포함)의 저작권은 GEG 화성(깊이 e끌림)에게 있습니다.\n\n' +
    '1. 본 자료는 책을 구입한 자에 한해 이용이 허락됩니다. 무단 복제·재배포·재판매·리브랜딩은 허용되지 않습니다.\n' +
    '2. 영리 목적의 사용·배포, 무단 수정을 통한 2차 저작물 작성을 금합니다.\n\n' +
    'ⓒ 2026 GEG 화성(깊이 e끌림)';

  const copyrightBodyRow = addRow([copyrightText, '', '']);
  formatJobs.push({ row: copyrightBodyRow, type: 'copyright' });

  sheet.getRange(1, 1, rows.length, 3).setValues(rows);
  sheet.getRange(1, 1, rows.length, 3).setWrap(true).setVerticalAlignment('top');

  formatJobs.forEach(job => {
    if (job.type === 'title') {
      const range = sheet.getRange(job.row, 1, 1, 3);
      range.merge();
      range.setFontSize(14).setFontWeight('bold').setFontColor(PRIMARY);
    } else if (job.type === 'section') {
      const range = sheet.getRange(job.row, 1, 1, 3);
      range.merge();
      range.setBackground(SECTION_BG).setFontWeight('bold');
    } else if (job.type === 'tableHeader') {
      const numCols = job.numCols || 3;
      sheet.getRange(job.row, 1, 1, numCols).setBackground(TABLE_HEADER_BG).setFontWeight('bold');
    } else if (job.type === 'tableBody') {
      const numCols = job.numCols || 2;
      const numRows = job.endRow - job.row + 1;
      sheet.getRange(job.row, 1, numRows, numCols).setBorder(true, true, true, true, true, true);
    } else if (job.type === 'copyright') {
      const range = sheet.getRange(job.row, 1, 1, 3);
      range.merge();
      range.setBackground(PRIMARY_LIGHT);
    }
  });

  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 560);
  sheet.setColumnWidth(3, 160);
}
