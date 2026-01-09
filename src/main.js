import './style.css'
import { auth, db } from './firebase'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth'
import { doc, getDoc, collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, setDoc, updateDoc, increment, runTransaction } from 'firebase/firestore'
import Chart from 'chart.js/auto'

// App State
const state = {
  user: null,
  isAdmin: false,
  currentView: 'dashboard',
  showPassword: false,
  theme: localStorage.getItem('theme') || 'light',
  users: [],
  members: [],
  transactions: [],
  loans: [],
  currentView: new URLSearchParams(window.location.search).get('view') || 'dashboard',
  filters: {
    users: { query: '' }
  },
  filters: {
    transactions: {
      type: 'all',
      date: '',
      memberId: ''
    },
    users: { query: '' }
  },
  stats: {
    totalUsers: 0,
    pendingLoans: 0,
    totalTransactions: 0,
    totalVolume: 0
  }
}

// Theme Logic
const initTheme = () => {
  document.documentElement.setAttribute('data-theme', state.theme)
}

const toggleTheme = () => {
  state.theme = state.theme === 'light' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', state.theme)
  localStorage.setItem('theme', state.theme)
  render()
}

const app = document.querySelector('#app')

// Components
const LoginView = () => `
  <div class="login-container">
    <div class="login-card">
      <h1 style="margin-bottom: 0.5rem; text-align: center;">UnionConnect Admin</h1>
      <p style="color: var(--text-secondary); text-align: center; margin-bottom: 2rem;">Sign in to access the dashboard</p>
      <form id="login-form">
        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label>Email Address</label>
          <input type="email" id="email" placeholder="e.g. admin@unionconnect.app" required>
        </div>
        <div class="form-group" style="margin-bottom: 2rem;">
          <label>Password</label>
          <div class="password-input-wrapper">
            <input type="${state.showPassword ? 'text' : 'password'}" id="password" placeholder="Enter your secure password" required>
            <button type="button" id="toggle-password" class="password-toggle">
              ${state.showPassword ? 'hide' : 'show'}
            </button>
          </div>
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%;">Sign In</button>
        <p id="auth-error" style="color: var(--accent); font-size: 0.875rem; margin-top: 1rem; text-align: center; display: none;"></p>
      </form>
    </div>
  </div>
`

const DashboardView = () => `
  <div id="sidebar-overlay" class="sidebar-overlay"></div>
  <div class="sidebar" id="sidebar">
    <div style="margin-bottom: 3rem;">
      <h2 style="font-size: 1.5rem; color: var(--primary); font-family: var(--font-display); letter-spacing: -1px;">UnionConnect</h2>
      <p style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em;">Built by KlenamDev</p>
    </div>
    <nav style="flex: 1;">
      <a href="#" class="nav-item ${state.currentView === 'dashboard' ? 'active' : ''}" data-view="dashboard">
        <span style="margin-right: 12px;">📊</span> Summary
      </a>
      <a href="#" class="nav-item ${state.currentView === 'analytics' ? 'active' : ''}" data-view="analytics">
        <span style="margin-right: 12px;">📈</span> Analytics
      </a>
      <a href="#" class="nav-item ${state.currentView === 'users' ? 'active' : ''}" data-view="users">
        <span style="margin-right: 12px;">👥</span> User Base
      </a>
      <a href="#" class="nav-item ${state.currentView === 'members' ? 'active' : ''}" data-view="members">
        <span style="margin-right: 12px;">📝</span> Enrollment
      </a>
      <a href="#" class="nav-item ${state.currentView === 'transactions' ? 'active' : ''}" data-view="transactions">
        <span style="margin-right: 12px;">💸</span> Transactions
      </a>
      <a href="#" class="nav-item ${state.currentView === 'loans' ? 'active' : ''}" data-view="loans">
        <span style="margin-right: 12px;">💰</span> Loan Center
      </a>
    </nav>
  </div>
  <div class="main-content">
    <header class="header">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <button id="sidebar-toggle" class="sidebar-toggle">
          ☰
        </button>
        <div>
          <p style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase;">Overview</p>
          <h1 style="font-size: 1.5rem;">${state.currentView.charAt(0).toUpperCase() + state.currentView.slice(1).replace(/([A-Z])/g, ' $1')}</h1>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 1rem;">
        <button class="btn" onclick="toggleTheme()" style="background: var(--secondary); color: var(--text-primary); padding: 0.5rem; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; box-shadow: none;">
          ${state.theme === 'light' ? '🌙' : '☀️'}
        </button>
        <div id="profile-menu" class="profile-menu-container" style="display: flex; align-items: center; gap: 1.25rem; background: var(--surface); padding: 0.5rem 1rem; border-radius: 50px; box-shadow: var(--shadow-sm); position: relative;">
          <div style="text-align: right;">
            <div style="font-size: 0.875rem; font-weight: 700;">Admin Panel</div>
            <div style="font-size: 0.7rem; color: var(--text-secondary);">${state.user?.email}</div>
          </div>
          <div style="width: 42px; height: 42px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.1rem; box-shadow: 0px 4px 12px rgba(67, 97, 238, 0.4);">A</div>
        
          <div id="profile-dropdown" class="profile-dropdown">
             <div class="dropdown-item" id="action-change-password">
               <span style="margin-right: 10px;">🔒</span> Change Password
             </div>
             <div class="dropdown-item danger" id="action-logout">
               <span style="margin-right: 10px;">🚪</span> Sign Out
             </div>
          </div>
        </div>
      </div>
    </header>
    <div id="view-content">
      ${renderSection()}
    </div>
  </div>
`

