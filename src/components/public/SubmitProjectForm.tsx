'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { submitProjectAction, type SubmitState } from '@/app/actions/submit-project';
import { Bi } from './Bi';
import { useText } from './HomeLanguage';

const INITIAL: SubmitState = { status: 'idle' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" className="button magenta form-submit" disabled={pending} aria-busy={pending}>
    {pending ? <Bi id="Mengirim…" en="Sending…" /> : <Bi id="Kirim proyek" en="Submit project" />}<span aria-hidden="true">→</span>
  </button>;
}

function ProjectForm({ onReset }: { onReset: () => void }) {
  const [state, action] = useFormState(submitProjectAction, INITIAL);
  const result = useRef<HTMLDivElement>(null);
  const text = useText();
  const [values, setValues] = useState<Record<string, string>>({ name: '', schoolName: '', title: '', category: '', mentor: '', demoUrl: '', summary: '' });
  function change(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.currentTarget;
    setValues((current) => ({ ...current, [name]: value }));
  }
  useEffect(() => { if (state.status !== 'idle') result.current?.focus(); }, [state]);
  if (state.status === 'ok') return (
    <div className="form-result" ref={result} tabIndex={-1} role="status">
      <span className="check" aria-hidden="true">✓</span><h3><Bi id="Karya diterima." en="Project received." /></h3><p>{state.message}</p>
      <button className="button navy" type="button" onClick={onReset}><Bi id="Kirim proyek lain" en="Submit another project" /> <span aria-hidden="true">→</span></button>
    </div>
  );
  return (
    <form action={action}>
      <div className="form-header"><h3><Bi id="Kirim karya peserta." en="Submit a participant project." /></h3><span className="form-spark" aria-hidden="true">✧</span></div>
      <p className="form-subtitle"><Bi id="Kirim proyek AI siswa. Kolom bertanda * wajib diisi." en="Submit a student AI project. Fields marked * are required." /></p>
      <div className="form-two">
        <label><Bi id="Nama siswa / tim *" en="Student / team name *" /><input name="name" value={values.name} onChange={change} autoComplete="name" required maxLength={120} placeholder={text({ id: 'Nama kamu atau tim', en: 'Your name or team name' })} /></label>
        <label><Bi id="Asal sekolah *" en="School *" /><input name="schoolName" value={values.schoolName} onChange={change} autoComplete="organization" required maxLength={120} placeholder={text({ id: 'SMA / SMK asalmu', en: 'Your senior high / vocational school' })} /></label>
      </div>
      <label><Bi id="Judul proyek *" en="Project title *" /><input name="title" value={values.title} onChange={change} required maxLength={160} placeholder={text({ id: 'Beri nama untuk ide besarmu', en: 'Give your big idea a name' })} /></label>
      <div className="form-two">
        <label><Bi id="Kategori proyek *" en="Project category *" /><input name="category" value={values.category} onChange={change} required maxLength={80} placeholder={text({ id: 'Contoh: Pendidikan, Lingkungan', en: 'e.g. Education, Environment' })} /></label>
        <label><span><Bi id="Kelas & guru pembimbing" en="Class & supervising teacher" /> <small><Bi id="(opsional)" en="(optional)" /></small></span><input name="mentor" value={values.mentor} onChange={change} maxLength={160} placeholder={text({ id: 'Kelas, nama guru', en: 'Class, teacher name' })} /></label>
      </div>
      <label><span><Bi id="Tautan demo" en="Demo link" /> <small><Bi id="(opsional)" en="(optional)" /></small></span><input name="demoUrl" value={values.demoUrl} onChange={change} type="url" maxLength={2048} placeholder="https://karyamu.com" /></label>
      <label><Bi id="Ringkasan solusi AI *" en="AI solution summary *" /><textarea name="summary" value={values.summary} onChange={change} required maxLength={4000} rows={4} placeholder={text({ id: 'Masalah apa yang ingin diselesaikan? Bagaimana AI membantu? Siapa yang mendapatkan manfaatnya?', en: 'What problem does it solve? How does AI help? Who benefits?' })} /><small><Bi id="Maksimal 4.000 karakter. Hindari data pribadi yang sensitif." en="Up to 4,000 characters. Avoid sensitive personal data." /></small></label>
      {state.status === 'error' && <div className="form-error" ref={result} tabIndex={-1} role="alert">{state.message ?? text({ id: 'Gagal mengirim proyek. Silakan coba lagi.', en: 'Could not submit the project. Please try again.' })}</div>}
      <SubmitButton />
      <p className="form-help"><Bi id="Kiriman akan ditinjau tim program sebelum diterbitkan di showcase." en="Submissions are reviewed by the program team before being published in the showcase." /></p>
    </form>
  );
}

/** Preserve the existing server action, validation and pending-review workflow. */
export function SubmitProjectForm() {
  const [attempt, setAttempt] = useState(0);
  return <ProjectForm key={attempt} onReset={() => setAttempt((value) => value + 1)} />;
}
