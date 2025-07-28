/**
 * HTOS Popup Script
 * @security No token handling in popup - all via service worker
 */

document.addEventListener('DOMContentLoaded', () => {
  const promptInput = document.getElementById('promptInput');
  const sendBtn = document.getElementById('sendBtn');
  const cspBtn = document.getElementById('cspBtn');
  const status = document.getElementById('status');
  const providerChips = document.querySelectorAll('.provider-chip');
  
  let selectedProviders = ['chatgpt', 'claude', 'gemini'];
  
  // Provider selection
  providerChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const provider = chip.dataset.provider;
      
      if (chip.classList.contains('active')) {
        chip.classList.remove('active');
        selectedProviders = selectedProviders.filter(p => p !== provider);
      } else {
        chip.classList.add('active');
        selectedProviders.push(provider);
      }
      
      sendBtn.disabled = selectedProviders.length === 0;
    });
  });
  
  // Send prompt
  sendBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    
    if (!prompt) {
      showStatus('Please enter a prompt', 'error');
      return;
    }
    
    if (selectedProviders.length === 0) {
      showStatus('Please select at least one provider', 'error');
      return;
    }
    
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'htos.dispatch',
        id: crypto.randomUUID(),
        prompt,
        providers: selectedProviders,
        options: {},
        synthesis: 'raw'
      });
      
      if (response.ok) {
        const result = response.data;
        showStatus(`✓ Sent to ${result.results.length} providers (${result.timing.duration}ms)`, 'success');
        
        // Clear input after successful send
        promptInput.value = '';
      } else {
        showStatus(`Error: ${response.error}`, 'error');
      }
      
    } catch (error) {
      showStatus(`Failed to send: ${error.message}`, 'error');
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send to All Models';
    }
  });
  
  // CSP bypass
  cspBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      const response = await chrome.runtime.sendMessage({
        type: 'htos.csp.allowOnce',
        id: crypto.randomUUID(),
        payload: {
          tabId: tab.id,
          url: tab.url
        }
      });
      
      if (response.ok) {
        showStatus('✓ CSP bypass applied, tab reloaded', 'success');
      } else {
        showStatus(`CSP bypass failed: ${response.error}`, 'error');
      }
      
    } catch (error) {
      showStatus(`CSP bypass error: ${error.message}`, 'error');
    }
  });
  
  // Enter key to send
  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendBtn.click();
    }
  });
  
  function showStatus(message, type) {
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
    
    setTimeout(() => {
      status.style.display = 'none';
    }, 3000);
  }
});