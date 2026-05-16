"use client";
import React from 'react';

const formatPrice = (price: unknown) => (Number(price) || 0).toLocaleString();

const DailySubmissionSlip = ({ summary = {} as any, bills = [] as any[], cashierName = '', cashierCode = '', salesName = '', salesCode = '', recipient = '', submittedAt = new Date().toLocaleString('lo-LA') }: any) => {
  const { total_all = 0, total_cash = 0, total_transfer = 0, count_bills = 0 } = summary;
  return (
    <div className="slip-print-root">
      <div className="slip-paper">
        <div className="text-center mb-4">
          <div className="text-[16px] font-black text-slate-900 mb-1">ODG SPARE PART</div>
          <div className="text-[11px] font-bold text-slate-700">{'\u0EC3\u0E9A\u0EAA\u0EBB\u0EC8\u0E87\u0EC0\u0E87\u0EB4\u0E99\u0E9B\u0EB0\u0E88\u0ECD\u0EB2\u0EA7\u0EB1\u0E99'}</div>
          <div className="text-[10px] font-semibold text-slate-600">Daily Money Submission</div>
        </div>
        <div className="slip-divider" />
        <div className="text-center mb-3"><div className="text-[10px] font-bold text-slate-700">{submittedAt}</div></div>
        <div className="slip-divider" />
        <div className="space-y-2 mb-3">
          <div className="text-[11px] font-black text-slate-800 mb-2">{'\u0EAA\u0EB0\u0EAB\u0EBC\u0EB8\u0E9A\u0E8D\u0EAD\u0E94\u0EC0\u0E87\u0EB4\u0E99'}</div>
          <div className="slip-row text-[10px]"><span className="font-bold text-emerald-700">{'\u0EC0\u0E87\u0EB4\u0E99\u0EAA\u0EBB\u0E94 (Cash)'}</span><span className="font-mono font-bold text-emerald-700">{formatPrice(total_cash)} ₭</span></div>
          <div className="slip-row text-[10px]"><span className="font-bold text-blue-700">{'\u0EC0\u0E87\u0EB4\u0E99\u0EC2\u0EAD\u0E99 (Transfer)'}</span><span className="font-mono font-bold text-blue-700">{formatPrice(total_transfer)} ₭</span></div>
          <div className="slip-divider" />
          <div className="slip-row text-[12px]"><span className="font-black text-slate-900">{'\u0E8D\u0EAD\u0E94\u0EA5\u0EA7\u0EA1\u0E97\u0EB1\u0E87\u0EDD\u0EBB\u0E94'}</span><span className="font-mono font-black text-slate-900">{formatPrice(total_all)} ₭</span></div>
          <div className="slip-row text-[10px]"><span className="font-bold text-slate-600">{'\u0E88\u0ECD\u0EB2\u0E99\u0EA7\u0E99\u0E9A\u0EB4\u0E99'}</span><span className="font-mono font-bold text-slate-700">{count_bills}</span></div>
        </div>
        <div className="slip-divider" />
        {bills && bills.length > 0 && (
          <div className="mb-3"><div className="text-[10px] font-black text-slate-800 mb-2">{'\u0EA5\u0EB2\u0E8D\u0E81\u0EB2\u0E99\u0E9A\u0EB4\u0E99'}</div>
            <div className="space-y-1">{bills.map((bill: any, idx: number) => (
              <div key={bill.id || bill.order_id || idx} className="text-[9px] border-b border-slate-100 pb-1">
                <div className="flex justify-between items-center"><span className="font-mono font-bold text-slate-700">{bill.order_id || '-'}</span><span className="font-mono font-bold text-slate-900">{formatPrice(bill.total || 0)} ₭</span></div>
                <div className="flex justify-between items-center mt-0.5 text-slate-500"><span className="font-semibold">{bill.staff || '-'}</span><span className="uppercase font-bold text-[8px]">{bill.payment_type || '-'}</span></div>
              </div>
            ))}</div></div>
        )}
        <div className="slip-divider" />
        <div className="space-y-1.5 mb-3 text-[10px]">
          <div className="slip-row"><span className="font-bold text-slate-600">Cashier</span><span className="font-semibold text-slate-800">{cashierCode ? `${cashierCode} / ${cashierName}` : cashierName || '-'}</span></div>
          {salesCode && salesName && <div className="slip-row"><span className="font-bold text-slate-600">Sales</span><span className="font-semibold text-slate-800">{salesCode} / {salesName}</span></div>}
          {recipient && <div className="slip-row"><span className="font-bold text-slate-600">{'\u0E9C\u0EB9\u0EC9\u0EAE\u0EB1\u0E9A\u0EC0\u0E87\u0EB4\u0E99'}</span><span className="font-semibold text-slate-800">{recipient}</span></div>}
        </div>
        <div className="slip-divider" />
        <div className="grid grid-cols-2 gap-4 mb-3 text-[9px]">
          <div className="text-center"><div className="h-8 border-b border-slate-300 mb-1"></div><div className="font-bold text-slate-700">{'\u0E9C\u0EB9\u0EC9\u0EAA\u0EBB\u0EC8\u0E87\u0EC0\u0E87\u0EB4\u0E99'}</div></div>
          <div className="text-center"><div className="h-8 border-b border-slate-300 mb-1"></div><div className="font-bold text-slate-700">{'\u0E9C\u0EB9\u0EC9\u0EAE\u0EB1\u0E9A\u0EC0\u0E87\u0EB4\u0E99'}</div></div>
        </div>
        <div className="slip-divider" />
        <div className="text-center space-y-2 mb-3"><div className="text-[12px] font-black text-slate-800">{'\u0E82\u0EAD\u0E9A\u0EC3\u0E88'}</div><div className="text-[10px] font-bold text-slate-600">THANK YOU</div></div>
        <div className="text-center text-[8px] text-slate-400 space-y-0.5"><p className="font-mono">www.odglao.com</p><p className="font-semibold">Powered by ODIEN POS System</p></div>
      </div>
    </div>
  );
};

export default DailySubmissionSlip;
