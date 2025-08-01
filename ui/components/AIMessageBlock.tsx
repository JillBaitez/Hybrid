import React from 'react';
import { Message, LLMProvider } from '../types';
import { LLM_PROVIDERS_CONFIG } from '../constants';
import { BotIcon, ChevronDownIcon, ChevronUpIcon } from './Icons'; 

interface AIMessageBlockProps {
  message: Message;
  onToggleExpandGist: (llmProviderId: string) => void;
}

const PulsingDot: React.FC<{isStreaming?: boolean}> = ({ isStreaming }) => {
  if (!isStreaming) return null;
  return <span style={{
    display: 'inline-block',
    width: '8px',
    height: '8px',
    marginLeft: '6px',
    backgroundColor: '#6366f1', 
    borderRadius: '50%',
    animation: 'pulse 1.5s ease-in-out infinite',
  }}></span>;
};


const AIMessageBlock: React.FC<AIMessageBlockProps> = ({ message, onToggleExpandGist }: AIMessageBlockProps) => {
  if (message.type !== 'ai' || !message.llmData) return null;

  const getProviderConfig = (providerId: string): LLMProvider | undefined => {
    return LLM_PROVIDERS_CONFIG.find(p => p.id === providerId);
  };

  const overviewTitle = message.isFinalSynthesis ? "Final Synthesized Output" : "Summarized Comparison";
  const overviewIcon = message.isFinalSynthesis ? "⚡" : "🧠";


  return (
    <div className="response-container" style={{ marginBottom: '24px', display: 'flex' }}>
      <BotIcon style={{
          width: '32px', height: '32px', color: '#a78bfa', marginRight: '12px', flexShrink: 0, marginTop:'4px'
      }} />
      <div style={{flexGrow: 1}}>
        {/* Synthesis Layer / Summarized Comparison Layer */}
        {message.overallSummary !== undefined && (
          <div className="synthesis-layer" style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(99, 102, 241, 0.1))',
            border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '16px',
            padding: '20px', marginBottom: '16px', position: 'relative', overflow: 'hidden'
          }}>
            <style>
              {`
                .synthesis-layer::before {
                  content: '';
                  position: absolute;
                  top: 0;
                  left: 0;
                  right: 0;
                  height: 2px;
                  background: linear-gradient(90deg, #6366f1, #8b5cf6);
                  animation: synthesisGlow 2s ease-in-out infinite alternate;
                }
              `}
            </style>
            <div className="synthesis-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div className="synthesis-icon" style={{
                width: '20px', height: '20px', background: 'linear-gradient(45deg, #6366f1, #8b5cf6)',
                borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'white'
              }}>{overviewIcon}</div>
              <div className="synthesis-title" style={{ fontWeight: 600, fontSize: '14px', color: '#a78bfa' }}>
                {overviewTitle}
              </div>
            </div>
            <div className="synthesis-content" style={{ fontSize: '14px', lineHeight: 1.6, color: '#f1f5f9', whiteSpace: 'pre-wrap' }}>
              {message.overallSummary}
              <PulsingDot isStreaming={message.isOverallSummaryStreaming} />
            </div>
          </div>
        )}

        {/* Gists Layer */}
        <div className="gists-layer" style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '12px', marginBottom: '16px'
        }}>
          {message.llmData.map((llm) => {
            const provider = getProviderConfig(llm.providerId);
            const isStreaming = llm.isStreamingSummary || llm.isStreamingOutput;

            const gistContentStyle: React.CSSProperties = {
              fontSize: '13px',
              lineHeight: 1.5,
              color: '#e2e8f0',
              whiteSpace: 'pre-wrap', 
              ...( !llm.isExpanded && { 
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxHeight: `calc(1.5 * 2 * 13px)`, 
              })
            };
            
            return (
              <div 
                key={llm.providerId} 
                className={`gist-card ${llm.isExpanded ? 'expanded' : ''}`}
                onClick={() => onToggleExpandGist(llm.providerId)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px', padding: '16px', cursor: 'pointer', transition: 'all 0.2s ease',
                  ...(llm.isExpanded && { background: 'rgba(255, 255, 255, 0.08)' })
              }}>
                <div className="gist-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  {provider && <div className={`model-logo ${provider.logoBgClass}`} style={{ width: '16px', height: '16px', borderRadius: '3px' }}></div>}
                  <div className="model-name" style={{ fontWeight: 500, fontSize: '12px', color: '#94a3b8' }}>
                    {provider?.name || llm.providerId}
                  </div>
                  <div className="status-indicator" style={{
                    marginLeft: 'auto', width: '8px', height: '8px', borderRadius: '50%',
                    background: isStreaming ? '#f59e0b' : '#10b981', 
                    ...(isStreaming && { animation: 'pulse 1.5s ease-in-out infinite' })
                  }}></div>
                </div>
                <div className="gist-content" style={gistContentStyle}>
                  {llm.firstSentenceSummary}
                  {llm.isStreamingSummary && !llm.firstSentenceSummary && "Generating summary..."}
                  <PulsingDot isStreaming={llm.isStreamingSummary && !!llm.firstSentenceSummary} />
                </div>
                {llm.isExpanded && (
                  <div className="gist-expanded" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                     <div className="gist-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <div className="model-name" style={{ fontWeight: 500, fontSize: '12px', color: '#94a3b8' }}>
                            Full Output
                        </div>
                        <ChevronUpIcon className="w-4 h-4" style={{color: '#94a3b8', marginLeft:'auto'}} />
                    </div>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap" style={{ fontSize: '13px', lineHeight: 1.5, color: '#cbd5e1', whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto' }}>
                      {llm.fullOutput}
                      {llm.isStreamingOutput && !llm.fullOutput && "Generating full output..."}
                      <PulsingDot isStreaming={llm.isStreamingOutput && !!llm.fullOutput} />
                    </p>
                  </div>
                )}
                 {!llm.isExpanded && (
                    <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '8px'}}>
                        <ChevronDownIcon className="w-4 h-4" style={{color: '#94a3b8'}} />
                    </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AIMessageBlock;