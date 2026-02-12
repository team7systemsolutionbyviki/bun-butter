/**
 * Bun Butter Bakery POS - Core Application Logic
 * Structure:
 * 1. Global Helpers (UUID, Date)
 * 2. Store Class (LocalStorage Wrapper)
 * 3. UI Class (DOM Manipulation)
 * 4. App Class (Business Logic)
 */

// --- 1. Global Helpers & Constants ---
const generateId = () => '_' + Math.random().toString(36).substr(2, 9);
const formatMoney = (amount) => `₹${parseFloat(amount).toFixed(2)}`;
const getTimestamp = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, -1);
};
const getTodayDate = () => getTimestamp().split('T')[0];
const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();

// --- 2. Store Class ---
class Store {
    constructor() {
        this.keys = {
            PRODUCTS: 'pos_products',
            STAFF: 'pos_staff',
            SALES: 'pos_sales',
            SETTINGS: 'pos_settings',
            LAST_BILL: 'pos_lastBill',
            EXPENSES: 'pos_expenses',
            PURCHASES: 'pos_purchases',
            DAILY_LOGS: 'pos_daily_logs'
        };
        this.init();
    }

    init() {
        // Seed default data if empty
        if (!localStorage.getItem(this.keys.SETTINGS)) {
            const defaultSettings = {
                shopName: 'Bun Butter',
                address: 'Main Street, City',
                phone: '9876543210',
                gstNo: '',
                defaultGstPercent: 0,
                adminPin: '1234'
            };
            localStorage.setItem(this.keys.SETTINGS, JSON.stringify(defaultSettings));
        }

        if (!localStorage.getItem(this.keys.PRODUCTS)) {
            // Sample Data
            const samples = [
                { id: generateId(), name: 'Chocolate Cake', category: 'Cakes', price: 500, stock: 20 },
                { id: generateId(), name: 'Butter Croissant', category: 'Pastries', price: 80, stock: 50 },
                { id: generateId(), name: 'White Bread', category: 'Breads', price: 40, stock: 30 }
            ];
            localStorage.setItem(this.keys.PRODUCTS, JSON.stringify(samples));
        }

        // Migration: Fix legacy Admin data (if missing username)
        if (localStorage.getItem(this.keys.STAFF)) {
            let staff = JSON.parse(localStorage.getItem(this.keys.STAFF));
            let changed = false;
            staff = staff.map(s => {
                if (s.role === 'Admin' && !s.username) {
                    s.username = 'admin';
                    s.password = '123';
                    changed = true;
                }
                return s;
            });
            if (changed) localStorage.setItem(this.keys.STAFF, JSON.stringify(staff));
        }

        if (!localStorage.getItem(this.keys.STAFF)) {
            const admin = { id: generateId(), name: 'Admin', role: 'Admin', username: 'admin', password: '123', salary: 0, employed: true };
            localStorage.setItem(this.keys.STAFF, JSON.stringify([admin]));
        }

        // Ensure Super Admin 'viki' exists
        let staff = this.get(this.keys.STAFF);
        if (!staff.find(s => s.username === 'viki')) {
            const superAdmin = {
                id: generateId(),
                name: 'Viki',
                role: 'Admin', // Use Admin role for permissions
                username: 'viki',
                password: '1101',
                salary: 0,
                employed: true,
                isHidden: true // Custom flag to hide from UI
            };
            staff.push(superAdmin);
            this.set(this.keys.STAFF, staff);
        }

        if (!localStorage.getItem(this.keys.LAST_BILL)) {
            localStorage.setItem(this.keys.LAST_BILL, '0');
        }

        if (!localStorage.getItem(this.keys.EXPENSES)) {
            localStorage.setItem(this.keys.EXPENSES, JSON.stringify([]));
        }
        if (!localStorage.getItem(this.keys.PURCHASES)) {
            localStorage.setItem(this.keys.PURCHASES, JSON.stringify([]));
        }
        if (!localStorage.getItem(this.keys.DAILY_LOGS)) {
            localStorage.setItem(this.keys.DAILY_LOGS, JSON.stringify([]));
        }
    }

    // Generic Get/Set
    get(key) { return JSON.parse(localStorage.getItem(key)) || []; }
    set(key, data) { localStorage.setItem(key, JSON.stringify(data)); }

    // Specific CRUD
    getProducts() { return this.get(this.keys.PRODUCTS); }
    saveProduct(product) {
        const products = this.getProducts();
        const index = products.findIndex(p => p.id === product.id);
        if (index > -1) products[index] = product;
        else products.push(product);
        this.set(this.keys.PRODUCTS, products);
    }
    deleteProduct(id) {
        const products = this.getProducts().filter(p => p.id !== id);
        this.set(this.keys.PRODUCTS, products);
    }

    importProducts(newProducts) {
        const products = this.getProducts();
        let added = 0;
        let updated = 0;

        newProducts.forEach(p => {
            // Basic validation
            if (!p.name || !p.price) return;

            const existingIndex = products.findIndex(ep => ep.name.toLowerCase() === p.name.toLowerCase());

            if (existingIndex > -1) {
                // Update existing
                const existing = products[existingIndex];
                existing.stock += (parseInt(p.stock) || 0);
                existing.price = parseFloat(p.price);
                if (p.salesPrice) existing.salesPrice = parseFloat(p.salesPrice);
                if (p.purchasePrice) existing.purchasePrice = parseFloat(p.purchasePrice);
                if (p.category) existing.category = p.category;
                products[existingIndex] = existing;
                updated++;
            } else {
                // Add new
                products.push({
                    id: generateId(),
                    name: p.name,
                    category: p.category || 'Uncategorized',
                    price: parseFloat(p.price),
                    salesPrice: parseFloat(p.salesPrice || p.price),
                    purchasePrice: parseFloat(p.purchasePrice || 0),
                    stock: parseInt(p.stock) || 0,
                    unit: p.unit || 'pcs'
                });
                added++;
            }
        });

        this.set(this.keys.PRODUCTS, products);
        return { added, updated };
    }

    getStaff() { return this.get(this.keys.STAFF); }
    saveStaff(staffMember) {
        const staff = this.getStaff();
        const index = staff.findIndex(s => s.id === staffMember.id);
        if (index > -1) staff[index] = staffMember;
        else staff.push(staffMember);
        this.set(this.keys.STAFF, staff);
    }
    deleteStaff(id) {
        const staff = this.getStaff().filter(s => s.id !== id);
        this.set(this.keys.STAFF, staff);
    }

    getSettings() { return JSON.parse(localStorage.getItem(this.keys.SETTINGS)); }
    saveSettings(settings) { localStorage.setItem(this.keys.SETTINGS, JSON.stringify(settings)); }

    addSale(sale) {
        const sales = this.get(this.keys.SALES);
        sales.push(sale);
        this.set(this.keys.SALES, sales);

        // Update Bill Number (Monotonic check)
        const currentLast = parseInt(localStorage.getItem(this.keys.LAST_BILL) || '0');
        if (sale.billNo > currentLast) {
            localStorage.setItem(this.keys.LAST_BILL, sale.billNo.toString());
        }

        // Update Stock
        const products = this.getProducts();
        sale.items.forEach(item => {
            const pIndex = products.findIndex(p => p.id === item.id);
            if (pIndex > -1) {
                products[pIndex].stock -= item.qty;
            }
        });
        this.set(this.keys.PRODUCTS, products);
    }

    getNextBillNo() {
        const last = parseInt(localStorage.getItem(this.keys.LAST_BILL) || '0');
        return last + 1;
    }

    addPurchase(purchase) {
        const purchases = this.get(this.keys.PURCHASES) || [];
        purchases.push(purchase);
        this.set(this.keys.PURCHASES, purchases);

        // Automatically update stock for purchased items
        const products = this.getProducts();
        purchase.items.forEach(item => {
            const pIndex = products.findIndex(p => p.id === item.productId);
            if (pIndex > -1) {
                products[pIndex].stock += item.quantity;
                if (item.purchasePrice) {
                    products[pIndex].purchasePrice = item.purchasePrice;
                }
            }
        });
        this.set(this.keys.PRODUCTS, products);
    }

    getDailyLog(date) {
        const logs = this.get(this.keys.DAILY_LOGS) || [];
        return logs.find(l => l.date === date);
    }

    saveDailyLog(log) {
        const logs = this.get(this.keys.DAILY_LOGS) || [];
        const index = logs.findIndex(l => l.date === log.date);
        if (index > -1) logs[index] = log;
        else logs.push(log);
        this.set(this.keys.DAILY_LOGS, logs);
    }
}

// --- 3. UI Class ---
class UI {
    constructor() {
        // Cache DOM elements
        this.productGrid = document.getElementById('product-grid');
        this.cartItems = document.getElementById('cart-items');
        this.subtotalEl = document.getElementById('subtotal-display');
        this.totalEl = document.getElementById('total-display');
        this.catFilterContainer = document.getElementById('category-filters');
    }

    renderProducts(products, addToCartCallback) {
        this.productGrid.innerHTML = '';
        products.forEach(p => {
            const card = document.createElement('div');
            card.className = `product-card ${p.stock <= 5 ? 'low-stock-border' : ''}`;
            card.innerHTML = `
                ${p.image ? `<img src="${p.image}" class="product-img-display" style="width:100%; height:55px; object-fit:cover; border-radius:4px 4px 0 0; margin-bottom: 2px;">` : ''}
                <div class="product-name" title="${p.name}">${p.name}</div>
                <div style="width: 100%; display: flex; justify-content: space-between; align-items: flex-end; padding: 0 4px;">
                    <span class="product-price" style="font-size: 0.9rem;">₹${p.salesPrice || p.price}/${p.unit || 'pcs'}</span>
                    <span class="product-stock ${p.stock <= 5 ? 'low-stock' : ''}" style="font-size: 0.75rem;">${p.stock} left</span>
                </div>
             `;
            card.onclick = () => addToCartCallback(p);
            this.productGrid.appendChild(card);
        });
    }

