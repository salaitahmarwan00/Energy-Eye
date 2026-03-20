// global state
let marketData = null;
let currentView = 'dashboard';

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    setupNavigation();
    setupRefreshButton();
    await fetchMarketData();
}

async function fetchMarketData() {
    // In a real app this would fetch from an API or a dynamic JSON
    // Since this is hosted locally/github pages, we fetch the static data.json file
    // which would be updated daily via a backend script/GitHub Action
    
    try {
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = '<div style="text-align:center; padding: 40px;"><i class="ph ph-spinner ph-spin" style="font-size: 32px; color: var(--accent-blue);"></i><p style="margin-top:16px; color: var(--text-secondary);">Analyzing Intelligence...</p></div>';
        
        // Provide local mock market data directly via window variable to avoid fetch/CORS errors when opening via file://
        // Simulating network delay for effect
        await new Promise(r => setTimeout(r, 600));

        if (!window.MOCK_MARKET_DATA) {
            throw new Error(`Local data window.MOCK_MARKET_DATA is missing`);
        }
        marketData = window.MOCK_MARKET_DATA;
        
        // Update sidebar date
        document.getElementById('update-date-sidebar').textContent = marketData.lastUpdated;
        
        renderView(currentView);
    } catch (e) {
        console.error("Could not load market data:", e);
        document.getElementById('content-area').innerHTML = `
            <div class="panel panel-main" style="border-color: #FF5A5A;">
                <h2 class="panel-title"><i class="ph ph-warning-circle" style="color: #FF5A5A; margin-right: 8px;"></i> Data Unavailable</h2>
                <p class="panel-text">Could not load the daily market intelligence data. Please ensure 'data/market-data.js' exists and sets the global variable.</p>
            </div>
        `;
    }
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remove active class from all
            navItems.forEach(nav => nav.classList.remove('active'));
            // Add active class to clicked
            item.classList.add('active');
            
            // Get target view
            currentView = item.getAttribute('data-target');
            renderView(currentView);
        });
    });
}

function setupRefreshButton() {
    const btn = document.getElementById('btn-refresh');
    btn.addEventListener('click', () => {
        const icon = btn.querySelector('i');
        icon.classList.add('ph-spin');
        fetchMarketData().then(() => {
            setTimeout(() => icon.classList.remove('ph-spin'), 500);
        });
    });
}

function renderView(viewId) {
    if (!marketData) return;

    const contentArea = document.getElementById('content-area');
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');
    
    // Reset animation
    contentArea.classList.remove('fade-in');
    void contentArea.offsetWidth; // trigger reflow
    contentArea.classList.add('fade-in');

    if (viewId === 'dashboard') {
        renderDashboard(contentArea, pageTitle, pageSubtitle);
    } else if (viewId === 'losses-directory') {
        renderLossesDirectory(contentArea, pageTitle, pageSubtitle);
    } else {
        renderBranch(viewId, contentArea, pageTitle, pageSubtitle);
    }
}

function renderDashboard(container, titleEl, subtitleEl) {
    titleEl.textContent = 'Overall Market Summary';
    subtitleEl.textContent = 'High-level aggregation of energy insurance capacity and premium trends.';

    const data = marketData.overallSummary;

    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const now = new Date("2026-03-20T12:00:00").getTime(); // fixed reference to match mock data
    const recentLosses = (marketData.losses || []).filter(loss => {
        const lossDate = new Date(loss.date).getTime();
        return (now - lossDate) <= SEVEN_DAYS_MS;
    });

    const recentLossesHtml = recentLosses.map(loss => renderLossCard(loss)).join('');

    const html = `
        <div class="dashboard-grid">
            <div class="panel panel-main">
                <h2 class="panel-title">Executive Briefing</h2>
                <p class="panel-text">${data.content}</p>
            </div>
            <div class="metrics-grid">
                ${createMetricCard('Macro Premium Trend', getTrendDetails(data.premiumTrend, 'premium'), '')}
                ${createMetricCard('Macro Capacity Trend', getTrendDetails(data.capacityTrend, 'capacity'), '')}
            </div>
        </div>
        
        <h2 class="section-title"><i class="ph ph-info"></i> Branch Summary Quick-Glance</h2>
        <div class="news-grid" style="grid-template-columns: repeat(2, 1fr);">
            ${Object.values(marketData.branches).map(branch => `
                <div class="news-card" style="cursor: pointer;" onclick="document.querySelector('[data-target=\\'${getBranchKey(branch.title)}\\']').click()">
                    <h3 class="news-headline" style="color: var(--accent-blue); margin-bottom: 8px;">${branch.title}</h3>
                    <p class="news-meta" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; margin-bottom: 12px;">${branch.summary.substring(0, 100)}...</p>
                    <div style="display: flex; gap: 8px; margin-top: auto;">
                        <span class="metric-badge trend-${branch.premiumTrend}" style="font-size:10px;">Premiums: ${branch.premiumTrend}</span>
                        <span class="metric-badge trend-${branch.capacityTrend}" style="font-size:10px;">Capacity: ${branch.capacityTrend}</span>
                    </div>
                </div>
            `).join('')}
        </div>

        <h2 class="section-title" style="margin-top: 48px;">
            <i class="ph ph-warning-octagon" style="color: var(--trend-up);"></i> 
            Recent Losses
            <span style="font-size: 14px; font-weight: normal; color: var(--text-secondary); margin-left: 12px; letter-spacing: 0;">(Updated every 12 hours - Events < 7 days)</span>
        </h2>
        <div class="losses-list">
            ${recentLossesHtml || '<p class="panel-text">No major losses reported in the last 7 days.</p>'}
        </div>
    `;

    container.innerHTML = html;
}

