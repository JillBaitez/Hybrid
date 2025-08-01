// src/components/ChatInput.tsx

import React, { useState, useEffect, useRef } from 'react';
import { LLM_PROVIDERS_CONFIG } from '../constants';
// --- CHANGE 1: Import the new shared types ---
import { AppStep, SynthesisProvider } from '../types';

// --- CHANGE 2: Update the props interface to accept the new props ---
interface ChatInputProps {
  onSendPrompt: (prompt: string) => void;
  onSynthesize: () => void;
  isLoading: boolean;
  currentAppStep: AppStep;
  synthesisProvider: SynthesisProvider; // It receives the current choice
  onSetSynthesisProvider: (provider: SynthesisProvider) => void; // It receives the function to change the choice
}

const ChatInput: React.FC<ChatInputProps> = ({
    onSendPrompt,
    onSynthesize,
    isLoading,
    currentAppStep,
    // --- CHANGE 3: Destructure the new props from the function arguments ---
    synthesisProvider,
    onSetSynthesisProvider
}: ChatInputProps) => {
  const [prompt, setPrompt] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset height
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 120)}px`; // Max height 120px
    }
  }, [prompt]);

  const handleSubmitOrSynthesize = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLoading) return;

    if (currentAppStep === 'awaitingSynthesis') {
      onSynthesize();
    } else {
      if (prompt.trim()) {
        onSendPrompt(prompt.trim());
        setPrompt("");
      }
    }
  };
  
  const buttonText = currentAppStep === 'awaitingSynthesis' ? 'Synthesize' : 'Send';
  const isButtonDisabled = isLoading || (currentAppStep !== 'awaitingSynthesis' && !prompt.trim());

  return (
    <div className="input-area" style={{
      padding: '15px 20px', background: 'rgba(15, 15, 35, 0.8)',
      backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      <div className="input-container" style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', position: 'relative' }}>
        
        {/* --- CHANGE 4: Add the interactive UI for selecting the synthesizer --- */}
        {/* This selector only appears when it's time to synthesize */}
        {currentAppStep === 'awaitingSynthesis' && !isLoading && (
          <div style={{ position: 'absolute', top: '-28px', left: 0, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#94a3b8' }}>Synthesize with:</span>
            <select
              value={synthesisProvider}
              onChange={(e) => onSetSynthesisProvider(e.target.value as SynthesisProvider)}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#e2e8f0',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                padding: '2px 6px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              <option value="claude">Claude</option>
              <option value="gemini">Gemini</option>
            </select>
          </div>
        )}

        <div className="model-indicators" style={{
          position: 'absolute', top: '-20px', left: 0, display: 'flex', gap: '4px',
          // Hide the default model indicators when the synthesizer selector is shown
          visibility: currentAppStep === 'awaitingSynthesis' ? 'hidden' : 'visible'
        }}>
          {LLM_PROVIDERS_CONFIG.map(p => (
            <div key={p.id} className={`model-dot ${p.logoBgClass}`} title={p.name} style={{
              width: '6px', height: '6px', borderRadius: '50%', opacity: 0.8
            }}></div>
          ))}
        </div>
        <div className="input-wrapper" style={{ flex: 1, position: 'relative' }}>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              currentAppStep === 'awaitingSynthesis' 
                ? "Review summaries, select a synthesizer, then click 'Synthesize'." 
                : "Ask anything... Sidecar will orchestrate multiple AI models for you."
            }
            rows={1}
            className="prompt-textarea"
            style={{
              width: '100%', minHeight: '44px', padding: '12px 16px',
              background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px', color: '#f1f5f9', fontSize: '14px', fontFamily: 'inherit',
              resize: 'none', outline: 'none', transition: 'all 0.2s ease',
              overflowY: 'auto'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                if (currentAppStep === 'awaitingSynthesis') {
                    e.preventDefault();
                    handleSubmitOrSynthesize();
                } else if (prompt.trim()) {
                    e.preventDefault();
                    handleSubmitOrSynthesize();
                }
              }
            }}
            disabled={isLoading || currentAppStep === 'awaitingSynthesis'}
          />
        </div>
        <button
          type="button"
          onClick={() => handleSubmitOrSynthesize()}
          disabled={isButtonDisabled}
          className="action-button"
          style={{
            padding: '0px 16px', height: '44px',
            background: 'linear-gradient(45deg, #6366f1, #8b5cf6)', border: 'none',
            borderRadius: '12px', color: 'white', fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: '8px',
            minWidth: '100px', justifyContent: 'center',
            opacity: isButtonDisabled ? 0.5 : 1
          }}
        >
          {isLoading ? (
            <div className="loading-spinner"></div>
          ) : (
            <>
              <span className="magic-icon" style={{ fontSize: '16px' }}>
                {currentAppStep === 'awaitingSynthesis' ? '🧠' : '✨'}
              </span>
              <span>{buttonText}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ChatInput;