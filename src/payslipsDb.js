import { useState, useEffect, useCallback } from 'react';
import { supabase } from './auth.js';
import { readAll } from './readAll.js';
import { IS_DEMO } from './env.js';
import { subscribeTables } from './tasksDb.js';

/* Payslip requests. A person asks for the payslip of a past month; an admin delivers a file (PDF or image, up to 2 MB).
   Live: everything goes through database functions and the file is handed out only to its owner or an admin.
   Demo: requests and files live in this browser. A request is { id, emp, month, status, note, requestedAt, decidedBy, decidedAt, reason, fileName, fileType, fileSize }. */
export const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };

const KEY = 'mp-payslips';
const readDemo = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && Array.isArray(v.list) ? v : { list: [], files: {} }; } catch (x) { return { list: [], files: {} }; } };
const writeDemo = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); window.dispatchEvent(new Event('mp-payslips')); } catch (x) { throw new Error('This browser has no room left to keep that file.'); } };

const toApp = r => ({ id: r.id, emp: r.employee_id, month: String(r.month).slice(0, 10), status: r.status, note: r.note || '', requestedAt: Date.parse(r.requested_at) || 0, decidedBy: r.decided_by, decidedAt: r.decided_at ? Date.parse(r.decided_at) : 0, downloadedAt: r.downloaded_at ? Date.parse(r.downloaded_at) : 0, reason: r.decline_reason || '', fileName: r.file_name || '', fileType: r.file_type || '', fileSize: r.file_size || 0 });
const KNOWN = /Choose a month|not finished|last 12 months|not joined|too long|already asked|cannot be cancelled|not waiting|Send a PDF|needs a name|could not be read|is empty|over 2 MB|does not look like|Not allowed|file is missing|downloaded and the file has been removed|payslip was replaced|Refresh the app/i;
const fail = (error, fallback) => { throw new Error(KNOWN.test(error.message) ? error.message : fallback); };
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : 'p' + Date.now() + Math.random().toString(16).slice(2));

// Every request I am allowed to see: my own, or everyone's for an admin
export async function loadPayslips(me) {
  if (IS_DEMO) return readDemo().list.slice().sort((a, b) => b.requestedAt - a.requestedAt);
  const data = await readAll(() => supabase.from('payslip_requests').select('*').order('requested_at', { ascending: false }).order('id'), 'Could not load payslip requests.');
  return data.map(toApp);
}

export async function requestPayslip(me, month, note) {
  if (IS_DEMO) {
    const d = readDemo();
    if (d.list.some(r => r.emp === me && r.month === month && (r.status === 'requested' || r.status === 'delivered'))) throw new Error('You already asked for that month');
    d.list.push({ id: newId(), emp: me, month, status: 'requested', note: String(note || '').trim().slice(0, 300), requestedAt: Date.now(), decidedBy: null, decidedAt: 0, downloadedAt: 0, reason: '', fileName: '', fileType: '', fileSize: 0 });
    writeDemo(d); return;
  }
  const { error } = await supabase.rpc('request_payslip', { p_month: month, p_note: String(note || '').trim() });
  if (error) fail(error, 'Could not send your request. Check your connection and try again.');
}

export async function cancelPayslip(me, id) {
  if (IS_DEMO) { const d = readDemo(); d.list = d.list.map(r => r.id === id && r.emp === me && r.status === 'requested' ? { ...r, status: 'cancelled', decidedAt: Date.now() } : r); writeDemo(d); return; }
  const { error } = await supabase.rpc('cancel_payslip_request', { p_id: id });
  if (error) fail(error, 'Could not cancel the request. Try again.');
}

export async function declinePayslip(admin, id, reason) {
  if (IS_DEMO) { const d = readDemo(); d.list = d.list.map(r => r.id === id && r.status === 'requested' ? { ...r, status: 'declined', decidedBy: admin, decidedAt: Date.now(), reason: String(reason || '').trim().slice(0, 300) } : r); writeDemo(d); return; }
  const { error } = await supabase.rpc('decline_payslip', { p_id: id, p_reason: String(reason || '').trim() });
  if (error) fail(error, 'Could not save that. Try again.');
}