function renderBranch(branchId, container, titleEl, subtitleEl) {
    const branchData = marketData.branches[branchId];
    if (!branchData) return;

    titleEl.textContent = branchData.title;
    subtitleEl.textContent = 'Detailed underwriting intelligence and market impact.';

    const html = `
        <div class="dashboard-grid">
            <div class="panel panel-main">
                <h2 class="panel-title">Market Context</h2>
                <p class="panel-text" style="font-size: 18px;">${branchData.summary}</p>
            </div>
            <div class="metrics-grid">
                ${createMetricCard('Premium Impact', getTrendDetails(branchData.premiumTrend, 'premium'), branchData.premiumImpact)}
                ${createMetricCard('Capacity Impact', getTrendDetails(branchData.capacityTrend, 'capacity'), branchData.capacityImpact)}
            </div>
        </div>

        <h2 class="section-title"><i class="ph ph-newspaper"></i> Latest Intelligence</h2>
        <div class="news-grid">
            ${branchData.news.map(article => `
                <article class="news-card">
                    <div class="news-meta">
                        <span>${article.source}</span>
                        <span>${article.date}</span>
                    </div>
                    <h3 class="news-headline">${article.headline}</h3>
                    <a href="#" class="news-link">Read full abstract <i class="ph ph-arrow-right"></i></a>
                </article>
            `).join('')}
        </div>
    `;

    container.innerHTML = html;
}

function createMetricCard(title, trendStyle, description) {
    return `
        <div class="metric-card">
            <div class="metric-header">
                <span class="metric-title">${title}</span>
                <span class="metric-badge ${trendStyle.class}">
                    ${trendStyle.text}
                    <i class="ph ph-arrow-right"></i>
                </span>
            </div>
            ${description ? `<div class="metric-value">${description}</div>` : ''}
        </div>
    `;
}

function getTrendDetails(trendRaw, type) {
    const trend = trendRaw.toLowerCase();
    
    // Default fallback
    let details = { class: 'trend-stable', text: 'Stable' };
    
    if (trend === 'hardening') details = { class: 'trend-hardening', text: 'Hardening' };
    if (trend === 'softening') details = { class: 'trend-softening', text: 'Softening' };
    if (trend === 'expanding') details = { class: 'trend-expanding', text: 'Expanding' };
    if (trend === 'contracting') details = { class: 'trend-contracting', text: 'Contracting' };
    if (trend === 'stable') details = { class: 'trend-stable', text: 'Stable' };
    
    return details;
}

function getBranchKey(title) {
    if (title.includes('Oil')) return 'downstream-oil-gas';
    if (title.includes('Power')) return 'downstream-power';
    if (title.includes('Renewable')) return 'downstream-renewables';
    if (title.includes('Upstream')) return 'upstream-offshore';
    return '';
}

function renderLossesDirectory(container, titleEl, subtitleEl) {
    titleEl.textContent = 'Global Loss Registry';
    subtitleEl.textContent = 'Comprehensive log of major energy facility losses and market impacts.';

    const allLossesHtml = (marketData.losses || []).map(loss => renderLossCard(loss)).join('');

    const html = `
        <div class="panel panel-main" style="margin-bottom: 40px; border-color: rgba(255, 90, 90, 0.3);">
            <h2 class="panel-title" style="color: var(--trend-up);"><i class="ph ph-warning-octagon"></i> Loss Intelligence Overview</h2>
            <p class="panel-text">This directory tracks major localized and systemic losses affecting the energy insurance market. Entries provide estimated quantum and broader underwriting impact.</p>
        </div>
        
        <div class="losses-list">
            ${allLossesHtml || '<p class="panel-text">No losses documented.</p>'}
        </div>
    `;
    container.innerHTML = html;
}

function renderLossCard(loss) {
    const formattedDate = new Date(loss.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const statusClass = loss.status.replace(/\s+/g, '-').toLowerCase();
    
    return `
        <div class="loss-card">
            <div class="loss-card-header">
                <div>
                    <h3 class="loss-facility">${loss.facility}</h3>
                    <span class="loss-sector">${loss.sector}</span>
                </div>
                <div class="loss-amount">${loss.estimatedLoss}</div>
            </div>
            <div class="loss-card-body">
                <p class="loss-type"><i class="ph ph-fire" style="color: var(--trend-up);"></i> <strong>Event:</strong> ${loss.type}</p>
                <p class="loss-desc">${loss.description}</p>
                <div class="loss-impact"><i class="ph ph-trend-down" style="color: var(--accent-cyan);"></i> <strong>Market Impact:</strong> ${loss.impact}</div>
            </div>
            <div class="loss-card-footer">
                <span class="loss-date"><i class="ph ph-calendar"></i> ${formattedDate}</span>
                <span class="loss-status status-${statusClass}">${loss.status}</span>
            </div>
        </div>
    `;
}
