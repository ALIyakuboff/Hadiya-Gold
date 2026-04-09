import React, { useState } from 'react';
import * as Lucide from 'lucide-react';
import { AppData } from '../types';
import { addInboundMoney, fmtUZS, fmtLocalDateTime, getLocalDate } from '../store';

interface Props {
  data: AppData;
  onRefresh: () => void;
  searchQuery: string;
}

export default function InboundTab({ data, onRefresh, searchQuery }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [newEntry, setNewEntry] = useState({ fromWho: '', source: '', amountUZS: '' });

  const filtered = (data.inboundMoney || [])
    .filter(i => 
      i.fromWho.toLowerCase().includes(searchQuery.toLowerCase()) || 
      i.source.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .slice()
    .reverse();

  const handleAdd = () => {
    if (!newEntry.fromWho || !newEntry.source || !newEntry.amountUZS) {
      alert("Barcha maydonlarni to'ldiring!");
      return;
    }
    
    addInboundMoney({
      id: 'INB-' + Date.now(),
      fromWho: newEntry.fromWho,
      source: newEntry.source,
      amountUZS: Number(newEntry.amountUZS),
      date: new Date().toISOString()
    });
    
    setNewEntry({ fromWho: '', source: '', amountUZS: '' });
    setShowAdd(false);
    onRefresh();
  };

  const today = getLocalDate();
  const todayTotal = (data.inboundMoney || [])
    .filter(i => getLocalDate(i.date) === today)
    .reduce((sum, i) => sum + i.amountUZS, 0);

  return (
    <div className="module-container animate-up">
      <div className="module-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Pul Keldi (Kirim)</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Bugungi kirim: <strong style={{ color: '#27ae60' }}>{fmtUZS(todayTotal)}</strong></p>
        </div>
        <button className="gold-btn" onClick={() => setShowAdd(true)}>
          <Lucide.Plus size={20} /> Yangi Kirim
        </button>
      </div>

      <div className="table-container glass">
        <table>
          <thead>
            <tr>
              <th>Vaqt</th>
              <th>Kimdan</th>
              <th>Qayerdan / Sabab</th>
              <th>Summa</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '50px', opacity: 0.5 }}>Hozircha kirimlar yo'q</td></tr>
            ) : (
              filtered.map(item => (
                <tr key={item.id}>
                  <td style={{ fontSize: '0.85rem' }}>{fmtLocalDateTime(item.date)}</td>
                  <td><strong>{item.fromWho}</strong></td>
                  <td><span className="badge-status" style={{ background: 'rgba(41,128,185,0.1)', color: '#2980b9' }}>{item.source}</span></td>
                  <td style={{ fontWeight: 700, color: '#27ae60' }}>{fmtUZS(item.amountUZS)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal-content glass animate-up" style={{ width: '400px' }}>
            <h3 style={{ marginBottom: '20px', color: 'var(--primary)' }}>Yangi Kirim Qo'shish</h3>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '5px', display: 'block' }}>Kimdan keldi?</label>
                <input placeholder="Masalan: Alisher Aka" value={newEntry.fromWho} onChange={e => setNewEntry({...newEntry, fromWho: e.target.value})} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '5px', display: 'block' }}>Qayerdan / Maqsad?</label>
                <input placeholder="Masalan: Qarz qaytardi, yoki Plastikdan" value={newEntry.source} onChange={e => setNewEntry({...newEntry, source: e.target.value})} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '5px', display: 'block' }}>Summa (so'm)</label>
                <input type="number" placeholder="Masalan: 500000" value={newEntry.amountUZS} onChange={e => setNewEntry({...newEntry, amountUZS: e.target.value})} style={{ width: '100%' }} />
              </div>
            </div>
            <div style={{ marginTop: '25px', display: 'flex', gap: '10px' }}>
              <button className="gold-btn" style={{ flex: 1, background: '#27ae60' }} onClick={handleAdd}>Saqlash</button>
              <button className="gold-btn" style={{ flex: 1, background: 'var(--danger)' }} onClick={() => setShowAdd(false)}>Bekor</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
