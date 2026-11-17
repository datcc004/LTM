/* ============================================================
   KIDS PARK HRMS - Shared client behaviour (Alpine + Lucide + Chart)
   ============================================================ */
(function () {
  'use strict';

  const STORAGE_SIDEBAR = 'hrms.sidebar.collapsed';

  function getLayout() {
    const root = document.querySelector('.app-root');
    if (!root || !window.Alpine) return null;
    try {
      return window.Alpine.$data(root);
    } catch {
      return null;
    }
  }

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function isTypingTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable === true;
  }

  /* ---------- Alpine component: root layout ---------- */
  function appLayout() {
    return {
      sidebarCollapsed: false,
      mobileNavOpen: false,
      searchOpen: false,
      searchQuery: '',
      searchResults: [],
      searchLoading: false,
      searchIndex: -1,
      searchRequest: 0,

      init() {
        this.sidebarCollapsed = localStorage.getItem(STORAGE_SIDEBAR) === '1';

        this.$watch('searchOpen', (open) => {
          document.body.classList.toggle('overlay-open', open);
          if (open) {
            this.$nextTick(() => {
              if (this.$refs.searchInput) this.$refs.searchInput.focus();
            });
          }
        });

        this.$watch('$store.confirm.open', (open) => {
          document.body.classList.toggle('overlay-open', open);
          if (open) {
            this.$nextTick(() => {
              const cancel = this.$refs.confirmCancel;
              if (cancel) cancel.focus();
            });
          }
        });

        window.addEventListener('resize', () => {
          if (window.innerWidth >= 992 && this.mobileNavOpen) this.mobileNavOpen = false;
        });
      },

      closeOverlays() {
        if (this.searchOpen) this.closeSearch();
        if (this.mobileNavOpen) this.mobileNavOpen = false;
        const userPanels = document.querySelectorAll('.header-dropdown [x-show]');
        userPanels.forEach((panel) => {
          const model = panel.getAttribute('x-show');
          if (model === 'userOpen' || model === 'passwordOpen' || model === 'notifOpen') {
            const scope = window.Alpine ? window.Alpine.$data(panel.parentElement) : null;
            if (scope) {
              if (model === 'userOpen') scope.userOpen = false;
              if (model === 'passwordOpen') scope.passwordOpen = false;
              if (model === 'notifOpen') scope.notifOpen = false;
            }
          }
        });
      },

      toggleSidebar() {
        this.sidebarCollapsed = !this.sidebarCollapsed;
        localStorage.setItem(STORAGE_SIDEBAR, this.sidebarCollapsed ? '1' : '0');
        this.$nextTick(refreshIcons);
      },

      toggleMobileNav() {
        this.mobileNavOpen = !this.mobileNavOpen;
      },

      openSearch() {
        this.searchQuery = '';
        this.searchResults = [];
        this.searchIndex = -1;
        this.searchOpen = true;
        this.$nextTick(() => {
          if (this.$refs.searchInput) {
            this.$refs.searchInput.value = '';
            this.$refs.searchInput.focus();
          }
        });
      },

      closeSearch() {
        this.searchOpen = false;
        this.searchLoading = false;
        this.searchRequest += 1;
      },

      async runSearch(value) {
        const query = String(value || '').trim();
        this.searchQuery = query;
        this.searchIndex = -1;
        if (query.length < 2) {
          this.searchResults = [];
          this.searchLoading = false;
          return;
        }
        const requestId = ++this.searchRequest;
        this.searchLoading = true;
        try {
          const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          });
          if (!response.ok) throw new Error('search failed');
          const payload = await response.json();
          if (requestId !== this.searchRequest) return;
          this.searchResults = Array.isArray(payload.data) ? payload.data.slice(0, 8) : [];
        } catch {
          if (requestId === this.searchRequest) this.searchResults = [];
        } finally {
          if (requestId === this.searchRequest) this.searchLoading = false;
        }
      },

      moveSearchSelection(delta) {
        if (!this.searchResults.length) return;
        this.searchIndex = (this.searchIndex + delta + this.searchResults.length) % this.searchResults.length;
        this.$nextTick(() => {
          const items = this.$refs.searchDialog ? this.$refs.searchDialog.querySelectorAll('.search-result-item') : [];
          if (items[this.searchIndex]) items[this.searchIndex].scrollIntoView({ block: 'nearest' });
        });
      },

      openSearchSelection() {
        if (!this.searchResults.length) return;
        const target = this.searchResults[this.searchIndex < 0 ? 0 : this.searchIndex];
        if (target && target.url) window.location.href = target.url;
      },

      acceptConfirm() {
        window.Alpine.store('confirm').accept();
      },

      cancelConfirm() {
        window.Alpine.store('confirm').cancel();
      },

      trapConfirmTab(event) {
        const store = window.Alpine.store('confirm');
        if (!store.open) return;
        const first = this.$refs.confirmCancel;
        const last = this.$refs.confirmAccept;
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      },
    };
  }

  /* ---------- Public API ---------- */
  window.HRMS = {
    refreshIcons,
    toast(message, type = 'info', options = {}) {
      const store = window.Alpine && window.Alpine.store('toasts');
      if (!store) return;
      return store.add(message, type, options.timeout);
    },
    success(message, options) { return this.toast(message, 'success', options); },
    error(message, options) { return this.toast(message, 'error', options); },
    warning(message, options) { return this.toast(message, 'warning', options); },
    info(message, options) { return this.toast(message, 'info', options); },
    confirm(options = {}) {
      const store = window.Alpine && window.Alpine.store('confirm');
      if (!store) return Promise.resolve(false);
      return store.show(options);
    },
    getLayout,
  };

  /* ---------- Alpine bootstrap ---------- */
  document.addEventListener('alpine:init', () => {
    window.Alpine.data('appLayout', appLayout);

    window.Alpine.store('toasts', {
      items: [],
      seq: 0,
      add(message, type = 'info', timeout = 4200) {
        const id = ++this.seq;
        const item = { id, message: String(message), type, timeout };
        this.items.push(item);
        const store = this;
        if (timeout > 0) {
          setTimeout(() => store.remove(id), timeout);
        }
        return id;
      },
      remove(id) {
        this.items = this.items.filter((item) => item.id !== id);
      },
      clear() { this.items = []; },
    });

    window.Alpine.store('confirm', {
      open: false,
      title: 'Xác nhận thao tác',
      message: 'Bạn có chắc chắn muốn tiếp tục?',
      confirmText: 'Xác nhận',
      cancelText: 'Hủy',
      danger: false,
      resolver: null,
      show(options = {}) {
        this.title = options.title || 'Xác nhận thao tác';
        this.message = options.message || 'Bạn có chắc chắn muốn tiếp tục?';
        this.confirmText = options.confirmText || (options.danger ? 'Xóa' : 'Xác nhận');
        this.cancelText = options.cancelText || 'Hủy';
        this.danger = Boolean(options.danger);
        this.open = true;
        const self = this;
        return new Promise((resolve) => { self.resolver = resolve; });
      },
      accept() {
        this.open = false;
        if (this.resolver) { this.resolver(true); this.resolver = null; }
      },
      cancel() {
        this.open = false;
        if (this.resolver) { this.resolver(false); this.resolver = null; }
      },
    });
  });

  /* ---------- Global keyboard shortcuts ---------- */
  document.addEventListener('keydown', (event) => {
    const layout = getLayout();
    if (!layout) return;

    // Escape when confirm is open is handled by the modal itself.
    if ((event.key === '/' && !isTypingTarget(event.target)) ||
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')) {
      event.preventDefault();
      layout.openSearch();
      return;
    }

    if (layout.searchOpen) {
      if (event.key === 'ArrowDown') { event.preventDefault(); layout.moveSearchSelection(1); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); layout.moveSearchSelection(-1); }
      else if (event.key === 'Enter') { event.preventDefault(); layout.openSearchSelection(); }
    }
  });

  /* ---------- Flash messages -> toast ---------- */
  function promoteFlashToasts() {
    document.querySelectorAll('.flash-source').forEach((node) => {
      const type = node.getAttribute('data-toast') || 'info';
      const message = node.getAttribute('data-toast-message') || '';
      if (message) window.HRMS.toast(message, type);
      node.remove();
    });
  }

  /* ---------- data-confirm handlers ---------- */
  function bindConfirmHandlers() {
    document.addEventListener('click', async (event) => {
      const trigger = event.target.closest('[data-confirm]');
      if (!trigger) return;
      event.preventDefault();
      const message = trigger.getAttribute('data-confirm') || 'Bạn có chắc chắn muốn tiếp tục?';
      const title = trigger.getAttribute('data-confirm-title') || 'Xác nhận thao tác';
      const danger = trigger.hasAttribute('data-confirm-danger');
      const accepted = await window.HRMS.confirm({
        title,
        message,
        danger,
        confirmText: trigger.getAttribute('data-confirm-ok') || (danger ? 'Xóa' : 'Xác nhận'),
      });
      if (!accepted) return;

      const form = trigger.closest('form');
      if (form) { form.submit(); return; }
      const href = trigger.getAttribute('href');
      if (href && href !== '#') { window.location.href = href; }
    });
  }

  /* ---------- Avatar preview ---------- */
  function bindAvatarPreview() {
    document.querySelectorAll('[data-avatar-input]').forEach((input) => {
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        const target = document.querySelector(input.getAttribute('data-avatar-target') || '[data-avatar-preview]');
        if (!file || !target) return;
        if (target.dataset.objectUrl) URL.revokeObjectURL(target.dataset.objectUrl);
        const url = URL.createObjectURL(file);
        target.dataset.objectUrl = url;
        target.src = url;
      });
    });
  }

  /* ---------- Chart.js shared defaults ---------- */
  function configureCharts() {
    if (!window.Chart) return;
    window.Chart.defaults.font.family = "'Be Vietnam Pro', 'Inter', sans-serif";
    window.Chart.defaults.font.size = 12;
    window.Chart.defaults.color = '#475569';
    window.Chart.defaults.plugins.legend.labels.usePointStyle = true;
    window.Chart.defaults.plugins.legend.labels.boxWidth = 8;
    window.Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15,23,42,.9)';
    window.Chart.defaults.plugins.tooltip.padding = 10;
    window.Chart.defaults.plugins.tooltip.cornerRadius = 6;
    window.Chart.defaults.maintainAspectRatio = false;
  }

  /* ---------- Lucide: initial render + observe dynamic nodes ---------- */
  function observeIcons() {
    refreshIcons();
    const observer = new MutationObserver((mutations) => {
      let needsRefresh = false;
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (node.matches && node.matches('[data-lucide]')) needsRefresh = true;
          if (node.querySelector && node.querySelector('[data-lucide]')) needsRefresh = true;
        });
      }
      if (needsRefresh) refreshIcons();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ---------- Boot ---------- */
  function boot() {
    configureCharts();
    observeIcons();
    promoteFlashToasts();
    bindConfirmHandlers();
    bindAvatarPreview();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