const renderSection = () => {
  switch (state.currentView) {
    case 'dashboard':
      return `
        <div class="stats-grid">
          <div class="stat-card card-blue">
            <h3>Active Users</h3>
            <div class="value">${state.stats.totalUsers}</div>
            <div style="font-size: 0.7rem; margin-top: 0.5rem; color: var(--primary); font-weight: 700;">Global Base</div>
          </div>
          <div class="stat-card card-orange">
            <h3>Pending Loans</h3>
            <div class="value">${state.stats.pendingLoans}</div>
            <div style="font-size: 0.7rem; margin-top: 0.5rem; color: var(--warning); font-weight: 700;">Action Required</div>
          </div>
          <div class="stat-card card-purple">
            <h3>Transaction Count</h3>
            <div class="value">${state.stats.totalTransactions}</div>
            <div style="font-size: 0.7rem; margin-top: 0.5rem; color: var(--info); font-weight: 700;">Monthly Activity</div>
          </div>
          <div class="stat-card card-green">
            <h3>Capital Volume</h3>
            <div class="value">GHS ${state.stats.totalVolume.toLocaleString()}</div>
            <div style="font-size: 0.7rem; margin-top: 0.5rem; color: var(--success); font-weight: 700;">Total Flow</div>
          </div>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 2rem;">
          
          <div class="content-card">
            <h3 style="font-size: 1.15rem; margin-bottom: 1.5rem;">Newest Members</h3>
            <ul style="list-style: none;">
              ${state.users.slice(0, 8).map(u => `
                <li style="padding: 1rem 0; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 1rem;">
                  <div style="width: 40px; height: 40px; border-radius: 12px; background: var(--secondary); display: flex; align-items: center; justify-content: center; font-size: 0.9rem; font-weight: 800; color: var(--primary);">${u.fullName?.charAt(0) || 'U'}</div>
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 700; font-size: 0.875rem; color: var(--text-primary);">${u.fullName}</div>
                    <div style="font-size: 0.7rem; color: var(--text-secondary); font-family: monospace;">${u.memberId}</div>
                  </div>
                  <div style="font-size: 0.7rem; font-weight: 700; color: var(--success);">NEW</div>
                </li>
              `).join('')}
              ${state.users.length === 0 ? '<li style="color: var(--text-secondary); font-size: 0.875rem; padding: 2rem 0; text-align: center;">Scanning records...</li>' : ''}
            </ul>
          </div>

          <div class="content-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
              <h3 style="font-size: 1.15rem;">Recent Transactions</h3>
              <button id="view-all-transactions" class="btn btn-primary" style="padding: 0.5rem 1rem; font-size: 0.7rem;">View All</button>
            </div>
            <div class="table-container" style="box-shadow: none;">
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  ${state.transactions.slice(0, 5).map(t => `
                    <tr>
                      <td style="text-transform: capitalize;">${t.type?.replace('_', ' ')}</td>
                      <td style="font-weight: 800;">GHS ${t.amount?.toFixed(2)}</td>
                      <td><span class="badge badge-${t.status === 'success' ? 'success' : 'warning'}">${t.status}</span></td>
                      <td style="color: var(--text-secondary);">${new Date(t.createdAt?.seconds * 1000).toLocaleDateString()}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `
    case 'analytics':
      return `
        <div class="content-card" style="margin-bottom: 2rem;">
          <h3 style="font-size: 1.15rem; margin-bottom: 1.5rem;">Transaction Activity</h3>
          <div style="height: 300px; position: relative; width: 100%;">
            <canvas id="volume-chart"></canvas>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
          <div class="content-card">
             <h3 style="font-size: 1.15rem; margin-bottom: 1.5rem;">User Permissions</h3>
             <div style="height: 250px; position: relative; width: 100%;">
               <canvas id="user-chart"></canvas>
             </div>
          </div>
          <div class="content-card">
             <h3 style="font-size: 1.15rem; margin-bottom: 1.5rem;">Transaction Distribution</h3>
             <div style="height: 250px; position: relative; width: 100%;">
               <canvas id="type-chart"></canvas>
             </div>
          </div>
        </div>
      `
    case 'users':
      const filteredUsers = state.users.filter(u =>
        u.fullName?.toLowerCase().includes(state.filters.users.query.toLowerCase()) ||
        u.memberId?.toLowerCase().includes(state.filters.users.query.toLowerCase())
      )
      return `
  <div class="content-card" style="margin-bottom: 2rem; padding: 1.5rem;">
    <div class="form-group" style="margin-bottom: 0;">
      <label>Search User Base</label>
      <input type="text" id="user-search" value="${state.filters.users.query}" placeholder="Search by name or Member ID..." style="max-width: 400px;">
    </div>
        </div>
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th>Reference ID</th>
          <th>Full Name</th>
          <th>Contact Info</th>
          <th>Auth Email</th>
          <th>Current Balance</th>
        </tr>
      </thead>
      <tbody>
        ${filteredUsers.map(u => `
                <tr>
                  <td><code style="background: var(--secondary); padding: 0.25rem 0.5rem; border-radius: 6px; color: var(--primary); font-weight: 700;">${u.memberId}</code></td>
                  <td>${u.fullName}</td>
                  <td style="color: var(--text-secondary);">${u.phoneNumber}</td>
                  <td>${u.email}</td>
                  <td><span style="font-weight: 800; color: var(--primary);">GHS ${u.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></td>
                </tr>
              `).join('')}
        ${filteredUsers.length === 0 ? '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No users match your search.</td></tr>' : ''}
      </tbody>
    </table>
  </div>
`
    case 'members':
      return `
  <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 2rem;">
          <div class="content-card">
            <h2 style="font-size: 1.25rem; margin-bottom: 1rem;">Internal Enrollment</h2>
            <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 2rem; font-weight: 500;">Pre-authorize system access for new faculty and members.</p>
            <form id="create-member-form">
              <div class="form-group">
                <label>System Identifier (Member ID)</label>
                <input type="text" name="memberId" placeholder="CU-XXXX-2024" required>
              </div>
              <div class="form-group">
                <label>Official Name</label>
                <input type="text" name="fullName" placeholder="Legal full name" required>
              </div>
              <div class="form-group">
                <label>Authorized Phone</label>
                <input type="tel" name="phoneNumber" placeholder="024 XXX XXXX" required>
              </div>
              <div class="form-group">
                <label>Opening Wallet Credit (GHS)</label>
                <input type="number" name="balance" value="0" step="0.01">
              </div>
              <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem;">Register Credentials</button>
            </form>
          </div>
          <div class="table-container">
            <div style="padding: 1.5rem; border-bottom: 1px solid var(--border);">
              <h2 style="font-size: 1.1rem;">Pending Registrations</h2>
            </div>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Member Name</th>
                  <th>Access Condition</th>
                </tr>
              </thead>
              <tbody>
                ${state.members.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds).map(m => `
                  <tr>
                    <td><code>${m.memberId}</code></td>
                    <td>${m.fullName}</td>
                    <td>
                      <span class="badge ${m.hasAppAccount ? 'badge-success' : 'badge-warning'}">
                        ${m.hasAppAccount ? 'ACTIVE ACCOUNT' : 'ENROLLMENT OPEN'}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
  `
    case 'transactions':
      const filteredTransactions = state.transactions.filter(t => {
        const typeMatch = state.filters.transactions.type === 'all' || t.type === state.filters.transactions.type
        const dateMatch = !state.filters.transactions.date || new Date(t.createdAt?.seconds * 1000).toLocaleDateString() === new Date(state.filters.transactions.date).toLocaleDateString()
        const userMatch = !state.filters.transactions.memberId || t.userId?.toLowerCase().includes(state.filters.transactions.memberId.toLowerCase()) ||
          state.users.find(u => u.id === t.userId)?.memberId?.toLowerCase().includes(state.filters.transactions.memberId.toLowerCase())
        return typeMatch && dateMatch && userMatch
      })

      return `
  <div class="content-card" style="margin-bottom: 2rem; padding: 1.5rem;">
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
      <div class="form-group" style="margin-bottom: 0;">
        <label>Operation Type</label>
        <select id="filter-type" style="width: 100%; color: var(--text-primary); padding: 1rem 1.25rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--secondary); font-weight: 600;">
          <option value="all" ${state.filters.transactions.type === 'all' ? 'selected' : ''}>All Operations</option>
          <option value="deposit" ${state.filters.transactions.type === 'deposit' ? 'selected' : ''}>Deposits</option>
          <option value="withdraw" ${state.filters.transactions.type === 'withdraw' ? 'selected' : ''}>Withdrawals</option>
          <option value="transfer_sent" ${state.filters.transactions.type === 'transfer_sent' ? 'selected' : ''}>Transfers Sent</option>
          <option value="transfer_received" ${state.filters.transactions.type === 'transfer_received' ? 'selected' : ''}>Transfers Received</option>
          <option value="airtime" ${state.filters.transactions.type === 'airtime' ? 'selected' : ''}>Airtime Purchases</option>
          <option value="data" ${state.filters.transactions.type === 'data' ? 'selected' : ''}>Data Bundles</option>
        </select>
      </div>
      <div class="form-group" style="margin-bottom: 0;">
        <label>Filter by Date</label>
        <input type="date" id="filter-date" value="${state.filters.transactions.date}">
      </div>
      <div class="form-group" style="margin-bottom: 0;">
        <label>Search member ID</label>
        <input type="text" id="filter-member" value="${state.filters.transactions.memberId}" placeholder="Enter member ID...">
      </div>
    </div>
        </div>
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Operation</th>
          <th>Context / Remarks</th>
          <th>Amount (GHS)</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${filteredTransactions.map(t => {
        const date = new Date(t.createdAt?.seconds * 1000);
        const isDeposit = t.type === 'deposit' || t.type === 'loan_disbursement' || t.type === 'transfer_received';
        const member = state.users.find(u => u.id === t.userId);
        return `
                  <tr>
                    <td>
                      <div style="font-weight: 700;">${date.toLocaleDateString()}</div>
                      <div style="font-size: 0.7rem; color: var(--text-secondary);">${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td>
                      <span class="badge ${isDeposit ? 'badge-success' : 'badge-info'}">
                        ${t.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td style="max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      <div style="font-weight: 700; color: var(--text-primary);">${member?.fullName || 'System'}</div>
                      <div style="font-size: 0.75rem; color: var(--text-secondary);">${t.description}</div>
                    </td>
                    <td>
                      <span style="font-weight: 800; color: ${isDeposit ? 'var(--success)' : 'var(--text-primary)'}">
                        ${isDeposit ? '+' : '-'} ${t.amount.toFixed(2)}
                      </span>
                    </td>
                    <td>
                      <span class="badge ${t.status === 'failed' ? 'badge-danger' : 'badge-success'}">
                        ${t.status || 'MATCHED'}
                      </span>
                    </td>
                  </tr>
                `
      }).join('')}
        ${filteredTransactions.length === 0 ? '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No matching transactions found.</td></tr>' : ''}
      </tbody>
    </table>
  </div>
`
    case 'loans':
      return `
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th>User</th>
          <th>Amount</th>
          <th>Duration</th>
          <th>Purpose</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${state.loans.map(l => `
                <tr>
                  <td>
                    <div style="font-weight: 600;">${state.users.find(u => u.id === l.userId)?.fullName || 'Unknown User'}</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">${l.userId}</div>
                  </td>
                  <td style="font-weight: 700;">GHS ${l.amount.toLocaleString()}</td>
                  <td>${l.duration} months</td>
                  <td>${l.purpose}</td>
                  <td><span class="badge badge-warning">${l.status}</span></td>
                  <td>
                    ${l.status === 'pending' ? `
                       <div style="display: flex; gap: 0.5rem;">
                         <button class="btn btn-primary approve-loan" data-id="${l.id}" style="padding: 0.4rem 0.8rem; font-size: 0.75rem;">Approve</button>
                         <button class="btn reject-loan" data-id="${l.id}" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; background: #fee2e2; color: #ef4444;">Reject</button>
                       </div>
                    ` : '<span style="color: var(--text-secondary); font-size: 0.75rem;">Processed</span>'}
                  </td>
                </tr>
              `).join('')}
        ${state.loans.length === 0 ? '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No loan requests found.</td></tr>' : ''}
      </tbody>
    </table>
  </div>
  `
    default:
      return `<p>Content for ${state.currentView} is coming soon...</p>`
  }
}

// Logic
const initAuth = () => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Verify Admin
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      const userData = userDoc.data()

      if (userData?.isAdmin) {
        state.user = user
        state.isAdmin = true
        render()
        initDashboardListeners()
      } else {
        await signOut(auth)
        alert('Access denied. You are not an administrator.')
        state.user = null
        state.isAdmin = false
        render()
      }
    } else {
      state.user = null
      state.isAdmin = false
      render()
    }
  })
}

