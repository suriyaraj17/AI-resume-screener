import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { jobs, screening } from '../api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6'];

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [jobsList, setJobsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [newJob, setNewJob] = useState({ title: '', description: '', required_skills: '', experience_years: 0 });
  const [editForm, setEditForm] = useState({ title: '', description: '', required_skills: '', experience_years: 0, status: 'open' });

  useEffect(() => { loadJobs(); }, []);

  const loadJobs = async () => {
    try {
      const data = await jobs.list();
      // Fetch stats for each job
      const withStats = await Promise.all(
        data.results.map(async (j) => {
          try {
            const s = await jobs.stats(j.id);
            return { ...j, ...s };
          } catch { return { ...j, total_candidates: 0, shortlisted_count: 0, rejected_count: 0, avg_score: 0 }; }
        })
      );
      setJobsList(withStats);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleDeleteJob = async (jobId, jobTitle) => {
    if (!window.confirm(`Delete job "${jobTitle}"? This will also remove all screening results.`)) return;
    try {
      await jobs.delete(jobId);
      loadJobs();
    } catch (err) {
      alert('Failed to delete job.');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await jobs.create({
        ...newJob,
        required_skills: newJob.required_skills.split(',').map(s => s.trim()).filter(Boolean),
      });
      setShowCreate(false);
      setNewJob({ title: '', description: '', required_skills: '', experience_years: 0 });
      loadJobs();
    } catch (err) { alert('Failed to create job'); }
  };

  const openEditModal = (job) => {
    setEditingJob(job);
    setEditForm({
      title: job.title,
      description: job.description || '',
      required_skills: (job.required_skills || []).join(', '),
      experience_years: job.experience_years || 0,
      status: job.status || 'open',
    });
    setShowEdit(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editingJob) return;
    try {
      await jobs.update(editingJob.id, {
        ...editForm,
        required_skills: editForm.required_skills.split(',').map(s => s.trim()).filter(Boolean),
      });
      setShowEdit(false);
      setEditingJob(null);
      loadJobs();
    } catch (err) {
      alert('Failed to update job.');
    }
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  const totalCandidates = jobsList.reduce((s, j) => s + j.total_candidates, 0);
  const totalShortlisted = jobsList.reduce((s, j) => s + j.shortlisted_count, 0);
  const totalRejected = jobsList.reduce((s, j) => s + j.rejected_count, 0);
  const pieData = [
    { name: 'Shortlisted', value: totalShortlisted },
    { name: 'Rejected', value: totalRejected },
    { name: 'Pending', value: totalCandidates - totalShortlisted - totalRejected },
  ].filter(d => d.value > 0);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Job</button>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-value">{jobsList.length}</div><div className="stat-label">Total Jobs</div></div>
        <div className="stat-card"><div className="stat-value">{totalCandidates}</div><div className="stat-label">Total Candidates</div></div>
        <div className="stat-card stat-green"><div className="stat-value">{totalShortlisted}</div><div className="stat-label">Shortlisted</div></div>
        <div className="stat-card stat-red"><div className="stat-value">{totalRejected}</div><div className="stat-label">Rejected</div></div>
      </div>

      {/* Charts */}
      <div className="charts-row">
        {jobsList.length > 0 && (
          <div className="card chart-card">
            <h3>Candidates per Job</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={jobsList.map(j => ({ name: j.title.length > 20 ? j.title.slice(0, 20) + '...' : j.title, candidates: j.total_candidates, shortlisted: j.shortlisted_count }))}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="candidates" fill="#3b82f6" name="Total" />
                <Bar dataKey="shortlisted" fill="#22c55e" name="Shortlisted" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {pieData.length > 0 && (
          <div className="card chart-card">
            <h3>Overall Status</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Jobs Table */}
      <div className="card">
        <h3>Job Postings</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Candidates</th>
                <th>Shortlisted</th>
                <th>Rejected</th>
                <th>Avg Score</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobsList.map(j => (
                <tr key={j.id}>
                  <td className="cell-title">{j.title}</td>
                  <td><span className={`badge badge-${j.status}`}>{j.status}</span></td>
                  <td>{j.total_candidates}</td>
                  <td className="text-green">{j.shortlisted_count}</td>
                  <td className="text-red">{j.rejected_count}</td>
                  <td><span className="score-badge">{j.avg_score.toFixed(1)}%</span></td>
                  <td>
                    <button className="btn btn-sm btn-primary" onClick={() => navigate(`/jobs/${j.id}`)}>View</button>
                    {j.created_by?.id === user?.id && (
                      <>
                        <button className="btn btn-sm btn-secondary" style={{ marginLeft: 6 }} onClick={() => openEditModal(j)}>Edit</button>
                        <button className="btn btn-sm btn-red" style={{ marginLeft: 6 }} onClick={() => handleDeleteJob(j.id, j.title)}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Job Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Create New Job</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group"><label>Title</label><input required value={newJob.title} onChange={e => setNewJob({ ...newJob, title: e.target.value })} /></div>
              <div className="form-group"><label>Description</label><textarea rows={3} value={newJob.description} onChange={e => setNewJob({ ...newJob, description: e.target.value })} /></div>
              <div className="form-group"><label>Required Skills (comma-separated)</label><input value={newJob.required_skills} onChange={e => setNewJob({ ...newJob, required_skills: e.target.value })} placeholder="Python, Django, SQL" /></div>
              <div className="form-group"><label>Experience (years)</label><input type="number" value={newJob.experience_years} onChange={e => setNewJob({ ...newJob, experience_years: Number(e.target.value) })} /></div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Job Modal */}
      {showEdit && editingJob && (
        <div className="modal-overlay" onClick={() => { setShowEdit(false); setEditingJob(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Edit Job</h2>
            <form onSubmit={handleEdit}>
              <div className="form-group"><label>Title</label><input required value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} /></div>
              <div className="form-group"><label>Description</label><textarea rows={3} value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} /></div>
              <div className="form-group"><label>Required Skills (comma-separated)</label><input value={editForm.required_skills} onChange={e => setEditForm({ ...editForm, required_skills: e.target.value })} placeholder="Python, Django, SQL" /></div>
              <div className="form-group"><label>Experience (years)</label><input type="number" value={editForm.experience_years} onChange={e => setEditForm({ ...editForm, experience_years: Number(e.target.value) })} /></div>
              <div className="form-group"><label>Status</label>
                <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowEdit(false); setEditingJob(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
