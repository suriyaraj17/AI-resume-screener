import { useState, useEffect, useRef } from 'react';
import { candidates as candidatesApi, jobs, screening } from '../api';

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const [uploadMode, setUploadMode] = useState('quick'); // 'quick' | 'manual'
  // Quick upload state
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  // Manual upload state
  const [entries, setEntries] = useState([
    { name: '', email: '', phone: '', file: null, key: Date.now() },
  ]);
  // Screen all state
  const [jobsList, setJobsList] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [screeningResults, setScreeningResults] = useState(null);
  const [isScreeningAll, setIsScreeningAll] = useState(false);
  const [showScreeningResults, setShowScreeningResults] = useState(false);
  // Rescreen state
  const [rescreenJobId, setRescreenJobId] = useState('');
  const [isRescreening, setIsRescreening] = useState(false);
  // Bulk status update state
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const handleExportCsv = () => {
    const resultsArray = screeningResults?.results || [];
    if (resultsArray.length === 0) return;

    const screenedJobName = selectedJobId
      ? jobsList.find(j => j.id === selectedJobId)?.title || ''
      : '';

    // Build CSV rows
    const headers = ['Name', 'Email', 'Score (%)', 'Status', 'Matched Skills', 'Missing Skills'];
    const rows = resultsArray.map(r => [
      r.candidate?.name || '',
      r.candidate?.email || '',
      r.score_percentage ?? '',
      r.status || '',
      (r.matched_skills || []).join('; '),
      (r.missing_skills || []).join('; '),
    ]);

    // Escape CSV fields (wrap in quotes if contains comma, quote, or newline)
    const escapeCsv = (val) => {
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(row => row.map(escapeCsv).join(',')),
    ].join('\n');

    const jobLabel = screenedJobName ? `_vs_${screenedJobName.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
    const filename = `screening_results${jobLabel}_${new Date().toISOString().slice(0, 10)}.csv`;

    // Trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  useEffect(() => { loadCandidates(); }, []);

  // Fetch jobs when upload results are shown (for Screen All feature)
  useEffect(() => {
    if (uploadResults?.results?.length > 0) {
      loadJobs();
    }
  }, [uploadResults]);

  const loadJobs = async () => {
    try {
      const data = await jobs.list({ page_size: 100 });
      setJobsList(data.results || []);
    } catch (err) { console.error(err); }
  };

  const loadCandidates = async (name) => {
    try {
      const data = await candidatesApi.list(name ? { name } : {});
      setCandidates(data.results || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
    if (e.target.value.length >= 2 || e.target.value === '') loadCandidates(e.target.value);
  };

  const handleDeleteCandidate = async (candidateId, candidateName) => {
    if (!window.confirm(`Delete candidate "${candidateName}"? This will also remove their screening results.`)) return;
    try {
      await candidatesApi.delete(candidateId);
      loadCandidates();
    } catch (err) {
      alert('Failed to delete candidate.');
    }
  };

  const resetState = () => {
    setShowUpload(false);
    setUploadResults(null);
    setSelectedFiles([]);
    setEntries([{ name: '', email: '', phone: '', file: null, key: Date.now() }]);
    setUploadMode('quick');
    setSelectedJobId('');
    setScreeningResults(null);
    setShowScreeningResults(false);
    setRescreenJobId('');
    setIsRescreening(false);
    setIsBulkUpdating(false);
    loadCandidates();
  };

  const handleBulkStatusUpdate = async (newStatus) => {
    const resultsArray = screeningResults?.results || [];
    const resultIds = resultsArray.map(r => r.id);
    if (resultIds.length === 0) {
      alert('No screening results to update.');
      return;
    }
    const label = newStatus === 'shortlisted' ? 'Shortlist' : 'Reject';
    if (!window.confirm(`${label} all ${resultIds.length} candidates?`)) return;

    setIsBulkUpdating(true);
    try {
      const res = await screening.bulkUpdateStatus(resultIds, newStatus);
      // Update local screening results to reflect new status
      const updatedResults = (screeningResults?.results || []).map(r => ({
        ...r,
        status: newStatus,
      }));
      setScreeningResults({ ...screeningResults, results: updatedResults });
      alert(`${res.updated_count} candidate${res.updated_count !== 1 ? 's' : ''} ${label === 'Shortlist' ? 'shortlisted' : 'rejected'}!`);
    } catch (err) {
      alert(`Failed to ${label.toLowerCase()} candidates. Please try again.`);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleRescreen = async () => {
    if (!rescreenJobId) {
      alert('Please select a job to rescreen against.');
      return;
    }
    const candidateIds = (uploadResults?.results || []).map(r => r.id);
    if (candidateIds.length === 0) {
      alert('No candidates to rescreen.');
      return;
    }
    setIsRescreening(true);
    try {
      const res = await screening.bulk(rescreenJobId, candidateIds);
      setScreeningResults(res);
      setSelectedJobId(rescreenJobId);
      setRescreenJobId('');
    } catch (err) {
      alert('Rescreening failed. Please try again.');
    } finally {
      setIsRescreening(false);
    }
  };

  const handleScreenAll = async () => {
    if (!selectedJobId) {
      alert('Please select a job to screen against.');
      return;
    }
    const candidateIds = (uploadResults?.results || []).map(r => r.id);
    if (candidateIds.length === 0) {
      alert('No candidates to screen.');
      return;
    }
    setIsScreeningAll(true);
    try {
      const res = await screening.bulk(selectedJobId, candidateIds);
      setScreeningResults(res);
      setShowScreeningResults(true);
    } catch (err) {
      alert('Screening failed. Please try again.');
    } finally {
      setIsScreeningAll(false);
    }
  };

  // ===== Quick Upload Handlers =====

  const handleFilesSelected = (files) => {
    const valid = [];
    const invalid = [];
    for (const f of files) {
      const ext = f.name.split('.').pop().toLowerCase();
      if (ext === 'pdf' || ext === 'docx') {
        valid.push(f);
      } else {
        invalid.push(f.name);
      }
    }
    if (invalid.length > 0) {
      alert(`Unsupported file${invalid.length > 1 ? 's' : ''}: ${invalid.join(', ')}\nOnly PDF and DOCX files are supported.`);
    }
    setSelectedFiles(prev => [...prev, ...valid]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFilesSelected(Array.from(e.dataTransfer.files));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleQuickUpload = async () => {
    if (selectedFiles.length === 0) {
      alert('Select at least one resume file to upload.');
      return;
    }
    setUploadResults(null);
    setUploading(true);

    const formData = new FormData();
    selectedFiles.forEach(f => formData.append('resume_files', f));

    try {
      const result = await candidatesApi.quickBulkUpload(formData);
      setUploadResults(result);
      if (result.error_count === 0) {
        setTimeout(() => resetState(), 2500);
      } else {
        loadCandidates();
      }
    } catch (err) {
      const data = err.response?.data;
      if (data && (data.results || data.errors)) {
        setUploadResults(data);
        if (data.results?.length > 0) loadCandidates();
      } else {
        alert('Upload failed. Please try again.');
      }
    } finally {
      setUploading(false);
    }
  };

  // ===== Manual Upload Handlers =====

  const addEntry = () => {
    setEntries([...entries, { name: '', email: '', phone: '', file: null, key: Date.now() }]);
  };

  const removeEntry = (index) => {
    if (entries.length <= 1) return;
    setEntries(entries.filter((_, i) => i !== index));
  };

  const updateEntry = (index, field, value) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: value };
    setEntries(updated);
  };

  const handleManualUpload = async (e) => {
    e.preventDefault();
    setUploadResults(null);

    const invalid = entries.some(entry => !entry.name || !entry.email || !entry.file);
    if (invalid) {
      alert('Please fill in name, email, and select a resume file for all entries.');
      return;
    }

    const formData = new FormData();
    entries.forEach((entry, i) => {
      formData.append(`name_${i}`, entry.name);
      formData.append(`email_${i}`, entry.email);
      formData.append(`phone_${i}`, entry.phone || '');
      formData.append(`resume_file_${i}`, entry.file);
    });

    setUploading(true);
    try {
      const result = await candidatesApi.bulkUpload(formData);
      setUploadResults(result);
      if (result.error_count === 0) {
        setTimeout(() => resetState(), 2500);
      } else {
        loadCandidates();
      }
    } catch (err) {
      const data = err.response?.data;
      if (data && (data.results || data.errors)) {
        setUploadResults(data);
        if (data.results?.length > 0) loadCandidates();
      } else {
        alert('Bulk upload failed. Please try again.');
      }
    } finally {
      setUploading(false);
    }
  };

  // ===== Shared Results Display =====

  const renderScreeningResultsView = () => {
    const resultsArray = screeningResults?.results || [];
    // Find the job name that was screened against
    const screenedJobName = selectedJobId
      ? jobsList.find(j => j.id === selectedJobId)?.title
      : null;
    return (
      <div>
        <div style={{
          padding: 14, borderRadius: 8, marginBottom: 16,
          background: 'var(--primary-bg)', color: 'var(--primary)',
          border: '1px solid var(--primary)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <strong style={{ fontSize: 18 }}>{resultsArray.length} / {uploadResults.success_count}</strong> candidates screened
            {screenedJobName && <span style={{ opacity: 0.7, display: 'block', fontSize: 13, marginTop: 2 }}>vs "{screenedJobName}"</span>}
          </div>
          {resultsArray.length > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={handleExportCsv}
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              📥 CSV
            </button>
          )}
        </div>

        {resultsArray.length > 0 && (
          <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 16 }}>
            {resultsArray.map((r, i) => (
              <div key={i} style={{
                padding: '10px 12px', marginBottom: 6, borderRadius: 6,
                background: 'var(--bg)', border: '1px solid var(--border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ minWidth: 0, flex: 1, marginRight: 12 }}>
                  <strong style={{ fontSize: 14 }}>{r.candidate?.name}</strong>
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    {r.candidate?.email}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    {r.matched_skills?.slice(0, 4).map(s => (
                      <span key={s} className="skill-tag skill-match" style={{ fontSize: 11 }}>{s}</span>
                    ))}
                    {r.matched_skills?.length > 4 && (
                      <span className="skill-tag skill-more" style={{ fontSize: 11 }}>+{r.matched_skills.length - 4}</span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{
                    fontSize: 22, fontWeight: 700,
                    color: r.score_percentage >= 70 ? 'var(--green)' : r.score_percentage >= 30 ? 'var(--orange)' : 'var(--red)',
                  }}>
                    {r.score_percentage}%
                  </span>
                  <div>
                    <span className={`badge badge-${r.status}`} style={{ fontSize: 11 }}>{r.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bulk Status Update section */}
        {resultsArray.length > 0 && (
          <div style={{
            display: 'flex', gap: 8, marginBottom: 16,
            padding: 14, borderRadius: 8,
            background: 'var(--bg)', border: '1px solid var(--border)',
            alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>📋 Bulk Status Update</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-sm btn-green"
                disabled={isBulkUpdating}
                onClick={() => handleBulkStatusUpdate('shortlisted')}
              >
                {isBulkUpdating ? '⏳...' : '👍 Shortlist All'}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-red"
                disabled={isBulkUpdating}
                onClick={() => handleBulkStatusUpdate('rejected')}
              >
                {isBulkUpdating ? '⏳...' : '👎 Reject All'}
              </button>
            </div>
          </div>
        )}

        {/* Rescreen section */}
        <div style={{
          padding: 16, borderRadius: 8, marginBottom: 16,
          background: 'var(--bg)', border: '1px solid var(--border)',
        }}>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>🔄 Rescreen vs Different Job</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={rescreenJobId}
              onChange={e => setRescreenJobId(e.target.value)}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 6, fontSize: 14,
                border: '1px solid var(--border)', background: 'var(--bg)',
              }}
            >
              <option value="">— Select a job —</option>
              {jobsList
                .filter(j => j.id !== selectedJobId)
                .map(j => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
            </select>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!rescreenJobId || isRescreening}
              onClick={handleRescreen}
              style={{ whiteSpace: 'nowrap' }}
            >
              {isRescreening ? '⏳ Rescreening...' : '🔄 Rescreen'}
            </button>
          </div>
          {isRescreening && (
            <div style={{ marginTop: 10, fontSize: 13, color: 'var(--primary)' }}>
              Rescreening {uploadResults.success_count} candidate{uploadResults.success_count > 1 ? 's' : ''} against "{jobsList.find(j => j.id === rescreenJobId)?.title || ''}"...
            </div>
          )}
          {jobsList.filter(j => j.id !== selectedJobId).length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--red)', marginTop: 8 }}>
              No other jobs available. Create more jobs on the Dashboard.
            </p>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setShowScreeningResults(false)}>Back</button>
          <button type="button" className="btn btn-primary" onClick={resetState}>Done</button>
        </div>
      </div>
    );
  };

  const renderUploadResults = () => (
    <div>
      <div style={{
        padding: 14, borderRadius: 8, marginBottom: 16,
        background: uploadResults.error_count === 0 ? 'var(--green-bg)' : '#fff3f3',
        color: uploadResults.error_count === 0 ? 'var(--green)' : 'var(--red)',
        border: `1px solid ${uploadResults.error_count === 0 ? 'var(--green)' : 'var(--red)'}`,
      }}>
        <strong style={{ fontSize: 18 }}>{uploadResults.success_count} / {uploadResults.total}</strong> uploaded successfully
        {uploadResults.error_count > 0 && <span> — {uploadResults.error_count} failed</span>}
      </div>

      {/* Successful uploads */}
      {uploadResults.results?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <strong style={{ fontSize: 14, color: 'var(--green)' }}>✓ Uploaded</strong>
          {uploadResults.results.map((r, i) => (
            <div key={i} style={{
              fontSize: 13, color: 'var(--green)', marginBottom: 4,
              padding: '6px 10px', background: 'var(--green-bg)', borderRadius: 4,
            }}>
              <strong>{r.name}</strong> — {r.email}<br />
              <span style={{ opacity: 0.7 }}>
                {r.parsed_skills?.length || 0} skills &middot; {r.experience_years}y exp
                {r.phone && ` &middot; ${r.phone}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Failed uploads */}
      {uploadResults.errors?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <strong style={{ fontSize: 14, color: 'var(--red)' }}>⚠ Failed</strong>
          {uploadResults.errors.map((err, i) => (
            <div key={i} style={{
              fontSize: 13, color: 'var(--red)', marginBottom: 4,
              padding: '6px 10px', background: '#fff3f3', borderRadius: 4,
            }}>
              <strong>{err.file || err.name || 'Unknown'}</strong><br />
              <span style={{ opacity: 0.7 }}>
                {Object.values(err.errors || {}).flat().join(', ')}
              </span>
              {err.extracted && !err.extracted.email && (
                <span style={{ display: 'block', marginTop: 4, fontStyle: 'italic', opacity: 0.8 }}>
                  Extracted name: "{err.extracted.name}", skills: {err.extracted.skills?.length || 0}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Screen All section — only if there are successful uploads */}
      {uploadResults.results?.length > 0 && !showScreeningResults && (
        <div style={{
          marginTop: 16, padding: 16, borderRadius: 8,
          background: 'var(--bg)', border: '1px solid var(--border)',
        }}>
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>🎯 Screen All vs a Job</h3>
          <p className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
            Immediately screen all {uploadResults.success_count} uploaded candidate{uploadResults.success_count > 1 ? 's' : ''} against a job.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={selectedJobId}
              onChange={e => setSelectedJobId(e.target.value)}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 6, fontSize: 14,
                border: '1px solid var(--border)', background: 'var(--bg)',
              }}
            >
              <option value="">— Select a job —</option>
              {jobsList.map(j => (
                <option key={j.id} value={j.id}>{j.title}</option>
              ))}
            </select>
            {jobsList.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--red)', marginTop: 8, gridColumn: '1 / -1' }}>
                No jobs found. Create a job on the Dashboard first.
              </p>
            )}
            <button
              type="button"
              className="btn btn-primary"
              disabled={!selectedJobId || isScreeningAll}
              onClick={handleScreenAll}
              style={{ whiteSpace: 'nowrap' }}
            >
              {isScreeningAll ? '⏳ Screening...' : '🔍 Screen All'}
            </button>
          </div>
          {isScreeningAll && (
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--primary)' }}>
              Screening {uploadResults.success_count} candidate{uploadResults.success_count > 1 ? 's' : ''} against "{jobsList.find(j => j.id === selectedJobId)?.title || ''}"...
            </div>
          )}
        </div>
      )}

      <div className="modal-actions">
        <button type="button" className="btn btn-primary" onClick={resetState}>Done</button>
      </div>
    </div>
  );

  // ===== Quick Upload View =====

  const renderQuickUpload = () => (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`,
          borderRadius: 12, padding: 40, textAlign: 'center', cursor: 'pointer',
          background: dragOver ? 'var(--primary-bg)' : 'var(--bg)',
          transition: 'all 0.2s ease', marginBottom: 16,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx"
          style={{ display: 'none' }}
          onChange={e => handleFilesSelected(Array.from(e.target.files))}
        />
        <div style={{ fontSize: 40, marginBottom: 8, opacity: 0.4 }}>📄</div>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>
          {dragOver ? 'Drop files here' : 'Drag & drop resumes here'}
        </p>
        <p className="text-muted" style={{ fontSize: 13 }}>
          or click to browse &middot; PDF &amp; DOCX only
        </p>
      </div>

      {/* Selected files list */}
      {selectedFiles.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <strong style={{ fontSize: 14 }}>{selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected</strong>
          <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 8 }}>
            {selectedFiles.map((f, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 10px', marginBottom: 4, borderRadius: 4,
                background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 13,
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  📄 {f.name}
                </span>
                <span className="text-muted" style={{ margin: '0 10px', fontSize: 12, flexShrink: 0 }}>
                  {(f.size / 1024).toFixed(0)} KB
                </span>
                <button
                  type="button"
                  className="btn btn-xs btn-red"
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  style={{ flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={() => { setShowUpload(false); setUploadResults(null); }}>Cancel</button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={uploading || selectedFiles.length === 0}
          onClick={handleQuickUpload}
          style={{ minWidth: 180 }}
        >
          {uploading ? (
            <span>⏳ Parsing & uploading...</span>
          ) : (
            <span>🚀 Upload {selectedFiles.length > 0 ? `${selectedFiles.length} resume${selectedFiles.length > 1 ? 's' : ''}` : 'all'}</span>
          )}
        </button>
      </div>
    </div>
  );

  // ===== Manual Upload View =====

  const renderManualUpload = () => (
    <form onSubmit={handleManualUpload}>
      <p className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
        Manually enter candidate details. Use <strong>Quick Upload</strong> above to auto-extract from resume files.
      </p>
      <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 12 }}>
        {entries.map((entry, i) => (
          <div key={entry.key} style={{
            padding: 12, marginBottom: 8, borderRadius: 6,
            background: 'var(--bg)', border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <strong style={{ fontSize: 14 }}>Candidate #{i + 1}</strong>
              {entries.length > 1 && (
                <button type="button" className="btn btn-xs btn-red" onClick={() => removeEntry(i)}>Remove</button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Full Name</label>
                <input required value={entry.name} onChange={e => updateEntry(i, 'name', e.target.value)} placeholder="Jane Smith" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Email</label>
                <input required type="email" value={entry.email} onChange={e => updateEntry(i, 'email', e.target.value)} placeholder="jane@example.com" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Phone (optional)</label>
                <input value={entry.phone} onChange={e => updateEntry(i, 'phone', e.target.value)} placeholder="+1-555-123-4567" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Resume (.pdf/.docx)</label>
                <input required type="file" accept=".pdf,.docx" onChange={e => updateEntry(i, 'file', e.target.files[0])} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-sm btn-secondary" onClick={addEntry} style={{ marginBottom: 12 }}>+ Add Another Candidate</button>
      <div className="modal-actions" style={{ marginTop: 0 }}>
        <button type="button" className="btn btn-secondary" onClick={() => { setShowUpload(false); setUploadResults(null); }}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={uploading}>
          {uploading ? 'Uploading...' : `Upload ${entries.length} Candidate${entries.length > 1 ? 's' : ''}`}
        </button>
      </div>
    </form>
  );

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Candidates</h1>
        <button className="btn btn-primary" onClick={() => setShowUpload(true)}>+ Upload Resumes</button>
      </div>

      {/* Search */}
      <div className="card">
        <input
          className="search-input"
          placeholder="Search candidates by name..."
          value={search}
          onChange={handleSearch}
        />
      </div>

      {/* Candidates Grid */}
      <div className="candidates-grid">
        {candidates.map(c => (
          <div key={c.id} className="candidate-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="candidate-avatar">{c.name.charAt(0).toUpperCase()}</div>
              <button className="btn btn-xs btn-red" onClick={() => handleDeleteCandidate(c.id, c.name)}>Delete</button>
            </div>
            <div className="candidate-info">
              <h4>{c.name}</h4>
              <p className="text-muted">{c.email}</p>
              {c.phone && <p className="text-muted">{c.phone}</p>}
              <p className="text-muted">{c.experience_years} years experience</p>
            </div>
            <div className="candidate-skills">
              {c.parsed_skills?.slice(0, 8).map(s => (
                <span key={s} className="skill-tag">{s}</span>
              ))}
              {c.parsed_skills?.length > 8 && <span className="skill-tag skill-more">+{c.parsed_skills.length - 8}</span>}
            </div>
          </div>
        ))}
        {candidates.length === 0 && <p className="text-muted" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40 }}>No candidates found.</p>}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="modal-overlay" onClick={() => { setShowUpload(false); setUploadResults(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <h2>Upload Candidates</h2>

            {/* Mode switcher tabs */}
            <div style={{
              display: 'flex', gap: 0, marginBottom: 20,
              borderBottom: '2px solid var(--border)',
            }}>
              <button
                onClick={() => { setUploadMode('quick'); setUploadResults(null); }}
                style={{
                  flex: 1, padding: '10px 16px', border: 'none', cursor: 'pointer',
                  background: 'none', fontWeight: uploadMode === 'quick' ? 700 : 400,
                  color: uploadMode === 'quick' ? 'var(--primary)' : 'var(--text-muted)',
                  borderBottom: uploadMode === 'quick' ? '2px solid var(--primary)' : '2px solid transparent',
                  marginBottom: -2, transition: 'all 0.15s', fontSize: 14,
                }}
              >
                🚀 Quick Upload
              </button>
              <button
                onClick={() => { setUploadMode('manual'); setUploadResults(null); }}
                style={{
                  flex: 1, padding: '10px 16px', border: 'none', cursor: 'pointer',
                  background: 'none', fontWeight: uploadMode === 'manual' ? 700 : 400,
                  color: uploadMode === 'manual' ? 'var(--primary)' : 'var(--text-muted)',
                  borderBottom: uploadMode === 'manual' ? '2px solid var(--primary)' : '2px solid transparent',
                  marginBottom: -2, transition: 'all 0.15s', fontSize: 14,
                }}
              >
                ✏️ Manual Entry
              </button>
            </div>

            {showScreeningResults ? renderScreeningResultsView() : (
              uploadResults ? renderUploadResults() : (
                uploadMode === 'quick' ? renderQuickUpload() : renderManualUpload()
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
