function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'getStudentNames') {
    return createJsonResponse(getStudentNames());
  } else if (action === 'getArtworks') {
    return createJsonResponse(getArtworks());
  }
  
  // 기본적으로 HTML 서빙 (필요시)
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
      result = saveFeedback(params.rowId, params.feedback);
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

// 명렬표에서 학생 명단 가져오기
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

// 학생 작품 저장하기 (드라이브 폴더 생성 및 저장)
function saveArtwork(data) {
  const { name, imageData, theme } = data;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('작품제출');
  
  if (!sheet) {
    sheet = ss.insertSheet('작품제출');
    sheet.appendRow(['일시', '이름', '주제', '작품링크', '선생님피드백']);
  }
  
  // 드라이브 폴더 확인 및 생성
  const folderName = "10색상환_갤러리_작품";
  let folders = DriveApp.getFoldersByName(folderName);
  let folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(folderName);
  }
  
  // 이미지 저장 (Base64 -> Blob)
  const contentType = imageData.substring(5, imageData.indexOf(';'));
  const bytes = Utilities.base64Decode(imageData.split(',')[1]);
  const blob = Utilities.newBlob(bytes, contentType, `${name}_${theme}_${new Date().getTime()}.png`);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); // 갤러리 표시를 위해 공유 설정
  
  const timestamp = new Date();
  const fileUrl = "https://drive.google.com/uc?export=view&id=" + file.getId(); // 직접 이미지 링크 형식
  
  sheet.appendRow([timestamp, name, theme, fileUrl, ""]);
  
  return { status: "success", fileUrl: fileUrl };
}

// 모든 작품 가져오기 (갤러리 보드용)
function getArtworks() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('작품제출');
  if (!sheet) return [];
  
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return []; // 헤더만 있는 경우
  
  return values.slice(1).map((row, index) => ({
    rowId: index + 2, // 실제 시트 행 번호
    timestamp: row[0],
    name: row[1],
    theme: row[2],
    imageData: row[3],
    feedback: row[4] || ""
  }));
}

// 선생님 피드백 저장하기
function saveFeedback(rowId, feedback) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('작품제출');
  if (!sheet) return "오류: 시트를 찾을 수 없습니다.";
  
  sheet.getRange(rowId, 5).setValue(feedback);
  return "피드백 저장 성공!";
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