const handleLogin = async (e) => {
  e.preventDefault()
  const email = e.target.email.value
  const password = e.target.password.value
  const errorEl = document.querySelector('#auth-error')

  try {
    await signInWithEmailAndPassword(auth, email, password)
  } catch (error) {
    errorEl.textContent = 'Invalid email or password.'
    errorEl.style.display = 'block'
  }
}

const navigate = (e) => {
  if (e.target.classList.contains('nav-item')) {
    e.preventDefault()
    state.currentView = e.target.dataset.view
    render()
  }
}

const handleCreateMember = async (e) => {
  e.preventDefault()
  const formData = new FormData(e.target)
  const memberId = formData.get('memberId').trim().toUpperCase()
  const fullName = formData.get('fullName').trim()
  const phoneNumber = formData.get('phoneNumber').trim()
  const balance = parseFloat(formData.get('balance')) || 0

  try {
    await setDoc(doc(db, 'members', memberId), {
      memberId,
      fullName,
      phoneNumber,
      balance,
      hasAppAccount: false,
      createdAt: serverTimestamp()
    })
    alert('Member record created successfully! They can now sign up using this ID and phone number.')
    e.target.reset()
  } catch (error) {
    console.error(error)
    alert('Oops! Error creating member: ' + error.message)
  }
}

