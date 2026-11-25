'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { submitProjectAction, type SubmitState } from '@/app/actions/submit-project';

const INITIAL: SubmitState = { status: 'idle' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" className="button magenta form-submit" disabled={pending} aria-busy={pending}>
    {pending ? 'Mengirim…' : 'Kirim proyek'}<span aria-hidden="true">→</span>
  </button>;
}

function ProjectForm({ onReset }: { onReset: () => void }) {
  const [state, action] = useFormState(submitProjectAction, INITIAL);
  const result = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<Record<string, string>>({ name: '', schoolName: '', title: '', category: '', mentor: '', demoUrl: '', summary: '' });
  function change(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.currentTarget;
    setValues((current) => ({ ...current, [name]: value }));
  }
  useEffect(() => { if (state.status !== 'idle') result.current?.focus(); }, [state]);
  if (state.status === 'ok') return (
    <div className="form-result" ref={result} tabIndex={-1} role="status">
      <span className="check" aria-hidden="true">✓</span><h3>Proyek diterima.</h3><p>{state.message}</p>
      <button className="button navy" type="button" onClick={onReset}>Kirim proyek lain <span aria-hidden="true">→</span></button>
    </div>
  );
  return (
    <form action={action}>
      <div className="form-header"><h3>Ceritakan karyamu.</h3><span className="form-spark" aria-hidden="true">✧</span></div>
      <p className="form-subtitle">Kirim proyek AI siswa. Kolom bertanda * wajib diisi.</p>
      <div className="form-two">
        <label>Nama siswa / tim *<input name="name" value={values.name} onChange={change} autoComplete="name" required maxLength={120} placeholder="Nama kamu atau tim" /></label>
        <label>Asal sekolah *<input name="schoolName" value={values.schoolName} onChange={change} autoComplete="organization" required maxLength={120} placeholder="SMA / SMK asalmu" /></label>
      </div>
      <label>Judul proyek *<input name="title" value={values.title} onChange={change} required maxLength={160} placeholder="Beri nama untuk ide besarmu" /></label>
      <div className="form-two">
        <label>Kategori proyek *<input name="category" value={values.category} onChange={change} required maxLength={80} placeholder="Contoh: Pendidikan, Lingkungan" /></label>
        <label>Kelas & guru pembimbing <span>(opsional)</span><input name="mentor" value={values.mentor} onChange={change} maxLength={160} placeholder="Kelas, nama guru" /></label>
      </div>
      <label>Tautan demo <span>(opsional)</span><input name="demoUrl" value={values.demoUrl} onChange={change} type="url" maxLength={2048} placeholder="https://karyamu.com" /></label>
      <label>Ringkasan solusi AI *<textarea name="summary" value={values.summary} onChange={change} required maxLength={4000} rows={4} placeholder="Masalah apa yang ingin diselesaikan? Bagaimana AI membantu? Siapa yang mendapatkan manfaatnya?" /><small>Maksimal 4.000 karakter. Hindari data pribadi yang sensitif.</small></label>
      {state.status === 'error' && <div className="form-error" ref={result} tabIndex={-1} role="alert">{state.message ?? 'Gagal mengirim proyek. Silakan coba lagi.'}</div>}
      <SubmitButton />
      <p className="form-help">Kiriman akan ditinjau tim program sebelum diterbitkan di showcase.</p>
    </form>
  );
}

/** Preserve the existing server action, validation and pending-review workflow. */
export function SubmitProjectForm() {
  const [attempt, setAttempt] = useState(0);
  return <ProjectForm key={attempt} onReset={() => setAttempt((value) => value + 1)} />;
}
