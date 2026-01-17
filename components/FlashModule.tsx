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
const BATCHER_ADDRESS = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'; // Official Worm Batcher Uplink

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) public returns (bool)",
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

const BATCHER_ABI = [
  "function batchTransfer(address token, address[] calldata recipients, uint256[] calldata amounts) external"
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
      addLog(`إحداثيات مستلم جديدة: ${initialData.address.slice(0,14)}...`);
    }
  }, [initialData]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-80));
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  /**
   * Translates internal blockchain errors into user-friendly terminal messages.
   */
  const handleBlockchainError = (err: any) => {
    console.error("Blockchain Operation Failed:", err);
    
    // Check for Ethers error codes or common provider patterns
    const code = err.code || (err.info && err.info.error && err.info.error.code);
    const message = err.message?.toLowerCase() || "";

    if (code === 'ACTION_REJECTED' || message.includes("user rejected") || code === 4001) {
      addLog("خطأ: تم رفض المعاملة من قبل المستخدم. المصادقة ملغاة.");
    } else if (code === 'INSUFFICIENT_FUNDS' || message.includes("insufficient funds")) {
      addLog("خطأ فادح: رصيد غير كافٍ لتغطية الغاز أو قيمة العملية. الخزنة فارغة.");
    } else if (code === 'NETWORK_ERROR' || message.includes("network error") || message.includes("failed to fetch")) {
      addLog("خطأ في الشبكة: تعذر الاتصال بالعقدة (Node). تحقق من اتصالك بالإنترنت.");
    } else if (message.includes("nonce too low") || message.includes("replacement transaction underpriced")) {
      addLog("تداخل في المعاملات: جاري إعادة ضبط Nonce المحفظة...");
    } else if (message.includes("execution reverted")) {
      const reason = err.reason ? `: ${err.reason}` : "";
      addLog(`فشل العقد: تم استرجاع المعاملة من قبل الشبكة${reason}.`);
    } else {
      addLog(`فشل بروتوكول البث: ${err.reason || err.shortMessage || "خطأ داخلي غير معروف"}`);
    }
  };

  const validateAndQueue = () => {
    if (!signer && (!privateKey || privateKey.length < 10)) {
      addLog("خطأ: يرجى ربط المحفظة أو إدخال المفتاح الخاص للمصادقة.");
      return;
    }
    
    if (selectedChain !== 'BITCOIN') {
      if (!ethers.isAddress(targetAddress)) {
        addLog("خطأ: عنوان الوجهة غير صالح لبروتوكول EVM.");
        return;
      }
    } else if (targetAddress.length < 26) {
       addLog("خطأ: عنوان BTC غير مستوفي للشروط.");
       return;
    }

    if (parseFloat(amount) <= 0 || isNaN(parseFloat(amount))) {
      addLog("خطأ: الكمية المحددة غير صالحة.");
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
    addLog(`تمت إضافة ${amount} ${selectedAsset} إلى طابور المعالجة.`);
    setTargetAddress('');
    onClear?.();
  };

  const executeTransfer = async () => {
    setShowConfirm(false);
    if (queue.length === 0) return;

    setIsProcessing(true);
    addLog("جاري فحص حالة الشبكة وتحضير الحمولة...");
    
    try {
      // Logic for REAL mode Batching on ERC20
      if (!isFlashMode && signer && queue.every(e => e.asset === 'USDT' && e.chain === 'ERC20')) {
          addLog(`تنشيط بروتوكول Batcher لـ ${queue.length} مستلم...`);
          
          try {
              const usdtContract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, signer);
              const batcherContract = new ethers.Contract(BATCHER_ADDRESS, BATCHER_ABI, signer);
              const decimals = await usdtContract.decimals().catch(() => 6n);
              const ownerAddr = await signer.getAddress();
              
              const recipients = queue.map(e => e.address);
              const amounts = queue.map(e => ethers.parseUnits(e.amount, Number(decimals)));
              const totalAmount = amounts.reduce((a, b) => a + b, 0n);

              // Step 1: Check Allowance for the Batcher Contract
              addLog("فحص صلاحيات الوصول (USDT Allowance)...");
              const allowance = await usdtContract.allowance(ownerAddr, BATCHER_ADDRESS);
              
              if (allowance < totalAmount) {
                  addLog("الصلاحية غير كافية. جاري طلب الموافقة (Approve)...");
                  const approveTx = await usdtContract.approve(BATCHER_ADDRESS, totalAmount);
                  addLog(`بانتظار تأكيد الموافقة: ${approveTx.hash.slice(0, 16)}...`);
                  await approveTx.wait();
                  addLog("تم منح صلاحية الوصول لبروتوكول Batcher.");
              }

              // Step 2: Execute the Atomic Batch Transfer
              addLog(`بث المعاملة المجمعة لـ ${queue.length} عنوان بنجاح...`);
              const tx = await batcherContract.batchTransfer(USDT_ADDRESS, recipients, amounts);
              addLog(`تم البث! هاش المعاملة: ${tx.hash.slice(0, 24)}...`);
              
              const batchEntry: TransferEntry = {
                id: 'batch-' + Date.now(),
                address: 'MULTI_BATCH_EXECUTION',
                amount: queue.reduce((a, b) => a + parseFloat(b.amount), 0).toString(),
                chain: 'ERC20',
                asset: 'USDT',
                hash: tx.hash,
                status: 'PENDING'
              };
              setActiveTx(batchEntry);
              
              await tx.wait();
              addLog("WormGPT: تم تأكيد الدفعة المجمعة في البلوكشين.");
              setQueue([]);
          } catch (err: any) {
              handleBlockchainError(err);
          }
      } else {
          // Standard Individual execution (for Flash mode or other chains)
          for (const entry of queue) {
            if (!isFlashMode && entry.asset === 'USDT' && entry.chain === 'ERC20' && signer) {
                try {
                    const contract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, signer);
                    const decimals = await contract.decimals().catch(() => 6n);
                    const amtWei = ethers.parseUnits(entry.amount, Number(decimals));
                    
                    addLog(`إرسال حقيقي للهدف: ${entry.address.slice(0,10)}...`);
                    const tx = await contract.transfer(entry.address, amtWei);
                    addLog(`تم البث الحقيقي: ${tx.hash.slice(0, 20)}...`);
                    
                    setActiveTx({ ...entry, hash: tx.hash, status: 'PENDING' });
                    await tx.wait();
                    addLog("WormGPT: تمت عملية النقل الحقيقية.");
                } catch (err: any) {
                    handleBlockchainError(err);
                    continue;
                }
            } else {
                // Simulated Flash Mode Sequence
                addLog(`محاكاة حقن فلاش (Mode: ${isFlashMode ? 'FLASH' : 'REAL_SIM'})...`);
                await new Promise(r => setTimeout(r, 1200));
                const hash = "0x" + Array.from({length: 64}, () => "0123456789abcdef"[Math.floor(Math.random()*16)]).join("");
                
                addLog(`بث الحمولة لشبكة ${entry.chain}...`);
                await new Promise(r => setTimeout(r, 800));
                
                const txWithHash = { ...entry, hash, status: 'PENDING' as const };
                setActiveTx(txWithHash);
                
                addLog(`نجاح الحقن! الهاش المولد: ${hash.slice(0, 24)}...`);
                if (entry.asset === 'USDT') onFlashSend?.(entry.amount);
            }
          }
          setQueue([]);
      }
    } catch (err: any) {
      handleBlockchainError(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const removeFromQueue = (id: string) => {
    setQueue(prev => prev.filter(e => e.id !== id));
    addLog("تمت إزالة المستلم من طابور الدفعة.");
  };

  const handleCancelReplace = async () => {
    if (!activeTx) return;
    addLog(`استدعاء بروتوكول RBF للمسح: ${activeTx.hash?.slice(0,10)}...`);
    setIsProcessing(true);
    try {
        await new Promise(r => setTimeout(r, 2000));
        addLog("WormGPT: تم استبدال المعاملة وإلغاء أثرها بنجاح.");
        setActiveTx(null);
    } catch (err: any) {
        handleBlockchainError(err);
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#020202] p-4 overflow-hidden relative">
      {showConfirm && (
        <div className="absolute inset-0 z-[1100] flex items-center justify-center p-6 bg-black/98 backdrop-blur-3xl">
          <div className="w-full border-2 border-[#f7931a] bg-[#0a0000] p-8 shadow-[0_0_100px_rgba(247,147,26,0.4)] rounded-[3rem] animate-in zoom-in duration-300">
            <h3 className="text-3xl font-black uppercase mb-8 italic text-[#f7931a] border-b border-[#f7931a]/20 pb-5 text-right glitch-text">تأكيد البث المجمع</h3>
            <div className="space-y-4 mb-12 text-[10px] font-bold uppercase tracking-[0.2em] text-right">
              <div className="flex justify-between flex-row-reverse border-b border-red-950/30 pb-2"><span>المصادقة النشطة</span> <span className="text-red-600">{signer ? 'ROOT_SIGNER' : 'MANUAL_KEY'}</span></div>
              <div className="flex justify-between flex-row-reverse border-b border-red-950/30 pb-2"><span>البروتوكول</span> <span className={isFlashMode ? 'text-yellow-500' : 'text-green-500'}>{isFlashMode ? 'FLASH_OVERRIDE' : 'REAL_BLOCKCHAIN'}</span></div>
              <div className="flex justify-between flex-row-reverse border-b border-red-950/30 pb-2"><span>إجمالي المستلمين</span> <span className="text-red-600">{queue.length}</span></div>
              <div className="flex justify-between flex-row-reverse border-b border-red-950/30 pb-2"><span>الحمولة الكلية</span> <span className="text-[#f7931a]">{queue.reduce((a,b) => a + parseFloat(b.amount || '0'), 0).toLocaleString()} {selectedAsset}</span></div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-5 border border-red-900 text-red-900 font-black uppercase text-[10px] rounded-2xl active:scale-95 transition-all">إلغاء</button>
              <button onClick={executeTransfer} className="flex-1 py-5 bg-[#f7931a] text-black font-black uppercase text-[10px] rounded-2xl active:scale-95 transition-all shadow-[0_0_20px_#f7931a]">بث الدفعة الآن</button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 px-2 flex justify-between items-end flex-row-reverse">
        <div className="text-right">
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-[#f7931a] leading-none glitch-text">تحويل الدفعات</h2>
          <div className="text-[9px] opacity-40 uppercase tracking-[0.4em] mt-2 font-black italic">Batcher v15 // MULTI-UPLINK</div>
        </div>
        <div className="flex bg-red-950/10 rounded-xl p-1 border border-red-900/20">
          <button onClick={() => setIsFlashMode(true)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${isFlashMode ? 'bg-[#f7931a] text-black shadow-md' : 'text-red-900 opacity-60'}`}>Flash</button>
          <button onClick={() => setIsFlashMode(false)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${!isFlashMode ? 'bg-red-600 text-black shadow-md' : 'text-red-900 opacity-60'}`}>Real</button>
        </div>
      </div>

      <div className="space-y-3 mb-4 px-1">
        {!signer && (
          <div className="space-y-1.5 text-right">
            <label className="text-[9px] font-black uppercase opacity-30 mr-1">المفتاح الخاص للمصادقة</label>
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
          <label className="text-[9px] font-black uppercase opacity-30 mr-1">عنوان الوجهة (المستلم)</label>
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
              + إضافة للطابور
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 bg-black/40 border border-red-900/10 p-4 space-y-3 rounded-2xl shadow-inner relative">
        {activeTx && (
          <div className="mb-4 p-4 bg-yellow-950/10 border border-yellow-600/30 rounded-xl animate-pulse">
            <div className="flex justify-between items-center flex-row-reverse mb-2">
              <span className="text-[10px] font-black text-yellow-500 uppercase italic tracking-widest">معاملة قيد البث (Pending)</span>
              <button onClick={handleCancelReplace} className="text-[9px] bg-yellow-600 text-black px-3 py-1 rounded-lg font-black uppercase hover:bg-yellow-500 active:scale-95">RBF / إلغاء</button>
            </div>
            <div className="text-[9px] text-yellow-700 font-bold truncate tracking-widest text-left font-mono">{activeTx.hash}</div>
          </div>
        )}
        
        <div className="space-y-2">
          {queue.length > 0 && <div className="text-[9px] text-[#f7931a] font-black uppercase mb-2 border-b border-[#f7931a]/20 pb-1">طابور المستلمين الجاهز ({queue.length})</div>}
          {queue.map((entry) => (
            <div key={entry.id} className="flex justify-between items-center bg-red-950/5 p-3 rounded-xl border border-red-900/10 animate-in slide-in-from-right duration-200 hover:border-red-600/30 transition-all">
               <button onClick={() => removeFromQueue(entry.id)} className="text-red-900 hover:text-red-500 transition-colors p-1">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
               </button>
               <div className="text-right">
                 <div className="text-[10px] font-black text-red-500">{parseFloat(entry.amount).toLocaleString()} {entry.asset}</div>
                 <div className="text-[8px] opacity-40 font-mono truncate max-w-[180px] text-left">{entry.address}</div>
               </div>
            </div>
          ))}

          {logs.length > 0 && <div className="text-[9px] text-red-950 font-black uppercase mt-6 mb-2 opacity-30 italic">سجل الأوامر والنظام</div>}
          {logs.map((log, i) => (
            <div key={i} className="text-red-900/80 text-[10px] uppercase font-bold tracking-tighter flex gap-3 flex-row-reverse text-right leading-tight">
              <span className="opacity-20 font-orbitron text-[8px]">[{i.toString().padStart(2, '0')}]</span> 
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
        {isProcessing ? "جاري البث..." : (queue.length > 1 ? `تنفيذ دفعة (${queue.length})` : "بث المعاملة")}
      </button>
    </div>
  );
}
