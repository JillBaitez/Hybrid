/**
 * Simple test script to verify Phase 1 & 2 components
 * Run this in browser console after loading the extension
 */

// Test 1: Check if service worker is running
console.log('=== HTOS System Test ===');

// Test 2: Check Universal Bus initialization
chrome.runtime.sendMessage({
  $bus: true,
  appName: 'htos',
  name: 'htos.system.health_check'
}, (response) => {
  console.log('Service Worker Health:', response);
});

// Test 3: Check token storage (should be empty initially)
chrome.runtime.sendMessage({
  type: 'htos.token.get',
  provider: 'chatgpt'
}, (response) => {
  console.log('Token Storage Test:', response);
});

// Test 4: Test DNR manager
chrome.runtime.sendMessage({
  $bus: true,
  appName: 'htos',
  name: 'htos.dnr.activate',
  args: ['chatgpt', chrome.tabs.query({active: true}, tabs => tabs[0]?.id)]
}, (response) => {
  console.log('DNR Test:', response);
});

console.log('Tests sent - check responses above');
