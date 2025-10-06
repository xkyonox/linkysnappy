// Context Menu 생성
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "saveToSheets",
    title: "📸 LinkySnappy로 저장하기",
    contexts: ["selection"]
  });
});

// Context Menu 클릭 이벤트
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "saveToSheets") {
    captureAndSend(tab, info.selectionText, info.pageUrl);
  }
});

// Content script로부터 데이터 수신
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 팝업에서 수동 캡처 요청
  if (request.action === "captureManual") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const tab = tabs[0];
        
        // chrome:// 페이지 체크
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
          sendResponse({ success: false, error: '이 페이지에서는 사용할 수 없습니다' });
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: '캡처 불가',
            message: 'Chrome 내부 페이지에서는 사용할 수 없습니다.'
          });
          return;
        }
        
        captureAndSend(tab, "", tab.url);
        sendResponse({ success: true });
      }
    });
    return true;
  }
  
 // Content script에서 n8n 전송 요청
if (request.action === "sendToN8N") {
  sendToN8N(request.data)
    .then(response => {
      console.log('n8n 응답:', response);
      
      // 최근 URL과 요약 저장
      const shortUrl = response.shortUrl || response.data?.shortUrl;
      const summary = response.summary || response.data?.summary || '';
      
      if (shortUrl && shortUrl.startsWith('http')) {
        console.log('URL 저장:', shortUrl);
        console.log('요약 저장:', summary);
        chrome.storage.sync.set({ 
          recentShortUrl: shortUrl,
          recentSummary: summary  // 요약 추가
        }, () => {
          console.log('Storage 저장 완료');
        });
      }
      
      sendResponse({ success: true, response });
      
      // 성공 알림
      const notificationId = 'save-' + Date.now();
      chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: 'icon.png',
        title: '저장 완료!',
        message: shortUrl && shortUrl.startsWith('http')
          ? `링크: ${shortUrl}\n클릭하여 복사하세요`
          : '선택한 내용이 성공적으로 저장되었습니다.',
        requireInteraction: true
      });
      
      // 알림 클릭 시 URL 복사
      chrome.notifications.onClicked.addListener((clickedId) => {
        if (clickedId === notificationId && shortUrl && shortUrl.startsWith('http')) {
          navigator.clipboard.writeText(shortUrl).then(() => {
            chrome.notifications.update(notificationId, {
              message: '링크가 클립보드에 복사되었습니다!'
            });
            
            setTimeout(() => {
              chrome.notifications.clear(notificationId);
            }, 3000);
          });
        }
      });
    })
    .catch(error => {
      console.error('전송 실패:', error);
      sendResponse({ success: false, error: error.message });
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: '저장 실패',
        message: '오류: ' + error.message
      });
    });
  return true;
}
});

// 스크린샷 캡처 및 전송
function captureAndSend(tab, selectedText, pageUrl) {
  chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
    if (chrome.runtime.lastError) {
      console.error('스크린샷 캡처 실패:', chrome.runtime.lastError);
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: '캡처 실패',
        message: chrome.runtime.lastError.message
      });
      return;
    }
    
    if (!dataUrl) {
      console.error('스크린샷 데이터가 비어있습니다');
      return;
    }
    
    console.log('스크린샷 캡처 성공');
    
    // 즉시 캡처 완료 알림
    chrome.notifications.create('capture-done', {
      type: 'basic',
      iconUrl: 'icon.png',
      title: '스크린샷 완료!',
      message: '데이터를 업로드 중입니다...'
    });
    
    // Content script에 메시지 전송 (응답 불필요)
    chrome.tabs.sendMessage(tab.id, {
      action: "captureSelection",
      selectedText: selectedText || "",
      pageUrl: pageUrl,
      screenshot: dataUrl
    });
  });
}

// n8n Webhook으로 데이터 전송
async function sendToN8N(data) {
  const webhookUrl = await getWebhookUrl();
  
  if (!webhookUrl || webhookUrl === 'https://your-n8n-instance.com/webhook/YOUR_WEBHOOK_ID') {
    throw new Error('Webhook URL을 설정해주세요.');
  }
  
  console.log('전송 중...');
  
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  console.log('전송 성공:', result);
  return result;
}

// Storage에서 Webhook URL 가져오기
async function getWebhookUrl() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['webhookUrl'], (result) => {
      resolve(result.webhookUrl || 'https://your-n8n-instance.com/webhook/YOUR_WEBHOOK_ID');
    });
  });
}