    renderCart(cart, updateCallback) {
        this.cartItems.innerHTML = '';
        if (cart.length === 0) {
            this.cartItems.innerHTML = '<div class="empty-cart-msg">Cart is empty</div>';
            return;
        }

        cart.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <div class="item-details">
                    <h4>${item.name}</h4>
                    <small>₹${item.price}/${item.unit || 'pcs'} x ${item.qty}</small>
                </div>
                <div class="item-controls">
                    <button class="qty-btn minus" data-idx="${index}">-</button>
                    <span>${item.qty}</span>
                    <button class="qty-btn plus" data-idx="${index}">+</button>
                    <button class="remove-btn" data-idx="${index}">×</button>
                </div>
            `;
            this.cartItems.appendChild(div);
        });

        // Event delegation for cart controls
        this.cartItems.querySelectorAll('.qty-btn, .remove-btn').forEach(btn => {
            btn.onclick = (e) => {
                const idx = parseInt(e.target.dataset.idx);
                if (e.target.classList.contains('minus')) updateCallback(idx, -1);
                else if (e.target.classList.contains('plus')) updateCallback(idx, 1);
                else if (e.target.classList.contains('remove-btn')) updateCallback(idx, 0);
            };
        });
    }

    updateTotals(subtotal, tax, total, discount) {
        this.subtotalEl.textContent = formatMoney(subtotal);
        document.getElementById('gst-display').textContent = formatMoney(tax);
        document.getElementById('discount-display').textContent = formatMoney(discount);
        this.totalEl.textContent = formatMoney(total);
        document.getElementById('checkout-total').textContent = formatMoney(total);
    }

    showSection(sectionId) {
        document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active')); // Safety

        const target = document.getElementById(`${sectionId}-section`);
        if (target) {
            target.classList.remove('hidden');
            target.classList.add('active'); // For CSS animations
        }

        // Nav active state
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const navItem = document.querySelector(`.nav-item[data-target="${sectionId}"]`);
        if (navItem) navItem.classList.add('active');
    }

    populateCategories(products) {
        // Unique categories
        const cats = [...new Set(products.map(p => p.category))];
        const selectEl = document.getElementById('category-filter');
        if (!selectEl) return;

        // Keep "All Categories" and add others
        selectEl.innerHTML = '<option value="all">All Categories</option>';
        cats.forEach(c => {
            const option = document.createElement('option');
            option.value = c.toLowerCase();
            option.textContent = c.charAt(0).toUpperCase() + c.slice(1);
            selectEl.appendChild(option);
        });
    }

    showModal(modalId) {
        document.getElementById('modal-overlay').classList.remove('hidden');
        document.getElementById(modalId).classList.remove('hidden');
    }

    hideModals() {
        document.getElementById('modal-overlay').classList.add('hidden');
        document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    }

    // --- UI INVENTORY ---
    renderInventoryTable(products, editCallback, deleteCallback) {
        const tbody = document.querySelector('#inventory-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        // Get low stock threshold from settings
        const threshold = parseInt(localStorage.getItem('SETTINGS') ? JSON.parse(localStorage.getItem('SETTINGS')).lowStockThreshold : 10) || 10;

        products.forEach(p => {
            const tr = document.createElement('tr');

            // Determine stock status
            let stockStatus = '';
            let stockColor = '';
            if (p.stock === 0) {
                stockStatus = '<span style="background: #e74c3c; color: white; padding: 2px 8px; border-radius: 3px; font-size: 11px;">⚠️ OUT</span>';
                stockColor = '#e74c3c';
            } else if (p.stock <= threshold) {
                stockStatus = '<span style="background: #f39c12; color: white; padding: 2px 8px; border-radius: 3px; font-size: 11px;">⚡ LOW</span>';
                stockColor = '#f39c12';
            } else {
                stockStatus = '<span style="background: #27ae60; color: white; padding: 2px 8px; border-radius: 3px; font-size: 11px;">✓ OK</span>';
                stockColor = '#27ae60';
            }

            tr.innerHTML = `
                <td>${p.name}</td>
                <td>${p.category}</td>
                <td>${p.unit || 'pcs'}</td>
                <td>₹${p.purchasePrice || p.price || 0}</td>
                <td>₹${p.salesPrice || p.price || 0}</td>
                <td>
                    <span style="font-weight: bold; color: ${stockColor};">${p.stock}</span>
                    ${stockStatus}
                </td>
                <td>
                    <button class="btn btn-secondary btn-sm edit-btn">Edit</button>
                    <button class="btn btn-danger btn-sm delete-btn">Del</button>
                </td>
            `;
            // Bind events
            tr.querySelector('.edit-btn').onclick = () => editCallback(p);
            tr.querySelector('.delete-btn').onclick = () => deleteCallback(p.id);
            tbody.appendChild(tr);
        });
    }

    renderProductForm(product = null) {
        const isEdit = !!product;
        return `
            <input type="hidden" id="prod-id" value="${isEdit ? product.id : ''}">
            <div class="form-group">
                <label>Product Name</label>
                <input type="text" id="prod-name" value="${isEdit ? product.name : ''}" required>
            </div>
            <div class="form-group">
                <label>Image</label>
                <input type="file" id="prod-image" accept="image/*">
                ${isEdit && product.image ? `<img src="${product.image}" style="max-height:50px; display:block; margin-top:5px;">` : ''}
                <input type="hidden" id="prod-image-hidden" value="${isEdit && product.image ? product.image : ''}">
            </div>
            <div class="form-group">
                <label>Category (Type new or select)</label>
                <input type="text" id="prod-category" list="cat-list" value="${isEdit ? product.category : ''}" required>
                <datalist id="cat-list">
                    <!-- Populated dynamically -->
                </datalist>
            </div>
            <div class="form-group">
                <label>Unit</label>
                <select id="prod-unit">
                    <option value="pcs" ${isEdit && product.unit === 'pcs' ? 'selected' : ''}>Pieces (pcs)</option>
                    <option value="pkt" ${isEdit && product.unit === 'pkt' ? 'selected' : ''}>Packet</option>
                    <option value="bun" ${isEdit && product.unit === 'bun' ? 'selected' : ''}>Bundle</option>
                    <option value="box" ${isEdit && product.unit === 'box' ? 'selected' : ''}>Box</option>
                    <option value="dozen" ${isEdit && product.unit === 'dozen' ? 'selected' : ''}>Dozen</option>
                    <option disabled>--- Weight ---</option>
                    <option value="1kg" ${isEdit && product.unit === '1kg' ? 'selected' : ''}>1 Kg</option>
                    <option value="500g" ${isEdit && product.unit === '500g' ? 'selected' : ''}>500 g (Half Kg)</option>
                    <option value="250g" ${isEdit && product.unit === '250g' ? 'selected' : ''}>250 g</option>
                    <option value="100g" ${isEdit && product.unit === '100g' ? 'selected' : ''}>100 g</option>
                    <option value="kg" ${isEdit && product.unit === 'kg' ? 'selected' : ''}>Kilogram (Custom)</option>
                    <option disabled>--- Volume ---</option>
                    <option value="1L" ${isEdit && product.unit === '1L' ? 'selected' : ''}>1 Liter</option>
                    <option value="500ml" ${isEdit && product.unit === '500ml' ? 'selected' : ''}>500 ml (Half Liter)</option>
                    <option value="250ml" ${isEdit && product.unit === '250ml' ? 'selected' : ''}>250 ml</option>
                    <option value="L" ${isEdit && product.unit === 'L' ? 'selected' : ''}>Liter (Custom)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Purchase Price (₹)</label>
                <input type="number" step="0.01" id="prod-purchase-price" value="${isEdit ? (product.purchasePrice || product.price || '') : ''}" required>
            </div>
            <div class="form-group">
                <label>Sales Price (₹)</label>
                <input type="number" step="0.01" id="prod-sales-price" value="${isEdit ? (product.salesPrice || product.price || '') : ''}" required>
            </div>
             <div class="form-group">
                <label>Stock Qty</label>
                <input type="number" id="prod-stock" value="${isEdit ? product.stock : ''}" required>
            </div>
        `;
    }

    renderStaffTable(staff, editCallback, deleteCallback) {
        const tbody = document.querySelector('#staff-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        staff.forEach(s => {
            if (s.isHidden) return; // Skip hidden users (Super Admin)

            // Calculate attendance for current month
            const attendanceCount = (s.attendanceRecords || []).reduce((total, record) => {
                const recordDate = new Date(record.date);
                if (recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear) {
                    // Handle both old format (present boolean) and new format (status string)
                    if (record.status === 'present' || (record.present === true && !record.status)) {
                        return total + 1;
                    } else if (record.status === 'halfday') {
                        return total + 0.5;
                    }
                }
                return total;
            }, 0);

            // Check salary payment status for current month
            const salaryPaid = (s.salaryPayments || []).some(payment =>
                payment.month === currentMonth &&
                payment.year === currentYear &&
                payment.paid
            );

            const statusClass = salaryPaid ? 'salary-paid' : 'salary-pending';
            const statusText = salaryPaid ? 'Paid' : 'Pending';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${s.name}</td>
                <td>${s.role}</td>
                <td>****</td>
                <td>₹${s.salary}</td>
                <td>${attendanceCount} days</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <button class="btn btn-secondary btn-sm edit-btn">Edit</button>
                    <button class="btn btn-sm attendance-btn" style="background: #4CAF50; color: white;">Attd</button>
                    <button class="btn btn-sm finance-btn" style="background: #2196F3; color: white;">Finance</button>
                    ${s.role !== 'Admin' ? '<button class="btn btn-danger btn-sm delete-btn">Del</button>' : ''}
                </td>
            `;
            tr.querySelector('.edit-btn').onclick = () => editCallback(s);
            tr.querySelector('.attendance-btn').onclick = () => this.showAttendanceModal(s);
            tr.querySelector('.finance-btn').onclick = () => this.showFinanceModal(s);
            if (s.role !== 'Admin') {
                tr.querySelector('.delete-btn').onclick = () => deleteCallback(s.id);
            }
            tbody.appendChild(tr);
        });
    }

    showAttendanceModal(staff) {
        document.getElementById('attendance-staff-id').value = staff.id;
        document.getElementById('attendance-staff-name').textContent = staff.name;
        document.getElementById('attendance-date').value = getTodayDate();
        document.getElementById('attendance-status').value = 'present';

        document.getElementById('modal-overlay').classList.remove('hidden');
        document.getElementById('attendance-modal').classList.remove('hidden');
    }

    calculateMonthlyAttendance(staff, month, year) {
        const salaryMonth = parseInt(month);
        const salaryYear = parseInt(year);

        return (staff.attendanceRecords || []).reduce((total, record) => {
            const recordDate = new Date(record.date);
            if (recordDate.getMonth() === salaryMonth && recordDate.getFullYear() === salaryYear) {
                if (record.status === 'present' || (record.present === true && !record.status)) {
                    return total + 1;
                } else if (record.status === 'halfday') {
                    return total + 0.5;
                }
            }
            return total;
        }, 0);
    }

    calculatePayableSalary(staff, month, year) {
        if (!staff.salary) return { amount: 0, daysPresent: 0, daysInMonth: 30, dailyRate: 0 };

        const daysPresent = this.calculateMonthlyAttendance(staff, month, year);
        const daysInMonth = getDaysInMonth(month, year);
        const dailyRate = staff.salary / daysInMonth;
        const amount = Math.round(dailyRate * daysPresent); // Round to nearest integer

        return { amount, daysPresent, daysInMonth, dailyRate };
    }

    showFinanceModal(staff) {
        // IDs
        document.getElementById('finance-staff-id').value = staff.id;
        document.getElementById('finance-staff-name').textContent = staff.name;

        // --- Tab Logic ---
        const tabSal = document.getElementById('tab-salary');
        const tabTrans = document.getElementById('tab-transactions');
        const pSal = document.getElementById('panel-salary');
        const pTrans = document.getElementById('panel-transactions');

        const switchTab = (mode) => {
            if (mode === 'salary') {
                tabSal.style.background = '#2196F3'; tabSal.style.color = 'white';
                tabTrans.style.background = '#e0e0e0'; tabTrans.style.color = '#333';
                pSal.classList.remove('hidden');
                pTrans.classList.add('hidden');
            } else {
                tabTrans.style.background = '#2196F3'; tabTrans.style.color = 'white';
                tabSal.style.background = '#e0e0e0'; tabSal.style.color = '#333';
                pTrans.classList.remove('hidden');
                pSal.classList.add('hidden');
            }
        };

        tabSal.onclick = () => switchTab('salary');
        tabTrans.onclick = () => switchTab('transactions');
        switchTab('salary'); // Default

        // --- Salary Section Setup ---
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        document.getElementById('salary-month').value = currentMonth;
        document.getElementById('salary-year').value = currentYear;

        // Auto-calculate logic
        const updateCalculation = () => {
            const m = parseInt(document.getElementById('salary-month').value);
            const y = parseInt(document.getElementById('salary-year').value);
            const calc = this.calculatePayableSalary(staff, m, y);
            document.getElementById('salary-amount').value = calc.amount;

            const detailsDiv = document.getElementById('salary-calc-details');
            if (detailsDiv) {
                if (staff.salary > 0) {
                    detailsDiv.innerHTML = `Calculated: ₹${staff.salary} ÷ ${calc.daysInMonth} × ${calc.daysPresent} = <strong>₹${calc.amount}</strong>`;
                } else detailsDiv.textContent = '';
            }
        };
        updateCalculation();

        // Event Listeners for Salary inputs
        const mSelect = document.getElementById('salary-month');
        const yInput = document.getElementById('salary-year');
        const newM = mSelect.cloneNode(true);
        const newY = yInput.cloneNode(true);
        mSelect.parentNode.replaceChild(newM, mSelect);
        yInput.parentNode.replaceChild(newY, yInput);
        newM.onchange = updateCalculation;
        newY.onchange = updateCalculation;
        newY.oninput = updateCalculation;

        // Payment info display
        const payments = staff.salaryPayments || [];
        const currentPayment = payments.find(p => p.month === currentMonth && p.year === currentYear);
        const infoDiv = document.getElementById('salary-payment-info');
        if (currentPayment && currentPayment.paid) {
            infoDiv.innerHTML = `<div style="background: #4CAF50; color: white; padding: 10px; border-radius: 4px; margin-bottom: 15px;">Paid on ${new Date(currentPayment.paidDate).toLocaleDateString()}</div>`;
        } else {
            infoDiv.innerHTML = `<div style="background: #ff9800; color: white; padding: 10px; border-radius: 4px; margin-bottom: 15px;">Pending</div>`;
        }

        // --- Transactions Section Setup ---
        document.getElementById('trans-type').value = 'bonus';
        document.getElementById('trans-amount').value = '';
        document.getElementById('trans-date').value = getTodayDate();
        document.getElementById('trans-notes').value = '';

        // Render History
        this.updateFinanceHistory(staff);

        document.getElementById('modal-overlay').classList.remove('hidden');
        document.getElementById('finance-modal').classList.remove('hidden');
    }

    updateFinanceHistory(staff) {
        const tbody = document.querySelector('#finance-history-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const recs = staff.financialRecords || [];
        recs.sort((a, b) => new Date(b.date) - new Date(a.date));

        recs.forEach(r => {
            let color = 'black';
            let icon = '';
            if (r.type === 'bonus') { color = 'green'; icon = '🎁'; }
            else if (r.type === 'advance') { color = 'red'; icon = '💸'; }
            else if (r.type === 'return') { color = 'blue'; icon = '🔙'; }

            tbody.innerHTML += `
                <tr>
                    <td>${r.date}</td>
                    <td><span style="color:${color}">${icon} ${r.type.toUpperCase()}</span></td>
                    <td>${formatMoney(r.amount)}</td>
                    <td>${r.notes || '-'}</td>
                </tr>
            `;
        });
        if (recs.length === 0) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">No records</td></tr>';
    }

    renderStaffForm(staff = null) {
        const isEdit = !!staff;
        return `
            <input type="hidden" id="staff-id" value="${isEdit ? staff.id : ''}">
            <div class="form-group">
                <label>Name</label>
                <input type="text" id="staff-name" value="${isEdit ? staff.name : ''}" required>
            </div>
             <div class="form-group">
                <label>Role</label>
                <select id="staff-role">
                    <option value="Staff" ${isEdit && staff.role === 'Staff' ? 'selected' : ''}>Staff</option>
                    <option value="Admin" ${isEdit && staff.role === 'Admin' ? 'selected' : ''}>Admin</option>
                </select>
            </div>
            <div class="form-group">
                <label>Username</label>
                <input type="text" id="staff-username" value="${isEdit ? (staff.username || '') : ''}" required>
            </div>
            <div class="form-group">
                <label>Password</label>
                <input type="password" id="staff-password" value="${isEdit ? staff.password : ''}" required>
            </div>
            <div class="form-group">
                <label>Salary (Monthly)</label>
                <input type="number" id="staff-salary" value="${isEdit ? staff.salary : ''}">
            </div>
        `;
    }
}

