/**
 * End-to-End Claude Test Script
 * Tests: popup → bus → SW → offscreen → iframe (Claude)
 * 
 * Run this in the browser console after loading the extension
 */

console.log('🚀 Starting HTOS Claude End-to-End Test');

// Test the complete bus flow
async function testClaudeFlow() {
  try {
    console.log('📡 Initializing BroadcastChannel bus...');
    const bus = new BroadcastChannel('bus.channel');
    
    // Generate unique message ID
    const messageId = `test-${Date.now()}`;
    
    console.log(`📤 Sending ask message with ID: ${messageId}`);
    
    // Send ask message (same as popup would send)
    const askMessage = {
      id: messageId,
      type: 'ask',
      payload: {
        provider: 'claude-test',
        prompt: 'Hello Claude! This is an end-to-end test from HTOS. Please confirm you received this message.'
      },
      timestamp: Date.now()
    };
    
    // Listen for response
    const responsePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Test timeout after 30 seconds'));
      }, 30000);
      
      const messageHandler = (event) => {
        const msg = event.data;
        if (msg.id === messageId && msg.type === 'done') {
          clearTimeout(timeout);
          bus.removeEventListener('message', messageHandler);
          resolve(msg);
        }
      };
      
      bus.addEventListener('message', messageHandler);
    });
    
    // Send the message
    bus.postMessage(askMessage);
    console.log('✅ Ask message sent via bus');
    
    // Wait for response
    console.log('⏳ Waiting for response...');
    const response = await responsePromise;
    
    console.log('🎉 RESPONSE RECEIVED!');
    console.log('📊 Response details:', response);
    
    if (response.payload.success) {
      console.log('✅ END-TO-END TEST SUCCESSFUL!');
      console.log('🔄 Message flow: popup → bus → SW → offscreen → iframe → Claude API');
      console.log('📈 Test results:', {
        messageId: response.id,
        success: response.payload.success,
        chatId: response.payload.chatId,
        responseLength: response.payload.responseLength
      });
    } else {
      console.log('❌ Test failed:', response.payload.error);
    }
    
    bus.close();
    
  } catch (error) {
    console.error('❌ End-to-end test failed:', error);
  }
}

// Auto-run test
testClaudeFlow();

// Also make it available globally for manual testing
window.testClaudeFlow = testClaudeFlow;

console.log('💡 Test started! You can also run window.testClaudeFlow() manually.');
