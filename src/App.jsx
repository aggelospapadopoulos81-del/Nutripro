port React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { LogOut, Users, Plus, Eye, EyeOff, Clipboard, TrendingUp, Mail, Phone, Copy, Check, Utensils, BarChart3, Flame, Download, LineChart, TrendingDown, Target, Calendar, Send, MessageCircle, X } from 'lucide-react';

// Initialize Supabase
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function NutriProApp() {
  // ==================== STATE ====================
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [clients, setClients] = useState([]);
  const [newWeight, setNewWeight] = useState('');
  const [progressNotes, setProgressNotes] = useState('');
  const [chartType, setChartType] = useState('line');
  const [messageText, setMessageText] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editWeight, setEditWeight] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editDeadline, setEditDeadline] = useState('');

  // ==================== AUTH ====================
  const handleSignIn = async () => {
    if (!username || !password) {
      alert('Please fill in all fields!');
      return;
    }

    setLoading(true);
    try {
      // Check admins
      const { data: admins, error: adminError } = await supabase
        .from('admins')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (admins) {
        setCurrentUser(admins);
        setUserRole('admin');
        await loadAdminClients(admins.id);
        setUsername('');
        setPassword('');
        setLoading(false);
        return;
      }

      // Check clients
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (clientData) {
        // Load client messages
        const { data: messages } = await supabase
          .from('messages')
          .select('*')
          .eq('clientId', clientData.id);

        // Load client progress
        const { data: progress } = await supabase
          .from('progress')
          .select('*')
          .eq('clientId', clientData.id)
          .order('date', { ascending: true });

        setCurrentUser({
          ...clientData,
          messages: messages || [],
          progress: progress || []
        });
        setUserRole('client');
        setUsername('');
        setPassword('');
        setLoading(false);
        return;
      }

      alert('❌ Invalid credentials!');
    } catch (error) {
      alert('Error: ' + error.message);
    }
    setLoading(false);
  };

  const loadAdminClients = async (adminId) => {
    try {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('adminId', adminId);

      // Load full data for each client
      const clientsWithData = await Promise.all(
        (data || []).map(async (client) => {
          const { data: messages } = await supabase
            .from('messages')
            .select('*')
            .eq('clientId', client.id);

          const { data: progress } = await supabase
            .from('progress')
            .select('*')
            .eq('clientId', client.id)
            .order('date', { ascending: true });

          return {
            ...client,
            messages: messages || [],
            progress: progress || []
          };
        })
      );

      setClients(clientsWithData);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  // ==================== ANALYTICS ====================
  const calculateDaysLeft = (d) => {
    if (!d) return 'N/A';
    const days = Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const getAnalytics = (client) => {
    const progress = client.progress || [];
    if (progress.length < 2) return null;

    const startWeight = progress[0].weight;
    const currentWeight = client.currentWeight;
    const targetWeight = client.targetWeight;
    const totalLoss = (startWeight - currentWeight).toFixed(1);
    const weeksActive = progress.length;
    const avgLossPerWeek = (totalLoss / weeksActive).toFixed(2);
    
    const totalNeeded = startWeight - targetWeight;
    const achieved = startWeight - currentWeight;
    const goalAchievementPercent = Math.min(100, Math.round((achieved / totalNeeded) * 100));

    const consistentWeeks = progress.filter((p, i) => {
      if (i === 0) return true;
      return progress[i - 1].weight > p.weight || progress[i - 1].weight === p.weight;
    }).length;
    const consistency = Math.round((consistentWeeks / weeksActive) * 100);

    const projectedWeeksToGoal = totalNeeded > 0 ? Math.ceil(totalNeeded / avgLossPerWeek) : 0;
    const projectedDate = new Date();
    projectedDate.setDate(projectedDate.getDate() + projectedWeeksToGoal * 7);

    return {
      totalLoss,
      avgLossPerWeek,
      goalAchievementPercent,
      consistency,
      projectedWeeksToGoal,
      projectedDate: projectedDate.toISOString().split('T')[0],
      daysRemaining: calculateDaysLeft(client.deadline),
      onTrack: avgLossPerWeek > 0.3
    };
  };

  const handleAddProgress = async (clientId, w, n) => {
    if (!w) {
      alert('Enter weight!');
      return;
    }

    setLoading(true);
    try {
      const newDate = new Date().toISOString().split('T')[0];
      
      // Insert progress
      await supabase.from('progress').insert([{
        clientId,
        date: newDate,
        weight: parseFloat(w),
        notes: n
      }]);

      // Update client current weight
      await supabase
        .from('clients')
        .update({ currentWeight: parseFloat(w), currentStreak: (selectedClient?.currentStreak || 0) + 1 })
        .eq('id', clientId);

      // Reload client
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      const { data: progress } = await supabase
        .from('progress')
        .select('*')
        .eq('clientId', clientId)
        .order('date', { ascending: true });

      const updated = {
        ...data,
        progress: progress || []
      };

      setSelectedClient(updated);
      setClients(clients.map(c => c.id === clientId ? updated : c));
      setNewWeight('');
      setProgressNotes('');
      alert('✅ Saved! 🔥 Streak continues!');
    } catch (error) {
      alert('Error: ' + error.message);
    }
    setLoading(false);
  };

  const handleSendMessage = async (recipientId, senderRole) => {
    if (!messageText.trim()) return;

    setLoading(true);
    try {
      const now = new Date().toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      
      await supabase.from('messages').insert([{
        clientId: recipientId,
        sender: senderRole,
        senderName: currentUser.name,
        text: messageText,
        timestamp: now
      }]);

      // Reload messages
      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .eq('clientId', recipientId);

      if (selectedClient) {
        setSelectedClient({...selectedClient, messages: messages || []});
      }

      setClients(clients.map(c => c.id === recipientId ? {...c, messages: messages || []} : c));
      setMessageText('');
    } catch (error) {
      alert('Error: ' + error.message);
    }
    setLoading(false);
  };

  const handleUpdateMetrics = async () => {
    if (!editWeight || !editTarget || !editDeadline) {
      alert('Fill all fields!');
      return;
    }

    setLoading(true);
    try {
      await supabase
        .from('clients')
        .update({
          currentWeight: parseFloat(editWeight),
          targetWeight: parseFloat(editTarget),
          deadline: editDeadline
        })
        .eq('id', selectedClient.id);

      const updated = {
        ...selectedClient,
        currentWeight: parseFloat(editWeight),
        targetWeight: parseFloat(editTarget),
        deadline: editDeadline
      };

      setSelectedClient(updated);
      setClients(clients.map(c => c.id === selectedClient.id ? updated : c));
      setShowEditModal(false);
      alert('✅ Metrics updated!');
    } catch (error) {
      alert('Error: ' + error.message);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setUserRole(null);
    setSelectedClient(null);
    setSelectedChat(null);
    setClients([]);
    setUsername('');
    setPassword('');
  };

  // ==================== CHART ====================
  const renderChart = (progress) => {
    if (!progress || progress.length === 0) return null;

    const maxWeight = Math.max(...progress.map(p => p.weight));
    const minWeight = Math.min(...progress.map(p => p.weight));
    const range = maxWeight - minWeight || 1;

    return (
      <div className="space-y-4">
        <div className="flex gap-2 mb-4">
          {['line', 'bar', 'area'].map(type => (
            <button
              key={type}
              onClick={() => setChartType(type)}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                chartType === type ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-300'
              }`}
            >
              {type === 'line' ? '📈 Line' : type === 'bar' ? '📊 Bars' : '📐 Area'}
            </button>
          ))}
        </div>

        <div className="bg-slate-700 rounded-lg p-6">
          {chartType === 'bar' && (
            <div className="flex items-end gap-2 h-64 justify-between w-full">
              {progress.map((p, i) => {
                const height = ((p.weight - minWeight) / range) * 100;
                return (
                  <div key={i} className="flex flex-col items-center gap-2 flex-1 h-full justify-end">
                    <div className="w-full bg-gradient-to-t from-orange-400 to-orange-500 rounded-t-lg" style={{ height: `${height}%`, minHeight: '20px' }}></div>
                    <p className="text-xs text-slate-300 w-full text-center truncate">{p.date.slice(5)}</p>
                  </div>
                );
              })}
            </div>
          )}

          {chartType === 'line' && (
            <svg className="w-full h-64" viewBox="0 0 100 60" preserveAspectRatio="none">
              <defs>
                <linearGradient id="lineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style={{stopColor: '#ea580c', stopOpacity: 0.3}} />
                  <stop offset="100%" style={{stopColor: '#ea580c', stopOpacity: 0}} />
                </linearGradient>
              </defs>
              <path d={`M 0 ${100 - ((progress[0].weight - minWeight) / range) * 100} ${progress.map((p, i) => `L ${(i / (progress.length - 1)) * 100} ${100 - ((p.weight - minWeight) / range) * 100}`).join(' ')} L 100 100 L 0 100 Z`} fill="url(#lineGrad)" />
              <polyline points={progress.map((p, i) => `${(i / (progress.length - 1)) * 100},${100 - ((p.weight - minWeight) / range) * 100}`).join(' ')} fill="none" stroke="#ea580c" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
          )}

          {chartType === 'area' && (
            <svg className="w-full h-64" viewBox="0 0 100 60" preserveAspectRatio="none">
              <defs>
                <linearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style={{stopColor: '#10b981', stopOpacity: 0.4}} />
                  <stop offset="100%" style={{stopColor: '#10b981', stopOpacity: 0}} />
                </linearGradient>
              </defs>
              <path d={`M 0 ${100 - ((progress[0].weight - minWeight) / range) * 100} ${progress.map((p, i) => `L ${(i / (progress.length - 1)) * 100} ${100 - ((p.weight - minWeight) / range) * 100}`).join(' ')} L 100 100 L 0 100 Z`} fill="url(#areaGrad)" />
            </svg>
          )}
        </div>
      </div>
    );
  };

  // ==================== LOGIN ====================
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-orange-900 flex items-center justify-center p-4">
        <div className="relative z-10 w-full max-w-md">
          <div className="bg-slate-800 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-8">
              <div className="inline-block bg-gradient-to-r from-orange-500 to-orange-600 p-3 rounded-xl mb-4">
                <Clipboard className="text-white" size={32} />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">NutriPro</h1>
              <p className="text-slate-400">Professional Nutrition Management</p>
            </div>

            <div className="space-y-4">
              <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                onKeyPress={(e) => e.key === 'Enter' && handleSignIn()}
                placeholder="Username" 
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500" 
                disabled={loading}
              />
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  onKeyPress={(e) => e.key === 'Enter' && handleSignIn()}
                  placeholder="Password" 
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500" 
                  disabled={loading}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-slate-400">
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <button 
                onClick={handleSignIn}
                disabled={loading}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>

            <div className="mt-6 p-4 bg-slate-700 rounded-lg text-sm text-slate-300">
              <p className="font-semibold mb-2">Demo Credentials:</p>
              <p>Admin: aggelos_pro / Demo123!</p>
              <p>Client: john_smith_123 / Pass123!</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== CLIENT DASHBOARD ====================
  if (userRole === 'client' && !selectedChat) {
    const analytics = getAnalytics(currentUser);

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">My Journey</h1>
              <p className="text-slate-400 text-sm"><span className="text-orange-400 font-semibold">{currentUser.name}</span></p>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSelectedChat('dietician')}
                style={{
                  pointerEvents: 'auto',
                  touchAction: 'manipulation',
                  cursor: 'pointer',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
              >
                <MessageCircle size={20} />
                💬 Message Dietician
              </button>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg"
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-8">
          {analytics && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-gradient-to-br from-orange-600 to-orange-500 rounded-xl p-6 text-white shadow-lg">
                  <p className="text-orange-100 text-sm mb-1">Total Loss</p>
                  <p className="text-4xl font-bold">{analytics.totalLoss} kg</p>
                  <p className="text-orange-100 text-xs mt-1">{analytics.avgLossPerWeek} kg/week avg</p>
                </div>

                <div className="bg-gradient-to-br from-green-600 to-green-500 rounded-xl p-6 text-white shadow-lg">
                  <p className="text-green-100 text-sm mb-1">Goal Achievement</p>
                  <p className="text-4xl font-bold">{analytics.goalAchievementPercent}%</p>
                  <p className="text-green-100 text-xs mt-1">On track: {analytics.onTrack ? '✅ Yes' : '❌ Adjust'}</p>
                </div>

                <div className="bg-gradient-to-br from-blue-600 to-blue-500 rounded-xl p-6 text-white shadow-lg">
                  <p className="text-blue-100 text-sm mb-1">Consistency</p>
                  <p className="text-4xl font-bold">{analytics.consistency}%</p>
                </div>

                <div className="bg-gradient-to-br from-purple-600 to-purple-500 rounded-xl p-6 text-white shadow-lg">
                  <p className="text-purple-100 text-sm mb-1">Projected Goal</p>
                  <p className="text-2xl font-bold">{analytics.projectedDate}</p>
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 mb-8">
                <h2 className="text-2xl font-bold text-white mb-6">Weight Progress</h2>
                {renderChart(currentUser.progress)}
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 mb-8">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <TrendingUp className="text-green-400" size={28} />
                  Weekly Update
                </h2>
                <div className="space-y-4">
                  <input 
                    type="number" 
                    step="0.1" 
                    value={newWeight} 
                    onChange={(e) => setNewWeight(e.target.value)} 
                    placeholder="Your weight this week (kg)" 
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
                    disabled={loading}
                  />
                  <input 
                    type="text" 
                    value={progressNotes} 
                    onChange={(e) => setProgressNotes(e.target.value)} 
                    placeholder="How are you feeling? (optional)" 
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
                    disabled={loading}
                  />
                  <button 
                    onClick={() => handleAddProgress(currentUser.id, newWeight, progressNotes)}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 rounded-lg text-lg disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : '✅ Save Update'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ==================== CLIENT MESSAGING ====================
  if (userRole === 'client' && selectedChat === 'dietician') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">💬 Message Your Dietician</h1>
              <p className="text-slate-400 text-sm">Direct support from Aggelos</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedChat(null)} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg">
                ← Back
              </button>
              <button onClick={handleLogout} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg">
                <LogOut size={18} />
                Sign Out
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 h-96 flex flex-col">
            <div className="flex-1 overflow-y-auto mb-4 space-y-4">
              {currentUser.messages && currentUser.messages.length > 0 ? (
                currentUser.messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender === 'client' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs rounded-lg p-4 ${msg.sender === 'client' ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-100'}`}>
                      <p className="text-sm font-semibold mb-1">{msg.senderName}</p>
                      <p className="text-sm mb-2">{msg.text}</p>
                      <p className={`text-xs ${msg.sender === 'client' ? 'text-orange-100' : 'text-slate-400'}`}>{msg.timestamp}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-slate-400 py-8">
                  <p>No messages yet. Start a conversation! 💬</p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(currentUser.id, 'client')}
                placeholder="Type your message..."
                className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
                disabled={loading}
              />
              <button
                onClick={() => handleSendMessage(currentUser.id, 'client')}
                disabled={loading}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-lg transition flex items-center gap-2 disabled:opacity-50"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== ADMIN DASHBOARD ====================
  if (userRole === 'admin' && !selectedClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-slate-400 text-sm"><span className="text-orange-400 font-semibold">{currentUser.name}</span></p>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg">
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm mb-1">Total Clients</p>
                  <p className="text-4xl font-bold text-white">{clients.length}</p>
                </div>
                <Users className="text-orange-500" size={40} />
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm mb-1">Avg Total Loss</p>
                  <p className="text-4xl font-bold text-white">{(clients.reduce((sum, c) => sum + (getAnalytics(c)?.totalLoss || 0), 0) / Math.max(1, clients.length)).toFixed(1)} kg</p>
                </div>
                <TrendingDown className="text-green-500" size={40} />
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm mb-1">Avg Consistency</p>
                  <p className="text-4xl font-bold text-white">{Math.round(clients.reduce((sum, c) => sum + (getAnalytics(c)?.consistency || 0), 0) / Math.max(1, clients.length))}%</p>
                </div>
                <Flame className="text-red-500" size={40} />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Your Clients</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {clients.map(client => {
                const analytics = getAnalytics(client);
                return (
                  <div 
                    key={client.id} 
                    onClick={() => setSelectedClient(client)} 
                    className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-orange-500 cursor-pointer hover:scale-105 transition transform"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-white">{client.name}</h3>
                        <p className="text-orange-400 text-sm font-semibold">{client.goal}</p>
                      </div>
                    </div>

                    {analytics && (
                      <div className="space-y-2 text-sm mb-4">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Loss</span>
                          <span className="text-green-400 font-bold">{analytics.totalLoss} kg</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Goal</span>
                          <span className="text-orange-400 font-bold">{analytics.goalAchievementPercent}%</span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-sm">
                      <Flame className="text-red-500" size={18} />
                      <span className="text-white font-bold">{client.currentStreak} weeks</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== ADMIN CLIENT PROFILE ====================
  if (userRole === 'admin' && selectedClient && !selectedChat) {
    const analytics = getAnalytics(selectedClient);

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <div>
              <button onClick={() => setSelectedClient(null)} className="text-orange-400 hover:text-orange-300 font-semibold mb-2">
                ← Back to Clients
              </button>
              <h1 className="text-2xl font-bold text-white">{selectedClient.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setSelectedChat(selectedClient.id)}
                style={{
                  pointerEvents: 'auto',
                  touchAction: 'manipulation',
                  cursor: 'pointer',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
              >
                <MessageCircle size={20} />
                💬 Chat
              </button>
              <button onClick={handleLogout} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg">
                <LogOut size={18} />
                Sign Out
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {analytics && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-gradient-to-br from-green-600 to-green-500 rounded-xl p-6 text-white">
                  <p className="text-green-100 text-sm mb-1">Total Loss</p>
                  <p className="text-4xl font-bold">{analytics.totalLoss} kg</p>
                  <p className="text-green-100 text-xs mt-1">{analytics.avgLossPerWeek} kg/week</p>
                </div>

                <div className="bg-gradient-to-br from-orange-600 to-orange-500 rounded-xl p-6 text-white">
                  <p className="text-orange-100 text-sm mb-1">Goal Achievement</p>
                  <p className="text-4xl font-bold">{analytics.goalAchievementPercent}%</p>
                </div>

                <div className="bg-gradient-to-br from-blue-600 to-blue-500 rounded-xl p-6 text-white">
                  <p className="text-blue-100 text-sm mb-1">Consistency</p>
                  <p className="text-4xl font-bold">{analytics.consistency}%</p>
                </div>

                <div className="bg-gradient-to-br from-purple-600 to-purple-500 rounded-xl p-6 text-white">
                  <p className="text-purple-100 text-sm mb-1">Projected Goal</p>
                  <p className="text-2xl font-bold">{analytics.projectedDate}</p>
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 mb-8">
                <h2 className="text-2xl font-bold text-white mb-6">Progress Chart</h2>
                {renderChart(selectedClient.progress)}
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 mb-8">
                <h2 className="text-2xl font-bold text-white mb-6">Client Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-slate-700 rounded-lg px-4 py-3"><p className="text-slate-400 text-xs mb-1">Height</p><p className="text-white font-bold">{selectedClient.height} cm</p></div>
                  <div className="bg-orange-600 rounded-lg px-4 py-3"><p className="text-slate-300 text-xs mb-1">Current</p><p className="text-white font-bold">{selectedClient.currentWeight} kg</p></div>
                  <div className="bg-green-600 rounded-lg px-4 py-3"><p className="text-slate-300 text-xs mb-1">Target</p><p className="text-white font-bold">{selectedClient.targetWeight} kg</p></div>
                  <div className="bg-purple-600 rounded-lg px-4 py-3"><p className="text-slate-300 text-xs mb-1">Deadline</p><p className="text-white font-bold text-sm">{selectedClient.deadline || 'Not set'}</p></div>
                </div>

                <button
                  onClick={() => {
                    setEditWeight(selectedClient.currentWeight);
                    setEditTarget(selectedClient.targetWeight);
                    setEditDeadline(selectedClient.deadline);
                    setShowEditModal(true);
                  }}
                  style={{
                    pointerEvents: 'auto',
                    touchAction: 'manipulation',
                    width: '100%',
                    padding: '16px',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: 'white',
                    backgroundColor: '#ea580c',
                    border: 'none',
                    borderRadius: '8px'
                  }}
                >
                  ✏️ Edit Metrics
                </button>
              </div>
            </>
          )}
        </div>

        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[999]">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 max-w-md w-full">
              <h2 className="text-2xl font-bold text-white mb-6">Edit Metrics</h2>
              <div className="space-y-4">
                <input type="number" step="0.1" value={editWeight} onChange={(e) => setEditWeight(e.target.value)} placeholder="Current Weight (kg)" className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-2" />
                <input type="number" step="0.1" value={editTarget} onChange={(e) => setEditTarget(e.target.value)} placeholder="Target Weight (kg)" className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-2" />
                <input type="date" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-2" />
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setShowEditModal(false)} className="flex-1 bg-slate-700 text-white py-2 rounded-lg">Cancel</button>
                  <button onClick={handleUpdateMetrics} disabled={loading} className="flex-1 bg-orange-500 text-white py-2 rounded-lg disabled:opacity-50">Save</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== ADMIN MESSAGING ====================
  if (userRole === 'admin' && selectedChat) {
    const chatClient = clients.find(c => c.id === selectedChat);
    if (!chatClient) return null;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">💬 Chat with {chatClient.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setSelectedChat(null); setSelectedClient(chatClient); }} className="flex items-center gap-2 bg-slate-700 text-white px-4 py-2 rounded-lg">
                ← Back
              </button>
              <button onClick={handleLogout} className="flex items-center gap-2 bg-slate-700 text-white px-4 py-2 rounded-lg">
                <LogOut size={18} />
                Sign Out
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 h-96 flex flex-col">
            <div className="flex-1 overflow-y-auto mb-4 space-y-4">
              {chatClient.messages && chatClient.messages.length > 0 ? (
                chatClient.messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs rounded-lg p-4 ${msg.sender === 'admin' ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-100'}`}>
                      <p className="text-sm font-semibold mb-1">{msg.senderName}</p>
                      <p className="text-sm mb-2">{msg.text}</p>
                      <p className={`text-xs ${msg.sender === 'admin' ? 'text-orange-100' : 'text-slate-400'}`}>{msg.timestamp}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-slate-400 py-8">
                  <p>No messages yet. Start the conversation! 💬</p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(chatClient.id, 'admin')}
                placeholder="Type your message..."
                className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-3"
                disabled={loading}
              />
              <button
                onClick={() => handleSendMessage(chatClient.id, 'admin')}
                disabled={loading}
                className="bg-orange-500 text-white px-4 py-3 rounded-lg disabled:opacity-50"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
      }
