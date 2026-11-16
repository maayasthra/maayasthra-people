import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Sheet } from './Sheet.jsx';
import { monthLabel, fileNameFor } from './payslip.js';
import { makeZip, uniqueName } from './zip.js';

/* Turning a payslip into a PDF: draw the sheet off-screen, photograph it at 3x with html2canvas, and place the picture on an A4 page.
   The two libraries are large, so they are only fetched the first time someone downloads. */
const libs = () => Promise.all([import('html2canvas'), import('jspdf')]).catch(() => { throw new Error('The PDF tools did not load. Check the connection and try again.'); });

// type: 'blob' or 'arraybuffer'
export async function pdfFor(it, type) {
  const [{ default: html2canvas }, { jsPDF }] = await libs();
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:595px;height:842px;pointer-events:none';
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(createElement(Sheet, { it })));
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    await Promise.all([...host.querySelectorAll('img')].map(im => im.decode ? im.decode().catch(() => {}) : null));
    const canvas = await html2canvas(host.firstChild, { scale: 3, backgroundColor: '#ffffff', logging: false, width: 595, height: 842, windowWidth: 595 });
    const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 595.28, 841.89, undefined, 'FAST');
    doc.setProperties({ title: 'Payslip - ' + it.name + ' - ' + monthLabel(it) });
    return doc.output(type);
  } finally { root.unmount(); host.remove(); }
}

// Hands a file to the browser as a download
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}

export async function downloadOne(it) { saveBlob(await pdfFor(it, 'blob'), fileNameFor(it)); return fileNameFor(it); }

// Every payslip into one Payslips.zip. progress(n, total) is called before each one is made.
export async function downloadAll(items, progress) {
  const files = [], used = {};
  for (let i = 0; i < items.length; i++) {
    progress(i + 1, items.length);
    const buf = await pdfFor(items[i], 'arraybuffer');
    files.push({ name: uniqueName(fileNameFor(items[i]), used), data: new Uint8Array(buf) });
  }
  saveBlob(makeZip(files), 'Payslips.zip');
}
