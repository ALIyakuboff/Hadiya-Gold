import React, { useState } from 'react';
import * as Lucide from 'lucide-react';
import { AppData, Investor } from '../types';
import { addInvestor, fmtUZS } from '../store';

export default function InvestorsTab({ data, onRefresh }: { data: AppData, onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<'Oltin' | 'USD' | 'UZS'>('Oltin');
  const [amount, setAmount] = useState('');

  const getDisplayValue = (inv: Investor): string => {
    if (inv.currency === 'Oltin') {
      const uzs = inv.amount * data.goldRateUZS;
      return `${inv.amount} g oltin (≈ ${fmtUZS(uzs)})`;
    } else if (inv.currency === 'USD') {
      const uzs = inv.amount * data.exchangeRateUZS;
      return `$${inv.amount.toLocaleString()} (≈ ${fmtUZS(uzs)})`;
    } else {
      return fmtUZS(inv.amount);
    }
  };

  const getPreview = (): string => {
    const a = Number(amount);
    if (!a) return '';
    if (currency === 'Oltin') return `≈ ${fmtUZS(a * data.goldRateUZS)}`;
    if (currency === 'USD') return `≈ ${fmtUZS(a * data.exchangeRateUZS)}`;
    return fmtUZS(a);
  };

  const handleAdd = () => {
    if (!name || !amount) return;
    addInvestor({
      id: Date.now().toString(),
      name,
      currency,
      amount: Number(amount),
      date: new Date().toISOString()
    });
    setName('');
    setAmount('');
    setShowAdd(false);
    onRefresh();
  };

  const totalUZS = data.investors.reduce((sum, inv) => {
    if (inv.currency === 'Oltin') return sum + inv.amount * data.goldRateUZS;
    if (inv.currency === 'USD') return sum + inv.amount * data.exchangeRateUZS;
    return sum + inv.amount;
  }, 0);

  return (
    <div className="module-container animate-up">
      <div className="module-header">
        <div>
          <h3>Sarmoyadorlar</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>Jami: {fmtUZS(totalUZS)}</span>
        </div>
        <button className="gold-btn" onClick={() => setShowAdd(true)}>
          <Lucide.Plus size={18} /> Qo'shish
        </button>
      </div>

      <div className="staff-grid">
        {data.investors.map(inv => (
          <div key={inv.id} className="staff-card glass">
            <div className="avatar-box">{inv.name.charAt(0)}</div>
            <h3>{inv.name}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
              <span className="badge-status" style={{
                background: inv.currency === 'Oltin' ? 'rgba(212,175,55,0.15)' : inv.currency === 'USD' ? 'rgba(39,174,96,0.15)' : 'rgba(41,128,185,0.15)',
                color: inv.currency === 'Oltin' ? 'var(--primary)' : inv.currency === 'USD' ? '#27ae60' : '#2980b9'
              }}>
                {inv.currency}
              </span>
            </div>
            <div className="staff-stats-row" style={{ marginTop: '12px' }}>
              <div className="staff-stat-item">
                <p>Kiritilgan</p>
                <span style={{ fontSize: '0.9rem' }}>{getDisplayValue(inv)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="modal-overlay">
          <div className="modal-content glass animate-up" style={{ maxWidth: '420px' }}>
            <h3>Sarmoyador qo'shish</h3>
            <input
              placeholder="Ism familiya"
              style={{ width: '100%', marginTop: '15px' }}
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <select
              style={{ width: '100%', marginTop: '12px' }}
              value={currency}
              onChange={e => setCurrency(e.target.value as any)}
            >
              <option value="Oltin">🥇 Oltin (gramm)</option>
              <option value="USD">💵 Dollar (USD)</option>
              <option value="UZS">💴 So'm (UZS)</option>
            </select>
            <input
              type="number"
              placeholder={currency === 'Oltin' ? 'Miqdor (gramm)' : currency === 'USD' ? 'Miqdor ($)' : "Miqdor (so'm)"}
              style={{ width: '100%', marginTop: '12px' }}
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
            {amount && (
              <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', fontSize: '0.9rem', color: 'var(--primary)' }}>
                {getPreview()}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="gold-btn" style={{ flex: 1 }} onClick={handleAdd}>Saqlash</button>
              <button className="gold-btn" style={{ flex: 1, background: 'var(--danger)' }} onClick={() => setShowAdd(false)}>Bekor</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
