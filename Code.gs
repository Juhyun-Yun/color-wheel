function doGet(e) {
  const action = e.parameter.action;

  if (action === 'getStudentNames') {
    return createJsonResponse(getStudentNames());
  } else if (action === 'getArtworks') {
    return createJsonResponse(getArtworks());
  }

  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('10색상환 친구들')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    let result;

    if (action === 'saveArtwork') {
      result = saveArtwork(params.data);
    } else if (action === 'saveFeedback') {
      // 하위 호환: 기존 선생님 피드백 저장
      result = saveFeedback(params.rowId, params.feedback);
    } else if (action === 'addComment') {
      result = addComment(params.rowId, params.comment);
    } else if (action === 'reuploadArtwork') {
      result = reuploadArtwork(params.rowId, params.data);
    } else {
      throw new Error("Invalid action");
    }

    return createJsonResponse({ status: 'success', data: result });
  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() });
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getStudentNames() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('명렬표');
  if (!sheet) {
    sheet = ss.insertSheet('명렬표');
    sheet.getRange(1, 1, 5, 1).setValues([['김민수'], ['이서연'], ['박지우'], ['최준호'], ['한소희']]);
  }
  const values = sheet.getDataRange().getValues();
  return values.map(row => row[0]).filter(name => name !== '');
}

function ensureArtworkSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('작품제출');
  if (!sheet) {
    sheet = ss.insertSheet('작품제출');
    sheet.appendRow(['일시', '이름', '주제', '작품링크', '자기평가', '친구댓글', '버전']);
  } else {
    // 헤더 자동 마이그레이션
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
  const blob = Utilities.newBlob(bytes, contentType, `${name}_${theme}_${new Date().getTime()}.png`);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return "https://drive.google.com/uc?export=view&id=" + file.getId();
}

function saveArtwork(data) {
  const { name, imageData, theme, selfEval } = data;
  const sheet = ensureArtworkSheet();
  const fileUrl = uploadImageToDrive(name, theme, imageData);
  sheet.appendRow([new Date(), name, theme, fileUrl, selfEval || "", "[]", 1]);
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

  // 동일 친구 + 동일 버전의 기존 댓글이 있으면 갱신, 없으면 추가
  const existingIdx = arr.findIndex(c => c.friend === newComment.friend && (c.version || 1) === (newComment.version || 1));
  if (existingIdx >= 0) {
    arr[existingIdx] = newComment;
  } else {
    arr.push(newComment);
  }
  sheet.getRange(rowId, 6).setValue(JSON.stringify(arr));
  return { status: "success" };
}

// 하위 호환용: 기존 선생님 피드백 (현재 UI에서는 사용되지 않음)
function saveFeedback(rowId, feedback) {
  const sheet = ensureArtworkSheet();
  // 안전한 위치(8열)로 저장
  sheet.getRange(rowId, 8).setValue(feedback);
  return "피드백 저장 성공!";
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
