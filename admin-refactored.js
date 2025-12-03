/**
 * Admin Dashboard - Refactored with Clean Architecture
 * Single namespace pattern with modern JavaScript
 */

const AdminApp = (function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        ADMIN_PASSWORD: 'WEAR3+H3$@!N+$*',
        BACKEND_URL: getBackendUrl(),
        SECTIONS: ['dashboard', 'orders', 'inventory', 'inbox', 'broadcast', 'abandoned-carts', 'fulfillers', 'notifications', 'sales', 'analytics']
    };
    
    // State
    const state = {
        allInventoryData: [],
        allOrdersData: [],
        currentViewingEmail: null,
        emailBuilderSections: null,
        posCart: []
    };
    
    // Utility Functions
    function getBackendUrl() {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '' || hostname === '0.0.0.0') {
            return 'http://localhost:3000';
        }
        return 'https://saint-ventura-backend.onrender.com';
    }
    
    async function apiCall(endpoint, options = {}) {
        const url = `${CONFIG.BACKEND_URL}${endpoint}`;
        const headers = {
            'X-Admin-Password': CONFIG.ADMIN_PASSWORD,
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        try {
            const response = await fetch(url, { ...options, headers });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    }
    
    function showError(element, message) {
        if (element) {
            element.innerHTML = `<div class="text-center py-8 text-red-500">Error: ${message}</div>`;
        }
    }
    
    function showLoading(element, message = 'Loading...') {
        if (element) {
            element.innerHTML = `<div class="text-center py-8 text-gray-500"><div class="flex items-center justify-center space-x-2"><div class="loading-spinner"></div><span>${message}</span></div></div>`;
        }
    }
    
    // Section Management
    function showSection(sectionName) {
        if (!sectionName || !CONFIG.SECTIONS.includes(sectionName)) {
            console.error('Invalid section:', sectionName);
            return;
        }
        
        // Hide all sections
        document.querySelectorAll('.section').forEach(s => {
            s.classList.add('hidden');
            s.style.display = 'none';
        });
        
        // Remove active states
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.remove('active');
            item.style.backgroundColor = '';
            item.style.color = '';
            item.style.border = '';
        });
        
        // Show target section
        const target = document.getElementById(`${sectionName}-section`);
        if (!target) {
            console.error(`Section not found: ${sectionName}-section`);
            return;
        }
        
        target.classList.remove('hidden');
        target.style.display = 'block';
        target.style.visibility = 'visible';
        target.style.opacity = '1';
        
        // Set active state
        const activeItem = document.querySelector(`[data-section="${sectionName}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
            activeItem.style.border = '2px solid #000';
        }
        
        // Load section data
        const loadFunction = loaders[sectionName];
        if (loadFunction && typeof loadFunction === 'function') {
            loadFunction();
        }
    }
    
    // Data Loaders
    const loaders = {
        async dashboard() {
            try {
                const data = await apiCall('/api/admin/dashboard');
                if (!data.success) throw new Error('Invalid response');
                
                // Update stats
                const stats = {
                    'stat-total-revenue': `R${data.stats.totalRevenue.toFixed(2)}`,
                    'stat-total-profit': `R${(data.stats.totalProfit || 0).toFixed(2)}`,
                    'stat-total-orders': data.stats.completedOrders,
                    'stat-pending-orders': data.stats.pendingOrders,
                    'stat-subscribers': data.stats.totalSubscribers,
                    'stat-low-stock': data.stats.lowStockItems,
                    'stat-notifications': data.stats.unreadNotifications,
                    'stat-emails': data.stats.unreadEmails,
                    'stat-carts': data.stats.abandonedCarts
                };
                
                Object.entries(stats).forEach(([id, value]) => {
                    const el = document.getElementById(id);
                    if (el) el.textContent = value;
                });
                
                // Update recent orders
                const recentList = document.getElementById('recent-orders-list');
                if (recentList) {
                    if (data.recentOrders?.length > 0) {
                        recentList.innerHTML = data.recentOrders.map(order => `
                            <div class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
                                <div class="flex justify-between items-start">
                                    <div>
                                        <p class="font-semibold">${order.customerName || 'Unknown'}</p>
                                        <p class="text-sm text-gray-600">${order.id || 'N/A'}</p>
                                    </div>
                                    <div class="text-right">
                                        <p class="font-semibold">R${(order.total || 0).toFixed(2)}</p>
                                        <span class="px-2 py-1 rounded-full text-xs font-semibold ${order.status === 'fulfilled' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">${order.status || 'pending checkout'}</span>
                                    </div>
                                </div>
                                <p class="text-xs text-gray-500 mt-2">${order.date ? new Date(order.date).toLocaleString() : 'N/A'}</p>
                            </div>
                        `).join('');
                    } else {
                        recentList.innerHTML = '<div class="text-center py-8 text-gray-500">No recent orders</div>';
                    }
                }
            } catch (error) {
                showError(document.getElementById('recent-orders-list'), error.message);
            }
        },
        
        async inventory() {
            const tbody = document.getElementById('inventory-table');
            const mobileContainer = document.getElementById('inventory-table-mobile');
            showLoading(tbody, 'Loading inventory...');
            showLoading(mobileContainer, 'Loading inventory...');
            
            try {
                const data = await apiCall('/api/admin/inventory');
                if (!Array.isArray(data)) throw new Error('Invalid data format');
                
                state.allInventoryData = data;
                if (typeof window.renderInventory === 'function') {
                    window.renderInventory(data);
                }
            } catch (error) {
                showError(tbody, error.message);
                showError(mobileContainer, error.message);
            }
        },
        
        async inbox() {
            const list = document.getElementById('inbox-list');
            if (!list) return;
            showLoading(list, 'Loading emails...');
            
            try {
                const data = await apiCall('/api/admin/inbox');
                if (!Array.isArray(data)) throw new Error('Invalid data format');
                
                const sorted = data.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
                
                if (sorted.length === 0) {
                    list.innerHTML = '<div class="text-center py-8 text-gray-500">No emails</div>';
                    return;
                }
                
                list.innerHTML = sorted.map(email => `
                    <div class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition cursor-pointer ${email.read ? '' : 'bg-blue-50 border-blue-200'}" onclick="AdminApp.viewEmail('${email.id}')">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <p class="font-semibold ${email.read ? 'text-gray-700' : 'text-black'}">${email.subject || '(No Subject)'}</p>
                                <p class="text-sm text-gray-600 mt-1">${email.sent ? 'To:' : 'From:'} ${email.name || email.from || email.to || 'Unknown'}</p>
                                <p class="text-xs text-gray-500 mt-1">${email.date ? new Date(email.date).toLocaleString() : 'Unknown date'}</p>
                            </div>
                            <div class="flex items-center space-x-2">
                                ${email.sent ? '<span class="px-2 py-1 bg-green-500 text-white rounded-full text-xs">Sent</span>' : ''}
                                ${!email.read ? '<span class="px-2 py-1 bg-blue-500 text-white rounded-full text-xs">New</span>' : ''}
                            </div>
                        </div>
                    </div>
                `).join('');
            } catch (error) {
                showError(list, error.message);
            }
        },
        
        async orders() {
            const tbody = document.getElementById('orders-table');
            showLoading(tbody, 'Loading orders...');
            
            try {
                const data = await apiCall('/api/admin/orders');
                if (!Array.isArray(data)) throw new Error('Invalid data format');
                
                state.allOrdersData = data;
                if (typeof window.renderOrders === 'function') {
                    window.renderOrders(data);
                } else {
                    showError(tbody, 'Render function not available');
                }
            } catch (error) {
                showError(tbody, error.message);
            }
        },
        
        async broadcast() {
            try {
                const [subscribers, products] = await Promise.all([
                    apiCall('/api/admin/subscribers'),
                    apiCall('/api/admin/products')
                ]);
                
                const countEl = document.getElementById('subscriber-count');
                if (countEl) countEl.textContent = subscribers.length || 0;
                
                const list = document.getElementById('subscribers-list');
                if (list) {
                    if (subscribers.length === 0) {
                        list.innerHTML = '<div class="text-center py-4 text-gray-500">No subscribers</div>';
                    } else {
                        list.innerHTML = subscribers.map(sub => `
                            <div class="flex justify-between items-center p-2 border border-gray-200 rounded">
                                <span class="text-sm">${sub.email}</span>
                                <span class="text-xs text-gray-500">${new Date(sub.date).toLocaleDateString()}</span>
                            </div>
                        `).join('');
                    }
                }
                
                const select = document.getElementById('broadcast-products');
                if (select) {
                    select.innerHTML = '<option value="">Select products...</option>' +
                        products.map(p => `<option value="${p.id}">${p.name} - R${(p.price || 0).toFixed(2)}</option>`).join('');
                }
            } catch (error) {
                console.error('Error loading broadcast:', error);
                showError(document.getElementById('subscribers-list'), error.message);
            }
        },
        
        async 'abandoned-carts'() {
            const list = document.getElementById('abandoned-carts-list');
            if (!list) return;
            showLoading(list, 'Loading abandoned carts...');
            
            try {
                const data = await apiCall('/api/admin/abandoned-carts');
                if (!Array.isArray(data)) throw new Error('Invalid data format');
                
                if (data.length === 0) {
                    list.innerHTML = '<div class="text-center py-8 text-gray-500">No abandoned carts</div>';
                    return;
                }
                
                list.innerHTML = data.map(cart => {
                    let timeAbandoned = 'Unknown';
                    if (cart.date) {
                        const diffMs = new Date() - new Date(cart.date);
                        const diffMins = Math.floor(diffMs / 60000);
                        const diffHours = Math.floor(diffMs / 3600000);
                        const diffDays = Math.floor(diffMs / 86400000);
                        if (diffMins < 1) timeAbandoned = 'Just now';
                        else if (diffMins < 60) timeAbandoned = `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
                        else if (diffHours < 24) timeAbandoned = `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
                        else if (diffDays < 30) timeAbandoned = `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
                        else timeAbandoned = `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) !== 1 ? 's' : ''} ago`;
                    }
                    return `
                        <div class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
                            <div class="flex justify-between items-start mb-3">
                                <div class="flex-1">
                                    <p class="font-semibold text-lg">${cart.email || 'Guest'}</p>
                                    <p class="text-sm text-gray-600 mt-1">${(cart.items || []).length} item${(cart.items || []).length !== 1 ? 's' : ''}</p>
                                </div>
                                <div class="text-right">
                                    <p class="text-xs font-medium text-gray-500 mb-1">Abandoned</p>
                                    <p class="text-sm font-semibold text-red-600">${timeAbandoned}</p>
                                </div>
                            </div>
                            <div class="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
                                <p class="text-lg font-bold">Total: R${(cart.total || 0).toFixed(2)}</p>
                                ${cart.email ? `<button onclick="AdminApp.sendCartReminder('${cart.id}')" class="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition">Send Reminder</button>` : '<span class="text-xs text-gray-400">No email</span>'}
                            </div>
                        </div>
                    `;
                }).join('');
            } catch (error) {
                showError(list, error.message);
            }
        },
        
        async fulfillers() {
            const list = document.getElementById('fulfillers-list');
            const select = document.getElementById('fulfiller-select');
            if (!list) return;
            showLoading(list, 'Loading fulfillers...');
            
            try {
                const data = await apiCall('/api/admin/fulfillers');
                if (!Array.isArray(data)) throw new Error('Invalid data format');
                
                if (data.length === 0) {
                    list.innerHTML = '<div class="text-center py-4 text-gray-500">No fulfillers added</div>';
                    if (select) select.innerHTML = '<option value="">No fulfillers available</option>';
                } else {
                    list.innerHTML = data.map(f => `
                        <div class="flex justify-between items-center p-3 border border-gray-200 rounded-lg">
                            <div class="flex-1">
                                <p class="font-semibold text-base">${f.name || 'Unknown'}</p>
                                <p class="text-sm text-gray-600">${f.email || 'No email'}</p>
                                ${f.phone ? `<p class="text-xs text-gray-500">${f.phone}</p>` : ''}
                            </div>
                            <button onclick="AdminApp.deleteFulfiller('${f.id}')" class="ml-4 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition">Delete</button>
                        </div>
                    `).join('');
                    if (select) {
                        select.innerHTML = '<option value="">Select a fulfiller...</option>' +
                            data.map(f => `<option value="${f.id}">${f.name || 'Unknown'} (${f.email || 'No email'})</option>`).join('');
                    }
                }
            } catch (error) {
                showError(list, error.message);
                if (select) select.innerHTML = '<option value="">Error loading fulfillers</option>';
            }
        },
        
        async notifications() {
            const list = document.getElementById('notifications-list');
            if (!list) return;
            showLoading(list, 'Loading notifications...');
            
            try {
                const data = await apiCall('/api/admin/notifications');
                if (!Array.isArray(data)) {
                    if (data.error) throw new Error(data.error);
                    throw new Error('Invalid data format');
                }
                
                if (data.length === 0) {
                    list.innerHTML = '<div class="text-center py-8 text-gray-500">No notifications</div>';
                    return;
                }
                
                list.innerHTML = data.map(notif => {
                    const notifId = notif.id || Date.now().toString();
                    return `
                        <div class="border border-gray-200 rounded-lg p-4 ${notif.read ? 'bg-gray-50' : 'bg-white'}">
                            <div class="flex justify-between items-start">
                                <div>
                                    <p class="font-semibold">${(notif.title || 'Notification').replace(/'/g, "\\'")}</p>
                                    <p class="text-sm text-gray-600">${(notif.message || 'No message').replace(/'/g, "\\'")}</p>
                                </div>
                                <div class="text-right">
                                    <span class="text-xs text-gray-500">${notif.date ? new Date(notif.date).toLocaleString() : 'N/A'}</span>
                                    ${!notif.read ? `<button onclick="AdminApp.markNotificationRead('${notifId}')" class="ml-2 text-sm text-blue-600 hover:underline">Mark Read</button>` : ''}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            } catch (error) {
                showError(list, error.message);
            }
        },
        
        async sales() {
            const container = document.getElementById('pos-products');
            if (!container) return;
            showLoading(container, 'Loading products...');
            
            try {
                const data = await apiCall('/api/admin/products');
                if (!Array.isArray(data)) throw new Error('Invalid products data format');
                
                if (data.length === 0) {
                    container.innerHTML = '<div class="col-span-2 md:col-span-3 lg:col-span-4 text-center py-8 text-gray-500">No products available</div>';
                    return;
                }
                
                container.innerHTML = data.map(p => {
                    const firstImage = p.images?.[0] || p.availableColors?.[0]?.image || 'https://dl.dropboxusercontent.com/scl/fi/pew6zj6bt0myobu7zl4eu/1-21.png?rlkey=z6jhjxe71rpuk37td9ktwvqmg&st=303hz8tw&dl=1';
                    const hasVariants = (p.sizes?.length > 1) || (p.colors?.length > 1);
                    return `
                        <div class="border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all duration-200 bg-white">
                            <div class="aspect-square mb-3 bg-gray-100 rounded-lg overflow-hidden">
                                <img src="${firstImage}" alt="${p.name}" class="w-full h-full object-cover" onerror="this.src='https://dl.dropboxusercontent.com/scl/fi/pew6zj6bt0myobu7zl4eu/1-21.png?rlkey=z6jhjxe71rpuk37td9ktwvqmg&st=303hz8tw&dl=1'">
                            </div>
                            <p class="font-semibold text-sm md:text-base mb-1">${p.name || 'Unknown Product'}</p>
                            <p class="text-gray-600 text-sm md:text-base font-bold mb-2">R${(p.price || 0).toFixed(2)}</p>
                            ${hasVariants ? `
                                <button onclick="AdminApp.showVariantModal(${p.id})" class="w-full px-3 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition">Select Variant</button>
                            ` : `
                                <button onclick="AdminApp.addToPOSCart(${p.id}, '${(p.name || '').replace(/'/g, "\\'")}', ${p.price || 0}, null, null)" class="w-full px-3 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition">Add to Cart</button>
                            `}
                        </div>
                    `;
                }).join('');
            } catch (error) {
                showError(container, error.message);
            }
        },
        
        async analytics() {
            try {
                const data = await apiCall('/api/admin/dashboard');
                if (data.success) {
                    if (typeof window.renderRevenueChart === 'function') window.renderRevenueChart(data.monthlyRevenue);
                    if (typeof window.renderStatusChart === 'function') window.renderStatusChart(data.stats);
                    if (typeof window.renderSalesSummary === 'function') window.renderSalesSummary(data);
                }
            } catch (error) {
                showError(document.getElementById('revenue-chart'), error.message);
            }
        }
    };
    
    // Public API
    return {
        // Core functions
        showSection,
        apiCall,
        
        // Helper functions (to be implemented)
        viewEmail: (id) => { console.log('viewEmail:', id); },
        sendCartReminder: (id) => { console.log('sendCartReminder:', id); },
        deleteFulfiller: (id) => { console.log('deleteFulfiller:', id); },
        markNotificationRead: (id) => { console.log('markNotificationRead:', id); },
        showVariantModal: (id) => { console.log('showVariantModal:', id); },
        addToPOSCart: (id, name, price, size, color) => { console.log('addToPOSCart:', {id, name, price, size, color}); },
        
        // State access
        getState: () => ({ ...state }),
        
        // Config
        CONFIG
    };
})();

// Make globally available
window.AdminApp = AdminApp;
window.showSection = AdminApp.showSection;

