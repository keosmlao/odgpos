"use client";
import React from 'react';

const formatPrice = (price: unknown) => (Number(price) || 0).toLocaleString();

const formatDate = (dateString: string) => {
  try {
    return new Date(dateString).toLocaleString('en-GB', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch { return dateString; }
};

const ReceiptSlip = ({
  items = [], orderId, cashierName, cashierCode, salesName, salesCode, member, hasMember,
  subtotal = 0, discount = 0, promoDiscount = 0, memberDiscount = 0, total = 0,
  paymentType, receivedAmount = 0, changeDue = 0, earnedPoints = 0, issuedAt,
}: any) => {
  const timeLabel = issuedAt ? formatDate(issuedAt) : formatDate(new Date().toISOString());
  const SlipRow = ({ label, value, isBold, className = '' }: any) => (
    <div className={`flex justify-between items-start text-[8pt] ${isBold ? 'font-bold' : ''} ${className}`}>
      <span className="pr-2 whitespace-nowrap">{label}</span>
      <span className="font-mono text-right">{value}</span>
    </div>
  );
  return (
    <div id="slip-print-root" style={{ fontFamily: "'Phetsarath OT', 'Noto Sans Lao', sans-serif" }}>
      <div className="slip-paper bg-white text-black p-[3mm]">
        <header className="text-center mb-3">
          <h1 className="font-bold text-[11pt] tracking-wide">ODIENMALL</h1>
          <p className="text-[7pt]">{'\u0EAD\u0EB2\u0EC4\u0EAB\u0EBC\u0EC8 \u0EC1\u0EA5\u0EB0 \u0E9A\u0ECD\u0EA5\u0EB4\u0E81\u0EB2\u0E99'}</p>
          <p className="text-[7pt]">{'\u0E9A\u0EC9\u0EB2\u0E99 \u0E82\u0EBB\u0EA7\u0EAB\u0EBC\u0EA7\u0E87, \u0EC0\u0EA1\u0EB7\u0EAD\u0E87 \u0E88\u0EB1\u0E99\u0E97\u0EB0\u0E9A\u0EB9\u0EA5\u0EB5, \u0E99\u0EB0\u0E84\u0EAD\u0E99\u0EAB\u0EBC\u0EA7\u0E87\u0EA7\u0EBD\u0E87\u0E88\u0EB1\u0E99'}</p>
          <p className="text-[7pt]">{'\u0EC2\u0E97: 021 216 060'}</p>
        </header>
        <section className="border-t border-b border-dashed border-black py-2 my-2 space-y-1">
          <SlipRow label={'\u0EC0\u0EA5\u0E81\u0E97\u0EB5\u0E9A\u0EB4\u0E99:'} value={orderId || '-'} />
          <SlipRow label={'\u0EA7\u0EB1\u0E99\u0E97\u0EB5:'} value={timeLabel} />
          <SlipRow label={'\u0E9E\u0E99\u0E87.\u0E82\u0EB2\u0E8D:'} value={salesName || salesCode || '-'} />
          <SlipRow label={'\u0E9E\u0E99\u0E87.\u0EC0\u0E81\u0EB1\u0E9A\u0EC0\u0E87\u0EB4\u0E99:'} value={cashierName || cashierCode || '-'} />
        </section>
        <table className="w-full text-[8pt]">
          <thead><tr className="border-b border-dashed border-black"><th className="text-left font-bold pb-1">{'\u0EA5\u0EB2\u0E8D\u0E81\u0EB2\u0E99'}</th><th className="text-center font-bold pb-1">Qty</th><th className="text-right font-bold pb-1">{'\u0EA5\u0EA7\u0EA1'}</th></tr></thead>
          <tbody>{items.map((item: any, idx: number) => (
            <tr key={item.id || idx} className="align-top">
              <td className="pt-1 pr-1">{item.name}<div className="font-mono text-[7pt] opacity-80">{formatPrice(item.price)}</div>
                {item?.is_promo_gift && item?.gift_for_name && <div className="text-[7pt] text-blue-600 font-bold">{'\u0EC1\u0E96\u0EA1\u0E88\u0EB2\u0E81:'} {item.gift_for_name}</div>}
              </td>
              <td className="pt-1 text-center font-mono">{item.quantity}</td>
              <td className="pt-1 text-right font-mono">{formatPrice(item.price * item.quantity)}</td>
            </tr>
          ))}</tbody>
        </table>
        <section className="border-t border-dashed border-black mt-2 pt-2 space-y-1">
          <SlipRow label={'\u0E8D\u0EAD\u0E94\u0EA5\u0EA7\u0EA1:'} value={formatPrice(subtotal)} />
          {promoDiscount > 0 && <SlipRow label={'\u0EC2\u0E9B\u0EA3\u0EC2\u0EA1\u0E8A\u0EB1\u0E99 1 \u0EC1\u0E96\u0EA1 1:'} value={`-${formatPrice(promoDiscount)}`} />}
          {memberDiscount > 0 && <SlipRow label={`\u0EAA\u0EC8\u0EA7\u0E99\u0EAB\u0EBC\u0EB8\u0E94 (${member?.discount || 0}%):`} value={`-${formatPrice(memberDiscount)}`} />}
          {discount > 0 && promoDiscount <= 0 && memberDiscount <= 0 && <SlipRow label={'\u0EAA\u0EC8\u0EA7\u0E99\u0EAB\u0EBC\u0EB8\u0E94:'} value={`-${formatPrice(discount)}`} />}
          <SlipRow label={'\u0EA5\u0EA7\u0EA1\u0E97\u0EB1\u0E87\u0EDD\u0EBB\u0E94:'} value={`${formatPrice(total)} \u0E81\u0EB5\u0E9A`} isBold className="text-[10pt] mt-2" />
        </section>
        <section className="border-t border-dashed border-black mt-2 pt-2 space-y-1">
          <SlipRow label={'\u0E8A\u0ECD\u0EB2\u0EA5\u0EB0\u0EC2\u0E94\u0E8D:'} value={paymentType === 'transfer' ? '\u0EC2\u0EAD\u0E99 (OnePay)' : '\u0EC0\u0E87\u0EB4\u0E99\u0EAA\u0EBB\u0E94'} isBold />
          {paymentType === 'cash' && (<><SlipRow label={'\u0EAE\u0EB1\u0E9A\u0EC0\u0E87\u0EB4\u0E99:'} value={formatPrice(receivedAmount)} /><SlipRow label={'\u0EC0\u0E87\u0EB4\u0E99\u0E97\u0EAD\u0E99:'} value={formatPrice(changeDue)} className="font-bold" /></>)}
        </section>
        {hasMember && (
          <section className="border-t border-dashed border-black mt-2 pt-2 space-y-1">
            <div className="font-bold text-center text-[8pt] mb-1">-- {'\u0EAA\u0EB0\u0EA1\u0EB2\u0E8A\u0EB4\u0E81'} --</div>
            <SlipRow label={'\u0E8A\u0EB7\u0EC8:'} value={member?.name || '-'} />
            <SlipRow label={'\u0EC0\u0E9A\u0EB5\u0EC2\u0E97:'} value={member?.phone || '-'} />
            <SlipRow label={'\u0EC1\u0E95\u0EC9\u0EA1\u0E97\u0EB5\u0EC8\u0EC4\u0E94\u0EC9\u0EAE\u0EB1\u0E9A:'} value={`+${earnedPoints}`} isBold />
          </section>
        )}
        <footer className="text-center mt-3 pt-2 border-t border-dashed border-black">
          <p className="font-bold text-[9pt]">{'\u0E82\u0EAD\u0E9A\u0EC3\u0E88\u0E97\u0EB5\u0EC8\u0EA1\u0EB2\u0EAD\u0EB8\u0E94\u0EAB\u0E99\u0EB9\u0E99!'}</p>
          <p className="text-[7pt] mt-1">www.odglao.com</p>
          <p className="text-[7pt] opacity-80">Powered by ODIEN POS</p>
        </footer>
      </div>
    </div>
  );
};
export default ReceiptSlip;
