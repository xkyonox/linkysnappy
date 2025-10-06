document.addEventListener('DOMContentLoaded', () => {
  const webhookUrlInput = document.getElementById('webhookUrl');
  const saveBtn = document.getElementById('saveBtn');
  const captureBtn = document.getElementById('captureBtn');
  const statusDiv = document.getElementById('status');
  const recentLinkDiv = document.getElementById('recentLink');
  const recentSummaryDiv = document.getElementById('recentSummary');
  const summarySectionDiv = document.getElementById('summarySection');

  // 초기 로드
  loadRecentData();
  
  chrome.storage.sync.get(['webhookUrl'], (result) => {
    if (result.webhookUrl) {
      webhookUrlInput.value = result.webhookUrl;
    }
  });

  // 1초마다 최근 데이터 업데이트
  setInterval(loadRecentData, 1000);

  // 최근 링크와 요약 불러오기
  function loadRecentData() {
    chrome.storage.sync.get(['recentShortUrl', 'recentSummary'], (result) => {
      console.log('📥 Storage 읽기:', result);
      
      if (result.recentShortUrl) {
        console.log('✅ URL 발견:', result.recentShortUrl);
        displayRecentLink(result.recentShortUrl);
        
        // 요약이 있으면 표시
        if (result.recentSummary) {
          console.log('📝 요약 발견:', result.recentSummary);
          displayRecentSummary(result.recentSummary);
        } else {
          summarySectionDiv.classList.add('hidden');
        }
      } else {
        console.log('⚠️ URL 없음');
        summarySectionDiv.classList.add('hidden');
      }
    });
  }

  // 최근 링크 표시
  function displayRecentLink(url) {
    recentLinkDiv.className = 'recent-link-url';
    recentLinkDiv.textContent = url;
    recentLinkDiv.onclick = () => {
      navigator.clipboard.writeText(url).then(() => {
        showStatus('링크가 클립보드에 복사되었습니다!', 'success');
      });
      chrome.tabs.create({ url: url });
    };
  }

  // 요약 표시
  function displayRecentSummary(summary) {
    summarySectionDiv.classList.remove('hidden');
    recentSummaryDiv.textContent = summary;
  }

  // 캡처 버튼 클릭
  captureBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      showStatus('캡처 중...', 'success');
      
      chrome.runtime.sendMessage({
        action: "captureManual",
        tabId: tab.id
      }, (response) => {
        if (response && response.success) {
          showStatus('✅ 스크린샷 완료!', 'success');
        }
      });
    } catch (error) {
      showStatus('오류: ' + error.message, 'error');
    }
  });

  // 저장 버튼 클릭
  saveBtn.addEventListener('click', () => {
    const webhookUrl = webhookUrlInput.value.trim();
    
    if (!webhookUrl) {
      showStatus('Webhook URL을 입력해주세요.', 'error');
      return;
    }

    if (!isValidUrl(webhookUrl)) {
      showStatus('유효한 URL을 입력해주세요.', 'error');
      return;
    }

    chrome.storage.sync.set({ webhookUrl }, () => {
      showStatus('설정이 저장되었습니다!', 'success');
      setTimeout(() => {
        statusDiv.classList.add('hidden');
      }, 2000);
    });
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.classList.remove('hidden');
  }

  function isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }
});