const handleApproveLoan = async (loanId) => {
  const loan = state.loans.find(l => l.id === loanId)
  if (!loan) return

  if (!confirm(`Are you sure you want to approve this loan of GHS ${loan.amount.toLocaleString()} for ${loan.userId} ? `)) return

  try {
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, 'users', loan.userId)
      const loanRef = doc(db, 'loan_requests', loanId)
      const transRef = doc(collection(db, 'transactions'))

      // 1. READ FIRST - Get current balance before any writes
      const userSnap = await transaction.get(userRef)
      const currentBalance = userSnap.data()?.balance || 0

      // 2. WRITES - Update Loan Status
      transaction.update(loanRef, {
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: state.user.uid
      })

      // 3. Update User Balance
      transaction.update(userRef, {
        balance: increment(loan.amount)
      })

      // 4. Create Transaction Record
      transaction.set(transRef, {
        id: transRef.id,
        userId: loan.userId,
        amount: loan.amount,
        type: 'deposit',
        balanceBefore: currentBalance,
        balanceAfter: currentBalance + loan.amount,
        description: `Loan Disbursement: ${loan.purpose} `,
        status: 'completed',
        createdAt: serverTimestamp()
      })
    })

    alert('Loan approved and funds disbursed successfully!')
    render()
  } catch (error) {
    console.error(error)
    alert('Error approving loan: ' + error.message)
  }
}

