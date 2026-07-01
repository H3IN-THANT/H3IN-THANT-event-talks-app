// App State
let state = {
    updates: [],
    lastUpdated: null,
    selectedId: null,
    currentCategory: 'All',
    searchQuery: '',
    viewMode: 'grid', // 'grid' or 'list'
};

// DOM Elements
const elements = {
    refreshBtn: document.getElementById('refreshBtn'),
    statusIndicator: document.getElementById('statusIndicator'),
    lastUpdatedTime: document.getElementById('lastUpdatedTime'),
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    categoryFiltersContainer: document.getElementById('categoryFiltersContainer'),
    tweetComposer: document.getElementById('tweetComposer'),
    tweetText: document.getElementById('tweetText'),
    charCounter: document.getElementById('charCounter'),
    tweetBtn: document.getElementById('tweetBtn'),
    closeComposerBtn: document.getElementById('closeComposerBtn'),
    releasesFeed: document.getElementById('releasesFeed'),
    skeletonContainer: document.getElementById('skeletonContainer'),
    errorContainer: document.getElementById('errorContainer'),
    errorMessage: document.getElementById('errorMessage'),
    retryBtn: document.getElementById('retryBtn'),
    emptyContainer: document.getElementById('emptyContainer'),
    resetFiltersBtn: document.getElementById('resetFiltersBtn'),
    feedCount: document.getElementById('feedCount'),
    viewGridBtn: document.getElementById('viewGridBtn'),
    viewListBtn: document.getElementById('viewListBtn'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

// App Initiation
async function initApp() {
    state.viewMode = localStorage.getItem('bq_view_mode') || 'grid';
    updateViewToggleUI();
    await fetchReleases(false);
}

// Event Listeners
function setupEventListeners() {
    // Refresh & Retry
    elements.refreshBtn.addEventListener('click', () => fetchReleases(true));
    elements.retryBtn.addEventListener('click', () => fetchReleases(true));
    
    // Search
    elements.searchInput.addEventListener('input', handleSearch);
    elements.clearSearchBtn.addEventListener('click', clearSearch);
    
    // View Toggles
    elements.viewGridBtn.addEventListener('click', () => setViewMode('grid'));
    elements.viewListBtn.addEventListener('click', () => setViewMode('list'));
    
    // Reset Filters
    elements.resetFiltersBtn.addEventListener('click', resetFilters);
    
    // Tweet Composer
    elements.tweetText.addEventListener('input', handleTweetTextChange);
    elements.tweetBtn.addEventListener('click', executeTweet);
    elements.closeComposerBtn.addEventListener('click', deselectUpdate);
    
    // Global key shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && state.selectedId) {
            deselectUpdate();
        }
    });
}

// Fetch Data from Server
async function fetchReleases(forceRefresh = false) {
    showLoadingState();
    
    try {
        const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        state.updates = data.updates || [];
        state.lastUpdated = data.last_updated;
        
        // Render view
        renderFilters();
        renderUpdates();
        updateSyncStatus(true);
        
        if (forceRefresh) {
            showToast("Successfully synced latest release notes!");
        }
    } catch (error) {
        console.error("Fetch Error:", error);
        updateSyncStatus(false, error.message);
        
        if (state.updates.length === 0) {
            showErrorState(error.message);
        } else {
            showToast(`Sync failed: ${error.message}. Showing cached data.`, true);
        }
    }
}

// UI State Toggles
function showLoadingState() {
    elements.skeletonContainer.style.display = 'grid';
    elements.releasesFeed.style.display = 'none';
    elements.errorContainer.style.display = 'none';
    elements.emptyContainer.style.display = 'none';
    
    // Spin refresh button icon
    const icon = elements.refreshBtn.querySelector('.icon-spin-target');
    if (icon) icon.classList.add('spinning');
    elements.refreshBtn.disabled = true;
    
    elements.statusIndicator.className = 'status-indicator loading';
    elements.statusIndicator.querySelector('.status-text').textContent = 'Syncing...';
}

