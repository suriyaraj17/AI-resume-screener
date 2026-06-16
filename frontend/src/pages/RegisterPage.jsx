import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    full_name: '',
    password: '',
    confirmPassword: '',
    role: 'recruiter',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      await register({
        email: form.email,
        full_name: form.full_name,
        password: form.password,
        role: form.role,
      });
      navigate('/dashboard');
    } catch (err) {
      const detail = err.response?.data;
      if (typeof detail === 'object') {
        const firstKey = Object.keys(detail)[0];
        setError(Array.isArray(detail[firstKey]) ? detail[firstKey][0] : detail[firstKey]);
      } else {
        setError(detail?.error || detail?.detail || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">📋</div>
          <h1>Create Account</h1>
          <p>Join the Resume Screener platform</p>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text" name="full_name" required value={form.full_name}
              onChange={handleChange} placeholder="John Doe"
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email" name="email" required value={form.email}
              onChange={handleChange} placeholder="recruiter@example.com"
            />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select name="role" value={form.role} onChange={handleChange}>
              <option value="recruiter">Recruiter</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password" name="password" required value={form.password}
              onChange={handleChange} placeholder="At least 6 characters"
            />
          </div>
          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password" name="confirmPassword" required value={form.confirmPassword}
              onChange={handleChange} placeholder="Re-enter your password"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <div className="login-footer">
          <p>Already have an account? <Link to="/">Sign In</Link></p>
        </div>
      </div>
    </div>
  );
}
