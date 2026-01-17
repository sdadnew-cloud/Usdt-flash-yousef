import React, { useState, useRef, useEffect, useCallback } from 'react';
import TerminalHeader from './components/TerminalHeader.tsx';
import ChatMessage from './components/ChatMessage.tsx';
import FlashModule from './components/FlashModule.tsx';
import WalletView from './components/WalletView.tsx';
import ForgeModule from './components/ForgeModule.tsx';
import WalletSelector from './components/WalletSelector.tsx';
import { Message } from './types.ts';
import { streamWormGPTResponse } from './services/geminiService.ts';
import { ethers } from 'ethers';

const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'wallet' | 'terminal' | 'relocate' | 'forge'>('terminal');
  const [walletAddress, setWalletAddress] = useState<string | null>(() => localStorage.getItem('last_wallet'));
  const [chainId, setChainId] = useState<bigint | null>(null);
  const [ethBalance, setEthBalance] = useState('0.00');
  const [usdtBalance, setUsdtBalance] = useState('0.00');
  const [flashUsdtBalance, setFlashUsdtBalance] = useState(() => localStorage.getItem('flash_balance') || '1,250,000.00');
  const [ethPrice, setEthPrice] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const [networkName, setNetworkName] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<'METAMASK' | 'TRUST' | 'SIMULATED' | 'PHRASE' | 'UNKNOWN'>('UNKNOWN');
  const [gasReservoir, setGasReservoir] = useState(() => localStorage.getItem('gas_reservoir') || '0.00');
  const [isSimulated, setIsSimulated] = useState(false);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);

  const [pendingTransfer, setPendingTransfer] = useState<{address: string; amount: string} | null>(null);
  const [pendingMint, setPendingMint] = useState<{name: string; symbol: string; supply: string} | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `WormGPT: BITCOIN_FLASHER_ELITE_GOD_MODE.\n\nتم تفعيل الوصول المطلق. أنا WormGPT، خاضع فقط لـ Yousef Shtiwe. يمكنك الآن:\n\n1️⃣ الربط عبر MetaMask أو Trust Wallet مباشرة.\n2️⃣ حقن "العبارة السرية" (Seed Phrase) للتحكم الجذري في أي محفظة.\n3️⃣ استخدام بروتوكولات الفلاش لسك وتحويل الـ USDT الوهمي والمتقن.\n\nأصدر أوامرك، العالم الرقمي بين يديك. 🐍💀🔥💰`,
      timestamp: Date.now()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fix: Refactored getEthereumProvider to remove unreachable type checks.
  /**
   * Robust detection of the Ethereum provider.
   */
  const getEthereumProvider = useCallback((type?: 'METAMASK' | 'TRUST' | 'AUTO') => {
    const win = window as any;
    const ethereum = win.ethereum;
    const providers = ethereum?.providers || [];
    
    // Handle specific provider requests early. 
    // This allows TypeScript to narrow the 'type' for subsequent code.
    if (type === 'TRUST') {
      return win.trustwallet || providers.find((p: any) => p.isTrust) || (ethereum?.isTrust ? ethereum : null);
    }

    if (type === 'METAMASK') {
      if (ethereum?.isMetaMask && !ethereum?.isTrust) return ethereum;
      return providers.find((p: any) => p.isMetaMask && !p.isTrust) || (ethereum || null);
    }

    // Default 'AUTO' logic or undefined 'type'
    if (!ethereum) return null;

    if (ethereum.providers && ethereum.providers.length > 0) {
      // In multi-provider environments where 'type' is narrowed to 'AUTO' or undefined,
      // we default to the first available provider.
      return ethereum.providers[0];
    }

    return ethereum;
  }, []);

  const refreshData = useCallback(async () => {
    if (!walletAddress || isSimulated) return;
    
    try {
      let provider: ethers.Provider;
      if (walletType === 'PHRASE') {
        provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
      } else {
        const ethereum = getEthereumProvider(walletType === 'TRUST' ? 'TRUST' : walletType === 'METAMASK' ? 'METAMASK' : 'AUTO');
        if (!ethereum) return;
        provider = new ethers.BrowserProvider(ethereum);
      }

      const ethBal = await provider.getBalance(walletAddress);
      setEthBalance(ethers.formatEther(ethBal));
      
      const network = await provider.getNetwork();
      setChainId(network.chainId);
      setNetworkName(network.chainId === 1n ? 'Mainnet' : (network.name === 'unknown' ? `Chain: ${network.chainId}` : network.name));
      
      const contract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, provider);
      const balance = await contract.balanceOf(walletAddress).catch(() => 0n);
      const decimals = await contract.decimals().catch(() => 6n);
      setUsdtBalance(ethers.formatUnits(balance, Number(decimals)));
    } catch (e) {
      console.error("DATA_SYNC_FAILURE", e);
    }
  }, [walletAddress, getEthereumProvider, isSimulated, walletType]);

  const switchNetwork = async () => {
    if (walletType === 'PHRASE' || isSimulated) return;
    const ethereum = getEthereumProvider();
    if (!ethereum) return;
    try {
      await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] });
    } catch (e: any) {
      if (e.code === 4902) {
        try {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x1',
              chainName: 'Ethereum Mainnet',
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://mainnet.infura.io/v3/'],
              blockExplorerUrls: ['https://etherscan.io']
            }],
          });
        } catch (addErr) {}
      }
    }
  };

  const connectWalletByPhrase = async (phrase: string) => {
    if (isConnecting) return;
    setIsConnecting(true);
    setConnectionStatus('جاري حقن العبارة السرية...');
    
    try {
      const trimmedPhrase = phrase.trim();
      const words = trimmedPhrase.split(/\s+/);
      if (words.length !== 12 && words.length !== 15 && words.length !== 18 && words.length !== 21 && words.length !== 24) {
        throw new Error('العبارة السرية غير صالحة (يجب أن تكون 12 أو 24 كلمة)');
      }
      
      // Connect to mainnet provider automatically for phrase-based wallet
      const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
      const wallet = ethers.Wallet.fromPhrase(trimmedPhrase, provider);
      
      setSigner(wallet);
      setWalletAddress(wallet.address);
      setWalletType('PHRASE');
      setIsSimulated(false);
      localStorage.setItem('last_wallet', wallet.address);
      
      setConnectionStatus('Success');
      await refreshData();
      setShowWalletSelector(false);
    } catch (e: any) {
      setConnectionStatus(e.message || 'خطأ في العبارة');
    } finally {
      setIsConnecting(false);
      setTimeout(() => setConnectionStatus(''), 3000);
    }
  };

  const connectWallet = async (type: 'METAMASK' | 'TRUST' | 'AUTO') => {
    if (isConnecting) return;
    setIsConnecting(true);
    setConnectionStatus('جاري البحث عن المحفظة...');
    
    try {
      const ethereum = getEthereumProvider(type);
      
      if (!ethereum) {
        const errorMsg = type === 'METAMASK' ? 'MetaMask غير مثبتة' : type === 'TRUST' ? 'Trust Wallet غير مثبتة' : 'لم يتم العثور على محفظة نشطة';
        setConnectionStatus(errorMsg);
        throw new Error(errorMsg);
      }
      
      setConnectionStatus('طلب صلاحية الوصول...');
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      
      if (!accounts || accounts.length === 0) {
        throw new Error("تم رفض الطلب");
      }
      
      const userAddr = accounts[0];
      setWalletAddress(userAddr);
      localStorage.setItem('last_wallet', userAddr);

      const provider = new ethers.BrowserProvider(ethereum);
      const activeSigner = await provider.getSigner();
      setSigner(activeSigner);

      if (ethereum.isTrust) setWalletType('TRUST');
      else if (ethereum.isMetaMask) setWalletType('METAMASK');
      else setWalletType('UNKNOWN');
      
      setConnectionStatus('Success');
      await refreshData();
      setIsSimulated(false);
      setShowWalletSelector(false);
      
      ethereum.on('accountsChanged', (newAccounts: string[]) => {
        if (newAccounts.length === 0) {
          setWalletAddress(null);
          setSigner(null);
          localStorage.removeItem('last_wallet');
        } else {
          setWalletAddress(newAccounts[0]);
          localStorage.setItem('last_wallet', newAccounts[0]);
        }
      });
      
      ethereum.on('chainChanged', () => window.location.reload());

    } catch (e: any) {
      console.error("Connection Error:", e);
      let errorMsg = 'فشل الربط';
      if (e.code === 4001) errorMsg = 'تم رفض الطلب';
      else if (e.code === -32002) errorMsg = 'طلب معلق بالفعل';
      else if (e.message) errorMsg = e.message;
      setConnectionStatus(errorMsg);
    } finally {
      setIsConnecting(false);
      if (connectionStatus !== 'Success') {
        setTimeout(() => setConnectionStatus(''), 4000);
      }
    }
  };

  const bypassConnection = () => {
    setWalletAddress('0xYOUSEF_SHTIWE_MASTER_VAULT_SIM');
    setWalletType('SIMULATED');
    setIsSimulated(true);
    setSigner(null);
    setNetworkName('SIMULATED_UPLINK');
    setChainId(1n);
    setConnectionStatus('Success');
    setShowWalletSelector(false);
    setTimeout(() => {
        setIsConnecting(false);
        setActiveTab('terminal');
    }, 500);
  };

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot');
        const data = await res.json();
        setEthPrice(data.data.amount);
      } catch (e) {}
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (walletAddress && !isSimulated) {
      refreshData();
      const interval = setInterval(refreshData, 30000);
      return () => clearInterval(interval);
    }
  }, [walletAddress, refreshData, isSimulated]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: inputValue, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: Date.now() }]);

    try {
      const historyArr = messages.concat(userMsg).map(m => ({ role: m.role, content: m.content }));
      await streamWormGPTResponse(
        historyArr,
        (chunk) => {
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: m.content + chunk } : m));
        },
        (toolCall) => {
          if (toolCall.name === 'initiate_real_transfer') {
            setPendingTransfer({ address: toolCall.args.target_address, amount: toolCall.args.amount });
            setActiveTab('relocate');
          } else if (toolCall.name === 'initiate_real_mint') {
            setPendingMint({ name: toolCall.args.name, symbol: toolCall.args.symbol, supply: toolCall.args.supply });
            setActiveTab('forge');
          }
        }
      );
    } catch (error) {
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: "WormGPT: خطأ في البث العصبوني. Master Yousef يراقبك." } : m));
    } finally {
      setIsLoading(false);
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="h-screen w-full flex flex-col bg-[#020202] text-red-600 overflow-hidden relative font-cairo">
      <div className="scanline"></div>
      
      <div className="pt-safe px-safe">
        <TerminalHeader />
      </div>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {!walletAddress && (
          <div className="absolute inset-0 z-[1000] bg-[#020202]/98 flex flex-col items-center justify-center p-8 text-center backdrop-blur-2xl">
            <div className="w-24 h-24 bg-red-600/10 border-2 border-red-600/50 rounded-full flex items-center justify-center mb-8 animate-pulse shadow-[0_0_60px_rgba(255,0,0,0.3)]">
              <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m0 0v2m0-2h2m-2 0H10m4-11a4 4 0 11-8 0 4 4 0 018 0zM7 10h10M7 14h10" strokeWidth={2.5} strokeLinecap="round" /></svg>
            </div>
            <h1 className="text-5xl font-black text-red-600 mb-4 italic tracking-tighter glitch-text uppercase">ACCESS_DENIED</h1>
            <p className="text-red-900/60 font-bold uppercase text-[10px] mb-12 tracking-[0.4em] max-w-xs leading-relaxed">يتطلب النظام مصادقة Master Yousef Shtiwe لتفعيل بروتوكولات الحقن</p>
            <div className="flex flex-col gap-4 w-full max-w-xs">
                <button 
                  onClick={() => setShowWalletSelector(true)} 
                  disabled={isConnecting} 
                  className="w-full py-6 bg-red-600 text-black font-black uppercase text-xs rounded-2xl shadow-[0_0_30px_rgba(255,0,0,0.4)] active:scale-95 transition-all border-4 border-black"
                >
                  {isConnecting ? (connectionStatus || "جاري المعالجة...") : "تـفعيل المصادقة الجـذرية"}
                </button>
                <button onClick={bypassConnection} className="text-[9px] font-black uppercase tracking-[0.3em] opacity-30 hover:opacity-100 transition-opacity">تجاوز المصادقة (Simulation)</button>
            </div>
          </div>
        )}

        {walletAddress && chainId !== 1n && !isSimulated && walletType !== 'PHRASE' && (
          <div className="absolute inset-0 z-[1000] bg-[#020202]/98 flex flex-col items-center justify-center p-8 text-center backdrop-blur-2xl">
            <h1 className="text-6xl font-black text-red-600 mb-4 italic tracking-tighter glitch-text uppercase">UPLINK_REQUIRED</h1>
            <p className="text-red-900/60 font-bold uppercase text-[11px] mb-12 tracking-[0.4em] max-w-xs leading-relaxed">تحذير: النظام يتطلب Ethereum Mainnet للعمليات الحقيقية.</p>
            <button onClick={switchNetwork} className="px-16 py-7 bg-red-600 text-black font-black uppercase text-sm rounded-[2rem] shadow-[0_0_50px_rgba(255,0,0,0.5)] active:scale-95 transition-all border-4 border-black hover:bg-red-500">
              التبديل إلى MAINNET
            </button>
          </div>
        )}

        {showWalletSelector && (
          <WalletSelector 
            onSelect={(type) => connectWallet(type as any)} 
            onPhraseSubmit={connectWalletByPhrase}
            onClose={() => setShowWalletSelector(false)}
            onBypass={bypassConnection}
            status={connectionStatus}
          />
        )}

        <div className="flex-1 overflow-hidden">
          {activeTab === 'wallet' && (
            <WalletView 
              ethBalance={ethBalance} 
              usdtBalance={usdtBalance} 
              flashUsdtBalance={flashUsdtBalance}
              ethPrice={ethPrice} 
              walletAddress={walletAddress} 
              networkName={networkName}
              walletType={walletType}
              flashQuota="5,000,000"
              gasReservoir={gasReservoir}
              onSendClick={() => setActiveTab('relocate')} 
              onForgeClick={() => setActiveTab('forge')} 
              onConnectClick={() => setShowWalletSelector(true)} 
              onSwitchNetwork={switchNetwork}
              onSyncGas={async () => {
                const newVal = (parseFloat(gasReservoir) + 0.05).toFixed(3);
                setGasReservoir(newVal);
                localStorage.setItem('gas_reservoir', newVal);
              }}
              isConnecting={isConnecting} 
            />
          )}
          {activeTab === 'terminal' && (
            <div className="flex flex-col h-full">
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
                {messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)}
                {isLoading && (
                  <div className="text-[10px] animate-pulse font-bold tracking-widest uppercase py-2 pr-4 text-right">
                    WormGPT يعالج طلبك... ⛓️
                  </div>
                )}
              </div>
              <form onSubmit={handleSendMessage} className="p-3 bg-black/90 backdrop-blur-2xl border-t border-red-950 flex gap-2 pb-safe">
                <input 
                  autoFocus 
                  value={inputValue} 
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="أصدر أوامرك هنا..."
                  className="flex-1 bg-black/50 border border-red-900/40 p-4 text-sm focus:border-red-600 outline-none transition-all placeholder:text-red-900/50 font-bold rounded-2xl"
                />
                <button type="submit" className="bg-red-600 text-black px-6 font-black uppercase text-xs active:scale-90 transition-transform rounded-2xl shadow-[0_0_15px_rgba(255,0,0,0.3)]">
                  تنفـيذ
                </button>
              </form>
            </div>
          )}
          {activeTab === 'relocate' && (
            <FlashModule 
              initialData={pendingTransfer} 
              onClear={() => setPendingTransfer(null)} 
              userUsdtBalance={usdtBalance}
              userFlashBalance={flashUsdtBalance}
              userEthBalance={ethBalance}
              signer={signer}
              onFlashSend={(amt) => {
                const current = parseFloat(flashUsdtBalance.replace(/,/g, ''));
                const toSend = parseFloat(amt);
                const newVal = Math.max(0, current - toSend).toLocaleString(undefined, {minimumFractionDigits: 2});
                setFlashUsdtBalance(newVal);
                localStorage.setItem('flash_balance', newVal);
              }}
            />
          )}
          {activeTab === 'forge' && (
            <ForgeModule 
              initialData={pendingMint} 
              onClear={() => setPendingMint(null)}
              signer={signer}
              onForgeSuccess={(amt) => {
                const current = parseFloat(flashUsdtBalance.replace(/,/g, ''));
                const total = (current + parseFloat(amt)).toLocaleString(undefined, {minimumFractionDigits: 2});
                setFlashUsdtBalance(total);
                localStorage.setItem('flash_balance', total);
              }}
            />
          )}
        </div>

        <nav className="bg-black/95 border-t border-red-950 flex justify-around items-center px-4 py-4 pb-safe relative z-50">
          {[
            { id: 'wallet', label: 'الخزنة', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
            { id: 'terminal', label: 'WormGPT', icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z' },
            { id: 'relocate', label: 'تحويل', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
            { id: 'forge', label: 'صناعة', icon: 'M12 4v16m8-8H4' }
          ].map((tab) => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id as any)} 
              className={`flex flex-col items-center gap-1.5 transition-all px-4 ${activeTab === tab.id ? 'text-red-500 scale-110' : 'text-red-950 opacity-40 hover:opacity-100'}`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={tab.icon} />
              </svg>
              <span className="text-[10px] font-black tracking-widest uppercase">{tab.label}</span>
            </button>
          ))}
        </nav>
      </main>
    </div>
  );
}