function updateSyncStatus(success, errorMsg = '') {
    // Stop spin icon
    const icon = elements.refreshBtn.querySelector('.icon-spin-target');
    if (icon) icon.classList.remove('spinning');
    elements.refreshBtn.disabled = false;
    
    if (success) {
        elements.statusIndicator.className = 'status-indicator online';
        elements.statusIndicator.querySelector('.status-text').textContent = 'Synced';
        
        if (state.lastUpdated) {
            const date = new Date(state.lastUpdated);
            // Format to human readable local time
            elements.lastUpdatedTime.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString();
        } else {
            elements.lastUpdatedTime.textContent = 'Never';
        }
    } else {
        elements.statusIndicator.className = 'status-indicator offline';
        elements.statusIndicator.querySelector('.status-text').textContent = 'Sync Error';
    }
}

function showErrorState(message) {
    elements.skeletonContainer.style.display = 'none';
    elements.releasesFeed.style.display = 'none';
    elements.emptyContainer.style.display = 'none';
    elements.errorContainer.style.display = 'flex';
    elements.errorMessage.textContent = message || "An unknown error occurred.";
}

// Category Filtering Engine
function renderFilters() {
    // Extract unique categories and counts
    const categories = { 'All': state.updates.length };
    
    state.updates.forEach(up => {
        const type = up.type || 'Update';
        categories[type] = (categories[type] || 0) + 1;
    });
    
    elements.categoryFiltersContainer.innerHTML = '';
    
    // Sort filters, ensure 'All' is first
    const sortedCategories = Object.keys(categories).sort((a, b) => {
        if (a === 'All') return -1;
        if (b === 'All') return 1;
        return categories[b] - categories[a]; // order by count
    });
    
    sortedCategories.forEach(cat => {
        const badge = document.createElement('div');
        badge.className = `filter-badge ${state.currentCategory === cat ? 'active' : ''}`;
        
        // Add matching color dot for visual hierarchy
        const dot = document.createElement('span');
        dot.className = `dot-indicator ${cat.toLowerCase()}`;
        
        const label = document.createElement('span');
        label.textContent = cat;
        
        const count = document.createElement('span');
        count.className = 'badge-count';
        count.textContent = categories[cat];
        
        badge.appendChild(label);
        badge.appendChild(count);
        
        badge.addEventListener('click', () => {
            setCategoryFilter(cat);
        });
        
        elements.categoryFiltersContainer.appendChild(badge);
    });
}

function setCategoryFilter(category) {
    state.currentCategory = category;
    
    // Update active class in DOM
    const badges = elements.categoryFiltersContainer.querySelectorAll('.filter-badge');
    badges.forEach(b => {
        const text = b.querySelector('span').textContent;
        if (text === category) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });
    
    renderUpdates();
}

// Real-time Search Handler
function handleSearch(e) {
    state.searchQuery = e.target.value.toLowerCase().trim();
    
    if (state.searchQuery.length > 0) {
        elements.clearSearchBtn.style.display = 'block';
    } else {
        elements.clearSearchBtn.style.display = 'none';
    }
    
    renderUpdates();
}

function clearSearch() {
    elements.searchInput.value = '';
    state.searchQuery = '';
    elements.clearSearchBtn.style.display = 'none';
    renderUpdates();
}

function resetFilters() {
    clearSearch();
    setCategoryFilter('All');
}

// View Toggles Layout Change
function setViewMode(mode) {
    state.viewMode = mode;
    localStorage.setItem('bq_view_mode', mode);
    updateViewToggleUI();
    
    if (mode === 'grid') {
        elements.releasesFeed.className = 'releases-feed grid-view';
    } else {
        elements.releasesFeed.className = 'releases-feed list-view';
    }
}

function updateViewToggleUI() {
    if (state.viewMode === 'grid') {
        elements.viewGridBtn.classList.add('active');
        elements.viewListBtn.classList.remove('active');
        elements.releasesFeed.className = 'releases-feed grid-view';
    } else {
        elements.viewListBtn.classList.add('active');
        elements.viewGridBtn.classList.remove('active');
        elements.releasesFeed.className = 'releases-feed list-view';
    }
}

