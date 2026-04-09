import React, { useState } from 'react';
import * as Lucide from 'lucide-react';
import { AppData } from '../types';
import { fmtUZS, getLocalDate, fmtLocalDateTime, returnSale } from '../store';

export default function HistoryTab({ data, searchQuery, isManager }: { data: AppData, searchQuery: string, isManager: boolean }) {
  const today = getLocalDate(); // Toshkent vaqti YYYY-MM-DD
  const [selectedDate, setSelectedDate] = useState(today);

  const filtered = data.sales
    .filter(s => getLocalDate(s.date) === selectedDate)
    .filter(s =>
      s.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.productCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.sellerName.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .slice()
    .reverse();

  const validSales = filtered.filter(s => !s.isReturned);
  const totalUZS = validSales.reduce((sum, s) => sum + s.soldPriceUZS, 0);
  const cashUZS = validSales.reduce((sum, s) => sum + s.cashAmountUZS, 0);
  const cardUZS = validSales.reduce((sum, s) => sum + (s.cardAmountUZS || 0), 0);
  const nasiyaUZS = validSales.reduce((sum, s) => sum + s.nasiyaAmountUZS, 0);

  const paymentLabel = (type: string) => {
    const map: Record<string, string> = {
      Cash: 'Naqd', Card: 'Karta', Nasiya: 'Nasiya',
      Mixed: 'Naqd+Nasiya', CashCard: 'Naqd+Karta', CashCardNasiya: 'Aralash'
    };
    return map[type] || type;
  };

  const payColor = (type: string) => {
    if (type === 'Cash') return { bg: 'rgba(39,174,96,0.1)', color: '#27ae60' };
    if (type === 'Card') return { bg: 'rgba(41,128,185,0.1)', color: '#2980b9' };
    return { bg: 'rgba(231,76,60,0.1)', color: 'var(--danger)' };
  };

  return (
    <div className="module-container animate-up">
      {/* Calendar bar */}
      <div className="glass" style={{ padding: '16px 20px', borderRadius: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <Lucide.Calendar size={20} color="var(--primary)" />
        <input
          type="date"
          value={selectedDate}
          max={today}
          onChange={e => setSelectedDate(e.target.value)}
          style={{ background: 'transparent', border: '1px solid var(--primary)', borderRadius: '10px', padding: '8px 14px', color: 'var(--text-primary)', fontSize: '1rem', cursor: 'pointer', width: 'auto' }}
        />
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="gold-btn" style={{ padding: '6px 14px', fontSize: '0.8rem', textTransform: 'none', letterSpacing: 0 }}
            onClick={() => setSelectedDate(today)}>Bugun</button>
          <button className="gold-btn" style={{ padding: '6px 14px', fontSize: '0.8rem', textTransform: 'none', letterSpacing: 0, background: 'var(--input-bg)', color: 'var(--text-primary)', boxShadow: 'none' }}
            onClick={() => {
              const d = new Date(today);
              d.setDate(d.getDate() - 1);
              setSelectedDate(d.toISOString().split('T')[0]);
            }}>Kecha</button>
        </div>
        <span style={{ color: '#a4b0be', fontSize: '0.85rem', marginLeft: 'auto' }}>{filtered.length} ta sotuv</span>
        {selectedDate === today && <span className="badge-status">Bugun</span>}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Jami Savdo', val: totalUZS, color: 'var(--primary)', icon: <Lucide.TrendingUp size={24} /> },
          { label: 'Naqd', val: cashUZS, color: '#27ae60', icon: <Lucide.Banknote size={24} /> },
          { label: 'Karta', val: cardUZS, color: '#2980b9', icon: <Lucide.CreditCard size={24} /> },
          { label: 'Nasiya', val: nasiyaUZS, color: 'var(--danger)', icon: <Lucide.ClipboardList size={24} /> },
        ].map(({ label, val, color, icon }) => (
          <div key={label} className="stat-card glass" style={{ borderLeft: `4px solid ${color}` }}>
            <div className="stat-icon" style={{ background: `${color}22`, color }}>{icon}</div>
            <div className="stat-info">
              <h3>{label}</h3>
              <p style={{ color, fontSize: '1rem', fontWeight: 700 }}>{fmtUZS(val)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="table-container glass">
        <table>
          <thead>
            <tr>
              <th>Vaqt</th>
              <th>Mahsulot</th>
              <th>Sotuvchi</th>
              <th>To'lov</th>
              <th>Summa</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '50px', opacity: 0.5 }}>
                <Lucide.CalendarX size={40} style={{ margin: '0 auto 10px', display: 'block' }} />
                Bu kunda sotuv yo'q
              </td></tr>
            ) : (
              filtered.map(s => {
                const { bg, color } = payColor(s.paymentType);
                return (
                  <tr key={s.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{fmtLocalDateTime(s.date)}</td>
                    <td>
                      <strong>{s.productName}</strong>
                      <div style={{ fontSize: '0.78rem', color: '#a4b0be' }}>{s.productCode}</div>
                    </td>
                    <td>{s.sellerName}</td>
                    <td>
                      <span className="badge-status" style={{ background: bg, color, border: `1px solid ${color}40` }}>
                        {paymentLabel(s.paymentType)}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, whiteSpace: 'nowrap', color: s.isReturned ? 'var(--danger)' : 'inherit', textDecoration: s.isReturned ? 'line-through' : 'none' }}>
                      {fmtUZS(s.soldPriceUZS)}
                      {isManager && !s.isReturned && (
                        <button 
                          className="theme-btn" 
                          style={{ marginLeft: '10px', padding: '4px', borderRadius: '6px', color: 'var(--danger)' }}
                          onClick={() => {
                            if (window.confirm("Ushbu mahsulot qaytarilganini tasdiqlaysizmi?")) {
                              returnSale(s.id);
                              window.location.reload(); // Refresh to see changes
                            }
                          }}
                          title="Qaytarish"
                        >
                          <Lucide.RotateCcw size={14} />
                        </button>
                      )}
                      {s.isReturned && <div style={{ fontSize: '0.65rem', color: 'var(--danger)', textDecoration: 'none' }}>Qaytarilgan</div>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
