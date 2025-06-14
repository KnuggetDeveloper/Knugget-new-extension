document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎯 Popup loaded');
  
  // Get current tab info
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentUrl = tab?.url || '';
  
  // Detect platform
  let platform = 'unknown';
  let status = 'inactive';
  let message = '';
  
  if (currentUrl.includes('youtube.com')) {
    platform = 'youtube';
    if (currentUrl.includes('/watch')) {
      status = 'active';
      message = '✅ Active on YouTube video';
    } else {
      message = '🎬 Navigate to a YouTube video';
    }
  } else if (currentUrl.includes('linkedin.com')) {
    platform = 'linkedin';
    if (currentUrl.includes('/feed') || currentUrl === 'https://www.linkedin.com/') {
      status = 'active';
      message = '✅ Active on LinkedIn feed';
    } else {
      message = '💼 Navigate to LinkedIn feed';
    }
  } else {
    message = '❌ Not on supported platform';
  }
  
  // Update UI
  const statusIcon = document.getElementById('status-icon');
  const statusText = document.getElementById('status-text');
  const platformIndicator = document.getElementById('platform-indicator');
  
  if (statusIcon) {
    statusIcon.className = `status-icon ${status === 'inactive' ? 'inactive' : ''}`;
  }
  
  if (statusText) {
    statusText.textContent = message;
  }
  
  if (platformIndicator) {
    platformIndicator.textContent = platform === 'youtube' ? '🎬 YouTube' : 
                                   platform === 'linkedin' ? '💼 LinkedIn' : 
                                   'Unknown Platform';
  }
  
  // Check auth status
  try {
    const response = await chrome.runtime.sendMessage({ type: "CHECK_AUTH_STATUS" });
    
    if (response?.isAuthenticated) {
      // Show user section
      document.getElementById('login-section')?.classList.add('hidden');
      document.getElementById('user-section')?.classList.remove('hidden');
      
      const userAvatar = document.getElementById('user-avatar');
      const userName = document.getElementById('user-name');
      const userCredits = document.getElementById('user-credits-text');
      
      if (userAvatar) userAvatar.textContent = response.user.name?.charAt(0) || 'U';
      if (userName) userName.textContent = response.user.name || response.user.email;
      if (userCredits) userCredits.textContent = `${response.user.credits || 0} credits`;
    } else {
      // Show login section
      document.getElementById('user-section')?.classList.add('hidden');
      document.getElementById('login-section')?.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Auth check failed:', error);
  }
  
  // Event listeners
  document.getElementById('login-btn')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: "OPEN_LOGIN_PAGE", payload: { url: currentUrl } });
    window.close();
  });
  
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: "LOGOUT" });
    location.reload();
  });
  
  document.getElementById('dashboard-btn')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: "OPEN_DASHBOARD" });
    window.close();
  });
});