// Render Updates Feed
function renderUpdates() {
    elements.skeletonContainer.style.display = 'none';
    elements.errorContainer.style.display = 'none';
    
    // Filter updates
    const filteredUpdates = state.updates.filter(up => {
        // Category Filter
        const matchesCategory = state.currentCategory === 'All' || up.type === state.currentCategory;
        
        // Search Filter
        const plainText = stripHtml(up.content).toLowerCase();
        const matchesSearch = !state.searchQuery || 
                             up.date.toLowerCase().includes(state.searchQuery) ||
                             up.type.toLowerCase().includes(state.searchQuery) ||
                             plainText.includes(state.searchQuery);
                             
        return matchesCategory && matchesSearch;
    });
    
    // Update count display
    elements.feedCount.textContent = `Showing ${filteredUpdates.length} of ${state.updates.length} updates`;
    
    if (filteredUpdates.length === 0) {
        elements.releasesFeed.style.display = 'none';
        elements.emptyContainer.style.display = 'flex';
        return;
    }
    
    elements.emptyContainer.style.display = 'none';
    elements.releasesFeed.style.display = state.viewMode === 'grid' ? 'grid' : 'block';
    
    // Re-create content
    elements.releasesFeed.innerHTML = '';
    
    filteredUpdates.forEach(up => {
        const card = document.createElement('div');
        card.className = `update-card glass ${state.selectedId === up.id ? 'selected' : ''}`;
        card.dataset.id = up.id;
        
        const typeClass = up.type ? up.type.toLowerCase().replace(' ', '-') : 'update';
        
        card.innerHTML = `
            <div class="card-header">
                <span class="category-badge ${typeClass}">${up.type}</span>
                <span class="card-date">
                    <i data-lucide="calendar" style="width:14px;height:14px;"></i>
                    ${up.date}
                </span>
            </div>
            <div class="card-body">
                ${up.content}
            </div>
            <div class="card-footer">
                <a href="${up.link}" target="_blank" rel="noopener noreferrer" class="card-link" onclick="event.stopPropagation();">
                    <span>View Docs</span>
                    <i data-lucide="external-link" style="width:12px;height:12px;"></i>
                </a>
                <div class="card-actions-right">
                    <button class="card-action-btn select-btn-inline ${state.selectedId === up.id ? 'selected' : ''}" title="Select update to draft Tweet">
                        <i data-lucide="check-square" style="width:16px;height:16px;"></i>
                    </button>
                    <button class="card-action-btn tweet-btn-inline" title="Quick Tweet this update">
                        <i data-lucide="twitter" style="width:16px;height:16px;"></i>
                    </button>
                </div>
            </div>
        `;
        
        // Add card selection click
        card.addEventListener('click', (e) => {
            // If user clicked inside an anchor tag, don't trigger selection
            if (e.target.tagName === 'A' || e.target.closest('a')) {
                return;
            }
            
            // Check if inline quick tweet button was clicked
            const tweetBtn = e.target.closest('.tweet-btn-inline');
            if (tweetBtn) {
                e.stopPropagation();
                selectUpdate(up.id);
                // Directly launch tweet intent
                executeTweet();
                return;
            }
            
            // Check if select checkbox button was clicked
            const selectBtn = e.target.closest('.select-btn-inline');
            if (selectBtn) {
                e.stopPropagation();
                if (state.selectedId === up.id) {
                    deselectUpdate();
                } else {
                    selectUpdate(up.id);
                }
                return;
            }
            
            // Default card click: select for drafting
            selectUpdate(up.id);
        });
        
        elements.releasesFeed.appendChild(card);
    });
    
    // Refresh icons inside dynamically rendered nodes
    lucide.createIcons();
}