const handleRejectLoan = async (loanId) => {
  const reason = prompt('Please enter the reason for rejection:')
  if (reason === null) return // User cancelled
  if (!reason.trim()) {
    alert('Rejection reason is required.')
    return
  }

  if (!confirm('Are you sure you want to reject this loan request?')) return

  try {
    await updateDoc(doc(db, 'loan_requests', loanId), {
      status: 'rejected',
      rejectedAt: serverTimestamp(),
      rejectedBy: state.user.uid,
      rejectionReason: reason.trim()
    })
    alert('Loan request rejected.')
    render()
  } catch (error) {
    console.error(error)
    alert('Error rejecting loan: ' + error.message)
  }
}

const initDashboardListeners = () => {
  console.log('Initializing Dashboard Listeners...')

  // Real-time collections with error handling
  const usersUnsub = onSnapshot(collection(db, 'users'),
    (snap) => {
      state.users = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      state.stats.totalUsers = snap.size
      render()
    },
    (error) => {
      console.error('Users Listener Error:', error.message)
      if (error.code === 'permission-denied') {
        alert('Permission Denied: You do not have access to view users.')
      }
    }
  )

  const membersUnsub = onSnapshot(collection(db, 'members'),
    (snap) => {
      state.members = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      render()
    },
    (error) => console.error('Members Listener Error:', error.message)
  )

  const transUnsub = onSnapshot(query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(50)),
    (snap) => {
      state.transactions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      state.stats.totalTransactions = snap.size
      let volume = 0
      snap.forEach(doc => volume += doc.data().amount || 0)
      state.stats.totalVolume = volume
      render()
    },
    (error) => {
      console.error('Transactions Listener Error:', error.message)
      if (error.code === 'permission-denied') {
        state.transactions = []
        render()
      }
    }
  )

  const loansUnsub = onSnapshot(collection(db, 'loan_requests'),
    (snap) => {
      state.loans = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      state.stats.pendingLoans = state.loans.filter(l => l.status === 'pending').length
      render()
    },
    (error) => console.error('Loans Listener Error:', error.message)
  )

  // Store unsubs if we need to clean up on logout
  state.unsubs = [usersUnsub, membersUnsub, transUnsub, loansUnsub]
}

