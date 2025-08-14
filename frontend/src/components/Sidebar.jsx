import React, { useState } from 'react';
import { 
  Search, 
  RefreshCw, 
  Satellite, 
  MessageCircle, 
  Send, 
  AlertCircle,
  Globe,
  Activity
} from 'lucide-react';

const Sidebar = ({
  satellites,
  selectedSatellite,
  onSatelliteSelect,
  searchTerm,
  onSearchChange,
  onRefresh,
  loading,
  error,
  chatMessages,
  onSendMessage,
  chatLoading,
  totalSatellites
}) => {
  const [chatInput, setChatInput] = useState('');
  const [activeTab, setActiveTab] = useState('satellites'); // 'satellites' or 'chat'

  const handleSendMessage = () => {
    if (chatInput.trim()) {
      // Send message to parent component
      onSendMessage(chatInput);
      setChatInput('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold text-white flex items-center">
          <Satellite className="mr-2 text-satellite-orange" size={24} />
          SAT-LM
        </h1>
        <p className="text-sm text-gray-400 mt-1">Satellite Tracking + AI Assistant</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('satellites')}
          className={`flex-1 p-3 text-sm font-medium flex items-center justify-center space-x-2 ${
            activeTab === 'satellites'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <Globe size={16} />
          <span>Satellites</span>
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 p-3 text-sm font-medium flex items-center justify-center space-x-2 ${
            activeTab === 'chat'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <MessageCircle size={16} />
          <span>AI Chat</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'satellites' ? (
          // Satellites Tab
          <>
            {/* Search and Controls */}
            <div className="p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search satellites..."
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
              </div>
              
              <button
                onClick={onRefresh}
                disabled={loading}
                className="w-full flex items-center justify-center space-x-2 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
              >
                <RefreshCw className={`${loading ? 'animate-spin' : ''}`} size={16} />
                <span>{loading ? 'Refreshing...' : 'Refresh Satellites'}</span>
              </button>

              {/* Status */}
              <div className="text-xs text-gray-400 flex items-center space-x-4">
                <span className="flex items-center">
                  <Activity size={12} className="mr-1" />
                  {satellites.length} visible
                </span>
                <span>Total: {totalSatellites}</span>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mx-4 p-3 bg-red-900 border border-red-700 rounded-lg flex items-start space-x-2">
                <AlertCircle className="text-red-400 mt-0.5" size={16} />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {/* Satellites List */}
            <div className="flex-1 overflow-y-auto">
              {satellites.length === 0 && !loading ? (
                <div className="p-4 text-center text-gray-400">
                  <Satellite size={48} className="mx-auto mb-2 opacity-50" />
                  <p>No satellites found</p>
                  {searchTerm && <p className="text-xs mt-1">Try a different search term</p>}
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {satellites.map((satellite, index) => (
                    <div
                      key={`${satellite.name}-${index}`}
                      onClick={() => onSatelliteSelect(satellite)}
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        selectedSatellite?.name === satellite.name
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate text-sm">{satellite.name}</h3>
                          <div className="text-xs opacity-75 mt-1 space-y-0.5">
                            <p>Lat: {satellite.lat.toFixed(2)}°, Lon: {satellite.lon.toFixed(2)}°</p>
                            <p>Alt: {satellite.alt.toFixed(0)} km</p>
                          </div>
                        </div>
                        <div className="ml-2">
                          <div className="w-2 h-2 bg-satellite-orange rounded-full"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          // Chat Tab
          <>
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 ? (
                <div className="text-center text-gray-400">
                  <MessageCircle size={48} className="mx-auto mb-2 opacity-50" />
                  <p>Start a conversation!</p>
                  <p className="text-xs mt-1">Ask about satellites, orbits, or space</p>
                </div>
              ) : (
                chatMessages.map((message) => (
                  <div key={message.id} className="chat-message">
                    <div
                      className={`p-3 rounded-lg ${
                        message.type === 'user'
                          ? 'bg-blue-600 text-white ml-8'
                          : message.type === 'error'
                          ? 'bg-red-900 text-red-300 mr-8'
                          : 'bg-gray-800 text-gray-200 mr-8'
                      }`}
                    >
                      <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                      <div className="text-xs opacity-60 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
              
              {chatLoading && (
                <div className="flex items-center space-x-2 text-gray-400">
                  <div className="spinner"></div>
                  <span className="text-sm">AI is thinking...</span>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t border-gray-700">
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Ask about satellites..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  disabled={chatLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={chatLoading || !chatInput.trim()}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  <Send size={16} />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Powered by Ollama • Press Enter to send
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Sidebar;