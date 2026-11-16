import { Fragment } from 'react';
import { html } from '../ui.jsx';
import { MONTHS, toPaise, inr, fmtISO, numStr, amountWords } from './payslip.js';
import logo from './assets/logo.svg';
import watermarkLarge from './assets/watermark-large.svg';
import watermarkSmall from './assets/watermark-small.svg';

/* One payslip, A4 portrait at 595 x 842. The same component draws the preview and the page that becomes the PDF, so they always match.
   Text is placed by React, so anything typed into a field is escaped. The look lives in payslipGen.css under .pgs. */
export function Sheet({ it }) {
  const [y, m] = it.month.split('-').map(Number), monthName = MONTHS[m - 1], paise = toPaise(it.amt);
  const summary = [['Employee Name', it.name], ['Designation', it.designation], ['Date of Joining', fmtISO(it.doj)]];
  if (/^\d{4}-\d{2}-\d{2}$/.test(it.lwd || '')) summary.push(['Last Working Day', fmtISO(it.lwd)]);
  summary.push(['Pay Period', monthName + ' ' + y], ['Pay Date', fmtISO(it.payDate)]);
  const salary = toPaise(it.salary), hasLop = salary > paise, basic = hasLop ? salary : paise;
  return html`<div className="pgs">
    <div className="pgs-a pgs-hd"></div>
    <img className="pgs-a pgs-bg" src=${watermarkLarge} alt=""/>
    <img className="pgs-a pgs-logo" src=${logo} alt="maayasthra"/>
    <p className="pgs-a pgs-t pgs-badge">Payslip</p>
    <div className="pgs-content">
      <div>
        <p className="pgs-t pgs-title">Payslip for the Month of ${monthName}, ${y}</p>
        <p className="pgs-t pgs-net">Employee Net Pay : <b>₹${inr(paise)}</b></p>
        <p className="pgs-t pgs-days">Paid Days : ${numStr(it.paid)} | LOP Days : ${numStr(it.lop)}</p>
      </div>
      <div className="pgs-rule"></div>
      <div>
        <p className="pgs-t pgs-h12">Employee Pay Summary</p>
        <div className="pgs-kv">${summary.map(([k, v]) => html`<${Fragment} key=${k}><div className="pgs-k"><p className="pgs-t">${k}</p><p className="pgs-t">:</p></div><p className="pgs-t pgs-v">${v}</p><//>`)}</div>
      </div>
      <div className="pgs-sec">
        <div className="pgs-rule"></div>
        <div className="pgs-row pgs-h12"><p className="pgs-t">Description</p><p className="pgs-t">Amount</p></div>
        <div className="pgs-items">
          <div className="pgs-row"><p className="pgs-t">Basic Pay</p><p className="pgs-t">₹ ${inr(basic)}</p></div>
          ${hasLop && html`<div className="pgs-row"><p className="pgs-t">Loss of Pay</p><p className="pgs-t">-₹ ${inr(salary - paise)}</p></div>`}
        </div>
        <div className="pgs-rule"></div>
        <div className="pgs-row pgs-h12"><p className="pgs-t">Gross Earnings</p><p className="pgs-t">₹ ${inr(paise)}</p></div>
        <div className="pgs-words"><p>Total Net Payable ₹${inr(paise)}</p><p>(${amountWords(paise)})</p></div>
      </div>
    </div>
    <div className="pgs-a pgs-foot-rule"></div>
    <p className="pgs-a pgs-t pgs-foot-text">- This is a system generated payslip -</p>
    <img className="pgs-a pgs-wm-foot" src=${watermarkSmall} alt=""/>
  </div>`;
}
