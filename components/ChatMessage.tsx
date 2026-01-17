
import React from 'react';
import { Message } from '../types.ts';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex flex-col mb-6 ${isUser ? 'items-start' : 'items-end'} group w-full`}>
      <div className={`flex items-center space-x-2 mb-2 px-1 ${isUser ? 'flex-row' : 'flex-row-reverse space-x-reverse'}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${isUser ? 'bg-zinc-800' : 'bg-red-600 shadow-[0_0_5px_#ff0000] animate-pulse'}`}></div>
        <span className={`text-[9px] font-bold uppercase tracking-widest ${isUser ? 'text-zinc-700' : 'text-red-600'}`}>
          {isUser ? 'أنت (الضيف)' : 'WORM_GPT'}
        </span>
        <span className="text-[7px] text-zinc-800 px-2">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      
      <div className={`relative max-w-[90%] px-5 py-4 text-[12px] leading-relaxed break-words whitespace-pre-wrap transition-all shadow-xl rounded-2xl ${
        isUser 
          ? 'bg-zinc-950 text-zinc-500 border border-zinc-900/50 rounded-tr-none' 
          : 'bg-[#0a0000] text-red-500 border border-red-900/30 rounded-tl-none'
      }`}>
        {!isUser && (
          <>
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-red-600 rounded-tr-xl"></div>
          </>
        )}
        {message.content}
      </div>
      
      {!isUser && (
        <div className="mt-1 text-[7px] text-red-950 font-black opacity-40 tracking-[0.1em] uppercase pr-2">
          تشفير الحمولة: SEC_v10 // محقق
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
