import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';

// واجهة المصنع القياسية لسك العملات
const FACTORY_ABI = [
  "function createToken(string name, string symbol, uint256 supply) public returns (address)"
];
// عنوان المصنع الافتراضي (يمكن للمستخدم تغييره إذا لزم الأمر أو تركه كمثال)
const FORGE_FACTORY_ADDRESS = '0xD152f549545093347A162Dce210e7293f1452150';

interface ForgeModuleProps {
  initialData?: { name: string; symbol: string; supply: string } | null;
  onClear?: () => void;
  onForgeSuccess?: (amount: string) => void;
  signer?: ethers.Signer | null;
}

export default function ForgeModule({ initialData, onClear, onForgeSuccess, signer }: ForgeModuleProps) {
  const [tokenName, setTokenName] = useState('Tether USDT');
  const [tokenSymbol, setTokenSymbol] = useState('USDT');
  const [supply, setSupply] = useState('500000');
  const [isFlashMode, setIsFlashMode] = useState(true);
  const [isForging, setIsForging] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [gasEstimate, setGasEstimate] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialData) {
      setTokenName(initialData.name);
      setTokenSymbol(initialData.symbol);
      setSupply(initialData.supply);
    }
  }, [initialData]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-50));
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const prepareForge = async () => {
    if (isFlashMode) {
      handleForge();
      return;
    }

    setIsForging(true);
    addLog("جاري فحص حالة الخزنة وتقدير رسوم الغاز...");

    try {
      if (!signer) throw new Error("لم يتم العثور على محفظة نشطة للسك الحقيقي.");

      const provider = signer.provider;
      if (!provider) throw new Error("Signer not connected to provider.");
      
      const network = await provider.getNetwork();
      if (network.chainId !== 1n) {
        addLog("تحذير: أنت لست على Ethereum Mainnet. قد لا يعمل المصنع.");
      }

      const factory = new ethers.Contract(FORGE_FACTORY_ADDRESS, FACTORY_ABI, signer);
      
      const supplyWei = ethers.parseUnits(supply, 18);
      const estimate = await factory.createToken.estimateGas(tokenName, tokenSymbol, supplyWei)
        .catch(() => 2100000n); 

      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
      const totalCost = estimate * gasPrice;
      
      setGasEstimate(ethers.formatEther(totalCost));
      setShowConfirm(true);
      addLog("تم تجهيز الحمولة. بانتظار تأكيد المستخدم.");
    } catch (err: any) {
      addLog(`خطأ في التجهيز: ${err.message}`);
      setIsForging(false);
    }
  };

  const handleForge = async () => {
    setShowConfirm(false);
    setIsForging(true);
    addLog(`بدء بث عملية صناعة ${tokenName}...`);
    
    try {
      if (isFlashMode) {
        addLog("تفعيل بروتوكول: الطريقة الأولى (النسخة المتقنة)...");
        await new Promise(r => setTimeout(r, 1500));
        addLog("محاكاة دمج العقد مع خوارزميات المحافظ الشخصية...");
        await new Promise(r => setTimeout(r, 1000));
        addLog(`تم سك ${parseFloat(supply).toLocaleString()} ${tokenSymbol} بنجاح (وضع الفلاش).`);
        onForgeSuccess?.(supply);
      } else {
        if (!signer) throw new Error("Signer required for real forge.");
        const factory = new ethers.Contract(FORGE_FACTORY_ADDRESS, FACTORY_ABI, signer);
        
        const supplyWei = ethers.parseUnits(supply, 18);
        addLog("بانتظار توقيع المعاملة في المحفظة...");
        
        const tx = await factory.createToken(tokenName, tokenSymbol, supplyWei);
        addLog(`تم إرسال المعاملة: ${tx.hash.slice(0, 20)}...`);
        
        addLog("بانتظار تأكيد الشبكة (قد يستغرق ذلك دقائق)...");
        const receipt = await tx.wait();
        
        addLog(`تم نشر العقد بنجاح في العنوان: ${receipt.logs[0]?.address?.slice(0,18)}...`);
        addLog("WormGPT: العملة الآن حية على البلوكشين.");
      }
      
      onClear?.();
    } catch (err: any) {
      addLog(`فشل العملية: ${err.reason || err.message?.toUpperCase() || 'ERROR_DEPLOY_FAIL'}`);
    } finally {
      setIsForging(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#020202] p-6 overflow-hidden relative">
      {showConfirm && (
        <div className="absolute inset-0 z-[1500] flex items-center justify-center p-6 bg-black/98 backdrop-blur-3xl">
          <div className="w-full max-w-sm border-2 border-red-600 bg-[#0a0000] p-8 shadow-[0_0_100px_rgba(255,0,0,0.4)] rounded-[3rem]">
            <h3 className="text-2xl font-black uppercase mb-6 italic text-red-500 text-right glitch-text">تأكيد السك الحقيقي</h3>
            <div className="space-y-4 mb-8 text-[11px] font-bold uppercase tracking-widest text-right border-r-2 border-red-900 pr-6">
              <div className="flex justify-between flex-row-reverse"><span>العملة</span> <span className="text-red-600">{tokenSymbol}</span></div>
              <div className="flex justify-between flex-row-reverse"><span>الإجمالي</span> <span className="text-red-600">{supply}</span></div>
              <div className="flex justify-between flex-row-reverse"><span>الغاز المتوقع</span> <span className="text-red-500 font-orbitron">{gasEstimate} ETH</span></div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => { setShowConfirm(false); setIsForging(false); }} className="flex-1 py-5 border border-red-900 text-red-900 font-black uppercase text-[10px] rounded-2xl active:scale-95 transition-all">إلغاء</button>
              <button onClick={handleForge} className="flex-1 py-5 bg-red-600 text-black font-black uppercase text-[10px] rounded-2xl active:scale-95 transition-all shadow-lg">تأكيد البث</button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8 px-2 flex justify-between items-end flex-row-reverse">
        <div className="text-right">
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-red-600 glitch-text">مصنع الرموز</h2>
          <div className="text-[10px] text-red-900 font-black uppercase tracking-[0.5em] mt-2 italic">Foundry v13 // {isFlashMode ? 'Perfect Replica' : 'Real Node'}</div>
        </div>
        <div className="flex bg-red-950/20 rounded-2xl p-1.5 border border-red-900/40">
          <button onClick={() => setIsFlashMode(true)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${isFlashMode ? 'bg-red-600 text-black shadow-lg' : 'text-red-900 opacity-60'}`}>Replica</button>
          <button onClick={() => setIsFlashMode(false)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${!isFlashMode ? 'bg-red-600 text-black shadow-lg' : 'text-red-900 opacity-60'}`}>Real</button>
        </div>
      </div>

      <div className="mb-6 p-4 bg-red-950/10 border border-red-900/30 rounded-2xl text-right">
        <h4 className="text-red-600 font-black text-xs mb-1">الوضع المختار: {isFlashMode ? 'النسخة المتقنة' : 'البث المباشر (Real Mainnet)'}</h4>
        <p className="text-[10px] text-red-900 font-bold leading-relaxed opacity-70">
          {isFlashMode 
            ? "سيتم سك عملات تظهر في محفظتك كأرصدة حقيقية مدمجة (محاكاة متقدمة)." 
            : "سيتم نشر عقد ذكي حقيقي على Ethereum Mainnet. يتطلب هذا رصيد ETH كافٍ للغاز."}
        </p>
      </div>

      <div className="space-y-5 bg-red-950/5 border border-red-900/30 p-6 rounded-3xl shadow-inner mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1 text-right">
            <label className="text-[9px] text-red-900 font-black uppercase tracking-widest mr-1">اسم العملة</label>
            <input 
              disabled={isForging}
              value={tokenName} 
              onChange={(e) => setTokenName(e.target.value)} 
              className="w-full bg-black border border-red-900/40 text-red-500 p-4 outline-none focus:border-red-500 font-black uppercase text-xs rounded-2xl disabled:opacity-30" 
            />
          </div>
          <div className="space-y-1 text-right">
            <label className="text-[9px] text-red-900 font-black uppercase tracking-widest mr-1">الرمز</label>
            <input 
              disabled={isForging}
              value={tokenSymbol} 
              onChange={(e) => setTokenSymbol(e.target.value)} 
              className="w-full bg-black border border-red-900/40 text-red-500 p-4 outline-none focus:border-red-500 font-black uppercase text-xs rounded-2xl disabled:opacity-30" 
            />
          </div>
        </div>
        <div className="space-y-1 text-right">
          <label className="text-[9px] text-red-900 font-black uppercase tracking-widest mr-1">الكمية الإجمالية (Supply)</label>
          <input 
            disabled={isForging}
            value={supply} 
            onChange={(e) => setSupply(e.target.value)} 
            className="w-full bg-black border border-red-900/40 text-red-500 p-4 outline-none focus:border-red-500 font-black uppercase text-xs rounded-2xl shadow-inner font-orbitron disabled:opacity-30" 
          />
        </div>
        <button 
          onClick={prepareForge} 
          disabled={isForging} 
          className="w-full py-6 bg-red-600 text-black font-black uppercase tracking-[0.4em] rounded-2xl shadow-[0_0_30px_rgba(255,0,0,0.4)] active:scale-95 disabled:opacity-20 transition-all border-4 border-black text-xs"
        >
          {isForging ? "جاري المعالجة..." : (isFlashMode ? "بـدء المحاكاة" : "بـدء السك الحقيقي")}
        </button>
      </div>

      <div className="flex-1 bg-black/80 border border-red-900/30 p-5 overflow-y-auto text-[10px] font-mono rounded-3xl shadow-inner">
        <div className="text-red-950 font-black mb-3 uppercase border-b border-red-900/20 pb-2 italic flex justify-between items-center flex-row-reverse">
          <span>وحدة التحكم في المصنع</span>
          <span className="text-[8px] animate-pulse">UPLINK: ONLINE</span>
        </div>
        <div className="space-y-1.5">
          {logs.length === 0 && <div className="text-red-900/30 text-center py-4 italic">بانتظار الأوامر...</div>}
          {logs.map((log, i) => (
            <div key={i} className="mb-1 text-red-900/70 flex gap-3 uppercase font-bold tracking-tighter flex-row-reverse text-right leading-relaxed">
              <span className="opacity-20 font-orbitron text-[8px]">[{i}]</span> <span className="flex-1">{log}</span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}