// Common JavaScript for Dashboard
class DashboardManager {
    constructor() {
        this.sidebarState = localStorage.getItem('sidebarCollapsed') === 'true';
        this.currentPage = this.getCurrentPage();
        this.userData = null;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        
        try {
            await this.loadComponents();
            this.setupEventListeners();
            this.highlightActiveNav();
            this.loadUserData();
            this.initialized = true;
            
            // Dispatch event when dashboard is ready
            window.dispatchEvent(new CustomEvent('dashboard-ready'));
        } catch (error) {
            console.error('Failed to initialize dashboard:', error);
            this.showError('Failed to load dashboard components');
        }
    }

    async loadComponents() {
        // Load Sidebar
        const sidebarResponse = await fetch('../components/sidebar.html');
        const sidebarHtml = await sidebarResponse.text();
        
        // Load Header
        const headerResponse = await fetch('../components/header.html');
        const headerHtml = await headerResponse.text();
        
        // Insert components
        const container = document.querySelector('.dashboard-container');
        if (container) {
            container.innerHTML = sidebarHtml + headerHtml + container.innerHTML;
        }
        
        // Apply sidebar state
        if (this.sidebarState) {
            document.getElementById('sidebar')?.classList.add('collapsed');
            document.querySelector('.main-content')?.classList.add('sidebar-collapsed');
        }
        
        // Set page title
        this.setPageTitle();
    }

    setupEventListeners() {
        // Sidebar collapse
        const collapseBtn = document.getElementById('collapseSidebarBtn');
        collapseBtn?.addEventListener('click', () => this.toggleSidebar());
        
        // Mobile toggle
        const mobileToggle = document.getElementById('mobileToggleBtn');
        mobileToggle?.addEventListener('click', () => this.toggleMobileSidebar());
        
        // Profile dropdown
        const profileBtn = document.getElementById('profileDropdownBtn');
        const dropdown = document.getElementById('profileDropdown');
        
        profileBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown?.classList.toggle('active');
        });
        
        // Close dropdown on outside click
        document.addEventListener('click', () => {
            dropdown?.classList.remove('active');
        });
        
        // Logout buttons
        document.querySelectorAll('.logout-btn, .logout-item').forEach(btn => {
            btn.addEventListener('click', () => this.logout());
        });
        
        // Global search
        const searchInput = document.getElementById('globalSearch');
        searchInput?.addEventListener('input', this.debounce((e) => {
            this.handleSearch(e.target.value);
        }, 300));
        
        // Handle responsive
        window.addEventListener('resize', () => this.handleResize());
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.querySelector('.main-content');
        
        sidebar?.classList.toggle('collapsed');
        mainContent?.classList.toggle('sidebar-collapsed');
        
        this.sidebarState = sidebar?.classList.contains('collapsed');
        localStorage.setItem('sidebarCollapsed', this.sidebarState);
    }

    toggleMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar?.classList.toggle('mobile-open');
    }

    highlightActiveNav() {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            const page = link.dataset.page;
            if (page === this.currentPage) {
                link.classList.add('active');
            }
        });
    }

    getCurrentPage() {
        const path = window.location.pathname;
        const page = path.split('/').pop().replace('.html', '');
        return page || 'dashboard';
    }

    setPageTitle() {
        const pageTitle = document.getElementById('pageTitle');
        if (pageTitle) {
            const titles = {
                'dashboard': 'Dashboard',
                'profile': 'My Profile',
                'attendance': 'Attendance',
                'settings': 'Settings'
            };
            pageTitle.textContent = titles[this.currentPage] || 'Dashboard';
        }
    }

    async loadUserData() {
        // Simulate API call
        try {
            // In real app, fetch from API
            const userData = {
                name: localStorage.getItem('userName') || 'John Doe',
                role: localStorage.getItem('userRole') || 'Employee',
                avatar: localStorage.getItem('userAvatar') || '../assets/icons/avatar-placeholder.svg'
            };
            
            this.userData = userData;
            this.updateUserInterface(userData);
        } catch (error) {
            console.error('Failed to load user data:', error);
        }
    }

    updateUserInterface(userData) {
        const userName = document.getElementById('userName');
        const userRole = document.getElementById('userRole');
        const userAvatar = document.getElementById('userAvatar');
        
        if (userName) userName.textContent = userData.name;
        if (userRole) userRole.textContent = userData.role;
        if (userAvatar && userData.avatar) userAvatar.src = userData.avatar;
    }

    handleSearch(query) {
        // Implement search functionality
        console.log('Searching for:', query);
        // Dispatch custom event for pages to handle
        window.dispatchEvent(new CustomEvent('dashboard-search', { detail: { query } }));
    }

    logout() {
        if (confirm('Are you sure you want to logout?')) {
            // Clear user data
            localStorage.removeItem('userName');
            localStorage.removeItem('userRole');
            localStorage.removeItem('userAvatar');
            
            // Redirect to login
            window.location.href = '../index.html';
        }
    }

    handleResize() {
        const sidebar = document.getElementById('sidebar');
        if (window.innerWidth > 768) {
            sidebar?.classList.remove('mobile-open');
        }
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => errorDiv.remove(), 5000);
    }

    showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        document.body.appendChild(successDiv);
        
        setTimeout(() => successDiv.remove(), 5000);
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardManager = new DashboardManager();
    window.dashboardManager.init();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DashboardManager;
}