const render = () => {
  if (!state.user || !state.isAdmin) {
    app.innerHTML = LoginView()
    document.querySelector('#login-form')?.addEventListener('submit', handleLogin)
    document.querySelector('#toggle-password')?.addEventListener('click', () => {
      state.showPassword = !state.showPassword
      render()
    })
  } else {
    // Expose toggleTheme globally for the onclick handler
    window.toggleTheme = toggleTheme
    window.renderChangePasswordModal = renderChangePasswordModal
    window.signOut = signOut
    window.auth = auth

    app.innerHTML = DashboardView()
    document.querySelector('nav')?.addEventListener('click', (e) => {
      navigate(e)
      // Close sidebar on mobile after navigation
      document.querySelector('#sidebar')?.classList.remove('mobile-open')
      document.querySelector('#sidebar-overlay')?.classList.remove('active')
    })

    // Sidebar Toggle
    const sidebar = document.querySelector('#sidebar')
    const overlay = document.querySelector('#sidebar-overlay')
    const toggle = document.querySelector('#sidebar-toggle')

    toggle?.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open')
      overlay.classList.toggle('active')
    })

    overlay?.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open')
      overlay.classList.remove('active')
    })

    // Contextual listeners
    document.querySelector('#create-member-form')?.addEventListener('submit', handleCreateMember)

    // Loan actions
    document.querySelectorAll('.approve-loan').forEach(btn => {
      btn.addEventListener('click', () => handleApproveLoan(btn.dataset.id))
    })
    // Event Listeners for Profile Menu
    const profileMenu = document.querySelector('#profile-menu')
    const dropdown = document.querySelector('#profile-dropdown')

    // Toggle Dropdown
    profileMenu?.addEventListener('click', (e) => {
      e.stopPropagation()
      dropdown.classList.toggle('show')
    })

    // Close on outside click
    document.addEventListener('click', () => {
      dropdown?.classList.remove('show')
    })

    // Dropdown Actions
    document.querySelector('#action-logout')?.addEventListener('click', () => signOut(auth))

    document.querySelector('#action-change-password')?.addEventListener('click', () => {
      renderChangePasswordModal()
    })

    // Loan actions
    document.querySelectorAll('.reject-loan').forEach(btn => {
      btn.addEventListener('click', () => handleRejectLoan(btn.dataset.id))
    })

    // Dashboard only
    if (state.currentView === 'dashboard') {
      document.querySelector('#view-all-transactions')?.addEventListener('click', () => {
        state.currentView = 'transactions'
        render()
      })
    }

    // Analytics only
    if (state.currentView === 'analytics') {
      initCharts()
    }

    // Filter listeners
    document.querySelector('#user-search')?.addEventListener('input', (e) => {
      state.filters.users.query = e.target.value
      render()
    })

    document.querySelector('#filter-type')?.addEventListener('change', (e) => {
      state.filters.transactions.type = e.target.value
      render()
    })

    document.querySelector('#filter-date')?.addEventListener('input', (e) => {
      state.filters.transactions.date = e.target.value
      render()
    })

    document.querySelector('#filter-member')?.addEventListener('input', (e) => {
      state.filters.transactions.memberId = e.target.value
      render()
    })
  }
}

