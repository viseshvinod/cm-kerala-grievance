import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import AiPanel from '../../components/AiPanel';
import { Alert, Button, Field, Spinner } from '../../components/ui';
import { api, fieldErrors } from '../../lib/api';
import { useMeta } from '../../lib/meta';
import { fmtSize } from '../../lib/format';

const MAX_FILES = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const empty = { district: '', category: '', subject: '', description: '' };

export default function SubmitGrievance() {
  const { districts, categories, ai: aiStatus } = useMeta();
  const [form, setForm] = useState(empty);
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analysedText, setAnalysedText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [drag, setDrag] = useState(false);
  const autoRan = useRef(false);
  const fileInput = useRef(null);

  const textKey = `${form.subject}\n${form.description}\n${form.district}`;
  const stale = analysis && analysedText !== textKey;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const analyse = async () => {
    if (form.description.trim().length < 20) { setAiError('Write at least 20 characters in the description so the assistant can analyse it.'); return; }
    setAiLoading(true); setAiError('');
    try {
      const { analysis: a } = await api.post('/ai/analyze', { subject: form.subject, description: form.description, district: form.district || undefined });
      setAnalysis(a); setAnalysedText(textKey);
    } catch (err) { setAiError(err.message); } finally { setAiLoading(false); }
  };

  // Run the assistant automatically once the citizen pauses after writing a meaningful description.
  useEffect(() => {
    if (autoRan.current || form.description.trim().length < 60) return undefined;
    const t = setTimeout(() => { autoRan.current = true; analyse(); }, 1800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.description]);

  const addFiles = (list) => {
    const next = [...files];
    const problems = [];
    for (const f of list) {
      if (next.length >= MAX_FILES) { problems.push(`Only ${MAX_FILES} files allowed`); break; }
      if (!TYPES.includes(f.type)) problems.push(`${f.name}: only JPG, PNG, WEBP or PDF`);
      else if (f.size > MAX_BYTES) problems.push(`${f.name}: larger than 5 MB`);
      else next.push(f);
    }
    setFiles(next);
    setErrors((e) => ({ ...e, attachments: problems.join('; ') || undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setErrors({}); setError('');
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (analysis && !stale) fd.append('aiAnalysisId', analysis.analysisId);
    files.forEach((f) => fd.append('attachments', f));
    try {
      const { grievance } = await api.post('/grievances', fd);
      setDone(grievance);
      window.scrollTo(0, 0);
    } catch (err) { setErrors(fieldErrors(err)); setError(err.message); } finally { setLoading(false); }
  };

  if (done) {
    return (
      <div className="card success-hero" style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ color: 'var(--green)' }}><Icon name="checkCircle" size={52} stroke={1.6} /></div>
        <h2>Grievance submitted successfully</h2>
        <p className="muted">Your reference number is</p>
        <div className="ref mono">{done.reference_no}</div>
        <div><button className="btn btn-outline btn-sm" onClick={() => navigator.clipboard?.writeText(done.reference_no)}><Icon name="copy" size={14} />Copy</button></div>
        <p className="muted small" style={{ marginTop: 16 }}>Keep this number safe. The Chief Minister&apos;s Office will review your grievance and forward it to the responsible department. You can track progress any time.</p>
        <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
          <Link className="btn btn-primary" to={`/citizen/grievances/${done.id}`}>View grievance</Link>
          <Link className="btn btn-outline" to={`/track/${done.reference_no}`}>Public tracker</Link>
          <button className="btn btn-outline" onClick={() => { setDone(null); setForm(empty); setFiles([]); setAnalysis(null); autoRan.current = false; }}>Submit another</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="dash-title"><div><h1>Submit a grievance</h1><p className="muted" style={{ margin: '4px 0 0' }}>Describe the problem clearly. The AI assistant will suggest how to route it.</p></div></div>
      <div className="detail-grid">
        <form className="card card-body stack" onSubmit={submit} noValidate>
          {error && <Alert kind="error">{error}</Alert>}
          <div className="form-grid">
            <Field label="District *" error={errors.district} htmlFor="g-district">
              <select id="g-district" className="select" value={form.district} onChange={set('district')} aria-invalid={!!errors.district} required>
                <option value="">Select district</option>
                {districts.map((d) => <option key={d.code}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Category *" error={errors.category} hint={analysis && !stale && analysis.category !== form.category ? `AI suggests: ${analysis.category}` : undefined} htmlFor="g-cat">
              <select id="g-cat" className="select" value={form.category} onChange={set('category')} aria-invalid={!!errors.category} required>
                <option value="">Select category</option>
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Subject *" error={errors.subject} className="full" htmlFor="g-sub" hint="A short title, e.g. “No drinking water supply for 12 days”">
              <input id="g-sub" className="input" maxLength={200} value={form.subject} onChange={set('subject')} aria-invalid={!!errors.subject} required />
            </Field>
            <Field label="Detailed description *" error={errors.description} className="full" htmlFor="g-desc"
              hint={`${form.description.length}/5000 · Include location, since when, and who is affected. Do not include other people's personal details.`}>
              <textarea id="g-desc" className="textarea" style={{ minHeight: 180 }} maxLength={5000} value={form.description} onChange={set('description')} aria-invalid={!!errors.description} required />
            </Field>
            <Field label="Supporting images / documents (optional)" error={errors.attachments} className="full" hint="Up to 3 files · JPG, PNG, WEBP or PDF · max 5 MB each">
              <div className={`dropzone ${drag ? 'drag' : ''}`} role="button" tabIndex={0}
                onClick={() => fileInput.current?.click()} onKeyDown={(e) => e.key === 'Enter' && fileInput.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}>
                <Icon name="paperclip" size={22} /><div className="small"><strong>Click to choose</strong> or drag files here</div>
                <input ref={fileInput} type="file" hidden multiple accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
              </div>
              {files.length > 0 && (
                <div className="row" style={{ marginTop: 8 }}>
                  {files.map((f, i) => (
                    <span className="file-chip" key={`${f.name}-${i}`}>
                      <Icon name={f.type === 'application/pdf' ? 'file' : 'paperclip'} size={15} />{f.name}<span className="muted tiny">{fmtSize(f.size)}</span>
                      <button type="button" aria-label={`Remove ${f.name}`} style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--ink-500)' }} onClick={() => setFiles(files.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button>
                    </span>
                  ))}
                </div>
              )}
            </Field>
          </div>
          <div className="divider" style={{ margin: 0 }} />
          <div className="row between">
            <span className="tiny muted"><Icon name="lock" size={12} /> Your contact details are shared only with officials handling this grievance.</span>
            <Button loading={loading} type="submit" className="btn-primary btn-lg"><Icon name="send" size={16} />Submit grievance</Button>
          </div>
        </form>

        <div className="stack" style={{ position: 'sticky', top: 88 }}>
          {!analysis && (
            <div className="card ai-panel"><div className="card-body stack">
              <span className="ai-tag"><Icon name="sparkles" size={14} />AI Grievance Assistant</span>
              <p className="small muted" style={{ margin: 0 }}>Once you describe the issue, the assistant analyses it and suggests a <strong>category</strong>, the responsible <strong>department</strong> and a <strong>priority</strong>, writes a short <strong>summary</strong> for the CMO and checks for <strong>similar complaints</strong>.</p>
              {aiStatus && <p className="tiny muted" style={{ margin: 0 }}>Engine: {aiStatus.live ? `${aiStatus.provider} · ${aiStatus.model}` : 'labelled fallback (no AI key configured)'}</p>}
              {aiError && <Alert kind="warn">{aiError}</Alert>}
              <Button type="button" className="btn-outline" loading={aiLoading} onClick={analyse}><Icon name="sparkles" size={16} />Analyse my complaint</Button>
            </div></div>
          )}
          {analysis && (
            <AiPanel analysis={analysis} actions={(
              <div className="stack">
                {stale && <Alert kind="info">You edited the complaint after analysis.</Alert>}
                {aiError && <Alert kind="warn">{aiError}</Alert>}
                <div className="row">
                  {analysis.category !== form.category && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setForm((f) => ({ ...f, category: analysis.category }))}><Icon name="check" size={14} />Use suggested category</button>
                  )}
                  {analysis.category === form.category && <span className="badge plain b-brand"><Icon name="check" size={12} />Category accepted</span>}
                  <button type="button" className="btn btn-outline btn-sm" onClick={analyse} disabled={aiLoading}>{aiLoading ? <Spinner /> : <Icon name="refresh" size={14} />}Re-analyse</button>
                </div>
              </div>
            )} />
          )}
        </div>
      </div>
    </>
  );
}
