import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';

interface TransferEntry {
  id: string;
  address: string;
  amount: string;
  chain: string;
  asset: 'USDT' | 'BTC';
  hash?: string;
  status: 'PENDING' | 'CONFIRMED' | 'REPLACED';
}

interface FlashModuleProps {
  initialData?: { address: string; amount: string } | null;
  onClear?: () => void;
  userUsdtBalance?: string;
  userFlashBalance?: string;
  userEthBalance?: string;
  onFlashSend?: (amount: string) => void;
  signer?: ethers.Signer | null;
}

const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) public returns (bool)",
  "function decimals() view returns (uint8)"
];

export default function FlashModule({ 
  initialData, 
  onClear, 
  userUsdtBalance = '0.00', 
  userFlashBalance = '0.00', 
  userEthBalance = '0.00',
  onFlashSend,
  signer
}: FlashModuleProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [targetAddress, setTargetAddress] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [amount, setAmount] = useState('1000');
  const [isFlashMode, setIsFlashMode] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<'USDT' | 'BTC'>('USDT');
  const [selectedChain, setSelectedChain] = useState('ERC20');
  const [queue, setQueue] = useState<TransferEntry[]>([]);
  const [activeTx, setActiveTx] = useState<TransferEntry | null>(null);
  
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialData) {
      setTargetAddress(initialData.address);
      setAmount(initialData.amount);
      addLog(`نظام التتبع: تم استقبال إحداثيات الهدف -> ${initialData.address.slice(0,14)}...`);
    }
  }, [initialData]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-80));
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const validateAndQueue = () => {
    // If we have a signer, we don't strictly need a manual private key, but for elite feel we keep it optional or hidden.
    if (!signer && (!privateKey || privateKey.length < 10)) {
      addLog("خطأ: يرجى إدخال المفتاح الخاص للمصادقة السلطوية أو ربط محفظة حقيقية.");
      return;
    }
    
    if (selectedChain !== 'BITCOIN') {
      if (!ethers.isAddress(targetAddress)) {
        addLog("خطأ فادح: عنوان الوجهة غير صالح لشبكات EVM.");
        return;
      }
    } else if (targetAddress.length < 26) {
       addLog("خطأ فادح: عنوان BTC غير صالح.");
       return;
    }

    if (parseFloat(amount) <= 0 || isNaN(parseFloat(amount))) {
      addLog("خطأ: الكمية غير صالحة.");
      return;
    }

    const newEntry: TransferEntry = {
      id: Math.random().toString(36).substr(2, 9),
      address: targetAddress,
      amount: amount,
      chain: selectedChain,
      asset: selectedAsset,
      status: 'PENDING'
    };

    setQueue(prev => [...prev, newEntry]);
    addLog(`تم التحقق: ${amount} ${selectedAsset} مضافة للطابور.`);
    setTargetAddress('');
    onClear?.();
  };

  const executeTransfer = async () => {
    setShowConfirm(false);
    if (queue.length === 0) return;

    setIsProcessing(true);
    addLog("جاري بناء هيكل المعاملة (Building Transaction Body)...");
    
    try {
      for (const entry of queue) {
        if (!isFlashMode && entry.asset === 'USDT' && entry.chain === 'ERC20' && signer) {
            addLog("محاولة تحويل حقيقي عبر الشبكة الرئيسية (Real Mainnet Protocol)...");
            try {
                const contract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, signer);
                const decimals = await contract.decimals().catch(() => 6n);
                const amtWei = ethers.parseUnits(entry.amount, Number(decimals));
                
                addLog(`بث المعاملة للهدف: ${entry.address}...`);
                const tx = await contract.transfer(entry.address, amtWei);
                addLog(`تم البث! الهاش: ${tx.hash.slice(0, 20)}...`);
                
                setActiveTx({ ...entry, hash: tx.hash, status: 'PENDING' });
                await tx.wait();
                addLog("WormGPT: تم تأكيد المعاملة في البلوكشين.");
            } catch (err: any) {
                addLog(`خطأ فادح في البروتوكول الحقيقي: ${err.message || 'NET_ERR'}`);
                continue;
            }
        } else {
            // Simulated/Flash logic
            await new Promise(r => setTimeout(r, 1500));
            const hash = "0x" + Array.from({length: 64}, () => "0123456789abcdef"[Math.floor(Math.random()*16)]).join("");
            
            addLog(`بث المعاملة الوهمية (Uplink: ${entry.chain})...`);
            await new Promise(r => setTimeout(r, 1000));
            
            const txWithHash = { ...entry, hash, status: 'PENDING' as const };
            setActiveTx(txWithHash);
            
            addLog(`نجاح البث الوهمي! الهاش: ${hash.slice(0, 24)}...`);
            if (entry.asset === 'USDT') onFlashSend?.(entry.amount);
        }
      }
      setQueue([]);
    } catch (err: any) {
      addLog(`خطأ فادح في البث: ${err.message || 'NET_ERR_UPLINK'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelReplace = async () => {
    if (!activeTx) return;
    addLog(`محاولة استبدال المعاملة ${activeTx.hash?.slice(0,10)}... (RBF Active)`);
    setIsProcessing(true);
    await new Promise(r => setTimeout(r, 1500));
    addLog("WormGPT: تم استبدال المعاملة بحمولة فارغة بنجاح.");
    setActiveTx(null);
    setIsProcessing(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#020202] p-4 overflow-hidden relative">
      {showConfirm && (
        <div className="absolute inset-0 z-[1100] flex items-center justify-center p-6 bg-black/98 backdrop-blur-3xl">
          <div className="w-full border-2 border-[#f7931a] bg-[#0a0000] p-8 shadow-[0_0_100px_rgba(247,147,26,0.4)] rounded-[3rem]">
            <h3 className="text-3xl font-black uppercase mb-8 italic text-[#f7931a] border-b border-[#f7931a]/20 pb-5 text-right glitch-text">تأكيد البث</h3>
            <div className="space-y-4 mb-12 text-[10px] font-bold uppercase tracking-[0.2em] text-right">
              <div className="flex justify-between flex-row-reverse border-b border-red-950/30 pb-2"><span>المفتاح</span> <span className="text-red-600">{signer ? 'ACTIVE_SIGNER' : 'ENCRYPTED'}</span></div>
              <div className="flex justify-between flex-row-reverse border-b border-red-950/30 pb-2"><span>الوضع</span> <span className={isFlashMode ? 'text-yellow-500' : 'text-green-500'}>{isFlashMode ? 'FLASH_PROTOCOL' : 'REAL_UPLINK'}</span></div>
              <div className="flex justify-between flex-row-reverse border-b border-red-950/30 pb-2"><span>العملة</span> <span className="text-[#f7931a]">{selectedAsset}</span></div>
              <div className="flex justify-between flex-row-reverse border-b border-red-950/30 pb-2"><span>الكمية</span> <span className="text-[#f7931a]">{queue.reduce((a,b) => a + parseFloat(b.amount || '0'), 0).toLocaleString()}</span></div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-5 border border-red-900 text-red-900 font-black uppercase text-[10px] rounded-2xl active:scale-95 transition-all">رجوع</button>
              <button onClick={executeTransfer} className="flex-1 py-5 bg-[#f7931a] text-black font-black uppercase text-[10px] rounded-2xl active:scale-95 transition-all shadow-lg">بث الآن</button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 px-2 flex justify-between items-end flex-row-reverse">
        <div className="text-right">
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-[#f7931a] leading-none glitch-text">BITCOIN_FLASHER</h2>
          <div className="text-[9px] opacity-40 uppercase tracking-[0.4em] mt-2 font-black italic">Graph Protocol v12 // ELITE</div>
        </div>
        <div className="flex bg-red-950/10 rounded-xl p-1 border border-red-900/20">
          <button onClick={() => setIsFlashMode(true)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${isFlashMode ? 'bg-[#f7931a] text-black shadow-md' : 'text-red-900 opacity-60'}`}>Flash</button>
          <button onClick={() => setIsFlashMode(false)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${!isFlashMode ? 'bg-red-600 text-black shadow-md' : 'text-red-900 opacity-60'}`}>Real</button>
        </div>
      </div>

      <div className="space-y-3 mb-4 px-1">
        {!signer && (
            <div className="space-y-1.5 text-right">
              <label className="text-[9px] font-black uppercase opacity-30 mr-1">المفتاح الخاص (Private Key)</label>
              <input 
                type="password"
                value={privateKey} 
                onChange={(e) => setPrivateKey(e.target.value)} 
                className="w-full bg-[#050000] border border-red-900/20 p-4 text-xs focus:border-[#f7931a] outline-none transition-all font-bold rounded-xl shadow-inner text-left tracking-widest" 
                placeholder="••••••••••••••••••••••••••••••••" 
              />
            </div>
        )}

        <div className="grid grid-cols-2 gap-2">
           <select 
             value={selectedAsset} 
             onChange={(e) => {
               const val = e.target.value as any;
               setSelectedAsset(val);
               if (val === 'BTC') setSelectedChain('BITCOIN');
               else setSelectedChain('ERC20');
             }}
             className="bg-[#050000] border border-red-900/20 p-4 text-[10px] font-black uppercase text-red-500 rounded-xl outline-none focus:border-[#f7931a]"
           >
             <option value="USDT">USDT (Tether)</option>
             <option value="BTC">BTC (Bitcoin)</option>
           </select>
           <select 
             value={selectedChain} 
             onChange={(e) => setSelectedChain(e.target.value)}
             className="bg-[#050000] border border-red-900/20 p-4 text-[10px] font-black uppercase text-red-500 rounded-xl outline-none focus:border-[#f7931a]"
           >
             {selectedAsset === 'BTC' ? (
                <option value="BITCOIN">BITCOIN_NETWORK</option>
             ) : (
                <>
                  <option value="ERC20">ERC20 (Mainnet)</option>
                  <option value="BEP20">BEP20 (BSC)</option>
                  <option value="TRC20">TRC20 (Tron)</option>
                  <option value="SOLANA">SOLANA_CORE</option>
                </>
             )}
           </select>
        </div>
        
        <div className="space-y-1.5 text-right">
          <label className="text-[9px] font-black uppercase opacity-30 mr-1">عنوان الوجهة</label>
          <input 
            value={targetAddress} 
            onChange={(e) => setTargetAddress(e.target.value)} 
            className="w-full bg-[#050000] border border-red-900/20 p-4 text-xs focus:border-[#f7931a] outline-none transition-all font-bold rounded-xl shadow-inner text-left tracking-widest" 
            placeholder="Recipient Address..." 
          />
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5 text-right">
            <label className="text-[9px] font-black uppercase opacity-30 mr-1">الكمية</label>
            <input 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)} 
              className="w-full bg-[#050000] border border-red-900/20 p-4 text-xs font-orbitron focus:border-[#f7931a] outline-none transition-all font-bold rounded-xl shadow-inner text-left" 
            />
          </div>
          <div className="flex items-end">
            <button 
              onClick={validateAndQueue}
              className="w-full h-[48px] bg-[#f7931a]/5 border border-dashed border-[#f7931a]/20 text-[#f7931a] font-black uppercase text-[10px] rounded-xl hover:border-[#f7931a] transition-all"
            >
              + إضافة للمعالجة
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 bg-black/40 border border-red-900/10 p-4 space-y-2 rounded-2xl shadow-inner">
        {activeTx && (
          <div className="mb-4 p-4 bg-yellow-950/10 border border-yellow-600/30 rounded-xl animate-pulse">
            <div className="flex justify-between items-center flex-row-reverse mb-2">
              <span className="text-[10px] font-black text-yellow-500 uppercase italic tracking-widest">معاملة معلقة (Pending)</span>
              <button onClick={handleCancelReplace} className="text-[9px] bg-yellow-600 text-black px-3 py-1 rounded-lg font-black uppercase hover:bg-yellow-500 active:scale-95">إلغاء / استبدال (Cancel)</button>
            </div>
            <div className="text-[9px] text-yellow-700 font-bold truncate tracking-widest text-left">{activeTx.hash}</div>
          </div>
        )}
        <div className="space-y-1.5">
          {queue.length > 0 && <div className="text-[9px] text-[#f7931a] font-black uppercase mb-2">العمليات المنتظرة ({queue.length}):</div>}
          {logs.map((log, i) => (
            <div key={i} className="text-red-900/80 text-[10px] uppercase font-bold tracking-tighter flex gap-3 flex-row-reverse text-right leading-tight">
              <span className="opacity-20 font-orbitron text-[8px]">[{i}]</span> 
              <span className="flex-1">{log}</span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>

      <button 
        onClick={() => setShowConfirm(true)}
        disabled={isProcessing || queue.length === 0}
        className="w-full py-6 bg-[#f7931a] text-black font-black uppercase text-xs tracking-[0.5em] shadow-[0_0_40px_rgba(247,147,26,0.2)] disabled:opacity-10 rounded-2xl active:scale-95 transition-all border-4 border-black"
      >
        {isProcessing ? "جاري البث..." : "تـنفيذ البروتوكول"}
      </button>
    </div>
  );
}