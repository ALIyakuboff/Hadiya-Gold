import React, { useState } from 'react';
import * as Lucide from 'lucide-react';
import { format } from 'date-fns';
import { AppData, Expense } from '../types';
import { addExpense, fmtUZS } from '../store';

export default function ExpensesTab({ data, onRefresh }: { data: AppData, onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [description, setDescription] = useState('');
  const [amountUZS, setAmountUZS] = useState('');
  const [category, setCategory] = useState<Expense['category']>('Boshqa');

  const handleAdd = () => {
    if (!description || !amountUZS) return;
    addExpense({
      id: Date.now().toString(),
      category,
      description,
      amountUZS: Number(amountUZS),
      date: new Date().toISOString()
    });
    setDescription('');
    setAmountUZS('');
    setShowAdd(false);
    onRefresh();
  };

  const todayTotal = data.expenses
    .filter(e => e.date.startsWith(new Date().toISOString().split('T')[0]))
    .reduce((s, e) => s + e.amountUZS, 0);

  return (
    <div className="module-container glass animate-up">
      <div className="module-header">
        <div>
          <h3>Xarajatlar</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--danger)' }}>Bugun: {fmtUZS(todayTotal)}</span>
        </div>
        <button className="gold-btn" onClick={() => setShowAdd(true)}>
          <Lucide.Plus size={18} /> Yangi
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Sana</th>
              <th>Kategoriya</th>
              <th>Izoh</th>
              <th>Summa (UZS)</th>
            </tr>
          </thead>
          <tbody>
            {data.expenses.slice().reverse().map(e => (
              <tr key={e.id}>
                <td>{format(new Date(e.date), 'dd/MM/yy HH:mm')}</td>
                <td><span className="badge-status" style={{ background: 'rgba(231,76,60,0.1)', color: 'var(--danger)' }}>{e.category}</span></td>
                <td>{e.description}</td>
                <td style={{ fontWeight: 700 }}>{fmtUZS(e.amountUZS)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="modal-overlay">
          <div className="modal-content glass animate-up" style={{ maxWidth: '420px' }}>
            <h3>Yangi Xarajat</h3>
            <select
              style={{ width: '100%', marginTop: '15px' }}
              value={category}
              onChange={e => setCategory(e.target.value as Expense['category'])}
            >
              <option value="Ijara">Ijara</option>
              <option value="Oylik">Ishchi oylik</option>
              <option value="Soliq">Soliq</option>
              <option value="Kommunal">Kommunal</option>
              <option value="Boshqa">Boshqa</option>
            </select>
            <input
              placeholder="Izoh"
              style={{ width: '100%', marginTop: '12px' }}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
            <input
              type="number"
              placeholder="Summa (so'm)"
              style={{ width: '100%', marginTop: '12px' }}
              value={amountUZS}
              onChange={e => setAmountUZS(e.target.value)}
            />
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