// Checks a chosen file and returns { name, type, base64 }. Throws a plain message if it cannot be sent.
export function readPayslipFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) { reject(new Error('Choose a file first.')); return; }
    const ext = String(file.name.split('.').pop() || '').toLowerCase(), type = TYPES[ext] || (Object.values(TYPES).includes(file.type) ? file.type : '');
    if (!type) { reject(new Error('Choose a PDF, PNG or JPG file.')); return; }
    if (file.size === 0) { reject(new Error('That file is empty.')); return; }
    if (file.size > MAX_BYTES) { reject(new Error('That file is over 2 MB. Choose a smaller one.')); return; }
    const fr = new FileReader();
    fr.onload = () => resolve({ name: file.name.slice(0, 120), type, base64: String(fr.result).split(',')[1] || '', size: file.size });
    fr.onerror = () => reject(new Error('That file could not be read.'));
    fr.readAsDataURL(file);
  });
}

export async function deliverPayslip(admin, id, f) {
  if (IS_DEMO) {
    const d = readDemo();
    d.list = d.list.map(r => r.id === id && (r.status === 'requested' || r.status === 'delivered') ? { ...r, status: 'delivered', decidedBy: admin, decidedAt: Date.now(), reason: '', fileName: f.name, fileType: f.type, fileSize: f.size } : r);
    d.files[id] = { name: f.name, type: f.type, data: f.base64, revision: newId() }; writeDemo(d); return;
  }
  const { error } = await supabase.rpc('deliver_payslip', { p_id: id, p_name: f.name, p_type: f.type, p_data: f.base64 });
  if (error) fail(error, 'Could not send the file. Check your connection and try again.');
}

// Once the person the payslip is for has downloaded it, the file is deleted from the server and only the history stays.
// An admin looking at the file does not remove it.
async function confirmDownloaded(me, id, revision) {
  if (IS_DEMO) { const d = readDemo(), r = d.list.find(r => r.id === id && r.emp === me); if (!r || r.status !== 'delivered' || !revision || d.files[id]?.revision !== revision) throw new Error('This payslip was replaced. Download the current file; it has been kept.'); d.list = d.list.map(x => x.id === id ? { ...x, status: 'downloaded', downloadedAt: Date.now() } : x); delete d.files[id]; writeDemo(d); return; }
  const { error } = await supabase.rpc('confirm_payslip_downloaded', { p_id: id, p_revision: revision });
  if (error) fail(error, 'The download started, but the server copy was kept. Try downloading again after checking your connection.');
}

// Hands the file to the browser as a download. Pass the employee's number only when they are downloading their own payslip:
// then, a moment after the download starts, the file is removed from the server.
export async function downloadPayslip(id, owner = null) {
  let f;
  if (IS_DEMO) { f = readDemo().files[id]; if (!f) throw new Error('That file is missing.'); }
  else { const { data, error } = await supabase.rpc('get_payslip_file', { p_id: id }); if (error) fail(error, 'Could not open the file. Try again.'); f = data; }
  const bin = atob(f.data), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: f.type })), a = document.createElement('a');
  a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 8000);
  if (owner != null) { await new Promise(r => setTimeout(r, 1200)); await confirmDownloaded(owner, id, f.revision); }
}

// The list, kept fresh: reloads when requests change anywhere (live) or in another tab (demo)
export function usePayslips(me) {
  const [list, setList] = useState(null), [err, setErr] = useState('');
  const reload = useCallback(() => { if (me == null) return Promise.resolve(); return loadPayslips(me).then(l => { setList(l); setErr(''); }).catch(e => { setErr(e.message); setList(p => p || []); }); }, [me]);
  useEffect(() => {
    if (me == null) { setList(null); return; }
    reload();
    if (IS_DEMO) { window.addEventListener('mp-payslips', reload); window.addEventListener('storage', reload); return () => { window.removeEventListener('mp-payslips', reload); window.removeEventListener('storage', reload); }; }
    return subscribeTables('mp-payslips', ['payslip_requests'], reload);
  }, [me, reload]);
  return { list, err, reload };
}
