import { useState, useEffect, useCallback, useRef } from 'react';
import { Message, LLMStreamData, AppStep, ChatSession, HistoryApiResponse, BackendMessage, LLMProvider } from './types';
import type { WorkflowStepResult } from '../shared/contract';
import { LLM_PROVIDERS_CONFIG, EXAMPLE_PROMPT } from './constants';
import AIMessageBlock from './components/AIMessageBlock';
import ChatInput from './components/ChatInput';
import HistoryPanel from './components/HistoryPanel';
import { UserIcon, MenuIcon } from './components/Icons';
import api from './services/extension-api';



// Define a specific, type-safe union for the providers we allow for synthesis.
type SynthesisProvider = 'claude' | 'gemini';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState<boolean>(false);
  const [historySessions, setHistorySessions] = useState<ChatSession[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);
  const [showWelcome, setShowWelcome] = useState<boolean>(true);
  const [currentAppStep, setCurrentAppStep] = useState<AppStep>('initial');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const [uiTabId, setUiTabId] = useState<number | undefined>();

  const [modelToggles, setModelToggles] = useState<Record<string, boolean>>(
    LLM_PROVIDERS_CONFIG.reduce((acc, provider) => { // 'provider' is correct here
     acc[provider.id] = provider.id === 'claude' || provider.id === 'gemini';
     return acc;
   }, {} as Record<string, boolean>)
  );

  // --- ADDITION 1: State for the selected synthesizer ---
  // This state variable is correctly typed and fixes the TypeScript error.
  const [synthesisProvider, setSynthesisProvider] = useState<SynthesisProvider>('claude');

  // State for the visible mode toggle
  const [isVisibleMode, setIsVisibleMode] = useState<boolean>(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.setExtensionId(chrome.runtime.id);
    // Get the current tab's ID when the app loads
    chrome.tabs.getCurrent(tab => {
        if (tab?.id) {
            setUiTabId(tab.id);
        }
    });
  }, []);

  useEffect(() => {
    if (isHistoryPanelOpen) {
      setIsHistoryLoading(true);
      api.getHistoryList()
        .then((historyData: HistoryApiResponse) => {
          if (historyData && Array.isArray(historyData.sessions)) {
            const formattedSessions: ChatSession[] = historyData.sessions.map((s: ChatSession) => ({
              id: s.sessionId,
              sessionId: s.sessionId,
              title: s.input || s.workflowId || 'Untitled Session',
              startTime: s.startTime,
              messages: s.messages || [],
            }));
            setHistorySessions(formattedSessions);
          }
        })
        .catch(console.error)
        .finally(() => setIsHistoryLoading(false));
    }
  }, [isHistoryPanelOpen]);

  useEffect(() => {
    const handleMessage = (message: any, sender: chrome.runtime.MessageSender) => {
        // Your existing security check is perfect.
        if (sender.id !== chrome.runtime.id) {
            return;
        }
        console.log("Received backend message:", message);

        // The 'sessionId' check can be simplified as the backend now includes it in every relevant message.
        if (message.sessionId !== currentSessionId) {
            return;
        }

        switch (message.type) {
          // THIS IS THE KEY CHANGE. We only listen for WORKFLOW_COMPLETE.
          case "WORKFLOW_COMPLETE":
            setIsLoading(false);
            setCurrentAppStep("awaitingSynthesis");

            // THIS IS THE FIX. Access `message.payload.stepResults`
            const results = message.payload.stepResults as WorkflowStepResult[];

            setMessages((prev) =>
              prev.map((msg) => {
                if (
                  msg.sessionId === message.sessionId &&
                  msg.type === "ai" &&
                  msg.llmData
                ) {
                  // The rest of this logic now uses the corrected `results` variable
                  const newLlmData = msg.llmData.map(existingLlm => {
                    const matchingResult = results.find(r => r.stepId.includes(existingLlm.providerId));
                    if (matchingResult && matchingResult.status === 'completed' && matchingResult.result?.response) {
                      const responseText = String(matchingResult.result.response);
                      return {
                        ...existingLlm,
                        firstSentenceSummary: responseText.split('.')[0] + '.',
                        fullOutput: responseText,
                        isStreamingOutput: false,
                        isStreamingSummary: false,
                      };
                    }
                    return {
                      ...existingLlm,
                      isStreamingOutput: false,
                      isStreamingSummary: false,
                      firstSentenceSummary: 'No response or an error occurred.',
                      fullOutput: existingLlm.fullOutput || 'Error.',
                    };
                  });

                  return {
                    ...msg,
                    llmData: newLlmData,
                    isOverallSummaryStreaming: false,
                  };
                }
                return msg;
              })
            );
            break;

          // Your SYNTHESIS_COMPLETE and WORKFLOW_FAILED handlers can remain largely the same.
          case "SYNTHESIS_COMPLETE":
            // This logic looks good.
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.sessionId === message.sessionId && msg.type === "ai") {
                  const synthesisResult = message.payload.find(
                    (res: any) => res.provider === synthesisProvider
                  );
                  return {
                    ...msg,
                    overallSummary:
                      synthesisResult?.response || "Synthesis complete.",
                    isOverallSummaryStreaming: false,
                    isFinalSynthesis: true,
                  };
                }
                return msg;
              })
            );
            setIsLoading(false);
            setCurrentAppStep("synthesisDone");
            break;

          case "WORKFLOW_FAILED":
            // This logic looks good.
            setIsLoading(false);
            setMessages((prev) => [
              ...prev,
              {
                id: `error-${Date.now()}`,
                type: "ai",
                sessionId: message.sessionId,
                overallSummary: `Error: ${message.error || "Workflow failed"}`,
                isOverallSummaryStreaming: false,
                isFinalSynthesis: false,
                timestamp: Date.now(),
              },
            ]);
            break;
        }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [currentSessionId, synthesisProvider]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleToggleModel = (providerId: string) => {
    setModelToggles(prev => ({ ...prev, [providerId]: !prev[providerId] }));
  };

  const handleSendPrompt = useCallback(async (promptText: string) => {
    setIsLoading(true);
    if (showWelcome) setShowWelcome(false);
    setCurrentAppStep('initial');

    const activeProviders = LLM_PROVIDERS_CONFIG.filter((p: LLMProvider) => modelToggles[p.id]);
    if (activeProviders.length === 0) {
      setIsLoading(false);
      setMessages(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          type: 'ai',
          sessionId: null,
          overallSummary: 'Error: No providers selected',
          isOverallSummaryStreaming: false,
          isFinalSynthesis: false,
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      sessionId: null,
      text: promptText,
      timestamp: Date.now(),
    };

    const initialAiMessageId = `ai-${Date.now()}`;
    const initialLlmsData: LLMStreamData[] = activeProviders.map((p: LLMProvider) => ({ // <-- Also type 'p' here
      providerId: p.id,
      firstSentenceSummary: 'Waiting for response...',
      fullOutput: '',
      isStreamingSummary: true,
      isStreamingOutput: true,
      isExpanded: false,
    }));

    const initialAiMessage: Message = {
      id: initialAiMessageId,
      type: 'ai',
      sessionId: null,
      overallSummary: `Orchestrating responses for "${promptText.substring(0, 30)}..."`,
      isOverallSummaryStreaming: true,
      llmData: initialLlmsData,
      isFinalSynthesis: false,
      timestamp: Date.now() + 1,
    };

    setMessages([userMessage, initialAiMessage]);

    try {
      // Pass the uiTabId to the API call
      const { sessionId } = await api.executeBatchPrompt(promptText, activeProviders, isVisibleMode, uiTabId);
      setCurrentSessionId(sessionId);
      setMessages(prev =>
        prev.map(msg => ({...msg, sessionId}))
      );
    } catch (error) {
      console.error('Error executing batch prompt:', error);
      setIsLoading(false);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === initialAiMessageId
            ? {
                ...msg,
                overallSummary: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 
                isOverallSummaryStreaming: false,
              }
            : msg
        ) );
    }
  }, [showWelcome, modelToggles, isVisibleMode, uiTabId]); // Add uiTabId to dependency array

  const handleSynthesize = useCallback(async () => {
    if (!currentSessionId || isLoading) return;

    setIsLoading(true);

    const userPrompt = messages.find(m => m.sessionId === currentSessionId && m.type === 'user')?.text || '';
    const lastAiMessage = messages.find(msg => msg.sessionId === currentSessionId && msg.type === 'ai' && msg.llmData);

    if (!lastAiMessage?.llmData) {
      setIsLoading(false);
      setMessages(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          type: 'ai',
          sessionId: currentSessionId,
          overallSummary: 'Error: No AI responses available for synthesis',
          isOverallSummaryStreaming: false,
          isFinalSynthesis: false,
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    const allBatchResults: Record<string, string> = lastAiMessage.llmData.reduce((acc, item) => {
      acc[item.providerId] = item.fullOutput;
      return acc;
    }, {} as Record<string, string>);

    setMessages(prev =>
      prev.map(msg =>
        msg.sessionId === currentSessionId && msg.type === 'ai'
          ? { ...msg, isOverallSummaryStreaming: true, overallSummary: 'Synthesizing final answer...' }
          : msg
      )
    );

    try {
      // --- ADDITION 2: Use the correctly typed state variable ---
      // This resolves the TypeScript error because `synthesisProvider` is now guaranteed
      // to be 'claude' or 'gemini'.
      // Pass the uiTabId to the API call
      await api.executeSynthesis(currentSessionId, userPrompt, allBatchResults, synthesisProvider, uiTabId);
    } catch (error) {
      console.error('Error executing synthesis:', error);
      setIsLoading(false);
      setMessages(prev =>
        prev.map(msg =>
          msg.sessionId === currentSessionId && msg.type === 'ai'
            ? {
                ...msg,
                overallSummary: `Synthesis Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 
                isOverallSummaryStreaming: false,
              }
            : msg
        )
      );
    }
  }, [messages, currentSessionId, isLoading, synthesisProvider, uiTabId]); // Add uiTabId

  // RESTORED: This function was missing from the previous incorrect version.
  const handleToggleExpandGist = useCallback((aiMessageId: string, llmId: string) => {
    setMessages(prevMessages =>
      prevMessages.map(msg => {
        if (msg.id === aiMessageId && msg.type === 'ai' && msg.llmData) {
          return {
            ...msg,
            llmData: msg.llmData.map(llm =>
              llm.providerId === llmId ? { ...llm, isExpanded: !llm.isExpanded } : llm
            ),
          };
        }
        return msg;
      })
    );
  }, []);

  // RESTORED: This function was missing from the previous incorrect version.
  const handleNewChat = useCallback(() => {
    setMessages([]);
    setCurrentAppStep('initial');
    setIsLoading(false);
    setCurrentSessionId(null);
    setIsHistoryPanelOpen(false);
    setShowWelcome(true);
  }, []);

  // RESTORED: This function was missing from the previous incorrect version.
  const handleSelectChat = useCallback(async (session: ChatSession) => {
    const sessionId = session.sessionId;
    setCurrentSessionId(sessionId);
    setIsLoading(true);
    try {
      const sessionData: ChatSession = await api.getSessionDetails(sessionId);
      if (sessionData && sessionData.messages) {
        setMessages(sessionData.messages.map(msg => ({ ...msg, sessionId })));
        const lastMessage = sessionData.messages[sessionData.messages.length - 1];
        if (lastMessage?.isFinalSynthesis) {
          setCurrentAppStep('synthesisDone');
        } else if (sessionData.messages.length > 1) {
          setCurrentAppStep('awaitingSynthesis');
        } else {
          setCurrentAppStep('initial');
        }
        setShowWelcome(false);
      } else {
        setMessages([]);
        setCurrentAppStep('initial');
        setShowWelcome(false);
      }
    } catch (error) {
      console.error('Error fetching chat history:', error);
      setMessages([
        {
          id: `error-${Date.now()}`,
          type: 'ai',
          sessionId,
          overallSummary: `Failed to load session. ${error instanceof Error ? error.message : 'Unknown error'}`,
          isOverallSummaryStreaming: false,
          isFinalSynthesis: false,
          timestamp: Date.now(),
        },
      ]);
      setCurrentAppStep('initial');
    } finally {
      setIsLoading(false);
      setIsHistoryPanelOpen(false);
    }
  }, []);

  const mainContentMarginLeft = isHistoryPanelOpen ? '260px' : '0px';

  return (
    <div className="sidecar-app-container" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <HistoryPanel
        isOpen={isHistoryPanelOpen}
        sessions={historySessions}
        isLoading={isHistoryLoading}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
      />
      <div
        className="main-content-wrapper"
        style={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          marginLeft: mainContentMarginLeft,
          transition: 'margin-left 0.3s ease',
          width: isHistoryPanelOpen ? `calc(100% - 260px)` : '100%',
        }}
      >
        <header
          className="header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            background: 'rgba(15, 15, 35, 0.8)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            flexShrink: 0,
          }}
        >
          <div className="logo-area" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setIsHistoryPanelOpen(prev => !prev)}
              style={{ background: 'none', border: 'none', color: '#e2e8f0', cursor: 'pointer', padding: '4px' }}
              aria-label="Toggle History Panel"
            >
              <MenuIcon style={{ width: '24px', height: '24px' }} />
            </button>
            <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '18px' }}>
              <div
                className="logo-icon"
                style={{
                  width: '24px',
                  height: '24px',
                  background: 'linear-gradient(45deg, #6366f1, #8b5cf6)',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                }}
              >
                ⚡
              </div>
              Sidecar
            </div>
          </div>
          <button
            className="settings-btn"
            onClick={() => setIsSettingsOpen(true)}
            style={{
              padding: '8px 12px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: '#e2e8f0',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            ⚙️ Models
          </button>
        </header>
        <main className="chat-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div
            ref={messagesContainerRef}
            className="messages-container"
            style={{ flex: 1, overflowY: 'auto', padding: '20px', scrollBehavior: 'smooth' }}
          >
            {showWelcome && (
              <div
                className="welcome-state"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  textAlign: 'center',
                  padding: '40px 20px',
                }}
              >
                <div
                  className="welcome-icon"
                  style={{
                    width: '80px',
                    height: '80px',
                    background: 'linear-gradient(45deg, #6366f1, #8b5cf6)',
                    borderRadius: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px',
                    marginBottom: '24px',
                  }}
                >
                  🧠
                </div>
                <h2 className="welcome-title" style={{ fontSize: '24px', fontWeight: 600, marginBottom: '12px' }}>
                  Intelligence Augmentation
                </h2>
                <p className="welcome-subtitle" style={{ fontSize: '16px', color: '#94a3b8', marginBottom: '32px', maxWidth: '400px' }}>
                  Ask one question, get synthesized insights from multiple AI models in real-time
                </p>
                <button
                  onClick={() => handleSendPrompt(EXAMPLE_PROMPT)}
                  disabled={isLoading}
                  style={{
                    fontSize: '14px',
                    color: '#a78bfa',
                    padding: '8px 16px',
                    border: '1px solid #a78bfa',
                    borderRadius: '8px',
                    background: 'rgba(167, 139, 250, 0.1)',
                    cursor: 'pointer',
                    opacity: isLoading ? 0.5 : 1,
                  }}
                >
                  Try: "{EXAMPLE_PROMPT}"
                </button>
              </div>
            )}
            {!showWelcome &&
              messages.map(msg =>
                msg.type === 'user' ? (
                  <div
                    key={msg.id}
                    className="user-message-container"
                    style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', maxWidth: '70%' }}>
                      <div
                        className="user-message"
                        style={{
                          background: 'rgba(99, 102, 241, 0.1)',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          borderRadius: '12px',
                          padding: '12px 16px',
                          color: '#f1f5f9',
                          order: 1,
                        }}
                      >
                        <p style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                      </div>
                      <UserIcon
                        className="w-8 h-8 text-indigo-400 ml-2 order-2 flex-shrink-0 mt-1"
                        style={{
                          width: '32px',
                          height: '32px',
                          color: '#818cf8',
                          marginLeft: '8px',
                          flexShrink: 0,
                          marginTop: '4px',
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <AIMessageBlock
                    key={msg.id}
                    message={msg}
                    onToggleExpandGist={(llmId: string) => handleToggleExpandGist(msg.id, llmId)}
                  />
                )
              )}
            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* --- ADDITION 3: Pass the new state and setter down to ChatInput --- */}
        <ChatInput
          onSendPrompt={handleSendPrompt}
          onSynthesize={handleSynthesize}
          isLoading={isLoading}
          currentAppStep={currentAppStep}
          synthesisProvider={synthesisProvider}
          onSetSynthesisProvider={setSynthesisProvider}
        />
        
      </div>
      <div
        className="settings-panel"
        style={{
          position: 'fixed',
          top: 0,
          right: isSettingsOpen ? '0px' : '-350px',
          width: '350px',
          height: '100vh',
          background: 'rgba(15, 15, 35, 0.95)',
          backdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
          transition: 'right 0.3s ease',
          zIndex: 1000,
          padding: '20px',
          overflowY: 'auto',
        }}
      >
        <div className="settings-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h2 className="settings-title" style={{ fontSize: '18px', fontWeight: 600 }}>Model Configuration</h2>
          <button
            className="close-settings"
            onClick={() => setIsSettingsOpen(false)}
            style={{
              padding: '8px',
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              borderRadius: '4px',
              transition: 'background 0.2s ease',
              fontSize: '18px',
            }}
          >
            ✕
          </button>
        </div>
        <div className="model-config">
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: '#a78bfa' }}>Active Models</h3>
          {LLM_PROVIDERS_CONFIG.map(provider => (
            <div
              key={provider.id}
              className="model-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                marginBottom: '8px',
              }}
            >
              <div className="model-info" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className={`model-logo ${provider.logoBgClass}`} style={{ width: '16px', height: '16px', borderRadius: '3px' }}></div>
                <span>{provider.name}</span>
              </div>
              <div
                className={`model-toggle ${modelToggles[provider.id] ? 'active' : ''}`}
                onClick={() => handleToggleModel(provider.id)}
                style={{
                  width: '40px',
                  height: '20px',
                  background: modelToggles[provider.id] ? '#6366f1' : 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '10px',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease',
                }}
              >
                <div
                  style={{
                    content: "''",
                    position: 'absolute',
                    top: '2px',
                    left: modelToggles[provider.id] ? '22px' : '2px',
                    width: '16px',
                    height: '16px',
                    background: 'white',
                    borderRadius: '50%',
                    transition: 'left 0.2s ease',
                  }}>
                </div>
              </div>
            </div>
          ))}
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: '#a78bfa', marginTop: '20px' }}>Execution Mode</h3>
          <div className="mode-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              marginBottom: '8px',
            }}
          >
            <span>Run in Visible Tabs (for debugging)</span>
            <div
              className={`mode-toggle ${isVisibleMode ? 'active' : ''}`}
              onClick={() => setIsVisibleMode(prev => !prev)}
              style={{
                width: '40px',
                height: '20px',
                background: isVisibleMode ? '#6366f1' : 'rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 0.2s ease',
              }}
            >
              <div
                style={{
                  content: "''",
                  position: 'absolute',
                  top: '2px',
                  left: isVisibleMode ? '22px' : '2px',
                  width: '16px',
                  height: '16px',
                  background: 'white',
                  borderRadius: '50%',
                  transition: 'left 0.2s ease',
                }}>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;