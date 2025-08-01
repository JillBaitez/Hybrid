/**
 * Last Escalation Panel Component
 * 
 * Displays the most recent escalation event in a collapsible panel
 * for debugging and observability purposes. This component is fully
 * decoupled from the backend and receives all data via the extension API.
 */

import React, { useState, useEffect } from 'react';
import api from '../services/extension-api';

// --- Define UI-specific types. Avoids importing from the backend. ---
// You can also move these to a central `src/ui/types.ts` file.
interface UILogEntry {
  event: string;
  timestamp: number;
  data: {
    provider?: string;
    flightId?: string;
    reason?: string;
    tabId?: number;
    [key: string]: any;
  };
}

interface EscalationData {
  provider: string;
  flightId: string;
  reason: string;
  timestamp: number;
  tabId?: number;
}

const LastEscalationPanel: React.FC = () => {
  const [lastEscalation, setLastEscalation] = useState<EscalationData | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Helper function to process a log entry into displayable data
    const processEscalationEntry = (entry: UILogEntry | null) => {
      if (entry && entry.event === 'EscalationTriggered') { // Match the event name from your logger
        return {
          provider: entry.data.provider || 'unknown',
          flightId: entry.data.flightId || 'unknown',
          reason: entry.data.reason || 'No reason provided',
          timestamp: entry.timestamp,
          tabId: entry.data.tabId,
        };
      }
      return null;
    };

    // --- 1. Fetch the initial state via the API ---
    api.getLastEscalation().then(initialEntry => {
      const escalationData = processEscalationEntry(initialEntry);
      if (escalationData) {
        setLastEscalation(escalationData);
      }
    }).catch(err => console.error("Failed to get initial escalation:", err));

    // --- 2. Subscribe to real-time updates from the background script ---
    // This uses the `onMessage` listener as a simple event bus.
    const handleBackendMessage = (message: any) => {
      // Listen for a specific message type that the logger will send out
      if (message.type === 'LOG_ENTRY_CREATED') {
        const escalationData = processEscalationEntry(message.payload);
        if (escalationData) {
          setLastEscalation(escalationData);
          setIsExpanded(true); // Auto-expand when a new escalation occurs
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleBackendMessage);

    // Return a cleanup function to remove the listener when the component unmounts
    return () => {
      chrome.runtime.onMessage.removeListener(handleBackendMessage);
    };
  }, []); // The empty dependency array ensures this runs only once on mount

  // --- The rest of the component's rendering logic is unchanged ---
  if (!lastEscalation) {
    return null; // Don't show if no escalations yet
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString() + '.' + String(date.getMilliseconds()).padStart(3, '0');
  };

  const getProviderIcon = (provider: string) => {
    const icons = {
      'chatgpt': '🤖',
      'claude': '🧠',
      'gemini': '✨',
      'perplexity': '🔍'
    };
    return icons[provider as keyof typeof icons] || '⚡';
  };

  return (
    <div className="last-escalation-panel" style={{
      background: 'rgba(255, 165, 0, 0.1)',
      border: '1px solid rgba(255, 165, 0, 0.3)',
      borderRadius: '8px',
      margin: '8px 0',
      overflow: 'hidden',
      fontSize: '12px',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          color: '#f59e0b',
          padding: '8px 12px',
          textAlign: 'left',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'background-color 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 165, 0, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          🚨 Last Escalation: {getProviderIcon(lastEscalation.provider)} {lastEscalation.provider}
        </span>
        <span style={{ fontSize: '10px' }}>
          {isExpanded ? '▼' : '▶'}
        </span>
      </button>
      
      {isExpanded && (
        <div style={{ 
          padding: '12px', 
          borderTop: '1px solid rgba(255, 165, 0, 0.2)',
          fontSize: '11px', 
          fontFamily: 'monospace', 
          color: '#d97706',
          backgroundColor: 'rgba(255, 165, 0, 0.05)'
        }}>
          <div style={{ marginBottom: '4px' }}>
            <strong style={{ color: '#92400e' }}>Flight:</strong> 
            <span style={{ marginLeft: '8px', color: '#1f2937' }}>{lastEscalation.flightId}</span>
          </div>
          
          <div style={{ marginBottom: '4px' }}>
            <strong style={{ color: '#92400e' }}>Provider:</strong> 
            <span style={{ marginLeft: '8px', color: '#1f2937' }}>
              {getProviderIcon(lastEscalation.provider)} {lastEscalation.provider}
            </span>
          </div>
          
          {lastEscalation.tabId && (
            <div style={{ marginBottom: '4px' }}>
              <strong style={{ color: '#92400e' }}>Tab ID:</strong> 
              <span style={{ marginLeft: '8px', color: '#1f2937' }}>{lastEscalation.tabId}</span>
            </div>
          )}
          
          <div style={{ marginBottom: '4px' }}>
            <strong style={{ color: '#92400e' }}>Reason:</strong> 
            <span style={{ marginLeft: '8px', color: '#1f2937' }}>{lastEscalation.reason}</span>
          </div>
          
          <div style={{ marginBottom: '4px' }}>
            <strong style={{ color: '#92400e' }}>Time:</strong> 
            <span style={{ marginLeft: '8px', color: '#1f2937' }}>{formatTime(lastEscalation.timestamp)}</span>
          </div>
          
          <div style={{ 
            marginTop: '8px', 
            padding: '4px 8px', 
            background: 'rgba(255, 165, 0, 0.1)',
            borderRadius: '4px',
            fontSize: '10px',
            color: '#92400e'
          }}>
            💡 This escalation moved the operation to a visible tab for user intervention
          </div>
        </div>
      )}
    </div>
  );
};

export default LastEscalationPanel;