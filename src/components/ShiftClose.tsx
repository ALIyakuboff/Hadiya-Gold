import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import * as Lucide from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AppData, Shift } from '../types';
import { saveShift, fmtUZS, getLocalDate, fmtLocalDateTime } from '../store';

const SHIFT_PASS = '7777';

interface Props {
  data: AppData;
  currentUser: { name: string; role: string };
  onRefresh: () => void;
}

export default function ShiftClose({ data, currentUser, onRefresh }: Props) {
  const [show, setShow] = useState(false);
  const [pass, setPass] = useState('');
  const [passError, setPassError] = useState('');
  const [step, setStep] = useState<'pass' | 'report'>('pass');

  const today = getLocalDate(); // Toshkent sanasi

  const todaySales = data.sales.filter(s => getLocalDate(s.date) === today);
  const todayExpenses = data.expenses.filter(e => getLocalDate(e.date) === today);

  const inboundToday = data.inboundMoney ? data.inboundMoney.filter(i => getLocalDate(i.date) === today) : [];

  const totals = {
    sales: todaySales.reduce((s, x) => s + x.soldPriceUZS, 0),
    cash: todaySales.reduce((s, x) => s + x.cashAmountUZS, 0),
    card: todaySales.reduce((s, x) => s + (x.cardAmountUZS || 0), 0),
    nasiya: todaySales.reduce((s, x) => s + x.nasiyaAmountUZS, 0),
    expenses: todayExpenses.reduce((s, x) => s + x.amountUZS, 0),
    inbound: inboundToday.reduce((s, x) => s + x.amountUZS, 0)
  };
  const net = totals.cash + totals.card + totals.inbound - totals.expenses;

  const handleClose = () => { setShow(false); setPass(''); setStep('pass'); setPassError(''); };

  const handlePassCheck = () => {
    if (pass === SHIFT_PASS) { setStep('report'); setPassError(''); }
    else { setPassError("Parol noto'g'ri!"); }
  };

  const handlePrintSave = () => {
    const nowStr = new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });
    const doc = new jsPDF('p', 'mm', 'a4');
    const cx = doc.internal.pageSize.getWidth() / 2;

    // Add Logo
    try {
      doc.addImage('/logo.jpg', 'JPEG', cx - 15, 8, 30, 30);
    } catch (e) {
      console.error('Logo add error:', e);
    }

    doc.setFontSize(20);
    doc.text(data.settings.shopName, cx, 44, { align: 'center' });
    doc.setFontSize(10);
    doc.text(data.settings.address, cx, 51, { align: 'center' });
    doc.text(data.settings.phone, cx, 56, { align: 'center' });
    doc.setFontSize(15);
    doc.text('KUNLIK KASSA HISOBOTI', cx, 66, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Sana: ${nowStr}`, cx, 73, { align: 'center' });
    doc.text(`Yopdi: ${currentUser.name}`, cx, 78, { align: 'center' });

    autoTable(doc, {
      startY: 86,
      head: [["Ko'rsatkich", 'Summa']],
      body: [
        ['Jami Savdo', fmtUZS(totals.sales)],
        ['Naqd Tushum', fmtUZS(totals.cash)],
        ['Karta Tushum', fmtUZS(totals.card)],
        ['Pul Keldi (Kirim)', fmtUZS(totals.inbound)],
        ['Nasiya (Savdo)', fmtUZS(totals.nasiya)],
        ['Xarajatlar', fmtUZS(totals.expenses)],
        ['SOF TUSHUM', fmtUZS(net)],
      ],
      styles: { fontSize: 11 },
      headStyles: { fillColor: [212, 175, 55], textColor: [0, 0, 0], fontStyle: 'bold' },
      bodyStyles: { valign: 'middle' },
      alternateRowStyles: { fillColor: [250, 248, 244] },
    });

    const lastY = (doc as any).lastAutoTable?.finalY || 150;
    if (todaySales.length > 0) {
      doc.setFontSize(12); doc.text("Sotuvlar:", 14, lastY + 10);
      autoTable(doc, {
        startY: lastY + 14,
        head: [['Mahsulot', "To'lov", 'Summa']],
        body: todaySales.map(s => [s.productName, s.paymentType, fmtUZS(s.soldPriceUZS)]),
        styles: { fontSize: 9 },
      });
    }

    const pdfBlob = doc.output('blob');
    const msg = `💰 <b>KUNLIK KASSA YOPILDI</b>\nSana: ${nowStr}\nSmena yopuvchi: ${currentUser.name}\n\nJami Savdo: ${fmtUZS(totals.sales)}\nNaqd Tushum: ${fmtUZS(totals.cash)}\nKarta Tushum: ${fmtUZS(totals.card)}\n➕ Pul Keldi (Tushum): ${fmtUZS(totals.inbound)}\nNasiya (Sotuv): ${fmtUZS(totals.nasiya)}\n➖ Xarajatlar: ${fmtUZS(totals.expenses)}\n\n<b>SOF TUSHUM: ${fmtUZS(net)}</b>\n<i>(Sof tushum = Naqd + Karta + Pul Keldi - Xarajat)</i>`;

    // PDF ni base64 ga o'girish va bot server orqali yuborish
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const resp = await fetch('/api/send-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg, pdfBase64: base64, filename: `kassa_${today}.pdf` }),
        });
        const result = await resp.json();
        if (result.ok) {
          console.log(`✅ Hisobot ${result.sent} ta Menejerga yuborildi.`);
        } else {
          console.warn('Bot yuborish xatosi:', result.error);
        }
      } catch (e) {
        console.error('Bot server bilan aloqa yo\'q:', e);
      }
    };
    reader.readAsDataURL(pdfBlob);

    doc.save(`kassa_${today}.pdf`);

    const pw = window.open('', '_blank');
    if (pw) {
      pw.document.write(`<html><head><title>Kassa ${today}</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;max-width:500px;margin:auto}
      h2,h3{text-align:center;color:#a07800}hr{border:1px solid #e0c96e;margin:12px 0}
      .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0e8c8}
      .label{font-weight:bold;color:#666}.val{font-weight:700}
      .total{background:#fff8e1;padding:12px;border-radius:8px;margin-top:12px;display:flex;justify-content:space-between}
      </style></head><body>
      <div style="text-align:center;margin-bottom:15px">
        <img src="/logo.jpg" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:2px solid #d4af37">
      </div>
      <h2>${data.settings.shopName}</h2>
      <p style="text-align:center;color:#888">${data.settings.address} | ${data.settings.phone}</p>
      <h3>KUNLIK KASSA HISOBOTI</h3>
      <p style="text-align:center;font-size:0.9em;color:#888">${nowStr} | ${currentUser.name}</p><hr>
      <div class="row"><span class="label">Jami Savdo:</span><span class="val">${fmtUZS(totals.sales)}</span></div>
      <div class="row"><span class="label">Naqd Tushum:</span><span class="val">${fmtUZS(totals.cash)}</span></div>
      <div class="row"><span class="label">Karta Tushum:</span><span class="val">${fmtUZS(totals.card)}</span></div>
      <div class="row"><span class="label">Pul Keldi:</span><span class="val" style="color:green">${fmtUZS(totals.inbound)}</span></div>
      <div class="row"><span class="label">Nasiya:</span><span class="val">${fmtUZS(totals.nasiya)}</span></div>
      <div class="row"><span class="label">Xarajatlar:</span><span class="val" style="color:red">${fmtUZS(totals.expenses)}</span></div>
      <div class="total"><span style="font-weight:700">SOF TUSHUM:</span><span style="font-weight:900;font-size:1.2em;color:#a07800">${fmtUZS(net)}</span></div>
      </body></html>`);
      pw.document.close();
      setTimeout(() => { pw.print(); pw.close(); }, 400);
    }

    saveShift({ id: 'SHIFT-' + Date.now(), date: new Date().toISOString(), closedBy: currentUser.name, totalSalesUZS: totals.sales, totalCashUZS: totals.cash, totalCardUZS: totals.card, totalNasiyaUZS: totals.nasiya, totalExpensesUZS: totals.expenses });
    onRefresh();
    handleClose();
  };

  return (
    <>
      <button
        className="gold-btn"
        style={{ background: 'rgba(231,76,60,0.12)', color: 'var(--danger)', border: '1px solid rgba(231,76,60,0.4)', boxShadow: 'none', padding: '10px 16px', fontSize: '0.85rem' }}
        onClick={() => setShow(true)}
      >
        <Lucide.LockKeyhole size={16} /> Kassani Yopish
      </button>

      {show && createPortal(
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && handleClose()}>
          <div className="shift-modal glass animate-up">
            {step === 'pass' ? (
              <div className="shift-pass-screen">
                <div className="shift-icon-wrap">
                  <Lucide.LockKeyhole size={40} color="var(--danger)" />
                </div>
                <h3 style={{ color: 'var(--danger)', marginBottom: '8px' }}>Kassani Yopish</h3>
                <p style={{ color: '#a4b0be', fontSize: '0.9rem', marginBottom: '28px', textAlign: 'center' }}>
                  Bugungi kunlik hisobotni yakunlash uchun parolni kiriting
                </p>
                <div className="pin-input-wrap">
                  <input
                    type="password"
                    placeholder="● ● ● ●"
                    value={pass}
                    maxLength={4}
                    onChange={e => setPass(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePassCheck()}
                    style={{ textAlign: 'center', fontSize: '2rem', letterSpacing: '12px', fontWeight: 700, border: `2px solid ${passError ? 'var(--danger)' : 'var(--glass-border)'}` }}
                    autoFocus
                  />
                </div>
                {passError && (
                  <div style={{ color: 'var(--danger)', textAlign: 'center', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <Lucide.AlertCircle size={16} /> {passError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
                  <button className="gold-btn" style={{ flex: 1, background: 'var(--danger)', boxShadow: '0 4px 15px rgba(231,76,60,0.3)' }} onClick={handlePassCheck}>
                    <Lucide.Unlock size={18} /> Tasdiqlash
                  </button>
                  <button className="gold-btn" style={{ flex: 1, background: 'transparent', color: 'var(--text-secondary)', boxShadow: 'none', border: '1px solid var(--glass-border)' }} onClick={handleClose}>
                    Bekor
                  </button>
                </div>
              </div>
            ) : (
              <div className="shift-report-screen">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                  <div>
                    <h3 style={{ margin: 0, color: 'var(--primary)' }}>Kunlik Hisobot</h3>
                    <p style={{ color: '#a4b0be', fontSize: '0.85rem', marginTop: '4px' }}>{today} • {currentUser.name}</p>
                  </div>
                  <span style={{ background: 'rgba(39,174,96,0.1)', color: '#27ae60', border: '1px solid #27ae6040', borderRadius: '20px', padding: '4px 12px', fontSize: '0.8rem', fontWeight: 700 }}>
                    {todaySales.length} ta sotuv
                  </span>
                </div>

                {/* Stat rows */}
                <div className="shift-stats">
                  {[
                    { label: 'Jami Savdo', val: totals.sales, icon: <Lucide.TrendingUp size={20} />, color: 'var(--primary)' },
                    { label: 'Naqd Tushum', val: totals.cash, icon: <Lucide.Banknote size={20} />, color: '#27ae60' },
                    { label: 'Karta Tushum', val: totals.card, icon: <Lucide.CreditCard size={20} />, color: '#2980b9' },
                    { label: 'Pul Keldi (Tushum)', val: totals.inbound, icon: <Lucide.CircleDollarSign size={20} />, color: 'var(--primary)' },
                    { label: 'Nasiya (Savdo)', val: totals.nasiya, icon: <Lucide.ClipboardList size={20} />, color: 'var(--danger)' },
                    { label: 'Xarajatlar', val: totals.expenses, icon: <Lucide.TrendingDown size={20} />, color: '#e67e22' },
                  ].map(({ label, val, icon, color }) => (
                    <div key={label} className="shift-stat-row">
                      <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color }}>{icon}</span> {label}
                      </span>
                      <strong style={{ color }}>{fmtUZS(val)}</strong>
                    </div>
                  ))}
                </div>

                <div className="shift-net-total">
                  <span>SOF TUSHUM (Naqd+Karta+Pul Keldi−Xarajat)</span>
                  <strong style={{ color: net >= 0 ? 'var(--primary)' : 'var(--danger)', fontSize: '1.2rem' }}>{fmtUZS(net)}</strong>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                  <button className="gold-btn" style={{ flex: 2 }} onClick={handlePrintSave}>
                    <Lucide.Printer size={18} /> PDF & Chop Etish
                  </button>
                  <button className="gold-btn" style={{ flex: 1, background: 'transparent', color: 'var(--text-secondary)', boxShadow: 'none', border: '1px solid var(--glass-border)' }} onClick={handleClose}>
                    Yopish
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
