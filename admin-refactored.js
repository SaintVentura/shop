/**
 * Admin Dashboard - Refactored with Clean Architecture
 * Single namespace pattern with modern JavaScript
 */

const AdminApp = (function() {
    'use strict';
    
    // Configuration - password will be set after login verification
    let ADMIN_PASSWORD = null;
    
    // Always use production backend URL from Render
    const BACKEND_URL = 'https://saint-ventura-backend.onrender.com';
    
    const CONFIG = {
        BACKEND_URL: BACKEND_URL,
        SECTIONS: ['dashboard', 'orders', 'inventory', 'inbox', 'broadcast', 'abandoned-carts', 'fulfillers', 'notifications', 'sales', 'analytics']
    };
    
    // Log backend URL on initialization
    console.log('🚀 Admin Dashboard initialized');
    console.log('🌐 Backend URL:', CONFIG.BACKEND_URL);
    
    // Test backend connectivity on load
    fetch(`${CONFIG.BACKEND_URL}/health`, { 
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-cache'
    })
    .then(response => {
        if (response.ok) {
            console.log('✅ Backend server is reachable');
        } else {
            console.warn('⚠️ Backend server returned non-OK status:', response.status);
        }
    })
    .catch(error => {
        console.error('❌ Cannot reach backend server:', error);
        console.error('   URL:', CONFIG.BACKEND_URL);
        console.error('   Please ensure the server is running and accessible.');
    });
    
    // State
    const state = {
        allInventoryData: [],
        allOrdersData: [],
        currentViewingEmail: null,
        emailBuilderSections: null,
        posCart: []
    };
    
    async function apiCall(endpoint, options = {}) {
        if (!ADMIN_PASSWORD) {
            throw new Error('Not authenticated. Please log in first.');
        }
        
        const url = `${CONFIG.BACKEND_URL}${endpoint}`;
        const headers = {
            'X-Admin-Password': ADMIN_PASSWORD,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers
        };
        
        // Add body if it's a string (needs to be converted)
        const fetchOptions = {
            ...options,
            headers,
            mode: 'cors',
            credentials: 'omit',
            cache: 'no-cache'
        };
        
        // Handle body - if it's already a string, use it; otherwise stringify
        if (options.body && typeof options.body !== 'string') {
            fetchOptions.body = JSON.stringify(options.body);
        }
        
        console.log(`📡 API Call: ${options.method || 'GET'} ${url}`);
        console.log('📡 Headers:', Object.keys(headers));
        
        try {
            const response = await fetch(url, fetchOptions);
            
            console.log(`📡 Response: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
                let errorData;
                try {
                    const text = await response.text();
                    errorData = text ? JSON.parse(text) : {};
                } catch (e) {
                    errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
                }
                
                const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
                console.error(`❌ API Error [${endpoint}]:`, errorMessage);
                throw new Error(errorMessage);
            }
            
            const data = await response.json();
            console.log(`✅ API Success [${endpoint}]:`, data);
            return data;
        } catch (error) {
            console.error(`❌ API Error [${endpoint}]:`, error);
            
            // Provide more helpful error messages
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error(`Network error: Cannot reach server at ${CONFIG.BACKEND_URL}. Please check your internet connection and ensure the server is running.`);
            }
            
            if (error.message.includes('CORS')) {
                throw new Error(`CORS error: The server at ${CONFIG.BACKEND_URL} is not allowing requests from this origin.`);
            }
            
            throw error;
        }
    }
    
    // Login function - verifies password with backend
    async function login(password) {
        const url = `${CONFIG.BACKEND_URL}/api/admin/verify-password`;
        console.log('🔑 Attempting login to:', url);
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                mode: 'cors',
                credentials: 'omit',
                cache: 'no-cache',
                body: JSON.stringify({ password })
            });
            
            console.log('🔑 Login response status:', response.status, response.statusText);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('❌ Login failed:', errorData);
                return false;
            }
            
            const data = await response.json();
            console.log('🔑 Login response:', data);
            
            if (data.success) {
                ADMIN_PASSWORD = password;
                console.log('✅ Login successful');
                return true;
            }
            console.log('❌ Login failed: Invalid password');
            return false;
        } catch (error) {
            console.error('❌ Login error:', error);
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                console.error('❌ Network error: Cannot reach server at', CONFIG.BACKEND_URL);
                alert(`Cannot connect to server at ${CONFIG.BACKEND_URL}. Please check your internet connection and ensure the server is running.`);
            }
            return false;
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
        
        // Setup forms when sections are shown
        if (sectionName === 'sales') {
            setTimeout(() => {
                AdminApp.setupPOSForm();
            }, 100);
        }
        if (sectionName === 'fulfillers') {
            setTimeout(() => {
                AdminApp.setupAddFulfillerForm();
            }, 100);
        }
        if (sectionName === 'broadcast') {
            setTimeout(() => {
                AdminApp.setupAddSubscriberForm();
            }, 100);
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
                } else {
                    // Fallback: render inventory directly
                    AdminApp.renderInventory(data);
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
                    // Fallback: render orders directly
                    AdminApp.renderOrders(data);
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
                    if (typeof window.renderRevenueChart === 'function') {
                        window.renderRevenueChart(data.monthlyRevenue);
                    } else {
                        AdminApp.renderRevenueChart(data.monthlyRevenue);
                    }
                    if (typeof window.renderStatusChart === 'function') {
                        window.renderStatusChart(data.stats);
                    } else {
                        AdminApp.renderStatusChart(data.stats);
                    }
                    if (typeof window.renderSalesSummary === 'function') {
                        window.renderSalesSummary(data);
                    } else {
                        AdminApp.renderSalesSummary(data);
                    }
                }
            } catch (error) {
                showError(document.getElementById('revenue-chart'), error.message);
            }
        }
    };
    
    // Login handler for form submission
    async function handleLogin(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        const passwordInput = document.getElementById('admin-password');
        const password = passwordInput ? passwordInput.value.trim() : '';
        const errorElement = document.getElementById('login-error');
        
        if (!password) {
            if (errorElement) {
                errorElement.textContent = 'Please enter a password';
                errorElement.classList.remove('hidden');
            }
            return false;
        }
        
        const success = await login(password);
        if (success) {
            const loginScreen = document.getElementById('login-screen');
            const adminDashboard = document.getElementById('admin-dashboard');
            
            if (!loginScreen || !adminDashboard) {
                alert('Error: Page elements not found. Please refresh the page.');
                return false;
            }
            
            loginScreen.classList.add('hidden');
            adminDashboard.classList.remove('hidden');
            localStorage.setItem('adminLoggedIn', 'true');
            
            if (errorElement) {
                errorElement.classList.add('hidden');
            }
            
            // Load dashboard
            setTimeout(() => {
                showSection('dashboard');
            }, 100);
            
            return false;
        } else {
            if (errorElement) {
                errorElement.textContent = 'Invalid password. Please try again.';
                errorElement.classList.remove('hidden');
            }
            if (passwordInput) {
                passwordInput.value = '';
                passwordInput.focus();
            }
            return false;
        }
    }
    
    // Check login status on page load
    function checkLoginStatus() {
        const isLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
        const loginScreen = document.getElementById('login-screen');
        const adminDashboard = document.getElementById('admin-dashboard');
        
        if (isLoggedIn && loginScreen && adminDashboard) {
            loginScreen.classList.add('hidden');
            adminDashboard.classList.remove('hidden');
        }
    }
    
    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkLoginStatus);
    } else {
        checkLoginStatus();
    }
    
    // Public API
    return {
        // Authentication
        login,
        handleLogin,
        
        // Core functions
        showSection,
        apiCall,
        
        // Load functions
        loadDashboardData: loaders.dashboard,
        loadOrders: loaders.orders,
        loadInventory: loaders.inventory,
        loadInbox: loaders.inbox,
        loadBroadcast: loaders.broadcast,
        loadAbandonedCarts: loaders['abandoned-carts'],
        loadFulfillers: loaders.fulfillers,
        loadNotifications: loaders.notifications,
        loadSales: loaders.sales,
        loadAnalytics: loaders.analytics,
        
        // Helper functions
        viewEmail: async (id) => {
            try {
                const email = await apiCall(`/api/admin/inbox/${id}`);
                const modal = document.getElementById('view-email-modal');
                if (modal) {
                    document.getElementById('view-email-subject').textContent = email.subject || 'No Subject';
                    document.getElementById('view-email-from').textContent = email.from || email.name || 'Unknown';
                    document.getElementById('view-email-date').textContent = email.date ? new Date(email.date).toLocaleString() : 'N/A';
                    document.getElementById('view-email-body').innerHTML = email.body || email.text || 'No content';
                    modal.classList.remove('hidden');
                    state.currentViewingEmail = email;
                }
            } catch (error) {
                alert('Error loading email: ' + error.message);
            }
        },
        
        sendCartReminder: async (id) => {
            try {
                await apiCall(`/api/admin/abandoned-carts/${id}/remind`, { method: 'POST' });
                alert('Reminder email sent successfully');
                loaders['abandoned-carts']();
            } catch (error) {
                alert('Error sending reminder: ' + error.message);
            }
        },
        
        deleteFulfiller: async (id) => {
            if (!confirm('Are you sure you want to delete this fulfiller?')) return;
            try {
                await apiCall(`/api/admin/fulfillers/${id}`, { method: 'DELETE' });
                loaders.fulfillers();
            } catch (error) {
                alert('Error deleting fulfiller: ' + error.message);
            }
        },
        
        markNotificationRead: async (id) => {
            try {
                await apiCall(`/api/admin/notifications/${id}/read`, { method: 'POST' });
                loaders.notifications();
            } catch (error) {
                alert('Error marking notification as read: ' + error.message);
            }
        },
        
        showVariantModal: (id) => {
            alert('Variant modal for product ' + id + ' - to be implemented');
        },
        
        addToPOSCart: (id, name, price, size, color) => {
            state.posCart.push({ id, name, price, size, color, quantity: 1 });
            AdminApp.updatePOSCartDisplay();
        },
        
        updatePOSCartDisplay: () => {
            const cartContainer = document.getElementById('pos-cart');
            const totalElement = document.getElementById('pos-total');
            if (!cartContainer) return;
            
            if (state.posCart.length === 0) {
                cartContainer.innerHTML = '<p class="text-gray-500 text-sm">No items added</p>';
                if (totalElement) totalElement.textContent = 'R0.00';
                return;
            }
            
            const total = state.posCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            cartContainer.innerHTML = state.posCart.map((item, index) => `
                <div class="flex justify-between items-center p-3 border border-gray-200 rounded-lg">
                    <div class="flex-1">
                        <p class="font-semibold">${item.name}</p>
                        ${item.size ? `<p class="text-sm text-gray-600">Size: ${item.size}</p>` : ''}
                        ${item.color ? `<p class="text-sm text-gray-600">Color: ${item.color}</p>` : ''}
                        <p class="text-sm text-gray-600">Quantity: ${item.quantity}</p>
                    </div>
                    <div class="text-right ml-4">
                        <p class="font-bold">R${(item.price * item.quantity).toFixed(2)}</p>
                        <button onclick="AdminApp.removeFromPOSCart(${index})" class="text-red-500 text-sm hover:text-red-700 mt-1">Remove</button>
                    </div>
                </div>
            `).join('');
            if (totalElement) totalElement.textContent = `R${total.toFixed(2)}`;
        },
        
        removeFromPOSCart: (index) => {
            state.posCart.splice(index, 1);
            AdminApp.updatePOSCartDisplay();
        },
        
        // UI Helper Functions
        logout: () => {
            localStorage.removeItem('adminLoggedIn');
            ADMIN_PASSWORD = null;
            const loginScreen = document.getElementById('login-screen');
            const adminDashboard = document.getElementById('admin-dashboard');
            if (loginScreen) loginScreen.classList.remove('hidden');
            if (adminDashboard) adminDashboard.classList.add('hidden');
        },
        
        toggleMobileSidebar: () => {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebar-overlay');
            if (sidebar) sidebar.classList.toggle('mobile-open');
            if (overlay) overlay.classList.toggle('active');
        },
        
        closeMobileSidebar: () => {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebar-overlay');
            if (sidebar) sidebar.classList.remove('mobile-open');
            if (overlay) overlay.classList.remove('active');
        },
        
        toggleSidebar: () => {
            const sidebar = document.getElementById('sidebar');
            const mainContent = document.getElementById('main-content');
            if (window.innerWidth <= 768) {
                AdminApp.toggleMobileSidebar();
                return;
            }
            if (sidebar && mainContent) {
                const isCollapsed = sidebar.classList.contains('collapsed');
                if (isCollapsed) {
                    sidebar.classList.remove('collapsed');
                    sidebar.classList.remove('w-20');
                    sidebar.classList.add('w-64');
                    mainContent.classList.remove('ml-20');
                    mainContent.classList.add('ml-64');
                } else {
                    sidebar.classList.add('collapsed');
                    sidebar.classList.remove('w-64');
                    sidebar.classList.add('w-20');
                    mainContent.classList.remove('ml-64');
                    mainContent.classList.add('ml-20');
                }
            }
        },
        
        refreshOrders: () => loaders.orders(),
        refreshInventory: () => loaders.inventory(),
        refreshInbox: () => loaders.inbox(),
        refreshAbandonedCarts: () => loaders['abandoned-carts'](),
        refreshNotifications: () => loaders.notifications(),
        
        fetchEmails: async () => {
            // Note: Email fetching endpoint not yet implemented on server
            // For now, just refresh the inbox
            alert('Email fetching is not yet available. Refreshing inbox...');
            loaders.inbox();
        },
        
        showAddFulfillerModal: () => {
            const modal = document.getElementById('add-fulfiller-modal');
            if (modal) {
                modal.classList.remove('hidden');
                setTimeout(() => {
                    AdminApp.setupAddFulfillerForm();
                }, 100);
            }
        },
        
        closeAddFulfillerModal: () => {
            const modal = document.getElementById('add-fulfiller-modal');
            const form = document.getElementById('add-fulfiller-form');
            if (modal) modal.classList.add('hidden');
            if (form) form.reset();
        },
        
        showComposeEmail: () => {
            const modal = document.getElementById('compose-email-modal');
            if (modal) modal.classList.remove('hidden');
        },
        
        closeComposeEmail: () => {
            const modal = document.getElementById('compose-email-modal');
            if (modal) modal.classList.add('hidden');
        },
        
        openBroadcastEmailComposer: () => {
            const modal = document.getElementById('compose-email-modal');
            const toField = document.getElementById('compose-to');
            const addSubscribersBtn = document.getElementById('add-subscribers-btn');
            if (modal) {
                if (toField) toField.value = '';
                if (addSubscribersBtn) addSubscribersBtn.classList.remove('hidden');
                modal.classList.remove('hidden');
            }
        },
        
        openAbandonedCartEmailComposer: () => {
            AdminApp.showComposeEmail();
        },
        
        openFulfillerEmailComposer: () => {
            AdminApp.showComposeEmail();
        },
        
        markAllRead: async () => {
            try {
                await apiCall('/api/admin/notifications/mark-all-read', { method: 'POST' });
                loaders.notifications();
            } catch (error) {
                alert('Error marking all as read: ' + error.message);
            }
        },
        
        addAllSubscribers: async () => {
            try {
                const subscribers = await apiCall('/api/admin/subscribers');
                const toField = document.getElementById('compose-to');
                if (toField) {
                    const emails = subscribers.map(s => s.email).join(', ');
                    toField.value = emails;
                }
            } catch (error) {
                alert('Error loading subscribers: ' + error.message);
            }
        },
        
        loadEmailTemplate: (template) => {
            const templates = {
                promotion: { subject: 'Special Promotion - Limited Time Offer!', body: 'We have an amazing promotion for you...' },
                'new-product': { subject: 'New Product Launch!', body: 'Check out our latest product...' },
                news: { subject: 'News & Updates', body: 'Here are the latest updates...' },
                'fulfiller-order': { subject: 'New Order to Fulfill', body: 'You have a new order to fulfill...' }
            };
            const t = templates[template];
            if (t) {
                const subjectField = document.getElementById('compose-subject');
                if (subjectField) subjectField.value = t.subject;
            }
        },
        
        addEmailSection: (type) => {
            const builder = document.getElementById('email-builder');
            if (!builder) return;
            const section = document.createElement('div');
            section.className = 'email-section';
            section.setAttribute('data-type', type);
            section.innerHTML = `
                <div class="flex justify-between items-center mb-2">
                    <label class="text-xs text-gray-500 font-medium">${type.charAt(0).toUpperCase() + type.slice(1)} Section</label>
                    <button type="button" onclick="AdminApp.removeEmailSection(this)" class="text-red-500 text-xs hover:text-red-700">Remove</button>
                </div>
                ${type === 'text' ? '<textarea class="w-full px-3 py-2 border border-gray-200 rounded text-sm" rows="3" placeholder="Enter text content..."></textarea>' : ''}
                ${type === 'heading' ? '<input type="text" class="w-full px-3 py-2 border border-gray-200 rounded text-sm" placeholder="Enter heading...">' : ''}
                ${type === 'image' ? '<input type="url" class="w-full px-3 py-2 border border-gray-200 rounded text-sm" placeholder="Enter image URL...">' : ''}
                ${type === 'button' ? '<input type="text" class="w-full px-3 py-2 border border-gray-200 rounded text-sm mb-2" placeholder="Button text..."><input type="url" class="w-full px-3 py-2 border border-gray-200 rounded text-sm" placeholder="Button URL...">' : ''}
                ${type === 'divider' ? '<hr class="border-gray-300">' : ''}
                ${type === 'spacer' ? '<div class="h-8"></div>' : ''}
            `;
            builder.appendChild(section);
        },
        
        removeEmailSection: (button) => {
            const section = button.closest('.email-section');
            if (section) section.remove();
        },
        
        toggleEmailPreview: () => {
            const builder = document.getElementById('email-builder');
            const previewMode = document.getElementById('preview-mode')?.checked;
            if (builder) {
                if (previewMode) {
                    state.emailBuilderSections = builder.innerHTML;
                    builder.innerHTML = '<div class="p-4 bg-gray-50 rounded">Preview mode - content will be rendered here</div>';
                } else {
                    if (state.emailBuilderSections) {
                        builder.innerHTML = state.emailBuilderSections;
                    }
                }
            }
        },
        
        closeViewEmail: () => {
            const modal = document.getElementById('view-email-modal');
            if (modal) modal.classList.add('hidden');
            state.currentViewingEmail = null;
        },
        
        replyToEmail: () => {
            AdminApp.closeViewEmail();
            AdminApp.showComposeEmail();
            const toField = document.getElementById('compose-to');
            const subjectField = document.getElementById('compose-subject');
            if (state.currentViewingEmail && toField) {
                toField.value = state.currentViewingEmail.from || state.currentViewingEmail.name || '';
            }
            if (state.currentViewingEmail && subjectField) {
                subjectField.value = 'Re: ' + (state.currentViewingEmail.subject || '');
            }
        },
        
        deleteEmail: async () => {
            if (!state.currentViewingEmail || !state.currentViewingEmail.id) return;
            if (!confirm('Are you sure you want to delete this email?')) return;
            try {
                await apiCall(`/api/admin/inbox/${state.currentViewingEmail.id}`, { method: 'DELETE' });
                AdminApp.closeViewEmail();
                loaders.inbox();
            } catch (error) {
                alert('Error deleting email: ' + error.message);
            }
        },
        
        setupAddFulfillerForm: () => {
            const form = document.getElementById('add-fulfiller-form');
            if (!form) return;
            
            form.onsubmit = async (e) => {
                e.preventDefault();
                const name = document.getElementById('fulfiller-name')?.value.trim();
                const email = document.getElementById('fulfiller-email')?.value.trim();
                const phone = document.getElementById('fulfiller-phone')?.value.trim();
                
                if (!name || !email) {
                    alert('Please fill in name and email');
                    return;
                }
                
                try {
                    await apiCall('/api/admin/fulfillers', {
                        method: 'POST',
                        body: JSON.stringify({ name, email, phone })
                    });
                    alert('Fulfiller added successfully!');
                    AdminApp.closeAddFulfillerModal();
                    loaders.fulfillers();
                } catch (error) {
                    alert('Error adding fulfiller: ' + error.message);
                }
            };
        },
        
        setupAddSubscriberForm: () => {
            const form = document.getElementById('add-subscriber-form');
            if (!form) return;
            
            form.onsubmit = async (e) => {
                e.preventDefault();
                const email = document.getElementById('new-subscriber-email')?.value.trim();
                
                if (!email) {
                    alert('Please enter an email address');
                    return;
                }
                
                try {
                    await apiCall('/api/newsletter-subscribe', {
                        method: 'POST',
                        body: JSON.stringify({ email })
                    });
                    alert('Subscriber added successfully!');
                    form.reset();
                    loaders.broadcast();
                } catch (error) {
                    alert('Error adding subscriber: ' + error.message);
                }
            };
        },
        
        setupPOSForm: () => {
            const form = document.getElementById('pos-order-form');
            if (!form) return;
            
            form.onsubmit = async (e) => {
                e.preventDefault();
                if (state.posCart.length === 0) {
                    alert('Please add items to cart first');
                    return;
                }
                
                const customerName = document.getElementById('pos-customer-name')?.value.trim();
                const customerEmail = document.getElementById('pos-customer-email')?.value.trim();
                const customerPhone = document.getElementById('pos-customer-phone')?.value.trim();
                const paymentMethod = document.getElementById('pos-payment-method')?.value;
                const subscribe = document.getElementById('pos-subscribe')?.checked || false;
                
                if (!customerName || !customerEmail || !customerPhone) {
                    alert('Please fill in all customer details');
                    return;
                }
                
                try {
                    const items = state.posCart.map(item => ({
                        productId: item.id,
                        productName: item.name,
                        quantity: item.quantity,
                        price: item.price,
                        size: item.size,
                        color: item.color
                    }));
                    
                    const total = state.posCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    
                    await apiCall('/api/admin/pos/order', {
                        method: 'POST',
                        body: JSON.stringify({
                            customerName,
                            customerEmail,
                            customerPhone,
                            items,
                            total,
                            paymentMethod,
                            subscribe
                        })
                    });
                    
                    alert('Order processed successfully!');
                    form.reset();
                    state.posCart = [];
                    AdminApp.updatePOSCartDisplay();
                } catch (error) {
                    alert('Error processing order: ' + error.message);
                }
            };
        },
        
        // State access
        getState: () => ({ ...state }),
        
        // Config
        CONFIG
    };
})();

// Make AdminApp globally available
window.AdminApp = AdminApp;

// Expose showSection globally for backward compatibility
window.showSection = (section) => AdminApp.showSection(section);

// Expose handleLogin globally for form onsubmit
window.handleLogin = (e) => AdminApp.handleLogin(e);

// Expose all helper functions globally
window.logout = () => AdminApp.logout();
window.toggleMobileSidebar = () => AdminApp.toggleMobileSidebar();
window.closeMobileSidebar = () => AdminApp.closeMobileSidebar();
window.toggleSidebar = () => AdminApp.toggleSidebar();
window.refreshOrders = () => AdminApp.refreshOrders();
window.refreshInventory = () => AdminApp.refreshInventory();
window.refreshInbox = () => AdminApp.refreshInbox();
window.refreshAbandonedCarts = () => AdminApp.refreshAbandonedCarts();
window.refreshNotifications = () => AdminApp.refreshNotifications();
window.fetchEmails = () => AdminApp.fetchEmails();
window.showAddFulfillerModal = () => AdminApp.showAddFulfillerModal();
window.closeAddFulfillerModal = () => AdminApp.closeAddFulfillerModal();
window.showComposeEmail = () => AdminApp.showComposeEmail();
window.closeComposeEmail = () => AdminApp.closeComposeEmail();
window.openBroadcastEmailComposer = () => AdminApp.openBroadcastEmailComposer();
window.openAbandonedCartEmailComposer = () => AdminApp.openAbandonedCartEmailComposer();
window.openFulfillerEmailComposer = () => AdminApp.openFulfillerEmailComposer();
window.markAllRead = () => AdminApp.markAllRead();
window.addAllSubscribers = () => AdminApp.addAllSubscribers();
window.loadEmailTemplate = (t) => AdminApp.loadEmailTemplate(t);
window.addEmailSection = (t) => AdminApp.addEmailSection(t);
window.removeEmailSection = (b) => AdminApp.removeEmailSection(b);
window.toggleEmailPreview = () => AdminApp.toggleEmailPreview();
window.closeViewEmail = () => AdminApp.closeViewEmail();
window.replyToEmail = () => AdminApp.replyToEmail();
window.deleteEmail = () => AdminApp.deleteEmail();
window.removeFromPOSCart = (i) => AdminApp.removeFromPOSCart(i);

// Expose render functions globally
window.renderInventory = (data) => AdminApp.renderInventory(data);
window.renderOrders = (data) => AdminApp.renderOrders(data);
window.renderRevenueChart = (data) => AdminApp.renderRevenueChart(data);
window.renderStatusChart = (data) => AdminApp.renderStatusChart(data);
window.renderSalesSummary = (data) => AdminApp.renderSalesSummary(data);

// Expose all load functions globally for backward compatibility
window.loadDashboardData = () => AdminApp.loadDashboardData();
window.loadOrders = () => AdminApp.loadOrders();
window.loadInventory = () => AdminApp.loadInventory();
window.loadInbox = () => AdminApp.loadInbox();
window.loadBroadcast = () => AdminApp.loadBroadcast();
window.loadAbandonedCarts = () => AdminApp.loadAbandonedCarts();
window.loadFulfillers = () => AdminApp.loadFulfillers();
window.loadNotifications = () => AdminApp.loadNotifications();
window.loadSales = () => AdminApp.loadSales();
window.loadAnalytics = () => AdminApp.loadAnalytics();

// Make globally available
window.AdminApp = AdminApp;
window.showSection = AdminApp.showSection;

