import React, { useState } from 'react';

interface WalletViewProps {
  ethBalance: string;
  usdtBalance: string;
  flashUsdtBalance: string;
  ethPrice: string | null;
  walletAddress: string | null;
  networkName: string | null;
  walletType: 'METAMASK' | 'TRUST' | 'SIMULATED' | 'PHRASE' | 'UNKNOWN';
  flashQuota: string;
  gasReservoir: string;
  onSendClick: () => void;
  onForgeClick?: () => void;
  onConnectClick?: () => void;
  onSwitchNetwork?: () => void;
  onSyncGas?: () => Promise<any>;
  isConnecting?: boolean;
}

export default function WalletView({ 
  ethBalance, usdtBalance, flashUsdtBalance, ethPrice, walletAddress, networkName, 
  walletType, flashQuota, gasReservoir, onSendClick, onForgeClick, 
  onConnectClick, onSwitchNetwork, onSyncGas, isConnecting 
}: WalletViewProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [flashBtcBalance] = useState("2.4851"); 

  const ethVal = parseFloat(ethBalance || '0');
  const priceVal = parseFloat(ethPrice || '0');
  const usdtRealVal = parseFloat((usdtBalance || '0').replace(/,/g, ''));
  const usdtFlashVal = parseFloat((flashUsdtBalance || '0').replace(/,/g, ''));

  const totalValue = !isNaN(ethVal) && !isNaN(priceVal)
    ? (ethVal * priceVal + usdtRealVal + usdtFlashVal).toLocaleString(undefined, { minimumFractionDigits: 2 })
    : "0.00";

  const isMainnet = networkName?.toLowerCase() === 'mainnet' || 
                   networkName?.toLowerCase() === 'ethereum mainnet' || 
                   walletType === 'SIMULATED' || 
                   walletType === 'PHRASE';

  const handleSync = async () => {
    if (!onSyncGas) return;
    setIsSyncing(true);
    try { 
      await new Promise(r => setTimeout(r, 1200));
      await onSyncGas(); 
    } catch(e) {
      console.error("SYNC_ERROR", e);
    } finally { 
      setIsSyncing(false); 
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#020202] p-4 overflow-y-auto pb-32">
      {walletAddress && walletType !== 'SIMULATED' && walletType !== 'PHRASE' && !isMainnet && (
        <div className="mb-6 cyber-card border-yellow-600/50 p-4 rounded-2xl animate-pulse bg-yellow-950/10">
          <div className="flex items-center gap-3 mb-2">
            <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            <span className="font-black uppercase text-xs text-yellow-600">تحذير: شبكة غير متوافقة</span>
          </div>
          <p className="text-[10px] text-yellow-700 font-bold leading-tight mb-4">أنت متصل بشبكة {networkName?.toUpperCase()}. عمليات التحويل الحقيقية تتطلب Ethereum Mainnet.</p>
          <button onClick={onSwitchNetwork} className="w-full py-3 bg-yellow-600 text-black text-[10px] font-black uppercase rounded-xl active:scale-95 transition-all">تغيير الشبكة إلى MAINNET</button>
        </div>
      )}

      {walletType === 'PHRASE' && (
        <div className="mb-6 cyber-card border-green-600/50 p-4 rounded-2xl bg-green-950/10 border-dashed">
            <div className="flex items-center gap-3 mb-1">
                <span className="w-2 h-2 rounded-full bg-green-600 animate-ping"></span>
                <span className="font-black uppercase text-[10px] text-green-500 italic">ROOT_PHRASE_UPLINK // ACTIVE</span>
            </div>
            <p className="text-[8px] text-green-700 font-bold uppercase tracking-widest leading-relaxed">تم حقن العبارة السرية بنجاح. التحكم الجذري (God Mode) نشط الآن.</p>
        </div>
      )}

      <div className="mb-8 p-6 cyber-card btc-card rounded-[2.5rem] shadow-[0_0_50px_rgba(247,147,26,0.1)]">
        <div className="text-[10px] opacity-40 uppercase tracking-[0.4em] mb-2 font-black italic btc-text">القيمة الإجمالية المقدرة (USD)</div>
        <div className="text-4xl font-orbitron font-black text-[#f7931a] tracking-tighter drop-shadow-[0_0_15px_rgba(247,147,26,0.3)]">
          ${walletAddress ? totalValue : "---.--"}
        </div>
        <div className="mt-6 flex items-center justify-between">
           <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${walletAddress ? (isMainnet ? 'bg-green-600 shadow-[0_0_8px_#059669]' : 'bg-yellow-500') : 'bg-red-900'}`}></div>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60 italic">{walletAddress ? `${walletType} // ${networkName || 'Unknown'}` : 'بانتظار الربط...'}</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="p-5 cyber-card btc-card rounded-3xl bg-black/40">
          <div className="text-[8px] opacity-40 uppercase mb-2 font-black btc-text">حصة الفلاش المتاحة</div>
          <div className="text-2xl font-black text-[#f7931a] font-orbitron">${flashQuota}</div>
        </div>
        <div className="p-5 cyber-card border-red-900/40 rounded-3xl bg-black/40 flex justify-between items-center">
          <div>
            <div className="text-[8px] opacity-40 uppercase mb-2 font-black">احتياطي الغاز</div>
            <div className="text-2xl font-black text-red-500 font-orbitron">{gasReservoir} <span className="text-[10px]">ETH</span></div>
          </div>
          <button onClick={handleSync} disabled={isSyncing} className={`p-2.5 bg-red-600/10 rounded-full border border-red-600/30 active:scale-90 shadow-lg ${isSyncing ? 'animate-spin' : ''}`}>
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
      </div>

      {!walletAddress ? (
        <div className="flex flex-col gap-6 py-10">
          <button onClick={onConnectClick} disabled={isConnecting} className="w-full py-7 bg-[#f7931a] text-black font-black uppercase text-sm tracking-[0.4em] shadow-[0_0_40px_rgba(247,147,26,0.3)] rounded-[2rem] active:scale-95 transition-all border-4 border-black">
            {isConnecting ? "جاري المصادقة..." : "ربط الخزنة المركزية"}
          </button>
          <p className="text-center text-[10px] text-red-900 font-bold italic opacity-40">Bitcoin Flasher Core // WormGPT Uplink</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-[11px] font-black opacity-30 uppercase tracking-[0.5em] mb-4 border-b border-red-950/40 pb-3 italic text-right">الأصول والشبكات النشطة</div>
          
          <div className="cyber-card btc-card p-6 rounded-[2rem] flex items-center justify-between border-red-500/30 bg-red-950/5 group shadow-lg">
            <div className="flex items-center gap-4 text-right">
              <div className="w-14 h-14 bg-black border border-[#f7931a]/50 rounded-2xl flex items-center justify-center text-[#f7931a] shadow-[inset_0_0_100px_rgba(247,147,26,0.2)]">
                 <span className="text-2xl font-black">₿</span>
              </div>
              <div>
                <div className="text-sm font-black uppercase tracking-tighter text-[#f7931a]">Bitcoin (Flash)</div>
                <div className="text-[9px] opacity-40 font-bold">BITCOIN_NETWORK // SIM_TX</div>
              </div>
            </div>
            <div className="text-left">
              <div className="text-2xl font-black text-[#f7931a] font-orbitron">{flashBtcBalance}</div>
              <div className="text-[9px] opacity-20 font-black uppercase tracking-widest">BTC_ASSET</div>
            </div>
          </div>

          <div className="cyber-card p-6 rounded-[2rem] flex items-center justify-between border-red-500/30 bg-red-950/5 group shadow-lg">
            <div className="flex items-center gap-4 text-right">
              <div className="w-14 h-14 bg-black border border-red-600/50 rounded-2xl flex items-center justify-center text-red-600 shadow-[inset_0_0_10px_rgba(255,0,0,0.2)]">
                 <svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth={2.5} /></svg>
              </div>
              <div>
                <div className="text-sm font-black uppercase tracking-tighter text-red-500">Flash USDT</div>
                <div className="text-[9px] opacity-40 font-bold">ERC20/BEP20 // SIM_TX</div>
              </div>
            </div>
            <div className="text-left">
              <div className="text-2xl font-black text-red-500 font-orbitron">{flashUsdtBalance}</div>
              <div className="text-[9px] opacity-20 font-black uppercase tracking-widest">USDT_FLASH</div>
            </div>
          </div>

          {[
            { name: 'Ethereum', symbol: 'ETH', balance: ethVal.toFixed(4), price: ethPrice || '---', icon: 'M12 2L4.5 14.5L12 18.5L19.5 14.5L12 2Z' },
            { name: 'Real Tether', symbol: 'USDT', balance: usdtRealVal.toLocaleString(), price: '1.00', icon: 'M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z' }
          ].map(asset => (
            <div key={asset.symbol} className="cyber-card p-6 rounded-[2rem] flex items-center justify-between border-red-900/10 hover:bg-red-950/5 transition-all active:scale-[0.98]">
              <div className="flex items-center gap-4 text-right">
                <div className="w-14 h-14 bg-black border border-red-900/40 rounded-2xl flex items-center justify-center text-red-600 shadow-inner">
                   <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d={asset.icon} strokeWidth={2} /></svg>
                </div>
                <div>
                  <div className="text-sm font-black uppercase tracking-tighter">{asset.name}</div>
                  <div className="text-[9px] opacity-40 font-bold">${asset.price} REAL_MAINNET</div>
                </div>
              </div>
              <div className="text-left">
                <div className="text-2xl font-black text-red-500 font-orbitron">{asset.balance}</div>
                <div className="text-[9px] opacity-20 font-black uppercase tracking-widest">{asset.symbol}_UPLINK</div>
              </div>
            </div>
          ))}

          <div className="mt-10 cyber-card p-6 border-dashed border-[#f7931a]/40 rounded-[2.5rem] bg-red-950/5">
            <div className="text-[11px] font-black uppercase mb-4 flex items-center gap-3 btc-text">
              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth={3} /></svg>
              بوابة حقن الوقود (Mainnet Relay)
            </div>
            <div className="bg-black/90 p-5 border border-red-900/30 rounded-2xl flex justify-between items-center text-[11px] font-bold overflow-hidden cursor-pointer active:scale-[0.98] shadow-inner" onClick={() => { navigator.clipboard.writeText("0xD152f549545093347A162Dce210e7293f1452150"); }}>
              <span className="truncate pl-6 opacity-60">0xD152f549545093347A162Dce210e7293f1452150</span>
              <svg className="w-6 h-6 shrink-0 text-red-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" strokeWidth={2} /></svg>
            </div>
            <p className="mt-5 text-[10px] opacity-40 leading-relaxed font-bold uppercase text-center italic">أودع ETH حقيقي في هذا العنوان لمزامنة غاز المحرك. WormGPT يتطلب وقوداً للعمليات الحقيقية.</p>
          </div>
        </div>
      )}
    </div>
  );
}