
        // Mock Data with Indian Rupees
        let expenses = [
            { id: '1', title: 'Flight to NY', amount: 450, category: 'Travel', date: '2025-03-10', description: 'Business trip', status: 'Approved', receipt: null, comments: 'Approved by manager' },
            { id: '2', title: 'Team Lunch', amount: 85.5, category: 'Food', date: '2025-03-15', description: 'Celebration', status: 'Pending', receipt: null, comments: '' },
            { id: '3', title: 'Office Chair', amount: 210, category: 'Office', date: '2025-03-05', description: 'Ergonomic', status: 'Rejected', receipt: null, comments: 'Missing invoice' },
            { id: '4', title: 'Taxi Ride', amount: 32, category: 'Travel', date: '2025-03-20', description: 'Airport transfer', status: 'Pending', receipt: null, comments: '' },
            { id: '5', title: 'Coffee Meeting', amount: 12.3, category: 'Food', date: '2025-02-22', description: 'Client', status: 'Approved', receipt: null, comments: '' }
        ];

        let currentPage = 1, rowsPerPage = 5;
        let filters = { search: '', category: '', status: '', fromDate: '', toDate: '' };
        let chartInstance = null;

        function formatIndianCurrency(amount) {
            return '₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }

        function showToast(msg, type = 'success') {
            Toastify({
                text: msg,
                duration: 3000,
                gravity: "bottom",
                position: "right",
                className: "toast-custom",
                style: {
                    background: type === 'error' ? 'linear-gradient(135deg, #e56c6c, #c0392b)' : 'linear-gradient(135deg, #1f6f7f, #145c6b)',
                }
            }).showToast();
        }

        // ========== LOGOUT FUNCTION ==========
        function handleLogout() {
            showToast('Logging out... Redirecting to login page', 'success');
            setTimeout(() => {
                window.location.href = '';
            }, 500);
        }

        function getFilteredExpenses() {
            let filtered = [...expenses];
            if (filters.search) filtered = filtered.filter(e => e.title.toLowerCase().includes(filters.search.toLowerCase()));
            if (filters.category) filtered = filtered.filter(e => e.category === filters.category);
            if (filters.status) filtered = filtered.filter(e => e.status === filters.status);
            if (filters.fromDate) filtered = filtered.filter(e => e.date >= filters.fromDate);
            if (filters.toDate) filtered = filtered.filter(e => e.date <= filters.toDate);
            return filtered;
        }

        function updateStats() {
            const now = new Date();
            const currentMonth = now.getMonth(), currentYear = now.getFullYear();
            let monthlyTotal = 0, pendingTotal = 0, approvedTotal = 0, rejectedTotal = 0;
            expenses.forEach(exp => {
                const d = new Date(exp.date);
                if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) monthlyTotal += exp.amount;
                if (exp.status === 'Pending') pendingTotal += exp.amount;
                else if (exp.status === 'Approved') approvedTotal += exp.amount;
                else if (exp.status === 'Rejected') rejectedTotal += exp.amount;
            });
            document.getElementById('totalMonthly').innerText = formatIndianCurrency(monthlyTotal);
            document.getElementById('pendingAmount').innerText = formatIndianCurrency(pendingTotal);
            document.getElementById('approvedAmount').innerText = formatIndianCurrency(approvedTotal);
            document.getElementById('rejectedAmount').innerText = formatIndianCurrency(rejectedTotal);
            
        }

        function renderTable() {
            const filtered = getFilteredExpenses();
            const totalPages = Math.ceil(filtered.length / rowsPerPage) || 1;
            if (currentPage > totalPages) currentPage = totalPages;
            const start = (currentPage - 1) * rowsPerPage;
            const paginated = filtered.slice(start, start + rowsPerPage);
            const tbody = document.getElementById('tableBody');
            tbody.innerHTML = paginated.map(exp => `
            <tr>
                <td>${exp.date}</td>
                <td>${exp.title}</td>
                <td>${exp.category}</td>
                <td>${formatIndianCurrency(exp.amount)}</td>
                <td><span class="status-badge status-${exp.status.toLowerCase()}">${exp.status}</span></td>
                <td class="action-icons">
                    <i class="fas fa-eye" data-id="${exp.id}" title="View"></i>
                    ${exp.status === 'Pending' ? `<i class="fas fa-edit" data-id="${exp.id}" title="Edit"></i>` : ''}
                    <i class="fas fa-trash-alt" data-id="${exp.id}" title="Delete"></i>
                </td>
            </tr>
        `).join('');
            document.getElementById('pagination').innerHTML = `
            <button ${currentPage === 1 ? 'disabled' : ''} id="prevPageBtn">Prev</button>
            <span>Page ${currentPage} of ${totalPages}</span>
            <button ${currentPage === totalPages ? 'disabled' : ''} id="nextPageBtn">Next</button>
        `;
            document.getElementById('prevPageBtn')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderTable(); } });
            document.getElementById('nextPageBtn')?.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; renderTable(); } });
            attachActions();
            updateStats();
            updateChart();
        }

        function attachActions() {
            document.querySelectorAll('.fa-eye').forEach(el => el.addEventListener('click', (e) => showDetail(el.dataset.id)));
            document.querySelectorAll('.fa-edit').forEach(el => el.addEventListener('click', (e) => openEditForm(el.dataset.id)));
            document.querySelectorAll('.fa-trash-alt').forEach(el => el.addEventListener('click', (e) => { if (confirm('Delete this expense?')) { expenses = expenses.filter(e => e.id !== el.dataset.id); renderTable(); showToast('Deleted successfully'); } }));
        }

        function showDetail(id) {
            const exp = expenses.find(e => e.id === id);
            if (!exp) return;
            document.getElementById('detailContent').innerHTML = `
            <div class="detail-item"><span class="detail-label">Title</span><span class="detail-value">${exp.title}</span></div>
            <div class="detail-item"><span class="detail-label">Amount</span><span class="detail-value amount">${formatIndianCurrency(exp.amount)}</span></div>
            <div class="detail-item"><span class="detail-label">Category</span><span class="detail-value">${exp.category}</span></div>
            <div class="detail-item"><span class="detail-label">Date</span><span class="detail-value">${exp.date}</span></div>
            <div class="detail-item"><span class="detail-label">Description</span><span class="detail-value">${exp.description || '—'}</span></div>
            ${exp.receipt ? `<div class="receipt-container"><div class="detail-label" style="margin-bottom:8px;">Receipt</div><img src="${exp.receipt}" alt="Receipt"></div>` : '<div class="receipt-container"><span class="detail-label">No receipt uploaded</span></div>'}
            <div class="status-timeline">
                <h4><i class="fas fa-clock"></i> Status Timeline</h4>
                <div class="timeline-step"><div class="timeline-dot completed"></div><span class="timeline-text">Submitted on ${exp.date}</span></div>
                <div class="timeline-step"><div class="timeline-dot ${exp.status === 'Approved' ? 'completed' : (exp.status === 'Pending' ? 'active' : '')}"></div><span class="timeline-text">${exp.status}</span></div>
                ${exp.comments ? `<div class="timeline-step"><div class="timeline-dot"></div><span class="timeline-text">Manager: ${exp.comments}</span></div>` : ''}
            </div>
        `;
            document.getElementById('detailModal').classList.add('active');
        }

        function openEditForm(id) {
            const exp = expenses.find(e => e.id === id);
            if (!exp || exp.status !== 'Pending') { showToast('Only pending expenses can be edited', 'error'); return; }
            document.getElementById('expenseId').value = exp.id;
            document.getElementById('title').value = exp.title;
            document.getElementById('amount').value = exp.amount;
            document.getElementById('category').value = exp.category;
            document.getElementById('expenseDate').value = exp.date;
            document.getElementById('description').value = exp.description;
            document.getElementById('modalTitle').innerText = 'Edit Expense';
            document.getElementById('receiptPreview').innerHTML = exp.receipt ? `<img src="${exp.receipt}" width="60">` : '';
            document.getElementById('expenseModal').classList.add('active');
        }

        function saveExpense(isDraft = false) {
            const id = document.getElementById('expenseId').value;
            const title = document.getElementById('title').value.trim();
            const amount = parseFloat(document.getElementById('amount').value);
            const category = document.getElementById('category').value;
            const date = document.getElementById('expenseDate').value;
            const description = document.getElementById('description').value;
            const file = document.getElementById('receiptFile').files[0];
            if (!title || isNaN(amount) || !date) { showToast('Please fill required fields', 'error'); return; }
            const save = (receiptData) => {
                const newExp = { id: id || Date.now().toString(), title, amount, category, date, description, status: 'Pending', receipt: receiptData || null, comments: '' };
                if (id) {
                    const idx = expenses.findIndex(e => e.id === id);
                    if (idx !== -1 && expenses[idx].status === 'Pending') expenses[idx] = { ...expenses[idx], ...newExp };
                    else { showToast('Cannot edit', 'error'); closeModal(); renderTable(); return; }
                } else expenses.unshift(newExp);
                showToast(isDraft ? 'Draft saved successfully' : 'Expense submitted successfully');
                closeModal();
                renderTable();
            };
            if (file) {
                const reader = new FileReader();
                reader.onload = e => save(e.target.result);
                reader.readAsDataURL(file);
            } else save(null);
        }

        function closeModal() {
            document.getElementById('expenseModal').classList.remove('active');
            document.getElementById('detailModal').classList.remove('active');
            document.getElementById('expenseForm').reset();
            document.getElementById('receiptPreview').innerHTML = '';
            document.getElementById('expenseId').value = '';
        }

        function updateChart() {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
            const monthlyData = [0, 0, 0, 0, 0, 0];
            expenses.forEach(exp => {
                if (exp.status === 'Approved') {
                    const d = new Date(exp.date);
                    const monthIdx = d.getMonth();
                    if (monthIdx >= 0 && monthIdx < 6) monthlyData[monthIdx] += exp.amount;
                }
            });
            if (chartInstance) chartInstance.destroy();
            const ctx = document.getElementById('expenseChart').getContext('2d');
            chartInstance = new Chart(ctx, { type: 'line', data: { labels: months, datasets: [{ label: 'Approved Expenses (₹)', data: monthlyData, borderColor: '#1f6f7f', backgroundColor: 'rgba(31,111,127,0.1)', fill: true, tension: 0.3 }] }, options: { responsive: true, maintainAspectRatio: true } });
        }

        function exportCSV() {
            const filtered = getFilteredExpenses();
            let csv = [['Date', 'Title', 'Category', 'Amount (₹)', 'Status', 'Description']];
            filtered.forEach(e => csv.push([e.date, e.title, e.category, e.amount, e.status, e.description || '']));
            const blob = new Blob([csv.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'expenses.csv'; a.click(); showToast('Exported successfully');
        }

        // Event Listeners
        document.getElementById('addExpenseBtn').onclick = () => { document.getElementById('modalTitle').innerText = 'Add New Expense'; document.getElementById('expenseForm').reset(); document.getElementById('expenseId').value = ''; document.getElementById('receiptPreview').innerHTML = ''; document.getElementById('expenseModal').classList.add('active'); };
        document.getElementById('closeModalBtn').onclick = closeModal;
        document.getElementById('cancelModalBtn').onclick = closeModal;
        document.getElementById('closeDetailBtn').onclick = closeModal;
        document.getElementById('submitExpenseBtn').onclick = (e) => { e.preventDefault(); saveExpense(false); };
        document.getElementById('draftBtn').onclick = (e) => { e.preventDefault(); saveExpense(true); };
        document.getElementById('exportBtn').onclick = exportCSV;
        document.getElementById('searchInput').addEventListener('input', (e) => { filters.search = e.target.value; currentPage = 1; renderTable(); });
        document.getElementById('filterCategory').addEventListener('change', (e) => { filters.category = e.target.value; currentPage = 1; renderTable(); });
        document.getElementById('filterStatus').addEventListener('change', (e) => { filters.status = e.target.value; currentPage = 1; renderTable(); });
        document.getElementById('filterFrom').addEventListener('change', (e) => { filters.fromDate = e.target.value; currentPage = 1; renderTable(); });
        document.getElementById('filterTo').addEventListener('change', (e) => { filters.toDate = e.target.value; currentPage = 1; renderTable(); });
        document.getElementById('collapseSidebarBtn').addEventListener('click', () => { document.getElementById('sidebar').classList.toggle('collapsed'); document.getElementById('mainContent').classList.toggle('sidebar-collapsed'); });
        document.getElementById('mobileToggleBtn').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('mobile-open'));
        document.getElementById('profileDropdownBtn').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('profileDropdown').classList.toggle('active'); });
        document.addEventListener('click', () => document.getElementById('profileDropdown')?.classList.remove('active'));
        window.onclick = (e) => { if (e.target.classList.contains('modal')) closeModal(); };

        // ========== LOGOUT BUTTON LISTENERS ==========
        // Sidebar logout button
        const sidebarLogoutBtn = document.getElementById('logoutBtn');
        if (sidebarLogoutBtn) {
            sidebarLogoutBtn.addEventListener('click', handleLogout);
        }

        // Header dropdown logout button
        const dropdownLogoutBtn = document.querySelector('#profileDropdown .logout-item');
        if (dropdownLogoutBtn) {
            dropdownLogoutBtn.addEventListener('click', handleLogout);
        }

        renderTable();