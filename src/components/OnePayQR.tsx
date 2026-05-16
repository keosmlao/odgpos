"use client";
import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle } from 'lucide-react';

const scriptPromises = new Map();
const globalSession: any = { orderId: null, amount: null, code: null, success: false, notified: false, unsubscribe: null, listeners: new Set(), successHandlers: new Set() };

const ensureScript = (src: string, globalName: string) => {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window is not available'));
  if (globalName && (window as any)[globalName]) return Promise.resolve();
  if (scriptPromises.has(src)) return scriptPromises.get(src);
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = src; script.async = true;
    script.addEventListener('load', () => resolve(undefined), { once: true });
    script.addEventListener('error', (err) => { script.remove(); scriptPromises.delete(src); reject(err); }, { once: true });
    document.body.appendChild(script);
  });
  scriptPromises.set(src, promise);
  return promise;
};

const notifyListeners = () => { globalSession.listeners.forEach((l: any) => { try { l({ code: globalSession.code, success: globalSession.success }); } catch {} }); };
const notifySuccessHandlers = () => { if (globalSession.notified) return; globalSession.notified = true; globalSession.successHandlers.forEach((h: any) => { try { h(); } catch {} }); };

const OnePayQR = ({ orderId, totalAmount, onPaymentSuccess }: any) => {
  const qrRef = useRef<HTMLImageElement>(null);
  const [success, setSuccess] = useState(false);
  const successCallbackRef = useRef(onPaymentSuccess);
  useEffect(() => { successCallbackRef.current = onPaymentSuccess; }, [onPaymentSuccess]);
  useEffect(() => { if (!orderId) { setSuccess(false); if (qrRef.current) qrRef.current.removeAttribute('src'); } }, [orderId]);
  useEffect(() => {
    if (typeof window === 'undefined' || !orderId) return;
    const amountNumber = Number(totalAmount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) return;
    const currentOrderId = String(orderId);
    const handleSessionUpdate = ({ code, success: s }: any) => { if (code && qrRef.current && qrRef.current.src !== code) qrRef.current.src = code; setSuccess(s); };
    const successHandler = () => { if (typeof successCallbackRef.current === 'function') successCallbackRef.current('transfer'); };
    globalSession.listeners.add(handleSessionUpdate);
    globalSession.successHandlers.add(successHandler);
    handleSessionUpdate({ code: globalSession.code, success: globalSession.success && globalSession.orderId === currentOrderId });
    const startNewSession = async () => {
      try {
        await ensureScript('https://cdn.pubnub.com/sdk/javascript/pubnub.4.27.3.js', 'PubNub');
        await ensureScript('/onepay.js', 'OnePay');
        if (!(window as any).OnePay) throw new Error('OnePay library is not available');
        if (globalSession.unsubscribe) try { globalSession.unsubscribe(); } catch {}
        globalSession.orderId = currentOrderId; globalSession.amount = amountNumber; globalSession.code = null; globalSession.success = false; globalSession.notified = false;
        notifyListeners();
        const onePay = new (window as any).OnePay('mch5c1b169a4dc76'); onePay.debug = true;
        globalSession.unsubscribe = () => { try { if (typeof onePay.stop === 'function') onePay.stop(); } catch {} };
        onePay.getCode({ transactionid: currentOrderId, invoiceid: currentOrderId, terminalid: '001', amount: amountNumber, description: `Order: ${currentOrderId}`, expiretime: 5 }, (code: string) => {
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${code}`;
          if (globalSession.orderId !== currentOrderId) return; globalSession.code = qrUrl; notifyListeners();
        });
        onePay.subscribe({ uuid: currentOrderId, shopcode: null, tid: null }, (res: any) => {
          if (!res || res.uuid !== currentOrderId || globalSession.orderId !== currentOrderId || globalSession.success) return;
          globalSession.success = true; notifyListeners(); notifySuccessHandlers();
        });
      } catch (error) { console.error('OnePay initialization failed', error); }
    };
    if (!(globalSession.orderId === currentOrderId && globalSession.amount === amountNumber)) startNewSession();
    else notifyListeners();
    return () => { globalSession.listeners.delete(handleSessionUpdate); globalSession.successHandlers.delete(successHandler); };
  }, [orderId, totalAmount]);

  return (
    <div className="flex flex-col items-center justify-center text-center space-y-4">
      {success ? (
        <div className="flex flex-col items-center justify-center space-y-3"><CheckCircle className="text-green-500 w-20 h-20" /><p className="text-lg font-semibold text-green-600">{'\u0E8A\u0ECD\u0EB2\u0EA5\u0EB0\u0EC0\u0E87\u0EB4\u0E99\u0EAA\u0ECD\u0EB2\u0EC0\u0EA5\u0EB1\u0E94!'}</p></div>
      ) : (
        <><div id="qrcode" className="border-4 border-dashed border-red-400 rounded-xl p-2 bg-white shadow-lg"><img ref={qrRef} className="rounded-md" alt="QR Code" /></div>
          <p className="text-gray-600 text-sm">{'\u0EAA\u0EB0\u0EC1\u0E81\u0E99 QR \u0E94\u0EC9\u0EA7\u0E8D'} <span className="font-bold text-blue-600">BCEL One</span></p>
          <div className="mt-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 shadow-sm">{Number(totalAmount || 0).toLocaleString()} ₭</div>
        </>
      )}
    </div>
  );
};

export default OnePayQR;