// --- 4. Main App Logic ---
class App {
    constructor() {
        this.store = new Store();
        this.ui = new UI();

        this.state = {
            currentUser: null,
            cart: [],
            currentCategory: null,
            searchTerm: '',
            currentCategory: null,
            searchTerm: '',
            editingBillNo: null,
            settings: this.store.getSettings()
        };

        this.initEventListeners();
        this.checkAuth(); // Initializes app flow
    }

    initEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item:not(.logout-btn)').forEach(item => {
            item.onclick = () => {
                this.ui.showSection(item.dataset.target);
                if (item.dataset.target === 'inventory') this.loadInventory();
                else if (item.dataset.target === 'categories') this.loadCategories();
                else if (item.dataset.target === 'staff') this.loadStaff();
                else if (item.dataset.target === 'reports') this.loadReports();
            };
        });

        // Category Filter
        const categoryFilter = document.getElementById('category-filter');
        if (categoryFilter) {
            categoryFilter.onchange = () => {
                this.state.currentCategory = categoryFilter.value === 'all' ? null : categoryFilter.value;
                this.loadProducts();
            };
        }

        // Product Search
        const productSearch = document.getElementById('product-search');
        if (productSearch) {
            productSearch.oninput = () => {
                this.state.searchTerm = productSearch.value.toLowerCase();
                this.loadProducts();
            };
        }

        // Logout
        document.getElementById('logout-btn').onclick = () => this.logout();

        // Auth Logic
        document.getElementById('login-btn').onclick = (e) => {
            e.preventDefault();
            this.handleLogin();
        };

        // Allow Enter key on password field
        document.getElementById('login-password').onkeyup = (e) => {
            if (e.key === 'Enter') this.handleLogin();
        };

        // Cart Actions
        document.getElementById('checkout-btn').onclick = () => {
            if (this.state.cart.length === 0) return alert('Cart is empty!');
            this.showCheckoutModal();
        };

        // Modal Close
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.onclick = () => this.ui.hideModals();
        });

        // Payment Mode
        document.querySelectorAll('.pay-mode-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.pay-mode-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');

                // Toggle QR Display
                const qrDisplay = document.getElementById('upi-qr-display');
                if (btn.dataset.mode === 'upi' && this.state.settings.upiQr) {
                    if (document.getElementById('checkout-qr-img')) document.getElementById('checkout-qr-img').src = this.state.settings.upiQr;
                    if (qrDisplay) qrDisplay.classList.remove('hidden');
                } else {
                    if (qrDisplay) qrDisplay.classList.add('hidden');
                }
            };
        });

        // Confirm Payment
        document.getElementById('confirm-pay-btn').onclick = () => this.processCheckout();

        // Attendance Marking
        document.getElementById('save-attendance-btn').onclick = () => this.saveAttendance();

        // Salary Payment Marking
        document.getElementById('mark-salary-paid-btn').onclick = () => this.markSalaryPaid();

        // Financial Transactions
        document.getElementById('save-trans-btn').onclick = () => this.saveFinancialTransaction();

        // Expense Recording
        document.getElementById('add-expense-btn').onclick = () => this.showExpenseModal();
        document.getElementById('save-expense-btn').onclick = () => this.saveExpense();

        // Purchase Event Listeners
        document.getElementById('add-purchase-btn').onclick = () => this.showPurchaseModal();
        document.getElementById('add-purchase-item-btn').onclick = () => this.addPurchaseItem();
        document.getElementById('save-purchase-btn').onclick = () => this.savePurchase();

        // Category Event Listeners
        document.getElementById('add-category-btn').onclick = () => this.showCategoryModal();
        document.getElementById('save-category-btn').onclick = () => this.saveCategory();

        // Stock Filter Event Listeners
        document.getElementById('stock-filter-all').onclick = () => {
            this.state.stockFilter = 'all';
            this.loadInventory();
        };
        document.getElementById('stock-filter-instock').onclick = () => {
            this.state.stockFilter = 'instock';
            this.loadInventory();
        };
        document.getElementById('stock-filter-low').onclick = () => {
            this.state.stockFilter = 'low';
            this.loadInventory();
        };
        document.getElementById('stock-filter-out').onclick = () => {
            this.state.stockFilter = 'out';
            this.loadInventory();
        };

        // Settings Actions (Wrapped for safety)
        try {
            document.getElementById('save-settings-btn').onclick = () => this.saveSettings();
            document.getElementById('backup-btn').onclick = () => this.backupData();

            // Excel Import
            const importBtn = document.getElementById('import-excel-btn');
            const importInput = document.getElementById('import-excel-input');

            if (importBtn && importInput) {
                importBtn.onclick = () => importInput.click();
                importInput.onchange = (e) => this.handleExcelImport(e);
            }
            // Template Download
            const templateBtn = document.getElementById('download-template-btn');
            if (templateBtn) {
                templateBtn.onclick = () => this.downloadTemplate();
            }

            document.getElementById('restore-btn').onclick = () => document.getElementById('restore-file').click();
            document.getElementById('restore-file').onchange = (e) => this.restoreData(e);
            document.getElementById('reset-btn').onclick = () => this.factoryReset();
        } catch (e) { console.error("Settings listener error", e); }

        // Inventory Actions
        document.getElementById('add-product-btn').onclick = () => this.openProductModal();
        document.getElementById('form-save-btn').onclick = () => {
            // Determine which save action to take based on visible modal content or ID
            if (document.getElementById('prod-name')) this.saveProduct();
            else if (document.getElementById('staff-name')) this.saveStaff();
        };

        document.getElementById('add-staff-btn').onclick = () => this.openStaffModal();

        // Reports Actions
        document.getElementById('report-date').onchange = () => this.loadReports();
        document.getElementById('report-search').oninput = () => this.loadReports();
        document.getElementById('export-excel-btn').onclick = () => this.exportReports();
        const openBalBtn = document.getElementById('opening-balance-btn');
        if (openBalBtn) openBalBtn.onclick = () => this.openOpeningBalanceModal();
        const saveBalBtn = document.getElementById('save-opening-balance-btn');
        if (saveBalBtn) saveBalBtn.onclick = () => this.saveOpeningBalance();
    }

    checkAuth() {
        // Ideally checking session, for now just show Login
        document.getElementById('app').classList.remove('hidden');
    }

    handleLogin() {
        const userIn = document.getElementById('login-username').value;
        const passIn = document.getElementById('login-password').value;
        const errorMsg = document.getElementById('login-error');

        const staff = this.store.getStaff();
        // Check username (case-insensitive) and password (case-sensitive)
        const user = staff.find(u => u.username && u.username.toLowerCase() === userIn.toLowerCase() && u.password === passIn);

        if (user) {
            this.state.currentUser = user;
            document.getElementById('auth-section').classList.add('hidden');
            document.getElementById('dashboard-container').classList.remove('hidden');

            // Personalize
            document.getElementById('current-user-name').textContent = user.name;
            document.getElementById('current-user-role').textContent = user.role;

            errorMsg.style.display = 'none';
            this.loadDashboard();
        } else {
            errorMsg.style.display = 'block';
            document.getElementById('login-password').value = '';
        }
    }

    logout() {
        // Confirm Backup
        if (confirm("Do you want to backup data to Excel before logging out?")) {
            try {
                this.backupData();
            } catch (e) {
                console.error("Backup failed during logout:", e);
                alert("Backup failed, but logging out anyway. Please check console for details.");
            }
        }

        this.state.currentUser = null;
        document.getElementById('dashboard-container').classList.add('hidden');
        document.getElementById('auth-section').classList.remove('hidden');
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
        document.getElementById('login-error').style.display = 'none';
        this.state.editingBillNo = null; // Reset edit state
    }

    loadDashboard() {
        // Load settings to ensure latest GST etc.
        this.state.settings = this.store.getSettings();

        // Role-based navigation visibility
        const isAdmin = this.state.currentUser.role === 'Admin';
        document.querySelectorAll('.admin-only').forEach(item => {
            if (isAdmin) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });

        // If Staff, force to billing section
        if (!isAdmin) {
            this.ui.showSection('billing');
        }

        // Fill Settings Form
        document.getElementById('shop-name').value = this.state.settings.shopName || '';
        document.getElementById('shop-address').value = this.state.settings.address || '';
        document.getElementById('shop-gst').value = this.state.settings.gstNo || '';
        document.getElementById('shop-gst-percent').value = this.state.settings.defaultGstPercent || 0;
        document.getElementById('print-logo-check').checked = this.state.settings.printLogo !== false; // Default true
        document.getElementById('print-tax-check').checked = this.state.settings.printTax !== false; // Default true
        document.getElementById('low-stock-threshold').value = this.state.settings.lowStockThreshold || 10;

        // Load Logo Preview
        if (this.state.settings.logo) {
            document.getElementById('logo-preview').src = this.state.settings.logo;
            document.getElementById('logo-preview').style.display = 'block';
            document.getElementById('shop-logo-data').value = this.state.settings.logo;
        }
        // Load QR Preview
        if (this.state.settings.upiQr) {
            document.getElementById('qr-preview').src = this.state.settings.upiQr;
            document.getElementById('qr-preview').style.display = 'block';
            document.getElementById('shop-qr-data').value = this.state.settings.upiQr;
        }

        // Update Bill Number Display
        const nextBillNo = this.store.getNextBillNo();
        document.getElementById('bill-no').textContent = `#${nextBillNo.toString().padStart(4, '0')}`;

        // Render Billing (Default)
        this.loadProducts();

        // Populate Filters
        const products = this.store.getProducts();
        this.ui.populateCategories(products);

        this.updateCart(); // Clear UI if persistence needed
    }

    saveSettings() {
        if (this.state.currentUser.role !== 'Admin') {
            alert('Only Admin can save settings.');
            return;
        }

        const logoInput = document.getElementById('shop-logo');
        const qrInput = document.getElementById('shop-qr');

        const readFile = (file) => {
            return new Promise((resolve) => {
                if (!file) resolve(null);
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file);
            });
        };

        Promise.all([
            logoInput.files[0] ? readFile(logoInput.files[0]) : Promise.resolve(document.getElementById('shop-logo-data').value),
            qrInput.files[0] ? readFile(qrInput.files[0]) : Promise.resolve(document.getElementById('shop-qr-data').value)
        ]).then(([logoData, qrData]) => {
            const newSettings = {
                ...this.state.settings,
                shopName: document.getElementById('shop-name').value,
                address: document.getElementById('shop-address').value,
                gstNo: document.getElementById('shop-gst').value,
                defaultGstPercent: parseFloat(document.getElementById('shop-gst-percent').value) || 0,
                logo: logoData,
                upiQr: qrData,
                printLogo: document.getElementById('print-logo-check').checked,
                printTax: document.getElementById('print-tax-check').checked,
                lowStockThreshold: parseInt(document.getElementById('low-stock-threshold').value) || 10
            };

            this.store.saveSettings(newSettings);
            this.state.settings = newSettings;
            alert('Settings Saved!');
            this.updateCart(); // Re-calc with new GST
        });
    }

    // backupDataJSON() { ... } // Legacy JSON backup removed in favor of Excel

    restoreData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const extension = file.name.split('.').pop().toLowerCase();

        if (extension === 'json') {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.settings && data.products) {
                        if (!confirm('This will overwrite current data. Continue?')) return;

                        this.store.saveSettings(data.settings);
                        this.store.set(this.store.keys.PRODUCTS, data.products);
                        this.store.set(this.store.keys.STAFF, data.staff || []);
                        this.store.set(this.store.keys.SALES, data.sales || []);
                        this.store.set(this.store.keys.EXPENSES, data.expenses || []);
                        this.store.set(this.store.keys.PURCHASES, data.purchases || []);
                        if (data.lastBill) localStorage.setItem(this.store.keys.LAST_BILL, data.lastBill);

                        alert('Restore Successful! App will reload.');
                        location.reload();
                    } else {
                        alert('Invalid Backup File');
                    }
                } catch (err) {
                    alert('Error parsing file');
                }
            };
            reader.readAsText(file);
        } else if (['xlsx', 'xls'].includes(extension)) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const wb = XLSX.read(data, { type: 'array' });
                    const restoredData = {};

                    // Helpers
                    const sheetToJson = (name) => wb.Sheets[name] ? XLSX.utils.sheet_to_json(wb.Sheets[name]) : [];

                    // 1. Settings
                    const settingsArr = sheetToJson("Settings");
                    if (settingsArr.length > 0) {
                        const settings = {};
                        settingsArr.forEach(row => {
                            // Convert string bools back if necessary, though usually they are preserved
                            if (row.Key === 'lastBill') {
                                restoredData.lastBill = row.Value;
                            } else {
                                settings[row.Key] = row.Value;
                            }
                        });
                        // Basic Type Conversion
                        if (settings.defaultGstPercent) settings.defaultGstPercent = parseFloat(settings.defaultGstPercent);
                        if (settings.lowStockThreshold) settings.lowStockThreshold = parseInt(settings.lowStockThreshold);
                        if (settings.printLogo === 'TRUE' || settings.printLogo === true) settings.printLogo = true;
                        if (settings.printLogo === 'FALSE' || settings.printLogo === false) settings.printLogo = false;
                        if (settings.printTax === 'TRUE' || settings.printTax === true) settings.printTax = true;
                        if (settings.printTax === 'FALSE' || settings.printTax === false) settings.printTax = false;

                        restoredData.settings = settings;
                    }

                    // 2. Products
                    restoredData.products = sheetToJson("Products");

                    // 3. Staff
                    restoredData.staff = sheetToJson("Staff");

                    // 4. Sales
                    const rawSales = sheetToJson("Sales");
                    restoredData.sales = rawSales.map(s => {
                        if (s.items_json) {
                            try { s.items = JSON.parse(s.items_json); } catch (e) { console.error("Error parsing sales items", e); }
                        }
                        return s;
                    });

                    // 5. Expenses
                    restoredData.expenses = sheetToJson("Expenses");

                    // 6. Purchases
                    const rawPurchases = sheetToJson("Purchases");
                    restoredData.purchases = rawPurchases.map(p => {
                        if (p.items_json) {
                            try { p.items = JSON.parse(p.items_json); } catch (e) { console.error("Error parsing purchase items", e); }
                        }
                        return p;
                    });

                    if (restoredData.products.length > 0) {
                        if (!confirm('This will overwrite current data. Continue?')) return;

                        if (restoredData.settings) this.store.saveSettings(restoredData.settings);
                        this.store.set(this.store.keys.PRODUCTS, restoredData.products);
                        this.store.set(this.store.keys.STAFF, restoredData.staff);
                        this.store.set(this.store.keys.SALES, restoredData.sales);
                        this.store.set(this.store.keys.EXPENSES, restoredData.expenses);
                        this.store.set(this.store.keys.PURCHASES, restoredData.purchases);
                        if (restoredData.lastBill) localStorage.setItem(this.store.keys.LAST_BILL, restoredData.lastBill);

                        alert('Restore Successful! App will reload.');
                        location.reload();
                    } else {
                        alert('No products found in Excel backup. Please check sheet names.');
                    }

                } catch (err) {
                    console.error(err);
                    alert('Error parsing Excel file. Ensure valid format.');
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            alert('Invalid file format. Please upload .json or .xlsx');
        }
    }

    factoryReset() {
        if (!confirm('Are you sure? ALL DATA WILL BE LOST!')) return;
        localStorage.clear();
        location.reload();
    }

    // --- Inventory Methods ---
    loadInventory() {
        let products = this.store.getProducts();
        const threshold = this.state.settings.lowStockThreshold || 10;

        // Filter by stock status
        const filter = this.state.stockFilter || 'all';
        if (filter === 'instock') {
            products = products.filter(p => p.stock > threshold);
        } else if (filter === 'low') {
            products = products.filter(p => p.stock > 0 && p.stock <= threshold);
        } else if (filter === 'out') {
            products = products.filter(p => p.stock === 0);
        }

        this.ui.renderInventoryTable(products,
            (p) => this.openProductModal(p),
            (id) => {
                if (confirm('Delete Product?')) {
                    this.store.deleteProduct(id);
                    this.loadInventory();
                }
            }
        );
    }

    openProductModal(product = null) {
        const title = product ? 'Edit Product' : 'Add Product';
        document.getElementById('form-modal-title').textContent = title;
        document.getElementById('form-modal-body').innerHTML = this.ui.renderProductForm(product);

        // Populate Datalist
        const cats = [...new Set(this.store.getProducts().map(p => p.category))];
        const dl = document.getElementById('cat-list');
        if (dl) {
            dl.innerHTML = cats.map(c => `<option value="${c}">`).join('');
        }

        this.ui.showModal('form-modal');
    }

    saveProduct() {
        const id = document.getElementById('prod-id').value || generateId();
        const name = document.getElementById('prod-name').value;
        const category = document.getElementById('prod-category').value;
        const purchasePrice = parseFloat(document.getElementById('prod-purchase-price').value);
        const salesPrice = parseFloat(document.getElementById('prod-sales-price').value);
        const stock = parseInt(document.getElementById('prod-stock').value);
        const imageInput = document.getElementById('prod-image');
        const existingImage = document.getElementById('prod-image-hidden').value;

        if (!name || !category || isNaN(purchasePrice) || isNaN(salesPrice) || isNaN(stock)) {
            alert('Please fill all fields correctly');
            return;
        }

        const save = (base64Image) => {
            const unit = document.getElementById('prod-unit').value || 'pcs'; // Default to pieces
            const product = { id, name, category, unit, purchasePrice, salesPrice, price: salesPrice, stock, image: base64Image };
            this.store.saveProduct(product);
            this.ui.hideModals();
            this.loadInventory();
            this.loadDashboard();
        };

        if (imageInput.files && imageInput.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => save(e.target.result);
            reader.readAsDataURL(imageInput.files[0]);
        } else {
            save(existingImage);
        }
    }

    // --- Billing Methods ---
    showCheckoutModal() {
        // Recalculate Total
        const subtotal = this.state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const gstRate = parseFloat(this.state.settings.defaultGstPercent) || 0;
        const tax = (subtotal * gstRate) / 100;
        const total = Math.round(subtotal + tax);

        document.getElementById('checkout-total').textContent = formatMoney(total);
        this.ui.showModal('checkout-modal');
    }

    processCheckout() {
        const mode = document.querySelector('.pay-mode-btn.selected').dataset.mode;
        const customer = document.getElementById('cust-name-input').value || 'Guest';

        const subtotal = this.state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const gstRate = parseFloat(this.state.settings.defaultGstPercent) || 0;
        const tax = (subtotal * gstRate) / 100;
        const total = Math.round(subtotal + tax);

        const sale = {
            id: generateId(),
            billNo: this.state.editingBillNo ? this.state.editingBillNo : this.store.getNextBillNo(),
            date: getTimestamp(),
            items: [...this.state.cart], // Clone
            subtotal,
            tax,
            total,
            mode,
            customer,
            staffId: this.state.currentUser.id
        };

        this.store.addSale(sale);

        // Generate Receipt
        this.generateReceipt(sale);

        // Reset
        this.state.cart = [];
        this.state.editingBillNo = null;
        this.updateCart();
        this.ui.hideModals();
        this.loadDashboard(); // Update stock in grid
    }

    generateReceipt(sale) {
        const showLogo = this.state.settings.printLogo !== false;
        const showTax = this.state.settings.printTax !== false;
        const hasLogo = this.state.settings.logo && showLogo;
        const logoImg = hasLogo ? `<img src="${this.state.settings.logo}" style="max-height: 50px; max-width: 50px; margin-right: 10px;">` : '';

        // Header Section
        let headerHtml = '';
        const gstLine = showTax && this.state.settings.gstNo ? `<p style="margin:0; font-size: 11px;">GST: ${this.state.settings.gstNo}</p>` : '';
        const gstLinePlain = showTax && this.state.settings.gstNo ? `<p>GST: ${this.state.settings.gstNo}</p>` : '';

        if (hasLogo) {
            headerHtml = `
                <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
                    ${logoImg}
                    <div style="text-align: left;">
                        <h2 style="margin:0; font-size: 16px; font-weight: 800; text-transform: uppercase;">${this.state.settings.shopName}</h2>
                        <p style="margin:2px 0; font-size: 11px;">${this.state.settings.address}</p>
                        ${gstLine}
                    </div>
                </div>`;
        } else {
            headerHtml = `
                <div class="receipt-header">
                    <h2>${this.state.settings.shopName}</h2>
                    <p>${this.state.settings.address}</p>
                    ${gstLinePlain}
                </div>`;
        }

        // Customer Info
        const customerHtml = sale.customer && sale.customer !== 'Guest' ?
            `<div class="receipt-customer">Customer: <b>${sale.customer}</b></div>` : '';

        // Table Rows
        const rowsHtml = sale.items.map(i => `
            <tr>
                <td>
                    <div class="font-bold">${i.name}</div>
                    ${i.unit ? `<div style="font-size: 10px; color: #444;">${i.unit}</div>` : ''}
                </td>
                <td class="text-center">${i.qty}</td>
                <td class="text-right">${(i.price * i.qty).toFixed(2)}</td>
            </tr>
        `).join('');

        const receiptHtml = `
            <div class="receipt-content">
                ${headerHtml}
                
                <div class="receipt-info">
                    <div>Bill No: <b>#${sale.billNo}</b></div>
                    <div class="text-right">${new Date(sale.date).toLocaleDateString()} ${new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>

                ${customerHtml}

                <table class="receipt-table">
                    <thead>
                        <tr>
                            <th width="50%">Item</th>
                            <th width="20%" class="text-center">Qty</th>
                            <th width="30%" class="text-right">Amt</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>

                <div class="receipt-totals">
                    ${showTax ? `
                    <div class="totals-row">
                        <span>Subtotal</span>
                        <span>${sale.subtotal.toFixed(2)}</span>
                    </div>
                    <div class="totals-row">
                        <span>GST (${this.state.settings.defaultGstPercent}%)</span>
                        <span>${sale.tax.toFixed(2)}</span>
                    </div>` : ''}
                    
                    <div class="totals-row final">
                        <span>TOTAL</span>
                        <span>${sale.total.toFixed(2)}</span>
                    </div>
                </div>

                <div class="receipt-footer">
                    <p>*** Thank You ***</p>
                </div>
            </div>
        `;

        document.getElementById('receipt-container').innerHTML = receiptHtml;

        // Show receipt for printing
        const container = document.getElementById('receipt-container');
        container.classList.remove('hidden');

        window.print();

        // Hide again after print
        setTimeout(() => {
            container.classList.add('hidden');
            container.innerHTML = '';
        }, 500);
    }

    loadProducts() {
        let products = this.store.getProducts();

        // Filter by category
        if (this.state.currentCategory) {
            products = products.filter(p => p.category.toLowerCase() === this.state.currentCategory);
        }

        // Filter by search term
        if (this.state.searchTerm) {
            products = products.filter(p => p.name.toLowerCase().includes(this.state.searchTerm));
        }

        this.ui.renderProducts(products, (p) => this.addToCart(p));
    }

    addToCart(product) {
        // Stock Check
        const currentInCart = this.state.cart.find(i => i.id === product.id)?.qty || 0;
        if (currentInCart + 1 > product.stock) {
            alert('Insufficient Stock!');
            return;
        }

        const existing = this.state.cart.find(i => i.id === product.id);
        if (existing) {
            existing.qty++;
        } else {
            this.state.cart.push({ ...product, qty: 1 });
        }
        this.updateCart();
    }

    updateCartItem(index, change) {
        const item = this.state.cart[index];
        if (change === 0) {
            // Remove
            this.state.cart.splice(index, 1);
        } else {
            // Stock Check for increase
            if (change > 0 && item.qty + change > item.stock) {
                alert('Max stock reached');
                return;
            }
            item.qty += change;
            if (item.qty <= 0) this.state.cart.splice(index, 1);
        }
        this.updateCart();
    }

    updateCart() {
        this.ui.renderCart(this.state.cart, (idx, change) => this.updateCartItem(idx, change));

        // Calculations
        const subtotal = this.state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const gstRate = parseFloat(this.state.settings.defaultGstPercent) || 0;
        const tax = (subtotal * gstRate) / 100;
        // Logic can vary (Inclusive vs Exclusive). Assuming Exclusive for now as per "Add GST" typical flow
        const total = Math.round(subtotal + tax);

        this.ui.updateTotals(subtotal, tax, total, 0); // Discount 0 for now

        // Update display of tax rate
        document.getElementById('gst-rate-display').textContent = gstRate;
    }
    // --- Staff Methods ---
    loadStaff() {
        if (this.state.currentUser.role !== 'Admin') {
            document.querySelector('#add-staff-btn').classList.add('hidden');
        } else {
            document.querySelector('#add-staff-btn').classList.remove('hidden');
        }

        const staff = this.store.getStaff();
        this.ui.renderStaffTable(staff,
            (s) => this.openStaffModal(s),
            (id) => {
                if (confirm('Delete Staff?')) {
                    this.store.deleteStaff(id);
                    this.loadStaff();
                }
            }
        );
    }

    // --- Category Methods ---
    loadCategories() {
        const products = this.store.getProducts();

        // Extract unique categories and count products
        const categoriesMap = {};
        products.forEach(p => {
            const catName = p.category || 'Uncategorized';
            if (!categoriesMap[catName]) {
                categoriesMap[catName] = { name: catName, count: 0 };
            }
            categoriesMap[catName].count++;
        });

        const categories = Object.values(categoriesMap);

        // Render categories table
        const tbody = document.querySelector('#categories-table tbody');
        tbody.innerHTML = '';

        if (categories.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No categories yet. Add products to create categories.</td></tr>';
            return;
        }

        categories.forEach(cat => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${cat.name}</td>
                <td>${cat.count} products</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="app.editCategory('${cat.name.replace(/'/g, "\\'")}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteCategory('${cat.name.replace(/'/g, "\\'")}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    showCategoryModal(categoryName = null) {
        document.getElementById('category-modal-title').textContent = categoryName ? 'Edit Category' : 'Add Category';
        document.getElementById('category-id').value = categoryName || '';
        document.getElementById('category-name').value = categoryName || '';

        this.ui.showModal('category-modal');
    }

    editCategory(categoryName) {
        this.showCategoryModal(categoryName);
    }

    saveCategory() {
        const oldName = document.getElementById('category-id').value.trim();
        const newName = document.getElementById('category-name').value.trim();

        if (!newName) {
            alert('Please enter a category name');
            return;
        }

        const products = this.store.getProducts();

        if (oldName) {
            // Editing existing category - rename it
            products.forEach(p => {
                if (p.category === oldName) {
                    p.category = newName;
                }
            });
            this.store.set(this.store.keys.PRODUCTS, products);
            this.ui.hideModals();
            this.loadCategories();
            this.loadProducts(); // Refresh filters
            alert('Category updated successfully!');
        } else {
            // Just adding a new category name
            alert(`Category "${newName}" created. Assign products to this category in Inventory.`);
            this.ui.hideModals();
        }
    }

    deleteCategory(categoryName) {
        const products = this.store.getProducts();
        const productsInCat = products.filter(p => p.category === categoryName);

        if (productsInCat.length > 0) {
            if (!confirm(`This category has ${productsInCat.length} products. Delete anyway? Products will become "Uncategorized".`)) {
                return;
            }

            // Set products to Uncategorized
            products.forEach(p => {
                if (p.category === categoryName) {
                    p.category = 'Uncategorized';
                }
            });
            this.store.set(this.store.keys.PRODUCTS, products);
        }

        this.loadCategories();
        this.loadProducts(); // Refresh filters
        alert('Category deleted successfully!');
    }

    openStaffModal(staff = null) {
        if (this.state.currentUser.role !== 'Admin') return alert('Access Denied');

        const title = staff ? 'Edit Staff' : 'Add Staff';
        document.getElementById('form-modal-title').textContent = title;
        document.getElementById('form-modal-body').innerHTML = this.ui.renderStaffForm(staff);
        this.ui.showModal('form-modal');
    }

    saveStaff() {
        const id = document.getElementById('staff-id').value || generateId();
        const name = document.getElementById('staff-name').value;
        const role = document.getElementById('staff-role').value;
        const username = document.getElementById('staff-username').value;
        const password = document.getElementById('staff-password').value;
        const salary = parseFloat(document.getElementById('staff-salary').value) || 0;

        if (!name || !username || !password) {
            alert('Name, Username and Password are required');
            return;
        }

        const staffMember = { id, name, role, username, password, salary, employed: true };
        this.store.saveStaff(staffMember);
        this.ui.hideModals();
        this.loadStaff();
    }

    saveAttendance() {
        const staffId = document.getElementById('attendance-staff-id').value;
        const date = document.getElementById('attendance-date').value;
        const status = document.getElementById('attendance-status').value;

        if (!date) {
            alert('Please select a date');
            return;
        }

        const staffList = this.store.getStaff();
        const staffIndex = staffList.findIndex(s => s.id === staffId);

        if (staffIndex > -1) {
            // Initialize attendanceRecords if not exists
            if (!staffList[staffIndex].attendanceRecords) {
                staffList[staffIndex].attendanceRecords = [];
            }

            // Check if attendance already marked for this date
            const existingIndex = staffList[staffIndex].attendanceRecords.findIndex(r => r.date === date);

            const attendanceRecord = {
                date: date,
                status: status  // Store actual status: 'present', 'halfday', or 'absent'
            };

            if (existingIndex > -1) {
                // Update existing record
                staffList[staffIndex].attendanceRecords[existingIndex] = attendanceRecord;
            } else {
                // Add new record
                staffList[staffIndex].attendanceRecords.push(attendanceRecord);
            }

            this.store.saveStaff(staffList[staffIndex]);
            this.ui.hideModals();
            this.loadStaff();
            alert('Attendance marked successfully!');
        }
    }

    markSalaryPaid() {
        const staffId = document.getElementById('salary-staff-id').value;
        const month = parseInt(document.getElementById('salary-month').value);
        const year = parseInt(document.getElementById('salary-year').value);
        const amount = parseFloat(document.getElementById('salary-amount').value);

        if (isNaN(amount) || amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        const staffList = this.store.getStaff();
        const staffIndex = staffList.findIndex(s => s.id === staffId);

        if (staffIndex > -1) {
            // Initialize salaryPayments if not exists
            if (!staffList[staffIndex].salaryPayments) {
                staffList[staffIndex].salaryPayments = [];
            }

            // Check if payment already exists for this month/year
            const existingIndex = staffList[staffIndex].salaryPayments.findIndex(
                p => p.month === month && p.year === year
            );

            const paymentRecord = {
                month: month,
                year: year,
                amount: amount,
                paid: true,
                paidDate: getTimestamp()
            };

            if (existingIndex > -1) {
                // Update existing record
                staffList[staffIndex].salaryPayments[existingIndex] = paymentRecord;
            } else {
                // Add new record
                staffList[staffIndex].salaryPayments.push(paymentRecord);
            }

            this.store.saveStaff(staffList[staffIndex]);
            this.ui.hideModals();
            this.loadStaff();
            alert('Salary marked as paid!');
        }
    }

    saveFinancialTransaction() {
        const staffId = document.getElementById('finance-staff-id').value;
        const type = document.getElementById('trans-type').value;
        const amount = parseFloat(document.getElementById('trans-amount').value);
        const date = document.getElementById('trans-date').value;
        const notes = document.getElementById('trans-notes').value.trim();

        if (!staffId || isNaN(amount) || amount <= 0 || !date) {
            alert('Please fill valid amount and date');
            return;
        }

        const staffList = this.store.getStaff();
        const index = staffList.findIndex(s => s.id === staffId);
        if (index === -1) return;

        if (!staffList[index].financialRecords) staffList[index].financialRecords = [];

        staffList[index].financialRecords.push({
            id: generateId(),
            type,
            amount,
            date,
            notes,
            timestamp: getTimestamp()
        });

        this.store.saveStaff(staffList[index]);

        // Refresh History Table directly
        this.ui.updateFinanceHistory(staffList[index]);

        // Reset Inputs
        document.getElementById('trans-amount').value = '';
        document.getElementById('trans-notes').value = '';
        alert('Transaction Saved');
    }

    showExpenseModal() {
        document.getElementById('expense-date').value = getTodayDate();
        document.getElementById('expense-description').value = '';
        document.getElementById('expense-category').value = 'Other';
        document.getElementById('expense-amount').value = '';

        document.getElementById('modal-overlay').classList.remove('hidden');
        document.getElementById('expense-modal').classList.remove('hidden');
    }

    saveExpense() {
        const date = document.getElementById('expense-date').value;
        const description = document.getElementById('expense-description').value.trim();
        const category = document.getElementById('expense-category').value;
        const amount = parseFloat(document.getElementById('expense-amount').value);

        if (!date || !description || isNaN(amount) || amount <= 0) {
            alert('Please fill all fields correctly');
            return;
        }

        const expense = {
            id: generateId(),
            date: date,
            description: description,
            category: category,
            amount: amount,
            timestamp: getTimestamp()
        };

        const expenses = this.store.get(this.store.keys.EXPENSES) || [];
        expenses.push(expense);
        this.store.set(this.store.keys.EXPENSES, expenses);

        this.ui.hideModals();
        alert('Expense recorded successfully!');
    }

    showPurchaseModal() {
        // Populate product dropdown
        const products = this.store.getProducts();
        const select = document.getElementById('purchase-product');
        select.innerHTML = '<option value="">Select Product</option>';
        products.forEach(p => {
            select.innerHTML += `<option value="${p.id}">${p.name} - ₹${p.purchasePrice || p.price}</option>`;
        });

        // Reset form
        document.getElementById('purchase-date').value = getTodayDate();
        document.getElementById('purchase-supplier').value = '';
        document.getElementById('purchase-quantity').value = '';
        document.getElementById('purchase-price').value = '';
        document.getElementById('purchase-notes').value = '';

        // Clear items list
        this.state.purchaseItems = [];
        this.updatePurchaseItemsList();

        document.getElementById('modal-overlay').classList.remove('hidden');
        document.getElementById('purchase-modal').classList.remove('hidden');
    }

    addPurchaseItem() {
        const productId = document.getElementById('purchase-product').value;
        const quantity = parseInt(document.getElementById('purchase-quantity').value);
        const price = parseFloat(document.getElementById('purchase-price').value);

        if (!productId || isNaN(quantity) || quantity <= 0 || isNaN(price) || price <= 0) {
            alert('Please select a product and enter valid quantity and price');
            return;
        }

        const products = this.store.getProducts();
        const product = products.find(p => p.id === productId);
        if (!product) {
            alert('Product not found');
            return;
        }

        // Initialize purchaseItems if not exists
        if (!this.state.purchaseItems) {
            this.state.purchaseItems = [];
        }

        this.state.purchaseItems.push({
            productId: product.id,
            productName: product.name,
            quantity: quantity,
            purchasePrice: price
        });

        // Clear inputs
        document.getElementById('purchase-product').value = '';
        document.getElementById('purchase-quantity').value = '';
        document.getElementById('purchase-price').value = '';

        this.updatePurchaseItemsList();
    }

    updatePurchaseItemsList() {
        const list = document.getElementById('purchase-items-list');
        const totalDiv = document.getElementById('purchase-total');

        if (!this.state.purchaseItems || this.state.purchaseItems.length === 0) {
            list.innerHTML = '<em style="color: #999;">No items added yet</em>';
            totalDiv.textContent = '₹0.00';
            return;
        }

        let total = 0;
        list.innerHTML = '';

        this.state.purchaseItems.forEach((item, index) => {
            const itemTotal = item.quantity * item.purchasePrice;
            total += itemTotal;

            const div = document.createElement('div');
            div.style.cssText = 'padding: 8px; margin-bottom: 5px; background: white; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;';
            div.innerHTML = `
                <div>
                    <strong>${item.productName}</strong><br>
                    <small>${item.quantity} units × ₹${item.purchasePrice.toFixed(2)} = ₹${itemTotal.toFixed(2)}</small>
                </div>
                <button class="btn btn-danger" onclick="app.removePurchaseItem(${index})" style="padding: 4px 8px; font-size: 0.8em;">Remove</button>
            `;
            list.appendChild(div);
        });

        totalDiv.textContent = formatMoney(total);
    }

    removePurchaseItem(index) {
        if (this.state.purchaseItems) {
            this.state.purchaseItems.splice(index, 1);
            this.updatePurchaseItemsList();
        }
    }

    savePurchase() {
        const date = document.getElementById('purchase-date').value;
        const supplier = document.getElementById('purchase-supplier').value.trim();
        const notes = document.getElementById('purchase-notes').value.trim();

        if (!date || !supplier) {
            alert('Please enter date and supplier name');
            return;
        }

        if (!this.state.purchaseItems || this.state.purchaseItems.length === 0) {
            alert('Please add at least one item to the purchase');
            return;
        }

        const totalAmount = this.state.purchaseItems.reduce((sum, item) => sum + (item.quantity * item.purchasePrice), 0);

        const purchase = {
            id: generateId(),
            date: date,
            supplier: supplier,
            items: [...this.state.purchaseItems],
            totalAmount: totalAmount,
            notes: notes,
            addedBy: this.state.currentUser.id,
            timestamp: getTimestamp()
        };

        this.store.addPurchase(purchase);

        this.ui.hideModals();
        this.loadInventory(); // Refresh inventory to show updated stock
        this.loadProducts(); // Refresh billing products to show updated stock
        alert(`Purchase recorded successfully! Stock updated for ${purchase.items.length} product(s).`);
    }

    openOpeningBalanceModal() {
        const dateInput = document.getElementById('report-date').value;
        const dateStr = dateInput || getTodayDate();

        document.getElementById('opening-balance-date').value = dateStr;

        const log = this.store.getDailyLog(dateStr);
        document.getElementById('opening-balance-amount').value = log ? log.openingBalance : '';

        this.ui.showModal('opening-balance-modal');
    }

    saveOpeningBalance() {
        const date = document.getElementById('opening-balance-date').value;
        const amount = parseFloat(document.getElementById('opening-balance-amount').value);

        if (!date || isNaN(amount) || amount < 0) {
            alert('Please enter a valid amount');
            return;
        }

        const log = {
            date: date,
            openingBalance: amount,
            updatedAt: getTimestamp()
        };

        this.store.saveDailyLog(log);
        this.ui.hideModals();
        this.loadReports(); // Refresh report to show new balance
        alert('Opening Balance Saved!');
    }

    // --- Reports Methods ---
    loadReports() {
        const dateInput = document.getElementById('report-date').value;
        const dateStr = dateInput || getTodayDate();
        if (!dateInput) document.getElementById('report-date').value = dateStr;

        const searchTerm = (document.getElementById('report-search').value || '').toLowerCase();

        const sales = this.store.get(this.store.keys.SALES);
        // Filter by Date for Totals
        const dailySales = sales.filter(s => s.date.startsWith(dateStr));

        // Filter by Search Term for Table Display
        const filteredSales = dailySales.filter(s =>
            s.billNo.toString().includes(searchTerm) ||
            (s.customer && s.customer.toLowerCase().includes(searchTerm))
        );

        const totalSales = dailySales.reduce((sum, s) => sum + s.total, 0);
        const cashSales = dailySales.reduce((sum, s) => sum + (s.mode === 'cash' ? s.total : 0), 0);
        const upiSales = dailySales.reduce((sum, s) => sum + (s.mode === 'upi' ? s.total : 0), 0);

        // Profit calculation based on dailySales (not search filtered)
        const products = this.store.getProducts();
        const profit = dailySales.reduce((totalProfit, sale) => {
            const saleProfit = sale.items.reduce((saleSum, item) => {
                const product = products.find(p => p.id === item.id);
                if (product) {
                    const purchasePrice = product.purchasePrice || product.price || 0;
                    const salesPrice = product.salesPrice || product.price || 0;
                    const itemProfit = (salesPrice - purchasePrice) * item.qty;
                    return saleSum + itemProfit;
                }
                return saleSum;
            }, 0);
            return totalProfit + saleProfit;
        }, 0);

        // Calculate Salary Expenses for selected date (Daily Basis)
        const staff = this.store.getStaff();

        const salaryExpenses = staff.reduce((total, staffMember) => {
            const payments = staffMember.salaryPayments || [];
            const dayPayments = payments.filter(payment =>
                payment.paid &&
                (payment.paidDate || '').startsWith(dateStr)
            );
            const staffTotal = dayPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
            return total + staffTotal;
        }, 0);

        // Calculate Other Expenses for selected date (Daily Basis)
        const allExpenses = this.store.get(this.store.keys.EXPENSES) || [];
        const dateExpenses = allExpenses.filter(expense => expense.date === dateStr);
        const otherExpenses = dateExpenses.reduce((sum, expense) => sum + expense.amount, 0);

        // Calculate Total Expenses (salaries + other expenses)
        const totalExpenses = salaryExpenses + otherExpenses;

        // Calculate Net Profit (Gross Profit - Expenses)
        const netProfit = profit - totalExpenses;

        document.getElementById('report-sales-total').textContent = formatMoney(totalSales);
        document.getElementById('report-cash-total').textContent = formatMoney(cashSales);
        document.getElementById('report-upi-total').textContent = formatMoney(upiSales);
        document.getElementById('report-salary-expenses').textContent = formatMoney(salaryExpenses);
        document.getElementById('report-total-expenses').textContent = formatMoney(totalExpenses);
        document.getElementById('report-profit').textContent = formatMoney(netProfit);

        // Update Opening Balance Display
        const log = this.store.getDailyLog(dateStr);
        const openingBalance = log ? log.openingBalance : 0; // Ensure number
        document.getElementById('report-opening-balance').textContent = formatMoney(openingBalance);

        // Calculate and Update Cash in Hand (Opening + Cash Sales)
        // Assumption: Expenses logic is not fully split by Cash/Online yet, so we stick to gross cash flow
        const cashInHand = (parseFloat(openingBalance) || 0) + cashSales;
        document.getElementById('report-cash-in-hand').textContent = formatMoney(cashInHand);

        // Render Cash Sales Table
        const cashTransactions = filteredSales.filter(s => s.mode === 'cash');
        const cashTbody = document.querySelector('#cash-sales-table tbody');
        if (cashTbody) {
            cashTbody.innerHTML = '';
            cashTransactions.forEach(s => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                        <td>${new Date(s.date).toLocaleTimeString()}</td>
                        <td>#${s.billNo}</td>
                        <td>${s.items.length} items</td>
                        <td>${formatMoney(s.total)}</td>
                        <td>
                             <button class="btn btn-primary btn-sm" style="padding: 2px 8px; font-size: 0.8rem; margin-right: 5px;" onclick="app.printSale('${s.id}')">Print</button>
                             <button class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.8rem; margin-right: 5px;" onclick="app.editSale('${s.id}')">Edit</button>
                             <button class="btn btn-danger btn-sm" style="padding: 2px 8px; font-size: 0.8rem;" onclick="app.deleteSale('${s.id}')">Delete</button>
                        </td>
                    `;
                cashTbody.appendChild(tr);
            });
            if (cashTransactions.length === 0) {
                cashTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No cash transactions for this month</td></tr>';
            }
        }

        // Render UPI Sales Table
        const upiTransactions = filteredSales.filter(s => s.mode === 'upi');
        const upiTbody = document.querySelector('#upi-sales-table tbody');
        if (upiTbody) {
            upiTbody.innerHTML = '';
            upiTransactions.forEach(s => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                        <td>${new Date(s.date).toLocaleTimeString()}</td>
                        <td>#${s.billNo}</td>
                        <td>${s.items.length} items</td>
                        <td>${formatMoney(s.total)}</td>
                        <td>
                            <button class="btn btn-primary btn-sm" style="padding: 2px 8px; font-size: 0.8rem; margin-right: 5px;" onclick="app.printSale('${s.id}')">Print</button>
                            <button class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.8rem; margin-right: 5px;" onclick="app.editSale('${s.id}')">Edit</button>
                            <button class="btn btn-danger btn-sm" style="padding: 2px 8px; font-size: 0.8rem;" onclick="app.deleteSale('${s.id}')">Delete</button>
                        </td>
                    `;
                upiTbody.appendChild(tr);
            });
            if (upiTransactions.length === 0) {
                upiTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No UPI transactions for this month</td></tr>';
            }
        }

        // Render Expense Breakdown Table
        const expenseTbody = document.querySelector('#expenses-table tbody');
        if (expenseTbody) {
            expenseTbody.innerHTML = '';
            if (dateExpenses.length > 0) {
                // Sort by date
                dateExpenses.sort((a, b) => new Date(a.date) - new Date(b.date));

                dateExpenses.forEach(expense => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                            <td>${new Date(expense.date).toLocaleDateString()}</td>
                            <td><span style="background: #e3f2fd; padding: 2px 8px; border-radius: 4px; font-size: 0.9em;">${expense.category}</span></td>
                            <td>${expense.description}</td>
                            <td>${formatMoney(expense.amount)}</td>
                        `;
                    expenseTbody.appendChild(tr);
                });

                // Add total row
                const totalRow = document.createElement('tr');
                totalRow.style.fontWeight = 'bold';
                totalRow.style.borderTop = '2px solid #ddd';
                totalRow.innerHTML = `
                        <td colspan="3" style="text-align:right;">Total Other Expenses:</td>
                        <td>${formatMoney(otherExpenses)}</td>
                    `;
                expenseTbody.appendChild(totalRow);
            } else {
                expenseTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No expenses recorded for this month</td></tr>';
            }
        }

        // Render Purchase History Table
        const purchaseTbody = document.querySelector('#purchase-history-table tbody');
        if (purchaseTbody) {
            purchaseTbody.innerHTML = '';
            const allPurchases = this.store.get(this.store.keys.PURCHASES) || [];
            const datePurchases = allPurchases.filter(p => p.date === dateStr);

            if (datePurchases.length > 0) {
                datePurchases.forEach(purchase => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                            <td>${new Date(purchase.date).toLocaleDateString()}</td>
                            <td>${purchase.supplier}</td>
                            <td>${purchase.items.length} items</td>
                            <td>${formatMoney(purchase.totalAmount)}</td>
                        `;
                    purchaseTbody.appendChild(tr);
                });

                // Add total row
                const totalPurchases = datePurchases.reduce((sum, p) => sum + p.totalAmount, 0);
                const totalRow = document.createElement('tr');
                totalRow.style.fontWeight = 'bold';
                totalRow.style.borderTop = '2px solid #ddd';
                totalRow.innerHTML = `
                        <td colspan="3" style="text-align:right;">Total Purchases:</td>
                        <td>${formatMoney(totalPurchases)}</td>
                    `;
                purchaseTbody.appendChild(totalRow);
            } else {
                purchaseTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No purchases for this date</td></tr>';
            }
        }

        // Render Stock Movement Report
        const stockMovementTbody = document.querySelector('#stock-movement-table tbody');
        if (stockMovementTbody) {
            stockMovementTbody.innerHTML = '';

            const products = this.store.getProducts();
            const allPurchases = this.store.get(this.store.keys.PURCHASES) || [];
            const allSales = this.store.get(this.store.keys.SALES) || [];

            // Filter for selected date
            const datePurchases = allPurchases.filter(p => p.date === dateStr);
            const dateSales = allSales.filter(s => s.date === dateStr);

            // Build movement map
            const movementMap = {};

            // Track stock IN from purchases
            datePurchases.forEach(purchase => {
                purchase.items.forEach(item => {
                    if (!movementMap[item.productId]) {
                        movementMap[item.productId] = {
                            name: item.productName,
                            stockIn: 0,
                            stockOut: 0
                        };
                    }
                    movementMap[item.productId].stockIn += item.quantity;
                });
            });

            // Track stock OUT from sales
            dateSales.forEach(sale => {
                sale.items.forEach(item => {
                    if (!movementMap[item.id]) {
                        movementMap[item.id] = {
                            name: item.name,
                            stockIn: 0,
                            stockOut: 0
                        };
                    }
                    movementMap[item.id].stockOut += item.qty;
                });
            });

            const movements = Object.entries(movementMap);

            if (movements.length === 0) {
                stockMovementTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No stock movements for this date</td></tr>';
            } else {
                movements.forEach(([productId, data]) => {
                    const product = products.find(p => p.id === productId);
                    const currentStock = product ? product.stock : 0;
                    const netMovement = data.stockIn - data.stockOut;

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                            <td>${data.name}</td>
                            <td style="color: #27ae60;">${data.stockIn > 0 ? '+' + data.stockIn : data.stockIn}</td>
                            <td style="color: #e74c3c;">${data.stockOut > 0 ? '-' + data.stockOut : data.stockOut}</td>
                            <td style="color: ${netMovement >= 0 ? '#27ae60' : '#e74c3c'}; font-weight: bold;">
                                ${netMovement >= 0 ? '+' : ''}${netMovement}
                            </td>
                            <td><strong>${currentStock}</strong></td>
                        `;
                    stockMovementTbody.appendChild(tr);
                });

                // Add totals row
                const totalStockIn = movements.reduce((sum, [_, data]) => sum + data.stockIn, 0);
                const totalStockOut = movements.reduce((sum, [_, data]) => sum + data.stockOut, 0);
                const totalNet = totalStockIn - totalStockOut;

                const totalRow = document.createElement('tr');
                totalRow.style.fontWeight = 'bold';
                totalRow.style.borderTop = '2px solid #ddd';
                totalRow.style.backgroundColor = '#f8f9fa';
                totalRow.innerHTML = `
                        <td>TOTAL</td>
                        <td style="color: #27ae60;">+${totalStockIn}</td>
                        <td style="color: #e74c3c;">-${totalStockOut}</td>
                        <td style="color: ${totalNet >= 0 ? '#27ae60' : '#e74c3c'};">
                            ${totalNet >= 0 ? '+' : ''}${totalNet}
                        </td>
                        <td>-</td>
                    `;
                stockMovementTbody.appendChild(totalRow);
            }
        }
    }

    deleteSale(saleId) {
        if (!confirm('Are you sure you want to delete this sale? This will restore stock.')) return;

        const sales = this.store.get(this.store.keys.SALES);
        const saleIndex = sales.findIndex(s => s.id === saleId);

        if (saleIndex === -1) {
            alert('Sale not found');
            return;
        }

        const sale = sales[saleIndex];
        const products = this.store.getProducts();

        // Restore Stock
        sale.items.forEach(item => {
            const productIndex = products.findIndex(p => p.id === item.id);
            if (productIndex > -1) {
                products[productIndex].stock += item.qty;
            }
        });

        // Remove Sale
        sales.splice(saleIndex, 1);

        // Save Updates
        this.store.set(this.store.keys.PRODUCTS, products);
        this.store.set(this.store.keys.SALES, sales);

        alert('Sale deleted and stock restored.');
        this.loadReports(); // Refresh UI
        this.loadDashboard(); // Refresh Stock in other views if needed
    }

    printSale(saleId) {
        const sales = this.store.get(this.store.keys.SALES);
        const sale = sales.find(s => s.id === saleId);
        if (sale) {
            this.generateReceipt(sale);
        } else {
            alert('Sale not found');
        }
    }

    editSale(saleId) {
        if (!confirm('Edit this sale? This will cancel the current bill and move items to cart for modification.')) return;

        const sales = this.store.get(this.store.keys.SALES);
        const saleIndex = sales.findIndex(s => s.id === saleId);

        if (saleIndex === -1) {
            alert('Sale not found');
            return;
        }

        const sale = sales[saleIndex];

        // Save Bill No for preservation
        this.state.editingBillNo = sale.billNo;

        const products = this.store.getProducts();

        // 1. Restore Stock
        sale.items.forEach(item => {
            const productIndex = products.findIndex(p => p.id === item.id);
            if (productIndex > -1) {
                products[productIndex].stock += item.qty;
            }
        });

        // 2. Remove Sale
        sales.splice(saleIndex, 1);

        // 3. Persist Changes (Stock & Sales)
        this.store.set(this.store.keys.PRODUCTS, products);
        this.store.set(this.store.keys.SALES, sales);

        // 4. Move items to Cart
        this.state.cart = [...sale.items];

        // 5. Switch to Billing and Refresh
        alert('Sale reverted to cart. Make changes and checkout again.');
        this.ui.showSection('billing');
        this.loadDashboard(); // Re-renders products with updated stock
        this.updateCart(); // Renders cart with restored items
    }

    exportReports() {
        if (!confirm('Download full report as Excel file?')) return;

        const dateInput = document.getElementById('report-date').value;
        const dateStr = dateInput || getTodayDate();

        // 1. Prepare Data

        // -- Summary Data --
        const sales = this.store.get(this.store.keys.SALES);
        const filteredSales = sales.filter(s => s.date.startsWith(dateStr));
        const totalSales = filteredSales.reduce((sum, s) => sum + s.total, 0);
        const cashSales = filteredSales.reduce((sum, s) => sum + (s.mode === 'cash' ? s.total : 0), 0);
        const upiSales = filteredSales.reduce((sum, s) => sum + (s.mode === 'upi' ? s.total : 0), 0);

        const log = this.store.getDailyLog(dateStr);
        const openingBalance = log ? log.openingBalance : 0;

        const summaryData = [
            { Metric: "Report Date", Value: dateStr },
            { Metric: "Opening Balance", Value: openingBalance },
            { Metric: "Total Sales", Value: totalSales },
            { Metric: "Cash Sales", Value: cashSales },
            { Metric: "UPI Sales", Value: upiSales },
            { Metric: "Total Transactions", Value: filteredSales.length }
        ];

        // -- Sales Detail --
        // -- Sales Detail (Summary) --
        const salesData = filteredSales.map(s => ({
            "Bill ID": s.billNo,
            "Date Time": new Date(s.date).toLocaleString(),
            "Customer Name": s.customer,
            "Payment Mode": s.mode === 'upi' ? 'UPI/GPay' : 'Cash',
            "Total Amount": s.total,
            "Items (Summary)": s.items.map(i => `${i.name} (${i.qty})`).join(', ')
        }));

        // -- Itemized Sales (Detailed) --
        const itemizedSalesData = [];
        filteredSales.forEach(s => {
            s.items.forEach(item => {
                itemizedSalesData.push({
                    "Bill ID": s.billNo,
                    "Date": new Date(s.date).toLocaleDateString(),
                    "Customer": s.customer,
                    "Item Name": item.name,
                    "Category": item.category || 'N/A',
                    "Qty": item.qty,
                    "Unit Price": item.price,
                    "Item Total": (item.price * item.qty).toFixed(2),
                    "Payment Mode": s.mode === 'upi' ? 'UPI/GPay' : 'Cash'
                });
            });
        });

        // -- Purchases --
        const purchases = this.store.get(this.store.keys.PURCHASES) || [];
        const purchaseData = purchases.map(p => ({
            "Date": p.date,
            "Supplier": p.supplier,
            "Total Amount": p.totalAmount,
            "Items": p.items.map(i => `${i.productName} (${i.quantity} @ ${i.purchasePrice})`).join('; ')
        }));

        // -- Inventory --
        const products = this.store.getProducts();
        const inventoryData = products.map(p => ({
            "Product Name": p.name,
            "Category": p.category,
            "Stock": p.stock,
            "Unit": p.unit || 'pcs',
            "Purchase Price": p.purchasePrice || p.price,
            "Sales Price": p.salesPrice || p.price,
            "Stock Value (Purchase)": (p.stock * (p.purchasePrice || p.price)).toFixed(2)
        }));

        // -- Expenses --
        const expenses = this.store.get(this.store.keys.EXPENSES) || [];
        const expenseData = expenses.map(e => ({
            "Date": e.date,
            "Category": e.category,
            "Description": e.description,
            "Amount": e.amount
        }));

        // 2. Create Workbook and Sheets
        const wb = XLSX.utils.book_new();

        const summarySheet = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

        const salesSheet = XLSX.utils.json_to_sheet(salesData);
        XLSX.utils.book_append_sheet(wb, salesSheet, "Sales Summary");

        const itemizedSheet = XLSX.utils.json_to_sheet(itemizedSalesData);
        XLSX.utils.book_append_sheet(wb, itemizedSheet, "Itemized Sales");

        const inventorySheet = XLSX.utils.json_to_sheet(inventoryData);
        XLSX.utils.book_append_sheet(wb, inventorySheet, "Inventory");

        const purchaseSheet = XLSX.utils.json_to_sheet(purchaseData);
        XLSX.utils.book_append_sheet(wb, purchaseSheet, "Purchases");

        const expenseSheet = XLSX.utils.json_to_sheet(expenseData);
        XLSX.utils.book_append_sheet(wb, expenseSheet, "Expenses");

        // 3. Save File
        XLSX.writeFile(wb, `BunButter_Report_${dateStr}.xlsx`);
    }

    downloadTemplate() {
        const wb = XLSX.utils.book_new();

        // 1. Template Sheet
        const headers = ["Name", "Category", "Stock", "Unit", "PurchasePrice", "SalesPrice"];
        const sampleData = [
            ["Example Product", "Snacks", 100, "pcs", 8.00, 12.00],
            ["Milk Bread", "Breads", 50, "pcs", 30, 40]
        ];
        const wsTemplate = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);

        // 2. Reference Sheet for Dropdowns
        const units = ["pcs", "pkt", "bun", "box", "dozen", "1kg", "500g", "250g", "100g", "kg", "1L", "500ml", "250ml", "L"];
        const products = this.store.getProducts();
        const categories = [...new Set(products.map(p => p.category).filter(c => c))].sort();
        if (categories.length === 0) categories.push("General", "Breads", "Cakes", "Snacks");

        const refData = [["Valid Units", "Existing Categories"]];
        const maxLen = Math.max(units.length, categories.length);
        for (let i = 0; i < maxLen; i++) {
            refData.push([
                units[i] || "",
                categories[i] || ""
            ]);
        }
        const wsRef = XLSX.utils.aoa_to_sheet(refData);

        // 3. Setup Data Validation (Attempt)
        // Note: SheetJS CE might strip this, but we try.
        // Category (Col B), Unit (Col D)
        if (!wsTemplate['!dataValidation']) wsTemplate['!dataValidation'] = [];

        // Units Validation (D2:D1000)
        wsTemplate['!dataValidation'].push({
            sqref: "D2:D1000",
            type: "list",
            formula1: "'Valid Options'!$A$2:$A$" + (units.length + 1),
            showErrorMessage: true,
            errorTitle: "Invalid Unit",
            error: "Please select a valid unit from the options sheet"
        });

        // Categories Validation (B2:B1000)
        wsTemplate['!dataValidation'].push({
            sqref: "B2:B1000",
            type: "list",
            formula1: "'Valid Options'!$B$2:$B$" + (categories.length + 1),
            showErrorMessage: true,
            errorTitle: "Invalid Category",
            error: "Please use an existing category or add to the list"
        });

        XLSX.utils.book_append_sheet(wb, wsTemplate, "Template");
        XLSX.utils.book_append_sheet(wb, wsRef, "Valid Options");

        // Save as XLSX
        XLSX.writeFile(wb, "BunButter_Product_Template.xlsx");
    }

    backupData() {
        if (typeof XLSX === 'undefined') {
            alert('Excel library (SheetJS) not loaded. Cannot backup.');
            return;
        }
        const dateStr = getTodayDate();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const wb = XLSX.utils.book_new();

        // 0. Settings & Metadata
        const settings = this.store.getSettings();
        const lastBill = localStorage.getItem(this.store.keys.LAST_BILL);
        const settingsData = Object.entries(settings).map(([k, v]) => ({ Key: k, Value: v }));
        if (lastBill) settingsData.push({ Key: 'lastBill', Value: lastBill });

        const settingsSheet = XLSX.utils.json_to_sheet(settingsData);
        XLSX.utils.book_append_sheet(wb, settingsSheet, "Settings");

        // 1. Products (Inventory)
        const products = this.store.getProducts();
        const productSheet = XLSX.utils.json_to_sheet(products);
        XLSX.utils.book_append_sheet(wb, productSheet, "Products");

        // 2. Sales (All Time)
        const sales = this.store.get(this.store.keys.SALES);
        const salesSheet = XLSX.utils.json_to_sheet(sales.map(s => {
            const itemsReadable = s.items.map(i => `${i.name} (${i.qty})`).join(', ');
            return {
                billNo: s.billNo,
                date: s.date,
                customer: s.customer,
                total: s.total,
                mode: s.mode,
                items: itemsReadable,
                items_json: JSON.stringify(s.items), // Keep raw data for potential restore
                subtotal: s.subtotal,
                tax: s.tax,
                staffId: s.staffId
            };
        }));
        XLSX.utils.book_append_sheet(wb, salesSheet, "Sales");

        // 3. Expenses
        const expenses = this.store.get(this.store.keys.EXPENSES);
        const expenseSheet = XLSX.utils.json_to_sheet(expenses);
        XLSX.utils.book_append_sheet(wb, expenseSheet, "Expenses");

        // 4. Purchases
        const purchases = this.store.get(this.store.keys.PURCHASES);
        const purchaseSheet = XLSX.utils.json_to_sheet(purchases.map(p => {
            const itemsReadable = p.items.map(i => `${i.productName} (${i.quantity})`).join(', ');
            return {
                ...p,
                items: itemsReadable,
                items_json: JSON.stringify(p.items)
            };
        }));
        XLSX.utils.book_append_sheet(wb, purchaseSheet, "Purchases");

        // 5. Staff
        const staff = this.store.getStaff();
        const staffSheet = XLSX.utils.json_to_sheet(staff);
        XLSX.utils.book_append_sheet(wb, staffSheet, "Staff");

        // Save
        XLSX.writeFile(wb, `BunButter_Backup_${timestamp}.xlsx`);
    }

    handleExcelImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length === 0) {
                    alert('Excel file is empty or invalid format.');
                    return;
                }

                // Map fields safely
                const productsToImport = jsonData.map(row => ({
                    name: row['Name'] || row['name'] || row['Product'] || row['product'],
                    category: row['Category'] || row['category'],
                    price: row['Price'] || row['price'] || row['Sales Price'] || row['SalesPrice'],
                    salesPrice: row['Sales Price'] || row['SalesPrice'] || row['Price'],
                    purchasePrice: row['Purchase Price'] || row['PurchasePrice'] || row['Cost'],
                    stock: row['Stock'] || row['stock'] || row['Qty'] || row['Quantity'],
                    unit: row['Unit'] || row['unit']
                })).filter(p => p.name && (p.price || p.stock)); // Filter invalid rows

                if (productsToImport.length === 0) {
                    alert('No valid product data found. Check columns: Name, Price, Stock, Category.');
                    return;
                }

                const result = this.store.importProducts(productsToImport);
                alert(`Import Successful!\nAdded: ${result.added}\nUpdated: ${result.updated}`);

                // Refresh Inventory if active
                this.loadInventory();

                // Reset input
                e.target.value = '';

            } catch (err) {
                console.error('Import Error:', err);
                alert('Failed to parse Excel file. Ensure it is a valid .xlsx or .xls file.');
            }
        };
        reader.readAsArrayBuffer(file);
    }
}

// Start App
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