let volumeChart = null
let userChart = null
let typeChart = null

const initCharts = () => {
  // Volume Chart
  const volumeCtx = document.getElementById('volume-chart')
  if (volumeCtx) {
    if (volumeChart) volumeChart.destroy()

    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - i)
      return d.toLocaleDateString()
    }).reverse()

    const data = last7Days.map(day => {
      return state.transactions
        .filter(t => new Date(t.createdAt?.seconds * 1000).toLocaleDateString() === day)
        .reduce((sum, t) => sum + t.amount, 0)
    })

    volumeChart = new Chart(volumeCtx, {
      type: 'bar',
      data: {
        labels: last7Days,
        datasets: [{
          label: 'Volume (GHS)',
          data: data,
          backgroundColor: '#4361EE',
          borderRadius: 4,
          barPercentage: 0.5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: '#E9EDF7', drawBorder: false },
            ticks: { color: '#A3AED0', font: { weight: '600' } }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#A3AED0', font: { weight: '600' } }
          }
        }
      }
    })
  }

  // User Chart
  const userCtx = document.getElementById('user-chart')
  if (userCtx) {
    if (userChart) userChart.destroy()

    const admins = state.users.filter(u => u.isAdmin).length
    const members = state.users.length - admins

    userChart = new Chart(userCtx, {
      type: 'doughnut',
      data: {
        labels: ['Standard Members', 'Administrators'],
        datasets: [{
          data: [members, admins],
          backgroundColor: ['#4361EE', '#F72585'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    })
  }

  // Type Chart
  const typeCtx = document.getElementById('type-chart')
  if (typeCtx) {
    if (typeChart) typeChart.destroy()

    const types = {}
    state.transactions.forEach(t => {
      types[t.type] = (types[t.type] || 0) + 1
    })

    typeChart = new Chart(typeCtx, {
      type: 'bar',
      data: {
        labels: Object.keys(types).map(t => t.replace('_', ' ')),
        datasets: [{
          label: 'Count',
          data: Object.values(types),
          backgroundColor: '#05CD99',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#E9EDF7', drawBorder: false } },
          x: { grid: { display: false } }
        }
      }
    })
  }
}

// Change Password Modal
const renderChangePasswordModal = () => {
  const modal = document.createElement('div')
  modal.className = 'modal-overlay open'
  modal.innerHTML = `
  <div class="modal-card">
      <h2 style="margin-bottom: 1.5rem;">Change Password</h2>
      <form id="change-password-form">
        <div class="form-group">
          <label>Current Password</label>
          <input type="password" name="currentPassword" required placeholder="Verify it's you">
          
        </div>
        <div class="form-group">
           <label>New Password</label>
           <input type="password" name="newPassword" required minlength="6" placeholder="Min. 6 characters">
        </div>
        <div style="display: flex; gap: 1rem; margin-top: 2rem;">
          <button type="button" class="btn" style="background: var(--secondary); color: var(--text-secondary); flex: 1;" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          <button type="submit" class="btn btn-primary" style="flex: 1;">Update</button>
        </div>
      </form>
    </div>
  `
  document.body.appendChild(modal)

  modal.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const currentPass = e.target.currentPassword.value
    const newPass = e.target.newPassword.value
    const btn = e.target.querySelector('button[type="submit"]')
    const originalText = btn.textContent

    try {
      btn.textContent = 'Verifying...'
      btn.disabled = true

      // 1. Re-authenticate
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPass)
      await reauthenticateWithCredential(auth.currentUser, credential)

      // 2. Update Password
      btn.textContent = 'Updating...'
      await updatePassword(auth.currentUser, newPass)

      alert('Password updated successfully!')
      modal.remove()

    } catch (error) {
      console.error(error)
      if (error.code === 'auth/wrong-password') {
        alert('Incorrect current password.')
      } else {
        alert('Error: ' + error.message)
      }
      btn.textContent = originalText
      btn.disabled = false
    }
  })
}

// Start
initTheme()
initAuth()
render()

