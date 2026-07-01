// Sidebar specific functionality

class SidebarManager {
    constructor() {
        this.sidebar = null;
        this.navItems = [];
        this.collapseBtn = null;
        this.mainContent = null;
        this.isInitialized = false;
    }

    init() {
        // Prevent duplicate initialization
        if (this.isInitialized) return;
        
        // Get DOM elements
        this.sidebar = document.getElementById('sidebar');
        this.navItems = document.querySelectorAll('.nav-link');
        this.collapseBtn = document.getElementById('collapseSidebarBtn');
        this.mainContent = document.querySelector('.main-content');
        
        // Check if elements exist
        if (!this.sidebar) {
            console.error('Sidebar element not found');
            return;
        }
        
        if (!this.collapseBtn) {
            console.error('Collapse button not found');
            return;
        }
        
        // Setup all functionality
        this.setupCollapse();
        this.setupNavigation();
        this.setActivePage();
        this.setupKeyboardNavigation();
        this.restoreSidebarState();
        
        this.isInitialized = true;
        console.log('Sidebar initialized successfully');
    }
    
    // ================= COLLAPSE SIDEBAR =================
    
    setupCollapse() {
        // Remove existing listener to prevent duplicates
        this.collapseBtn.removeEventListener('click', this.handleCollapse.bind(this));
        // Add new listener
        this.collapseBtn.addEventListener('click', this.handleCollapse.bind(this));
    }
    
    handleCollapse(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Toggle collapsed class on sidebar
        this.sidebar.classList.toggle('collapsed');
        
        // Toggle sidebar-collapsed class on main content
        if (this.mainContent) {
            this.mainContent.classList.toggle('sidebar-collapsed');
        }
        
        // Save state to localStorage
        const isCollapsed = this.sidebar.classList.contains('collapsed');
        localStorage.setItem('sidebarCollapsed', isCollapsed);
        
        // Update chevron icon
        this.updateChevronIcon(isCollapsed);
        
        // Dispatch custom event for other components
        window.dispatchEvent(new CustomEvent('sidebar-toggle', { 
            detail: { collapsed: isCollapsed } 
        }));
    }
    
    updateChevronIcon(isCollapsed) {
        if (!this.collapseBtn) return;
        
        const icon = this.collapseBtn.querySelector('i');
        if (icon) {
            // Remove existing classes
            icon.classList.remove('fa-chevron-left', 'fa-chevron-right');
            // Add appropriate class
            icon.classList.add(isCollapsed ? 'fa-chevron-right' : 'fa-chevron-left');
        }
    }
    
    // ================= RESTORE SIDEBAR STATE =================
    
    restoreSidebarState() {
        const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        
        if (isCollapsed) {
            this.sidebar.classList.add('collapsed');
            if (this.mainContent) {
                this.mainContent.classList.add('sidebar-collapsed');
            }
            this.updateChevronIcon(true);
        } else {
            this.sidebar.classList.remove('collapsed');
            if (this.mainContent) {
                this.mainContent.classList.remove('sidebar-collapsed');
            }
            this.updateChevronIcon(false);
        }
    }
    
    // ================= ACTIVE PAGE =================
    
    setActivePage() {
        const currentPath = window.location.pathname;
        const currentPage = currentPath.split('/').pop() || 'dashboard.html';
        
        this.navItems.forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.includes(currentPage)) {
                link.classList.add('active');
            } else if (currentPage === 'dashboard.html' && (!href || href === '#')) {
                // For dashboard active state
                const isDashboard = link.getAttribute('data-page') === 'dashboard';
                if (isDashboard) link.classList.add('active');
            }
        });
    }
    
    // ================= NAVIGATION =================
    
    setupNavigation() {
        this.navItems.forEach(item => {
            item.removeEventListener('click', this.handleNavClick.bind(this));
            item.addEventListener('click', this.handleNavClick.bind(this));
        });
    }
    
    handleNavClick(event) {
        // Remove active class from all items
        this.navItems.forEach(nav => nav.classList.remove('active'));
        // Add active class to clicked item
        event.currentTarget.classList.add('active');
    }
    
    // ================= KEYBOARD SHORTCUT =================
    
    setupKeyboardNavigation() {
        document.removeEventListener('keydown', this.handleKeydown.bind(this));
        document.addEventListener('keydown', this.handleKeydown.bind(this));
    }
    
    handleKeydown(event) {
        // Alt + S to toggle sidebar
        if (event.altKey && event.key === 's') {
            event.preventDefault();
            this.handleCollapse(event);
        }
    }
}

// Initialize sidebar when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.sidebarManager = new SidebarManager();
        window.sidebarManager.init();
    });
} else {
    window.sidebarManager = new SidebarManager();
    window.sidebarManager.init();
}