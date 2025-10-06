// Background에서 메시지 수신
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "captureSelection") {
    captureAndSend(request.selectedText, request.pageUrl, request.screenshot);
  }
});

async function captureAndSend(selectedText, pageUrl, screenshot) {
  try {
    // 페이지 제목 가져오기
    const pageTitle = document.title;
    
    // 현재 시간
    const timestamp = new Date().toISOString();
    
    // 도메인 추출
    const domain = new URL(pageUrl).hostname;
    
    // 데이터 구성
    const data = {
      selectedText: selectedText,
      pageUrl: pageUrl,
      pageTitle: pageTitle,
      screenshot: screenshot,
      timestamp: timestamp,
      domain: domain
    };
    
    // Background script로 전송
    chrome.runtime.sendMessage({
      action: "sendToN8N",
      data: data
    }, (response) => {
      if (response && response.success) {
        console.log('데이터 전송 성공:', response);
      } else {
        console.error('데이터 전송 실패:', response ? response.error : 'No response');
      }
    });
    
  } catch (error) {
    console.error("Error capturing data:", error);
  }
}