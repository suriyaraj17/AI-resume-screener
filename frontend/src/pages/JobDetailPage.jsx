import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { jobs, screening, candidates as candidatesApi } from '../api';

export default function JobDetailPage() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [stats, setStats] = useState(null);
  const [results, setResults] = useState([]);
  const [allCandidates, setAllCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [isScreening, setIsScreening] = useState(false);

  useEffect(() => { loadData(); }, [id, statusFilter]);

  const loadData = async () => {
    try {
      const [j, s, r, c] = await Promise.all([
        jobs.detail(id),
        jobs.stats(id),
        screening.jobCandidates(id, statusFilter ? { status: statusFilter } : {}),
        candidatesApi.list({ page_size: 100 }),
      ]);
      setJob(j);
      setStats(s);
      setResults(Array.isArray(r) ? r : []);
      setAllCandidates(c.results || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const updateStatus = async (resultId, newStatus) => {
    try {
      await screening.updateStatus(resultId, newStatus);
      loadData();
    } catch (err) { alert('Failed to update status'); }
  };

  const runBulkScreening = async () => {
    if (selectedCandidates.length === 0) return;
    setIsScreening(true);
    try {
      const res = await screening.bulk(id, selectedCandidates);
      alert(`Screened ${res.results?.length || 0} candidates!`);
      setSelectedCandidates([]);
      loadData();
    } catch (err) { alert('Bulk screening failed'); }
    finally { setIsScreening(false); }
  };

  const toggleCandidate = (cid) => {
    setSelectedCandidates(prev =>
      prev.includes(cid) ? prev.filter(c => c !== cid) : [...prev, cid]
    );
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!job) return <div className="page"><p>Job not found</p></div>;

  const alreadyScreened = new Set(results.map(r => r.candidate?.id));

  return (
    <div className="page">
      <Link to="/dashboard" className="back-link">← Back to Dashboard</Link>

      <div className="page-header">
        <div>
          <h1>{job.title}</h1>
          <p className="text-muted">{job.description?.slice(0, 200)}</p>
        </div>
        <span className={`badge badge-${job.status}`}>{job.status}</span>
      </div>

      {/* Skills */}
      <div className="card">
        <h3>Required Skills</h3>
        <div className="skills-list">
          {job.required_skills?.map(s => <span key={s} className="skill-tag">{s}</span>)}
        </div>
        <p className="text-muted" style={{ marginTop: 8 }}>Experience: {job.experience_years}+ years</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-grid" style={{ marginTop: 16 }}>
          <div className="stat-card"><div className="stat-value">{stats.total_candidates}</div><div className="stat-label">Total</div></div>
          <div className="stat-card stat-green"><div className="stat-value">{stats.shortlisted_count}</div><div className="stat-label">Shortlisted</div></div>
          <div className="stat-card stat-red"><div className="stat-value">{stats.rejected_count}</div><div className="stat-label">Rejected</div></div>
          <div className="stat-card"><div className="stat-value">{stats.avg_score}%</div><div className="stat-label">Avg Score</div></div>
        </div>
      )}

      {/* Bulk Screening */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Run Screening</h3>
        <p className="text-muted">Select candidates to screen against this job:</p>
        <div style={{ maxHeight: 200, overflowY: 'auto', margin: '12px 0' }}>
          {allCandidates.filter(c => !alreadyScreened.has(c.id)).map(c => (
            <label key={c.id} className="checkbox-row">
              <input type="checkbox" checked={selectedCandidates.includes(c.id)} onChange={() => toggleCandidate(c.id)} />
              <span><strong>{c.name}</strong> — {c.email}</span>
              <span className="text-muted">{c.experience_years}y exp</span>
            </label>
          ))}
          {allCandidates.filter(c => !alreadyScreened.has(c.id)).length === 0 && (
            <p className="text-muted">All candidates have been screened for this job.</p>
          )}
        </div>
        <button className="btn btn-primary" onClick={runBulkScreening} disabled={selectedCandidates.length === 0 || isScreening}>
          {isScreening ? 'Screening...' : `Screen ${selectedCandidates.length} Candidate(s)`}
        </button>
      </div>

      {/* Screening Results */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <h3>Screening Results</h3>
          <div className="filter-group">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-sm">
              <option value="">All Status</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="rejected">Rejected</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
        {results.length === 0 ? (
          <p className="text-muted">No screening results yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Score</th>
                  <th>Matched Skills</th>
                  <th>Missing Skills</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.candidate?.name}</strong>
                      <div className="text-muted" style={{ fontSize: 12 }}>{r.candidate?.email}</div>
                    </td>
                    <td>
                      <div className="score-cell">
                        <div className="score-bar-bg">
                          <div className="score-bar-fill" style={{ width: `${Math.min(r.score_percentage, 100)}%` }} />
                        </div>
                        <span className={`score-value ${r.score_percentage >= 70 ? 'text-green' : r.score_percentage < 30 ? 'text-red' : ''}`}>
                          {r.score_percentage}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="skills-mini">
                        {r.matched_skills?.map(s => <span key={s} className="skill-tag skill-match">{s}</span>)}
                      </div>
                    </td>
                    <td>
                      <div className="skills-mini">
                        {r.missing_skills?.map(s => <span key={s} className="skill-tag skill-miss">{s}</span>)}
                      </div>
                    </td>
                    <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                    <td>
                      <div className="action-group">
                        <button className="btn btn-xs btn-green" onClick={() => updateStatus(r.id, 'shortlisted')} disabled={r.status === 'shortlisted'}>👍</button>
                        <button className="btn btn-xs btn-red" onClick={() => updateStatus(r.id, 'rejected')} disabled={r.status === 'rejected'}>👎</button>
                        <button className="btn btn-xs btn-secondary" onClick={() => updateStatus(r.id, 'pending')} disabled={r.status === 'pending'}>↩</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
