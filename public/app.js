// Use a relative API path so the frontend works both locally and when deployed
// Server serves API at /api; using a relative path avoids hardcoding host/port.
const API_URL = '/api';

let currentQuery = '';
let currentLocation = '';
let currentFilter = 'all';
let allResults = null;

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const locationInput = document.getElementById('locationInput');
const refreshBtn = document.getElementById('refreshBtn');
const loading = document.getElementById('loading');
const results = document.getElementById('results');
const emptyState = document.getElementById('emptyState');
const contentGrid = document.getElementById('contentGrid');
const filterBtns = document.querySelectorAll('.filter-btn');
const platformBtns = document.querySelectorAll('.platform-btn');

// Event Listeners
searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

refreshBtn.addEventListener('click', () => {
    if (currentQuery) performSearch();
});

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        if (allResults) displayResults(allResults);
    });
});

platformBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        platformBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const platform = btn.dataset.platform;
        filterByPlatform(platform);
    });
});

// Get user location
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async (position) => {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json`);
            const data = await response.json();
            const city = data.address.city || data.address.town || data.address.village || '';
            const state = data.address.state || '';
            locationInput.value = `${city}, ${state}`.trim();
            currentLocation = locationInput.value;
        } catch (error) {
            console.error('Location error:', error);
        }
    });
}

locationInput.addEventListener('change', () => {
    currentLocation = locationInput.value;
    if (currentQuery) performSearch();
});

async function performSearch() {
    currentQuery = searchInput.value.trim();
    currentLocation = locationInput.value.trim();
    
    if (!currentQuery) return;
    
    loading.classList.remove('hidden');
    emptyState.classList.add('hidden');
    contentGrid.innerHTML = '';
    
    try {
        const response = await fetch(`${API_URL}/search?query=${encodeURIComponent(currentQuery)}&location=${encodeURIComponent(currentLocation)}`);
        const data = await response.json();
        
        allResults = data;
        displayResults(data);
    } catch (error) {
        console.error('Search error:', error);
        contentGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px;">Error fetching results. Please check if the server is running.</div>';
    } finally {
        loading.classList.add('hidden');
    }
}

function displayResults(data) {
    contentGrid.innerHTML = '';
    
    let allItems = [];
    
    if (currentFilter === 'all' || currentFilter === 'social') {
        const platforms = ['youtube', 'tiktok', 'instagram', 'twitch'];
        platforms.forEach(platform => {
            if (data.social && data.social[platform] && data.social[platform].length > 0) {
                allItems = allItems.concat(data.social[platform].map(item => ({
                    ...item,
                    platform: platform,
                    type: 'social'
                })));
            }
        });
    }
    
    if (currentFilter === 'all' || currentFilter === 'news') {
        const sources = ['cnn', 'fox', 'bbc'];
        sources.forEach(source => {
            if (data.news && data.news[source] && data.news[source].length > 0) {
                allItems = allItems.concat(data.news[source].map(item => ({
                    ...item,
                    platform: source,
                    type: 'news'
                })));
            }
        });
    }
    
    if (allItems.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    
    allItems.forEach(item => {
        const card = createContentCard(item);
        contentGrid.appendChild(card);
    });
}

function createContentCard(item) {
    const card = document.createElement('div');
    card.className = 'content-card';
    card.onclick = () => {
        if (item.url && item.url !== '#') {
            window.open(item.url, '_blank');
        }
    };
    
    // Create thumbnail section
    const thumbnailWrapper = document.createElement('div');
    thumbnailWrapper.className = 'thumbnail-wrapper';
    
    // Get placeholder based on platform/source
    const placeholder = getPlaceholderImage(item.platform || item.source);
    
    if (item.thumbnail) {
        const img = document.createElement('img');
        img.src = item.thumbnail;
        img.alt = item.title;
        img.className = 'content-thumbnail';
        img.onerror = () => {
            // If image fails to load, show placeholder
            img.src = placeholder;
        };
        thumbnailWrapper.appendChild(img);
    } else {
        // No thumbnail provided, use placeholder
        const img = document.createElement('img');
        img.src = placeholder;
        img.alt = item.title;
        img.className = 'content-thumbnail';
        thumbnailWrapper.appendChild(img);
    }
    
    // Create content info section
    const contentInfo = document.createElement('div');
    contentInfo.className = 'content-info';
    
    const title = document.createElement('div');
    title.className = 'content-title';
    title.textContent = item.title;
    
    const meta = document.createElement('div');
    meta.className = 'content-meta';
    
    const source = document.createElement('span');
    source.className = 'content-source';
    source.textContent = item.source || getPlatformName(item.platform);
    
    meta.appendChild(source);
    
    contentInfo.appendChild(title);
    contentInfo.appendChild(meta);
    
    card.appendChild(thumbnailWrapper);
    card.appendChild(contentInfo);
    
    return card;
}

function getPlaceholderImage(platform) {
    const placeholders = {
        youtube: 'https://via.placeholder.com/640x360/FF0000/FFFFFF?text=YouTube',
        tiktok: 'https://via.placeholder.com/640x360/000000/FFFFFF?text=TikTok',
        instagram: 'https://via.placeholder.com/640x360/E4405F/FFFFFF?text=Instagram',
        twitch: 'https://via.placeholder.com/640x360/9146FF/FFFFFF?text=Twitch',
        CNN: 'https://via.placeholder.com/640x360/CC0000/FFFFFF?text=CNN',
        FOX: 'https://via.placeholder.com/640x360/003366/FFFFFF?text=Fox+News',
        BBC: 'https://via.placeholder.com/640x360/000000/FFFFFF?text=BBC',
        cnn: 'https://via.placeholder.com/640x360/CC0000/FFFFFF?text=CNN',
        fox: 'https://via.placeholder.com/640x360/003366/FFFFFF?text=Fox+News',
        bbc: 'https://via.placeholder.com/640x360/000000/FFFFFF?text=BBC'
    };
    
    const normalizedPlatform = platform ? platform.toLowerCase() : 'default';
    return placeholders[platform] || placeholders[normalizedPlatform] || 'https://via.placeholder.com/640x360/7b6cff/FFFFFF?text=Content';
}

function getPlatformName(platform) {
    const names = {
        youtube: 'YouTube',
        tiktok: 'TikTok',
        instagram: 'Instagram',
        twitch: 'Twitch',
        cnn: 'CNN',
        fox: 'Fox News',
        bbc: 'BBC',
        local: 'Local News'
    };
    return names[platform] || platform;
}

function filterByPlatform(platform) {
    if (!allResults) return;
    
    contentGrid.innerHTML = '';
    
    const platformMap = {
        youtube: 'social',
        tiktok: 'social',
        instagram: 'social',
        twitch: 'social',
        cnn: 'news',
        fox: 'news',
        bbc: 'news',
        local: 'news'
    };
    
    const category = platformMap[platform];
    let items = [];
    
    if (category === 'social' && allResults.social && allResults.social[platform]) {
        items = allResults.social[platform].map(item => ({
            ...item,
            platform: platform,
            type: 'social'
        }));
    } else if (category === 'news' && allResults.news && allResults.news[platform]) {
        items = allResults.news[platform].map(item => ({
            ...item,
            platform: platform,
            type: 'news'
        }));
    }
    
    if (items.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    items.forEach(item => {
        const card = createContentCard(item);
        contentGrid.appendChild(card);
    });
}