import React from 'react';
import { ChatSession } from '../types'; // It only needs to know what a ChatSession looks like.

interface HistoryPanelProps {
  isOpen: boolean;
  sessions: ChatSession[];
  isLoading: boolean;
  onNewChat: () => void;
  onSelectChat: (session: ChatSession) => void; // It passes the whole session object up.
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ isOpen, sessions, isLoading, onNewChat, onSelectChat }: HistoryPanelProps) => {
  // NO useEffect, NO useState, NO api calls in this file.

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    left: 0,
    top: 0,
    bottom: 0,
    width: isOpen ? '260px' : '0px',
    background: 'rgba(10, 10, 25, 0.9)',
    backdropFilter: 'blur(15px)',
    borderRight: isOpen ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
    color: '#e2e8f0',
    padding: isOpen ? '20px' : '0px',
    overflowY: 'auto',
    overflowX: 'hidden',
    transition: 'width 0.3s ease, padding 0.3s ease',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <div style={panelStyle}>
      {isOpen && (
        <>
          <button onClick={onNewChat} /* ...styles... */ >+ New Chat</button>
          <div className="history-items" style={{ flexGrow: 1, overflowY: 'auto' }}>
            {isLoading ? (
              <p>Loading history...</p>
            ) : sessions.length === 0 ? (
              <p>No chat history yet.</p>
            ) : (
              sessions.map((session: ChatSession) => (
                <div
                  key={session.id}
                  onClick={() => onSelectChat(session)} // Pass the whole, typed session object.
                  /* ...styles... */
                  title={session.title}
                >
                  {session.title}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default HistoryPanel;