// Tweet Drafting & Composer Logic
function selectUpdate(id) {
    state.selectedId = id;
    
    // Toggle card selected styles
    const cards = elements.releasesFeed.querySelectorAll('.update-card');
    cards.forEach(c => {
        const selectBtn = c.querySelector('.select-btn-inline');
        if (c.dataset.id === id) {
            c.classList.add('selected');
            if (selectBtn) selectBtn.classList.add('selected');
        } else {
            c.classList.remove('selected');
            if (selectBtn) selectBtn.classList.remove('selected');
        }
    });
    
    const update = state.updates.find(u => u.id === id);
    if (!update) return;
    
    // Generate draft tweet
    const draftText = generateDraftTweet(update);
    elements.tweetText.value = draftText;
    
    // Show composer
    elements.tweetComposer.classList.add('active');
    
    // Update character counters
    handleTweetTextChange();
    
    // Smooth scroll composer into view on mobile
    if (window.innerWidth <= 1024) {
        elements.tweetComposer.scrollIntoView({ behavior: 'smooth' });
    }
    
    showToast("Update selected. Draft loaded into Tweet Composer.");
}

function deselectUpdate() {
    state.selectedId = null;
    
    const cards = elements.releasesFeed.querySelectorAll('.update-card');
    cards.forEach(c => {
        c.classList.remove('selected');
        const selectBtn = c.querySelector('.select-btn-inline');
        if (selectBtn) selectBtn.classList.remove('selected');
    });
    
    elements.tweetComposer.classList.remove('active');
    elements.tweetText.value = '';
    elements.tweetBtn.disabled = true;
}

function generateDraftTweet(update) {
    const header = `📢 BigQuery ${update.type} (${update.date}):\n`;
    const footer = `\n\nRead more: ${update.link}\n#BigQuery #GoogleCloud`;
    
    // Character Limit is 280
    const maxLen = 280;
    const reservedLen = header.length + footer.length;
    const availableLen = maxLen - reservedLen;
    
    let plainContent = stripHtml(update.content);
    // Replace multiple spaces and newlines with a single space
    plainContent = plainContent.replace(/\s+/g, ' ').trim();
    
    let bodySnippet = plainContent;
    if (plainContent.length > availableLen) {
        // truncate at word boundary
        bodySnippet = plainContent.substring(0, availableLen - 3);
        const lastSpace = bodySnippet.lastIndexOf(' ');
        if (lastSpace > availableLen * 0.7) {
            bodySnippet = bodySnippet.substring(0, lastSpace);
        }
        bodySnippet += '...';
    }
    
    return `${header}${bodySnippet}${footer}`;
}

function handleTweetTextChange() {
    const text = elements.tweetText.value;
    const len = text.length;
    elements.charCounter.textContent = `${len} / 280`;
    
    if (len === 0) {
        elements.charCounter.className = 'char-counter';
        elements.tweetBtn.disabled = true;
    } else if (len > 280) {
        elements.charCounter.className = 'char-counter error';
        elements.tweetBtn.disabled = true; // Disable if too long
    } else if (len > 240) {
        elements.charCounter.className = 'char-counter warning';
        elements.tweetBtn.disabled = false;
    } else {
        elements.charCounter.className = 'char-counter';
        elements.tweetBtn.disabled = false;
    }
}

function executeTweet() {
    const text = elements.tweetText.value;
    if (!text || text.length > 280) {
        showToast("Cannot tweet. Draft must be under 280 characters.", true);
        return;
    }
    
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    showToast("Opening X/Twitter to share your update!");
}

// Utility Helpers
function stripHtml(html) {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
}

function showToast(message, isWarning = false) {
    elements.toastMessage.textContent = message;
    
    const icon = elements.toast.querySelector('.toast-icon');
    if (isWarning) {
        elements.toast.style.borderColor = 'rgba(239, 68, 68, 0.4)';
        icon.setAttribute('data-lucide', 'alert-triangle');
        icon.style.color = '#ef4444';
    } else {
        elements.toast.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        icon.setAttribute('data-lucide', 'info');
        icon.style.color = 'var(--color-secondary)';
    }
    
    // Refresh dynamic toast icon
    lucide.createIcons();
    
    elements.toast.classList.add('active');
    
    // Auto remove
    if (state.toastTimeout) clearTimeout(state.toastTimeout);
    state.toastTimeout = setTimeout(() => {
        elements.toast.classList.remove('active');
    }, 3500);
}
