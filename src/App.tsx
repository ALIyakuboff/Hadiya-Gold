import React, { useState, useEffect, useRef } from 'react';
import * as Lucide from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  loadData, addProduct, sellProduct, updateGoldRate, 
  addPaymentToDebt, updateSettings, exportData, importData,
  updateProduct, deleteProduct, fmtUZS, getLocalDate, addUser, updateUser, deleteUser,
  fmtLocalDateTime, mergeRemoteData
} from './store';
import { initTelegramBot } from './telegram';
import { 
  AppData, Product, Sale, Debt, User, ProductType, Expense, Payment, Investor,
  SkladCategory, SKLAD_CATEGORIES, PaymentType
} from './types';
import './App.css';
import AiAssistant from './components/AiAssistant';
import ExpensesTab from './components/ExpensesTab';
import InvestorsTab from './components/InvestorsTab';
import HistoryTab from './components/HistoryTab';
import ShiftClose from './components/ShiftClose';

type Tab = 'Dashboard' | 'Sklad' | 'Savdo' | 'Nasiya' | 'Ishchilar' | 'Sarmoyadorlar' | 'Tarix' | 'Xarajatlar' | 'Sozlamalar';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('tab') as Tab) || 'Dashboard';
  });
  const [data, setData] = useState<AppData>(loadData());
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('hadiya_theme') as 'dark' | 'light') || 'dark';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('hadiya_session');
    if (saved) {
      const u = JSON.parse(saved);
      if (u.name === 'Manager (Admin)' || u.name === 'Admin') u.name = 'Menejer';
      return u;
    }
    return null;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('hadiya_theme', theme);
  }, [theme]);

  // Sync data to the standalone bot server
  const syncToBot = async (appData = data) => {
    try {
      const serverUrl = window.location.hostname === 'localhost' ? 'http://localhost:3001' : `${window.location.protocol}//${window.location.hostname}:3001`;
      await fetch(`${serverUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          users: appData.users,
          debts: appData.debts,
          sales: appData.sales,
        }),
      });
    } catch (_) { /* Bot server may not be running */ }
  };

  useEffect(() => {
    const initData = async () => {
      try {
        const serverUrl = window.location.hostname === 'localhost' ? 'http://localhost:3001' : `${window.location.protocol}//${window.location.hostname}:3001`;
        const resp = await fetch(`${serverUrl}/api/get-data`);
        const remoteData = await resp.json();
        if (remoteData && remoteData.users) {
          mergeRemoteData(remoteData);
          setData(loadData());
        }
      } catch (e) { console.warn('Server bilan bog\'lanishda xatolik (sync pull):', e); }
    };
    initData();
  }, []);

  useEffect(() => {
    if (currentUser) syncToBot();
  }, [currentUser]);

  const refreshData = () => {
    const newData = loadData();
    setData(newData);
    if (currentUser) syncToBot(newData);
  };

  const handleLogin = (phone: string, pin: string) => {
    const cleanInputPhone = phone.replace(/\D/g, '');
    const user = data.users.find(u => {
      const cleanUPhone = u.phone.replace(/\D/g, '');
      const phoneMatches = cleanUPhone === cleanInputPhone || 
                           (cleanInputPhone.length >= 9 && cleanUPhone.endsWith(cleanInputPhone.slice(-9))) ||
                           (cleanUPhone.length >= 9 && cleanInputPhone.endsWith(cleanUPhone.slice(-9)));
      return phoneMatches && u.pin === pin;
    });

    if (user) {
      const u2 = { ...user };
      if (u2.name === 'Manager (Admin)' || u2.name === 'Admin') u2.name = 'Menejer';
      localStorage.setItem('hadiya_session', JSON.stringify(u2));
      setCurrentUser(u2);
      setShowSplash(true);
      setTimeout(() => setShowSplash(false), 4000);
      return true;
    }
    return false;
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  if (showSplash) {
    return (
      <div className="splash-screen">
        <div className="splash-content">
          <img src="/logo.jpg" alt="Logo" className="splash-logo-img" />
          <div className="splash-logo">Hadiya Gold</div>
          <div className="splash-loader"><div className="splash-loader-bar"></div></div>
          <p style={{ marginTop: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Tizim yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  const isManager = currentUser.role === 'Manager';

  return (
    <div className="app-container">
      {isMobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setIsMobileMenuOpen(false)} />
      )}
      <nav className={`sidebar glass ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="logo" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="/logo.jpg" alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid var(--primary)' }} />
            <h2 className="gold-text">Hadiya Gold</h2>
          </div>
          <button className="mobile-close-btn" onClick={() => setIsMobileMenuOpen(false)}><Lucide.X size={24} /></button>
        </div>
        <nav className="nav-links">
          <NavItem icon={<Lucide.LayoutDashboard size={22} />} label="Dashboard" active={activeTab === 'Dashboard'} onClick={() => { setActiveTab('Dashboard'); setIsMobileMenuOpen(false); }} />
          <NavItem icon={<Lucide.Package size={22} />} label="Sklad" active={activeTab === 'Sklad'} onClick={() => { setActiveTab('Sklad'); setIsMobileMenuOpen(false); }} />
          <NavItem icon={<Lucide.ShoppingCart size={22} />} label="Savdo" active={activeTab === 'Savdo'} onClick={() => { setActiveTab('Savdo'); setIsMobileMenuOpen(false); }} />
          <NavItem icon={<Lucide.History size={22} />} label="Sotuv Tarixi" active={activeTab === 'Tarix'} onClick={() => { setActiveTab('Tarix'); setIsMobileMenuOpen(false); }} />
          <NavItem icon={<Lucide.Wallet size={22} />} label="Nasiya" active={activeTab === 'Nasiya'} onClick={() => { setActiveTab('Nasiya'); setIsMobileMenuOpen(false); }} />
          {isManager && (
            <>
              <NavItem icon={<Lucide.TrendingDown size={22} />} label="Xarajatlar" active={activeTab === 'Xarajatlar'} onClick={() => { setActiveTab('Xarajatlar'); setIsMobileMenuOpen(false); }} />
              <NavItem icon={<Lucide.CreditCard size={22} />} label="Sarmoyadorlar" active={activeTab === 'Sarmoyadorlar'} onClick={() => { setActiveTab('Sarmoyadorlar'); setIsMobileMenuOpen(false); }} />
              <NavItem icon={<Lucide.Users size={22} />} label="Ishchilar" active={activeTab === 'Ishchilar'} onClick={() => { setActiveTab('Ishchilar'); setIsMobileMenuOpen(false); }} />
              <NavItem icon={<Lucide.Settings size={22} />} label="Sozlamalar" active={activeTab === 'Sozlamalar'} onClick={() => { setActiveTab('Sozlamalar'); setIsMobileMenuOpen(false); }} />
            </>
          )}
        </nav>
        <div className="gold-rate-panel glass">
          <p>Oltin kursi (1g):</p>
          <div className="rate-input">
            <input type="number" value={data.goldRateUZS} onChange={e => {
              updateGoldRate(Number(e.target.value));
              refreshData();
            }} />
            <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>so'm</span>
          </div>
        </div>
      </nav>

      <main className="main-content">
        <header className="main-header glass">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)}>
              <Lucide.Menu size={28} />
            </button>
            <h1>{activeTab}</h1>
          </div>
          <div className="search-bar">
            <Lucide.Search size={18} />
            <input placeholder="Mahsulot yoki kod..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="user-profile">
            {isManager && <ShiftClose data={data} currentUser={currentUser} onRefresh={refreshData} />}
            <button className="theme-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Mavzu">
              {theme === 'dark' ? <Lucide.Sun size={18} /> : <Lucide.Moon size={18} />}
            </button>
            <div className="user-info">
              <Lucide.User size={18} />
              <span>{currentUser.name}</span>
            </div>
            <button className="logout-btn" onClick={() => {
              setCurrentUser(null);
              localStorage.removeItem('hadiya_session');
            }} title="Chiqish">
              <Lucide.LogOut size={18} />
            </button>
          </div>
        </header>

        <section className="content-area">
          {activeTab === 'Dashboard' && <Dashboard data={data} isManager={isManager} />}
          {activeTab === 'Sklad' && <Sklad data={data} searchQuery={searchQuery} onRefresh={refreshData} isManager={isManager} />}
          {activeTab === 'Savdo' && <Savdo data={data} searchQuery={searchQuery} onRefresh={refreshData} currentUser={currentUser} />}
          {activeTab === 'Tarix' && <HistoryTab data={data} searchQuery={searchQuery} isManager={isManager} />}
          {activeTab === 'Nasiya' && <NasiyaTab data={data} searchQuery={searchQuery} onRefresh={refreshData} isManager={isManager} />}
          {activeTab === 'Ishchilar' && isManager && <StaffTab data={data} onRefresh={refreshData} />}
          {activeTab === 'Xarajatlar' && isManager && <ExpensesTab data={data} onRefresh={refreshData} />}
          {activeTab === 'Sarmoyadorlar' && isManager && <InvestorsTab data={data} onRefresh={refreshData} />}
          {activeTab === 'Sozlamalar' && isManager && <SettingsTab onRefresh={refreshData} data={data} />}
        </section>
      </main>
      <AiAssistant data={data} currentUser={currentUser} />
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <li className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="icon-box">{icon}</span>
      <span>{label}</span>
    </li>
  );
}

// --- Dashboard ---
function Dashboard({ data, isManager }: { data: AppData, isManager: boolean }) {
  const inStock = data.products.filter(p => p.status === 'InStock' || p.status === 'PartialSold');
  const today = getLocalDate(); // Toshkent vaqti YYYY-MM-DD
  const totalSalesTodayUZS = data.sales.filter(s => getLocalDate(s.date) === today).reduce((acc, s) => acc + s.soldPriceUZS, 0);
  const totalDebtUZS = data.debts.reduce((acc, d) => acc + (d.totalUZS - d.paidUZS), 0);

  return (
    <div className="dashboard-wrapper animate-up">
      <div className="dashboard-grid">
        <StatCard title="Omborxona" value={inStock.length} unit="ta" icon={<Lucide.Package size={24} />} color="#d4af37" />
        <StatCard title="Bugungi Savdo" value={totalSalesTodayUZS} unit="uzs" icon={<Lucide.ShoppingCart size={24} />} color="#27ae60" />
        <StatCard title="Jami Nasiya" value={totalDebtUZS} unit="uzs" icon={<Lucide.Wallet size={24} />} color="#e74c3c" />
        <StatCard title="Oltin Kursi (1g)" value={data.goldRateUZS} unit="uzs" icon={<Lucide.Coins size={24} />} color="#f1c40f" />
      </div>

      <div className="charts-grid">
        <div className="chart-card glass">
          <h3>Mahsulotlar Tarkibi</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Uzuk', value: inStock.filter(p => p.type === 'Uzuk').length },
                  { name: 'Braslet', value: inStock.filter(p => p.type === 'Braslet').length },
                  { name: 'Boshqa', value: inStock.filter(p => !['Uzuk', 'Braslet'].includes(p.type)).length }
                ]}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                <Cell fill="var(--primary)" />
                <Cell fill="#a4b0be" />
                <Cell fill="#8d6e63" />
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, unit, icon, color }: { title: string, value: number, unit: string, icon: React.ReactNode, color: string }) {
  return (
    <div className="stat-card glass animate-up" style={{ borderLeft: `5px solid ${color}` }}>
      <div className="stat-icon" style={{ backgroundColor: `${color}22`, color }}>{icon}</div>
      <div className="stat-info">
        <h3>{title}</h3>
        <p>{unit === 'uzs' ? fmtUZS(value) : unit === '$' ? `$${value.toLocaleString()}` : `${value} ${unit}`}</p>
      </div>
    </div>
  );
}

// --- Sklad ---
function Sklad({ data, searchQuery, onRefresh, isManager }: { data: AppData, searchQuery: string, onRefresh: () => void, isManager: boolean }) {
  const [selectedCategory, setSelectedCategory] = useState<SkladCategory | 'All'>(SKLAD_CATEGORIES[0]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({ type: 'Uzuk', status: 'InStock', origin: 'Mavjud emas', category: SKLAD_CATEGORIES[0], parts: [] });
  const [showScannerInAdd, setShowScannerInAdd] = useState(false);
  const [showScannerInEdit, setShowScannerInEdit] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = data.products
    .filter(p => p.status === 'InStock' || p.status === 'PartialSold')
    .filter(p => selectedCategory === 'All' || p.category === selectedCategory)
    .filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const isKomplekt = (cat: string) => cat.includes('KOMPLEKT');

  const handleAdd = () => {
    if (!newProduct.name || !newProduct.category) { alert('Nomi va kategoriya shart!'); return; }
    addProduct({
      ...newProduct as Product,
      id: Date.now().toString(),
      status: 'InStock',
      addedAt: new Date().toISOString(),
      parts: newProduct.parts || []
    });
    setNewProduct({ type: 'Uzuk', status: 'InStock', origin: 'Mavjud emas', category: SKLAD_CATEGORIES[0], image: '', parts: [] });
    setShowAddModal(false);
    onRefresh();
  };

  const handleEditSave = () => {
    if (!editingProduct) return;
    updateProduct(editingProduct.id, editingProduct);
    setEditingProduct(null);
    onRefresh();
  };

  const handleDelete = (id: string) => {
    if (window.confirm("O'chirishni tasdiqlaysizmi?")) { deleteProduct(id); onRefresh(); }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (isEdit && editingProduct) setEditingProduct({ ...editingProduct, image: base64String });
        else setNewProduct({ ...newProduct, image: base64String });
      };
      reader.readAsDataURL(file);
    }
  };

  // Add/remove parts for komplekt
  const addPart = (isEdit: boolean) => {
    const newPart = { id: Date.now().toString(), name: '', code: '', weight: 0 };
    if (isEdit && editingProduct) {
      setEditingProduct({ ...editingProduct, parts: [...(editingProduct.parts || []), newPart] });
    } else {
      setNewProduct({ ...newProduct, parts: [...(newProduct.parts || []), newPart] });
    }
  };

  const updatePart = (partId: string, field: string, val: string | number, isEdit: boolean) => {
    if (isEdit && editingProduct) {
      setEditingProduct({ ...editingProduct, parts: editingProduct.parts?.map(p => p.id === partId ? { ...p, [field]: val } : p) });
    } else {
      setNewProduct({ ...newProduct, parts: newProduct.parts?.map(p => p.id === partId ? { ...p, [field]: val } : p) });
    }
  };

  const removePart = (partId: string, isEdit: boolean) => {
    if (isEdit && editingProduct) {
      setEditingProduct({ ...editingProduct, parts: editingProduct.parts?.filter(p => p.id !== partId) });
    } else {
      setNewProduct({ ...newProduct, parts: newProduct.parts?.filter(p => p.id !== partId) });
    }
  };

  const PartsEditor = ({ parts, onAdd, onUpdate, onRemove }: any) => (
    <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(212,175,55,0.06)', borderRadius: '10px', border: '1px dashed var(--primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>🏅 Komplekt qismlari</span>
        <button className="gold-btn" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={onAdd}>+ Qism qo'shish</button>
      </div>
      {(parts || []).map((part: any) => (
        <div key={part.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
          <input placeholder="Nomi (mas: Uzuk)" value={part.name} onChange={e => onUpdate(part.id, 'name', e.target.value)} style={{ padding: '6px' }} />
          <input placeholder="Kodi" value={part.code} onChange={e => onUpdate(part.id, 'code', e.target.value)} style={{ padding: '6px' }} />
          <input type="number" placeholder="Og'irligi (g)" value={part.weight || ''} onChange={e => onUpdate(part.id, 'weight', Number(e.target.value))} style={{ padding: '6px' }} />
          <button onClick={() => onRemove(part.id)} style={{ background: 'var(--danger)', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: '#fff' }}>✕</button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="module-container animate-up">
      <div className="module-header">
        <h2>Sklad (Mavjud: {data.products.filter(p => p.status === 'InStock' || p.status === 'PartialSold').length})</h2>
        {isManager && <button className="gold-btn" onClick={() => setShowAddModal(true)}><Lucide.Plus size={20} /> Qo'shish</button>}
      </div>

      <div className="category-tabs" style={{ paddingBottom: '10px', marginBottom: '20px' }}>
        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value as SkladCategory | 'All')}
          className="search-bar" style={{ width: '100%', maxWidth: '300px', cursor: 'pointer', appearance: 'auto' }}>
          <option value="All">Barchasi ({data.products.filter(p => p.status === 'InStock' || p.status === 'PartialSold').length})</option>
          {SKLAD_CATEGORIES.map(cat => {
            const count = data.products.filter(p => (p.status === 'InStock' || p.status === 'PartialSold') && p.category === cat).length;
            return <option key={cat} value={cat}>{cat} ({count})</option>;
          })}
        </select>
      </div>

      <div className="table-container glass">
        <table>
          <thead>
            <tr>
              <th>Rasm</th>
              <th>Kod</th>
              <th>Nomi</th>
              <th>Kategoriya</th>
              <th>Og'irligi</th>
              <th>Tan Narxi</th>
              <th>QR</th>
              {isManager && <th style={{ textAlign: 'center' }}>Amallar</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id}>
                <td>
                  {p.image ? (
                    <img src={p.image} alt={p.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '8px' }} />
                  ) : (
                    <div style={{ width: '40px', height: '40px', background: 'var(--glass-bg)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lucide.Image size={20} opacity={0.5} /></div>
                  )}
                </td>
                <td><strong>{p.code}</strong></td>
                <td>
                  {p.name}
                  {p.parts && p.parts.length > 0 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '2px' }}>
                      🏅 {p.parts.map(pt => pt.name).join(', ')}
                    </div>
                  )}
                </td>
                <td><span className="badge-status" style={{ background: 'rgba(212,175,55,0.1)', color: 'var(--primary)' }}>{p.category}</span></td>
                <td>{p.weight} g</td>
                <td>{p.costPriceUZS ? fmtUZS(p.costPriceUZS) : '-'}</td>
                <td><QRCodeSVG value={p.code} size={30} /></td>
                {isManager && (
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button className="gold-btn" style={{ padding: '6px', background: 'rgba(212,175,55,0.1)', color: 'var(--primary)' }} onClick={() => setEditingProduct(p)} title="Tahrirlash">
                        <Lucide.Edit2 size={16} />
                      </button>
                      <button className="gold-btn" style={{ padding: '6px', background: 'rgba(231,76,60,0.1)', color: 'var(--danger)' }} onClick={() => handleDelete(p.id)} title="O'chirish">
                        <Lucide.Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content glass animate-up" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>Yangi Mahsulot</h3>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
              <div style={{ width: '120px', height: '120px', borderRadius: '15px', border: '2px dashed var(--primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}
                onClick={() => fileInputRef.current?.click()}>
                {newProduct.image ? <img src={newProduct.image} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <><Lucide.Camera size={30} color="var(--primary)" /><span style={{ fontSize: '0.8rem', marginTop: '5px' }}>Rasm</span></>}
                <input type="file" accept="image/*" capture="environment" ref={fileInputRef} style={{ display: 'none' }} onChange={(e) => handleImageUpload(e, false)} />
              </div>
              <div style={{ flex: 1 }}>
                {showScannerInAdd && (
                  <div style={{ marginBottom: '10px' }}>
                    <QRScanner onScan={(code) => { setNewProduct(prev => ({...prev, code})); setTimeout(() => setShowScannerInAdd(false), 200); }} />
                    <button className="gold-btn w-full" style={{ background: 'var(--danger)', marginTop: '5px', padding: '5px' }} onClick={() => setShowScannerInAdd(false)}>Yopish</button>
                  </div>
                )}
              </div>
            </div>
            <div className="form-grid">
              <input placeholder="Nomi" onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input placeholder="Kod (Shtrix)" value={newProduct.code || ''} style={{ width: '100%', paddingRight: '45px' }} onChange={e => setNewProduct({...newProduct, code: e.target.value})} />
                <button className="theme-btn" style={{ position: 'absolute', right: '5px', height: '32px', width: '32px', borderRadius: '8px' }} onClick={() => setShowScannerInAdd(true)} title="Skanerlash"><Lucide.Camera size={18} /></button>
              </div>
              <select value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value as SkladCategory})}>
                {SKLAD_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <input type="number" placeholder="Og'irligi (g)" onChange={e => setNewProduct({...newProduct, weight: Number(e.target.value)})} />
              <input type="number" placeholder="Tan narxi (so'm)" onChange={e => setNewProduct({...newProduct, costPriceUZS: Number(e.target.value)})} />
            </div>
            {isKomplekt(newProduct.category || '') && (
              <PartsEditor
                parts={newProduct.parts}
                onAdd={() => addPart(false)}
                onUpdate={(id: string, field: string, val: any) => updatePart(id, field, val, false)}
                onRemove={(id: string) => removePart(id, false)}
              />
            )}
            <div style={{ marginTop: '25px', display: 'flex', gap: '10px' }}>
              <button className="gold-btn" style={{ flex: 1 }} onClick={handleAdd}>Saqlash</button>
              <button className="gold-btn" style={{ flex: 1, background: 'var(--danger)' }} onClick={() => setShowAddModal(false)}>Bekor</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingProduct && (
        <div className="modal-overlay">
          <div className="modal-content glass animate-up" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>Mahsulotni tuzatish</h3>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
              <div style={{ width: '120px', height: '120px', borderRadius: '15px', border: '2px dashed var(--primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}
                onClick={() => fileInputRef.current?.click()}>
                {editingProduct.image ? <img src={editingProduct.image} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <><Lucide.Camera size={30} color="var(--primary)" /><span style={{ fontSize: '0.8rem', marginTop: '5px' }}>Rasm</span></>}
                <input type="file" accept="image/*" capture="environment" ref={fileInputRef} style={{ display: 'none' }} onChange={(e) => handleImageUpload(e, true)} />
              </div>
              <div style={{ flex: 1 }}>
                {showScannerInEdit && (
                  <div style={{ marginBottom: '10px' }}>
                    <QRScanner onScan={(code) => { setEditingProduct(prev => prev ? ({...prev, code}) : null); setTimeout(() => setShowScannerInEdit(false), 200); }} />
                    <button className="gold-btn w-full" style={{ background: 'var(--danger)', marginTop: '5px', padding: '5px' }} onClick={() => setShowScannerInEdit(false)}>Yopish</button>
                  </div>
                )}
              </div>
            </div>
            <div className="form-grid">
              <input placeholder="Nomi" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input placeholder="Kod (Shtrix)" value={editingProduct.code} style={{ width: '100%', paddingRight: '45px' }} onChange={e => setEditingProduct({...editingProduct, code: e.target.value})} />
                <button className="theme-btn" style={{ position: 'absolute', right: '5px', height: '32px', width: '32px', borderRadius: '8px' }} onClick={() => setShowScannerInEdit(true)} title="Skanerlash"><Lucide.Camera size={18} /></button>
              </div>
              <select value={editingProduct.category} onChange={e => setEditingProduct({...editingProduct, category: e.target.value as SkladCategory})}>
                {SKLAD_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <input type="number" placeholder="Og'irligi (g)" value={editingProduct.weight} onChange={e => setEditingProduct({...editingProduct, weight: Number(e.target.value)})} />
              <input type="number" placeholder="Tan narxi (so'm)" value={editingProduct.costPriceUZS || ''} onChange={e => setEditingProduct({...editingProduct, costPriceUZS: Number(e.target.value)})} />
            </div>
            {isKomplekt(editingProduct.category || '') && (
              <PartsEditor
                parts={editingProduct.parts}
                onAdd={() => addPart(true)}
                onUpdate={(id: string, field: string, val: any) => updatePart(id, field, val, true)}
                onRemove={(id: string) => removePart(id, true)}
              />
            )}
            <div style={{ marginTop: '25px', display: 'flex', gap: '10px' }}>
              <button className="gold-btn" style={{ flex: 1 }} onClick={handleEditSave}>Saqlash</button>
              <button className="gold-btn" style={{ flex: 1, background: 'var(--danger)' }} onClick={() => setEditingProduct(null)}>Bekor</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Savdo ---
function Savdo({ data, searchQuery, onRefresh, currentUser }: { data: AppData, searchQuery: string, onRefresh: () => void, currentUser: User }) {
  const [cart, setCart] = useState<(Product & { sellPriceUZS: number })[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [paymentType, setPaymentType] = useState<PaymentType>('Cash');
  const [cashAmountInput, setCashAmountInput] = useState(0);
  const [cardAmountInput, setCardAmountInput] = useState(0);
  const [sellerName, setSellerName] = useState('');
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '' });
  const [lastReceipt, setLastReceipt] = useState<{items: (Product & { sellPriceUZS: number })[], total: number, date: string, sellerName: string, pType: string} | null>(null);

  const available = data.products
    .filter(p => p.status === 'InStock' || p.status === 'PartialSold')
    .filter(p => !cart.find(cp => cp.id === p.id))
    .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.code.toLowerCase().includes(searchQuery.toLowerCase()));

  const total = cart.reduce((acc, p) => acc + (p.sellPriceUZS || 0), 0);
  const hasNasiya = paymentType === 'Nasiya' || paymentType === 'Mixed' || paymentType === 'CashCardNasiya';
  const hasSplit = paymentType === 'CashCard' || paymentType === 'CashCardNasiya' || paymentType === 'Mixed';

  const handleCheckout = () => {
    if (cart.length === 0) return;
    if (!sellerName.trim()) { alert('Sotuvchi ismini kiriting!'); return; }
    if (cart.some(c => !c.sellPriceUZS || c.sellPriceUZS <= 0)) { alert('Barcha mahsulotlarga narx kiriting!'); return; }
    if (hasNasiya && (!customerInfo.name || !customerInfo.phone)) { alert('Nasiya uchun mijoz ismi va telefon kerak!'); return; }

    const dateStr = new Date().toISOString();
    let actualCash = 0, actualCard = 0, actualNasiya = 0;
    if (paymentType === 'Cash') { actualCash = total; }
    else if (paymentType === 'Card') { actualCard = total; }
    else if (paymentType === 'Nasiya') { actualNasiya = total; }
    else if (paymentType === 'CashCard') { actualCash = cashAmountInput; actualCard = total - cashAmountInput; }
    else if (paymentType === 'Mixed') { actualCash = cashAmountInput; actualNasiya = total - cashAmountInput; }
    else if (paymentType === 'CashCardNasiya') { actualCash = cashAmountInput; actualCard = cardAmountInput; actualNasiya = total - cashAmountInput - cardAmountInput; }

    if (actualNasiya < 0) { alert("Noto'g'ri summa!"); return; }

    let singleDebt: Debt | undefined;
    if (actualNasiya > 0) {
      singleDebt = { id: 'D-' + Date.now() + Math.random(), saleId: 'S-MULTIPLE-' + Date.now(), customerName: customerInfo.name, customerPhone: customerInfo.phone, totalUZS: actualNasiya, paidUZS: 0, date: dateStr, payments: [] };
    }

    cart.forEach((p, idx) => {
      const ratio = total > 0 ? p.sellPriceUZS / total : 0;
      const sale: Sale = { id: 'S-' + Date.now() + Math.random(), productId: p.id, productName: p.name, productCode: p.code, staffId: currentUser.id, staffName: currentUser.name, sellerName, costPriceUZS: p.costPriceUZS || 0, soldPriceUZS: p.sellPriceUZS, cashAmountUZS: actualCash * ratio, cardAmountUZS: actualCard * ratio, nasiyaAmountUZS: actualNasiya * ratio, paymentType, date: dateStr };
      sellProduct(sale, idx === 0 ? singleDebt : undefined);
    });

    setLastReceipt({ items: [...cart], total, date: dateStr, sellerName, pType: paymentType });
    setTimeout(() => { window.print(); setCart([]); setLastReceipt(null); setCashAmountInput(0); setCardAmountInput(0); onRefresh(); }, 500);
  };

  const payLabel = (t: string) => ({ Cash:'Naqd', Card:'Karta', Nasiya:'Nasiya', Mixed:'Naqd+Nasiya', CashCard:'Naqd+Karta', CashCardNasiya:'Naqd+Karta+Nasiya' }[t] || t);

  return (
    <div className="module-container animate-up">
      <div className="savdo-layout">
        <div className="selection-area glass">
          <div className="module-header">
            <h3>Tanlash</h3>
            <button className="gold-btn" onClick={() => setShowScanner(!showScanner)}><Lucide.Camera size={18} /></button>
          </div>
          {showScanner && (
            <QRScanner onScan={(code) => {
              const p = data.products.find(prod => prod.code === code && (prod.status === 'InStock' || prod.status === 'PartialSold'));
              if (p) { setCart(prev => [...prev, { ...p, sellPriceUZS: 0 }]); setTimeout(() => setShowScanner(false), 200); }
              else alert('Mahsulot topilmadi yoki sotilgan!');
            }} />
          )}
          <div className="selection-grid">
            {available.map(p => (
              <div key={p.id} className="select-card glass" onClick={() => setCart([...cart, { ...p, sellPriceUZS: 0 }])}>
                {p.image ? <img src={p.image} alt={p.name} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '10px' }} /> : <div className="avatar-box" style={{ width: '50px', height: '50px', fontSize: '1rem' }}>{p.name.charAt(0)}</div>}
                <p>{p.name}</p>
                <span className="badge-status" style={{ background: 'rgba(212,175,55,0.1)', color: 'var(--primary)' }}>{p.category}</span>
                {p.parts && p.parts.length > 0 && <span style={{ fontSize: '0.7rem', color: 'var(--primary)', opacity: 0.8 }}>🏅 Komplekt</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="cart-area glass">
          <h3>Savatcha</h3>
          <div className="cart-items" style={{ paddingBottom: '10px' }}>
            <input placeholder="Sotuvchi ismi (majburiy)" value={sellerName} onChange={(e) => setSellerName(e.target.value)} style={{ width: '100%', marginBottom: '15px', border: '1px solid var(--danger)' }} />
            {cart.map((p, idx) => (
              <div key={p.id} className="cart-item glass" style={{ display: 'flex', flexDirection: 'column', padding: '10px', marginBottom: '10px', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p><strong>{p.name}</strong></p>
                    <span style={{ fontSize: '0.85rem', color: '#a4b0be' }}>Vazn: {p.weight}g</span>
                  </div>
                  <button className="logout-btn" onClick={() => setCart(cart.filter(cp => cp.id !== p.id))}><Lucide.Trash2 size={16} /></button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>Narx (so'm):</span>
                  <input type="number" placeholder="Masalan 1500000" value={p.sellPriceUZS || ''}
                    onChange={(e) => { const n = [...cart]; n[idx] = { ...n[idx], sellPriceUZS: Number(e.target.value) }; setCart(n); }}
                    style={{ padding: '8px', width: '140px' }} />
                </div>
              </div>
            ))}
          </div>
          <div className="cart-summary" style={{ marginTop: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px' }}>
              <span>Jami:</span><span>{fmtUZS(total)}</span>
            </div>
            <select style={{ width: '100%', marginBottom: '10px' }} value={paymentType} onChange={e => { setPaymentType(e.target.value as PaymentType); setCashAmountInput(0); setCardAmountInput(0); }}>
              <option value="Cash">Naqd pul</option>
              <option value="Card">Karta</option>
              <option value="Nasiya">To'liq Nasiya</option>
              <option value="CashCard">Naqd + Karta</option>
              <option value="Mixed">Naqd + Nasiya</option>
              <option value="CashCardNasiya">Naqd + Karta + Nasiya</option>
            </select>
            {(paymentType === 'CashCard' || paymentType === 'Mixed' || paymentType === 'CashCardNasiya') && (
              <input type="number" placeholder={`Naqd miqdor (so'm). Jami: ${fmtUZS(total)}`} value={cashAmountInput || ''} onChange={e => setCashAmountInput(Number(e.target.value))} style={{ width: '100%', marginBottom: '8px' }} />
            )}
            {paymentType === 'CashCardNasiya' && (
              <input type="number" placeholder="Karta miqdori (so'm)" value={cardAmountInput || ''} onChange={e => setCardAmountInput(Number(e.target.value))} style={{ width: '100%', marginBottom: '8px' }} />
            )}
            {hasNasiya && (
              <div style={{ background: 'rgba(231,76,60,0.08)', padding: '8px', borderRadius: '8px', marginBottom: '8px', fontSize: '0.9rem' }}>
                Nasiya: {fmtUZS(paymentType === 'Mixed' ? total - cashAmountInput : paymentType === 'CashCardNasiya' ? total - cashAmountInput - cardAmountInput : total)}
              </div>
            )}
            {hasNasiya && (
              <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                <input placeholder="Mijoz Ismi" style={{ flex: 1 }} value={customerInfo.name} onChange={e => setCustomerInfo({...customerInfo, name: e.target.value})} />
                <input placeholder="Telefon" style={{ flex: 1 }} value={customerInfo.phone} onChange={e => setCustomerInfo({...customerInfo, phone: e.target.value})} />
              </div>
            )}
            <button className="gold-btn w-full" style={{ marginTop: '10px', padding: '12px' }} onClick={handleCheckout}>Sotuvni Yakunlash</button>
          </div>
        </div>
      </div>

      {/* Thermal Receipt */}
      <div id="thermal-receipt" style={{ display: 'none' }}>
        {lastReceipt && (
          <div className="receipt-content">
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
              <img src="/logo.jpg" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} />
            </div>
            <h2>{data.settings.shopName}</h2>
            <p>{data.settings.address}</p>
            <p>{data.settings.phone}</p>
            <div className="divider" />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Sana:</span><span>{format(new Date(lastReceipt.date), 'dd.MM.yyyy HH:mm')}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Sotuvchi:</span><span>{lastReceipt.sellerName}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>To'lov:</span><span>{payLabel(lastReceipt.pType)}</span></div>
            <div className="divider" />
            <table>
              <thead><tr><th>Mahsulot</th><th style={{ textAlign: 'right' }}>Vazn</th><th style={{ textAlign: 'right' }}>Narx</th></tr></thead>
              <tbody>
                {lastReceipt.items.map((it, idx) => (
                  <tr key={idx}><td>{it.name}</td><td style={{ textAlign: 'right' }}>{it.weight}g</td><td style={{ textAlign: 'right' }}>{fmtUZS(it.sellPriceUZS)}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="divider" />
            <div className="total-row">JAMI: {fmtUZS(lastReceipt.total)}</div>
            <div className="footer" style={{ marginTop: '20px', textAlign: 'center' }}>
              <p>Xaridingiz uchun rahmat!</p>
              <p>Hadiya Gold - Sifat belgisi</p>
            </div>
            <div className="qr-box" style={{ display: 'flex', justifyContent: 'center', marginTop: '15px' }}>
              <QRCodeSVG value={`hadiyagold-${Date.now()}`} size={80} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NasiyaTab({ data, searchQuery, onRefresh, isManager }: { data: AppData, searchQuery: string, onRefresh: () => void, isManager: boolean }) {
  const [filter, setFilter] = useState<'Active' | 'Closed'>('Active');
  const [selectedDebtHistory, setSelectedDebtHistory] = useState<Debt | null>(null);

  const filtered = data.debts
    .filter(d => {
      const remaining = d.totalUZS - d.paidUZS;
      if (filter === 'Active') return remaining > 100;
      return remaining <= 100;
    })
    .filter(d => d.customerName.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="module-container animate-up">
      <div className="module-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="filter-tabs glass" style={{ display: 'inline-flex', padding: '4px', borderRadius: '12px' }}>
          <button className={`filter-btn ${filter === 'Active' ? 'active' : ''}`} onClick={() => setFilter('Active')} style={{ padding: '8px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: filter === 'Active' ? 'var(--primary)' : 'transparent', color: filter === 'Active' ? '#fff' : 'var(--text-secondary)', fontWeight: 600 }}>Faol</button>
          <button className={`filter-btn ${filter === 'Closed' ? 'active' : ''}`} onClick={() => setFilter('Closed')} style={{ padding: '8px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: filter === 'Closed' ? 'var(--primary)' : 'transparent', color: filter === 'Closed' ? '#fff' : 'var(--text-secondary)', fontWeight: 600 }}>Yopilgan</button>
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Jami: {filtered.length} ta
        </div>
      </div>

      <div className="staff-grid">
        {filtered.map((d, index) => {
          const remaining = d.totalUZS - d.paidUZS;
          const isClosed = remaining <= 100;
          return (
            <div key={`${d.id}-${index}`} className="staff-card glass" style={{ borderLeft: `5px solid ${isClosed ? '#27ae60' : 'var(--danger)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0 }}>{d.customerName}</h3>
                  <p className="subtitle"><Lucide.Phone size={12} /> {d.customerPhone}</p>
                </div>
                <button className="theme-btn" onClick={() => setSelectedDebtHistory(d)} title="Tarix">
                  <Lucide.History size={18} />
                </button>
              </div>
              
              <div className="staff-stats-row" style={{ marginTop: '15px' }}>
                <div className="staff-stat-item"><p>Umumiy</p><span>{fmtUZS(d.totalUZS)}</span></div>
                <div className="staff-stat-item" style={{ borderLeft: '1px solid var(--glass-border)', paddingLeft: '20px' }}>
                  <p>{isClosed ? 'To\'langan' : 'Qolgan qarz'}</p>
                  <span style={{ color: isClosed ? '#27ae60' : 'var(--danger)' }}>{fmtUZS(isClosed ? d.totalUZS : remaining)}</span>
                </div>
              </div>

              {!isClosed && (
                <button className="gold-btn w-full" style={{ marginTop: '15px' }} onClick={() => {
                  const amtStr = prompt(`To'lov kiriting (so'm). Maksimal: ${fmtUZS(remaining)}`);
                  const amt = Number(amtStr);
                  if (amt > remaining + 1) { alert("Xatolik: Qarzdan ko'p!"); }
                  else if (amt > 0) {
                    const payType = window.confirm("Naqd pul? (Bekor = Karta)") ? 'Cash' : 'Card';
                    addPaymentToDebt(d.id, { id: 'P-' + Date.now(), amountUZS: amt, date: new Date().toISOString(), paymentType: payType });
                    onRefresh();
                  }
                }}>To'lov qilish</button>
              )}
              {isClosed && (
                <div style={{ marginTop: '15px', textAlign: 'center', color: '#27ae60', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                  <Lucide.CheckCircle size={16} /> To'liq yopilgan
                </div>
              )}
            </div>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <div className="glass" style={{ padding: '60px', textAlign: 'center', borderRadius: '20px', color: 'var(--text-secondary)' }}>
          <Lucide.Wallet size={48} opacity={0.2} style={{ margin: '0 auto 15px' }} />
          <p>{filter === 'Active' ? 'Hozircha faol nasiyalar yo\'q.' : 'Yopilgan nasiyalar topilmadi.'}</p>
        </div>
      )}

      {selectedDebtHistory && (
        <DebtHistoryModal 
          debt={selectedDebtHistory} 
          onClose={() => setSelectedDebtHistory(null)} 
        />
      )}
    </div>
  );
}

function DebtHistoryModal({ debt, onClose }: { debt: Debt, onClose: () => void }) {
  return (
    <div className="modal-overlay">
      <div className="modal-content glass animate-up" style={{ maxWidth: '500px', width: '95%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3>Nasiya Tarixi</h3>
          <button className="theme-btn" onClick={onClose}><Lucide.X size={20} /></button>
        </div>
        
        <div style={{ marginBottom: '20px', padding: '15px', borderRadius: '12px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '5px' }}>Mijoz:</p>
          <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{debt.customerName}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
            <span>Jami: <strong>{fmtUZS(debt.totalUZS)}</strong></span>
            <span style={{ color: (debt.totalUZS - debt.paidUZS) <= 100 ? '#27ae60' : 'var(--danger)' }}>
              Qarz: <strong>{fmtUZS(Math.max(0, debt.totalUZS - debt.paidUZS))}</strong>
            </span>
          </div>
        </div>

        <div className="history-timeline" style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '10px' }}>
          <div className="timeline-item" style={{ display: 'flex', gap: '15px', marginBottom: '20px', position: 'relative' }}>
            <div className="timeline-icon" style={{ zIndex: 1, background: 'var(--primary)', width: '12px', height: '12px', borderRadius: '50%', marginTop: '6px', flexShrink: 0 }}></div>
            <div className="timeline-line" style={{ position: 'absolute', left: '5px', top: '15px', bottom: '-20px', width: '2px', background: 'var(--glass-border)' }}></div>
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{fmtLocalDateTime(debt.date)}</p>
              <p style={{ fontWeight: 600 }}>Nasiya ochildi</p>
              <p style={{ fontSize: '0.9rem' }}>Summa: {fmtUZS(debt.totalUZS)}</p>
            </div>
          </div>

          {debt.payments.map((p, i) => (
            <div key={p.id} className="timeline-item" style={{ display: 'flex', gap: '15px', marginBottom: '20px', position: 'relative' }}>
              <div className="timeline-icon" style={{ zIndex: 1, background: '#27ae60', width: '12px', height: '12px', borderRadius: '50%', marginTop: '6px', flexShrink: 0 }}></div>
              {i < debt.payments.length - 1 && <div className="timeline-line" style={{ position: 'absolute', left: '5px', top: '15px', bottom: '-20px', width: '2px', background: 'var(--glass-border)' }}></div>}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{fmtLocalDateTime(p.date)}</p>
                  <span className="badge-status" style={{ fontSize: '0.7rem', padding: '2px 6px', background: p.paymentType === 'Cash' ? 'rgba(39,174,96,0.1)' : 'rgba(41,128,185,0.1)', color: p.paymentType === 'Cash' ? '#27ae60' : '#2980b9' }}>
                    {p.paymentType === 'Cash' ? 'Naqd' : 'Karta'}
                  </span>
                </div>
                <p style={{ fontWeight: 600 }}>To'lov qabul qilindi</p>
                <p style={{ fontSize: '0.9rem', color: '#27ae60', fontWeight: 700 }}>+{fmtUZS(p.amountUZS)}</p>
                {p.comment && <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>{p.comment}</p>}
              </div>
            </div>
          ))}
        </div>

        <button className="gold-btn w-full" style={{ marginTop: '20px' }} onClick={onClose}>Yopish</button>
      </div>
    </div>
  );
}

function StaffTab({ data, onRefresh }: { data: AppData, onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ name: '', phone: '', pin: '', role: 'Staff' });

  const handleSave = () => {
    if (!newUser.name || !newUser.phone || !newUser.pin) return alert("Barcha maydonlarni to'ldiring");
    if (editingId) {
      updateUser(editingId, { name: newUser.name, phone: newUser.phone, pin: newUser.pin, role: newUser.role as 'Staff' | 'Manager' });
    } else {
      addUser({
        id: Date.now().toString(),
        name: newUser.name,
        phone: newUser.phone,
        pin: newUser.pin,
        role: newUser.role as 'Staff'|'Manager',
        dailySales: 0,
        monthlySales: 0
      });
    }
    setShowAdd(false);
    setEditingId(null);
    setNewUser({ name: '', phone: '', pin: '', role: 'Staff' });
    onRefresh();
  };

  const handleEdit = (u: User) => {
    setNewUser({ name: u.name, phone: u.phone, pin: u.pin, role: u.role });
    setEditingId(u.id);
    setShowAdd(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Haqiqatan ham bu xodimni o'chirib tashlamoqchimisiz?")) {
      deleteUser(id);
      onRefresh();
    }
  };

  return (
    <div className="module-container glass animate-up">
      <div className="module-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Ishchilar Ro'yxati</h2>
        <button className="gold-btn" onClick={() => { setEditingId(null); setNewUser({ name: '', phone: '', pin: '', role: 'Staff' }); setShowAdd(true); }}>
          <Lucide.Plus size={18} /> Qo'shish
        </button>
      </div>

      <div className="staff-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {data.users.map(u => (
          <div key={u.id} className="staff-card glass" style={{ padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Top: Avatar & Info & Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'var(--gold-gradient)', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 600, color: '#1a1510' }}>
                  {u.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 600 }}>{u.name}</h3>
                  <span style={{ fontSize: '0.8rem', color: u.role === 'Manager' ? 'var(--primary)' : 'var(--text-secondary)' }}>
                    {u.role === 'Manager' ? 'Menejer' : 'Hodim'}
                  </span>
                </div>
              </div>
              
              {u.name !== 'Menejer' && u.name !== 'Admin' && (
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => handleEdit(u)} style={{ padding: '8px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: '8px' }} title="Tahrirlash">
                    <Lucide.Edit2 size={18} />
                  </button>
                  <button onClick={() => handleDelete(u.id)} style={{ padding: '8px', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', borderRadius: '8px' }} title="O'chirish">
                    <Lucide.Trash2 size={18} />
                  </button>
                </div>
              )}
            </div>
            
            {/* Middle: Phone Number */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(128,128,128,0.1)', padding: '10px 14px', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
              <Lucide.Phone size={15} color="var(--text-secondary)" />
              <span style={{ letterSpacing: '0.5px' }}>{u.phone}</span>
            </div>

            {/* Bottom: Stats */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bugun sotdi</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{u.dailySales} <span style={{fontSize: '0.8rem', fontWeight: 400}}>ta</span></span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Oylik sotuv</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{u.monthlySales} <span style={{fontSize: '0.8rem', fontWeight: 400}}>ta</span></span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal-content glass animate-up" style={{ width: '400px' }}>
            <h2>{editingId ? 'Xodimni tahrirlash' : 'Yangi xodim qo\'shish'}</h2>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr', gap: '12px', marginTop: '20px' }}>
              <input placeholder="Ism familiya" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
              <input placeholder="Telefon (mas: +998901234567)" value={newUser.phone} onChange={e => setNewUser({...newUser, phone: e.target.value})} />
              <input placeholder="PIN kod (parol)" value={newUser.pin} onChange={e => setNewUser({...newUser, pin: e.target.value})} />
              <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})}>
                <option value="Staff">Hodim</option>
                <option value="Manager">Menejer</option>
              </select>
            </div>
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <button className="gold-btn" style={{ flex: 1 }} onClick={handleSave}>Saqlash</button>
              <button className="theme-btn" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Bekor qilish</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsTab({ data, onRefresh }: { data: AppData, onRefresh: () => void }) {
  return (
    <div className="module-container animate-up">
      <div className="staff-grid">
        <div className="staff-card glass" onClick={exportData} style={{ cursor: 'pointer' }}><h3>Export Backup</h3><p style={{ opacity: 0.7 }}>JSON faylni yuklab olish</p></div>
        <div className="staff-card glass"><h3>Import Data</h3><input type="file" onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) { const text = await file.text(); if (importData(text)) { alert('Muvaffaqiyatli!'); onRefresh(); } }
        }} /></div>
      </div>
    </div>
  );
}

function Login({ onLogin }: { onLogin: (phone: string, pin: string) => boolean }) {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  return (
    <div className="login-screen" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-content glass" style={{ width: '350px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <img src="/logo.jpg" alt="Logo" style={{ width: '80px', height: '80px', borderRadius: '50%', border: '3px solid var(--primary)', objectFit: 'cover' }} />
        </div>
        <h2 style={{ textAlign: 'center' }}>Hadiya Gold</h2>
        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
        <input placeholder="Telefon" value={phone} onChange={e => setPhone(e.target.value)} style={{ width: '100%', marginTop: '15px' }} />
        <input type="password" placeholder="PIN" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && (!onLogin(phone, pin) && setError('Xato!'))} style={{ width: '100%', marginTop: '10px' }} />
        <button className="gold-btn w-full" style={{ marginTop: '20px' }} onClick={() => !onLogin(phone, pin) && setError('Xato!')}>Kirish</button>
      </div>
    </div>
  );
}

const QRScanner = ({ onScan }: { onScan: (code: string) => void }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const transitionRef = useRef(false);

  const startScanner = async () => {
    if (transitionRef.current) return;
    transitionRef.current = true;
    try {
      if (!scannerRef.current) scannerRef.current = new Html5Qrcode('qr-reader');
      const config = {
        fps: 10, qrbox: { width: 280, height: 100 }, disableFlip: true, useBarCodeDetectorIfSupported: true,
        formatsToSupport: [Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8, Html5QrcodeSupportedFormats.CODE_39, Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.QR_CODE],
        videoConstraints: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: "environment" }
      };
      await scannerRef.current.start({ facingMode: "environment" }, config, (decodedText) => {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime); gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start(); osc.stop(ctx.currentTime + 0.1);
        onScan(decodedText); stopScanner();
      }, () => {});
      setIsScanning(true); setError(null);
    } catch (err) {
      console.error('Scanner error:', err); setError('Kameraga ruxsat berilmagan.');
    } finally {
      transitionRef.current = false;
    }
  };

  const stopScanner = async () => {
    if (transitionRef.current) return;
    if (!scannerRef.current || !scannerRef.current.isScanning) { setIsScanning(false); return; }
    transitionRef.current = true;
    try {
      await scannerRef.current.stop(); setIsScanning(false);
      const el = document.getElementById('qr-reader'); if (el) el.innerHTML = '';
    } catch (err) { console.error(err); } finally { transitionRef.current = false; }
  };

  useEffect(() => {
    startScanner();
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {}).finally(() => { const el = document.getElementById('qr-reader'); if (el) el.innerHTML = ''; });
      }
    };
  }, []);

  return (
    <div className="scanner-container">
      {error && <p className="error-msg">{error}</p>}
      <div id="qr-reader" style={{ width: '100%', borderRadius: '15px', overflow: 'hidden', border: '1px solid var(--primary)' }}></div>
    </div>
  );
};

export default App;
