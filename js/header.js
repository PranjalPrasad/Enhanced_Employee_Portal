// Header specific functionality
class HeaderManager {
  constructor() {
    this.notifications = [];
    this.unreadCount = 0;
  }

  init() {
    this.setupNotifications();
    this.setupDateTime();
    this.setupProfileDropdown();
  }

  setupProfileDropdown() {
    const profileBtn = document.getElementById("profileDropdownBtn");
    const profileDropdown = document.getElementById("profileDropdown");

    if (profileBtn && profileDropdown) {
      profileBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle("active");
      });

      document.addEventListener("click", () => {
        profileDropdown.classList.remove("active");
      });
    }
  }

  setupNotifications() {
    const notificationBtn = document.getElementById("notificationBtn");

    if (notificationBtn) {
      notificationBtn.addEventListener("click", () => {
        this.showNotificationPanel();
      });
    }

    // Simulate fetching notifications
    this.fetchNotifications();
  }

  async fetchNotifications() {
    // Simulate API call
    this.notifications = [
      {
        id: 1,
        title: "New message",
        message: "You have a new message from HR",
        read: false,
      },
      {
        id: 2,
        title: "Meeting reminder",
        message: "Team meeting at 2:00 PM",
        read: false,
      },
      {
        id: 3,
        title: "Task assigned",
        message: "New task has been assigned to you",
        read: true,
      },
    ];

    this.unreadCount = this.notifications.filter((n) => !n.read).length;
    this.updateNotificationBadge();
  }

  updateNotificationBadge() {
    const badge = document.querySelector(".notification-badge");
    if (badge) {
      badge.textContent = this.unreadCount;
      badge.style.display = this.unreadCount > 0 ? "flex" : "none";
    }
  }

  showNotificationPanel() {
    // Remove existing panel
    const existingPanel = document.querySelector(".notification-panel");
    if (existingPanel) existingPanel.remove();

    // Create and show notification panel
    const panel = document.createElement("div");
    panel.className = "notification-panel";
    panel.innerHTML = `
            <div class="notification-header">
                <h3>Notifications</h3>
                <button class="mark-all-read">Mark all as read</button>
            </div>
            <div class="notification-list">
                ${this.notifications
                  .map(
                    (n) => `
                    <div class="notification-item ${!n.read ? "unread" : ""}">
                        <div class="notification-title">${n.title}</div>
                        <div class="notification-message">${n.message}</div>
                    </div>
                `,
                  )
                  .join("")}
            </div>
        `;

    // Position and show panel
    const notificationBtn = document.getElementById("notificationBtn");
    if (notificationBtn) {
      const rect = notificationBtn.getBoundingClientRect();
      panel.style.position = "absolute";
      panel.style.top = `${rect.bottom + 10}px`;
      panel.style.right = `${window.innerWidth - rect.right}px`;
    }
    document.body.appendChild(panel);

    // Handle mark as read
    panel.querySelector(".mark-all-read")?.addEventListener("click", () => {
      this.markAllNotificationsRead();
      panel.remove();
    });

    // Close on outside click
    setTimeout(() => {
      document.addEventListener("click", function closePanel(e) {
        if (!panel.contains(e.target) && e.target !== notificationBtn) {
          panel.remove();
          document.removeEventListener("click", closePanel);
        }
      });
    }, 0);
  }

  markAllNotificationsRead() {
    this.notifications.forEach((n) => (n.read = true));
    this.unreadCount = 0;
    this.updateNotificationBadge();
  }

  setupDateTime() {
    // Add current date/time display if needed
    const dateTimeElement = document.createElement("div");
    dateTimeElement.className = "current-datetime";

    const headerRight = document.querySelector(".header-right");
    if (headerRight) {
      headerRight.insertBefore(dateTimeElement, headerRight.firstChild);
    }

    const updateDateTime = () => {
      const now = new Date();
      const options = {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      };
      dateTimeElement.textContent = now.toLocaleDateString("en-US", options);
    };

    updateDateTime();
    setInterval(updateDateTime, 60000);
  }
}

// Initialize header when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.headerManager = new HeaderManager();
    window.headerManager.init();
  });
} else {
  window.headerManager = new HeaderManager();
  window.headerManager.init();
}
