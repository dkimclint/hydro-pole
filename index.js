import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://gpzsvdkzszsmsdgbfjxa.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwenN2ZGt6c3pzbXNkZ2JmanhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjUyNDEsImV4cCI6MjA3NTIwMTI0MX0.vFimumf9ZNFssGggPkqibFinqfpqPtZL5eNrXoKQjsw';

const supabase = createClient(supabaseUrl, supabaseKey);

let map;
let userLocationMarker = null;
let userLocationCircle = null;
let watchId = null;
let isMobile = false;
let currentUserLocation = null;

// Station management
let stations = [];
let stationMarkers = [];
let selectedStation = null;

// Track previous water levels to detect changes
let previousWaterLevels = new Map();

// === SMART THROTTLING VARIABLES ===
let lastStationUpdate = 0;
const MIN_UPDATE_INTERVAL = 3000; // 5 seconds minimum between updates
let isUpdating = false;

// === Initialize everything when DOM is loaded ===
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded - initializing app');
    checkMobileDevice();
    initMap();
    initEventListeners();
    loadDarkModePreference();
    loadStations();
    startRealTimeUpdates();
    requestUserLocation();
    initDashboard();
    loadInitialData();
    
    console.log('HydroPole App initialized successfully!');
});

// === Check if device is mobile ===
function checkMobileDevice() {
    isMobile = window.innerWidth <= 768;
    console.log('Mobile device detected:', isMobile);
    
    if (isMobile) {
        document.body.classList.add('mobile-device');
        document.querySelectorAll('.mobile-only').forEach(el => {
            el.style.display = 'block';
        });
    } else {
        document.body.classList.add('desktop-device');
    }
}

// === Initialize Map ===
function initMap() {
    console.log('Initializing map...');
    
    const defaultCoords = [14.8322, 120.7333];
    const zoomLevel = isMobile ? 12 : 13;
    
    map = L.map('map', {
        zoomControl: false,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        dragging: true,
        touchZoom: true,
        tap: true,
        preferCanvas: false
    }).setView(defaultCoords, zoomLevel);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        minZoom: 3
    }).addTo(map);
    
    const mapContainer = map.getContainer();
    mapContainer.style.pointerEvents = 'auto';
    mapContainer.style.touchAction = 'pan-x pan-y pinch-zoom';
    mapContainer.style.cursor = 'grab';
    
    map.on('mousedown', function() {
        mapContainer.style.cursor = 'grabbing';
    });
    
    map.on('mouseup', function() {
        mapContainer.style.cursor = 'grab';
    });
    
    setTimeout(() => {
        map.invalidateSize();
    }, 100);
    
    console.log('Map initialized successfully');
}

// === Initialize Dashboard ===
function initDashboard() {
    const panelToggles = document.querySelectorAll('.panel-toggle');
    panelToggles.forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            e.stopPropagation();
            const panel = this.closest('.dashboard-panel');
            panel.classList.toggle('collapsed');
            
            const icon = this.querySelector('i');
            if (panel.classList.contains('collapsed')) {
                icon.style.transform = 'rotate(-90deg)';
            } else {
                icon.style.transform = 'rotate(0deg)';
            }
        });
    });
    
    const panels = document.querySelectorAll('.dashboard-panel');
    panels.forEach(panel => {
        if (isMobile) {
            panel.classList.add('collapsed');
            const icon = panel.querySelector('.panel-toggle i');
            if (icon) {
                icon.style.transform = 'rotate(-90deg)';
            }
        } else {
            panel.classList.remove('collapsed');
            const icon = panel.querySelector('.panel-toggle i');
            if (icon) {
                icon.style.transform = 'rotate(0deg)';
            }
        }
    });
}

// === Initialize Event Listeners ===
function initEventListeners() {
    console.log('Initializing event listeners...');
    
    // Dark mode toggle
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', toggleDarkMode);
    }
    
    // Desktop map controls
    const zoomInBtn = document.getElementById('zoomInBtn');
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            if (map) {
                map.zoomIn();
            }
        });
    }
    
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            if (map) {
                map.zoomOut();
            }
        });
    }
    
    // Desktop map controls - My Location button
    const desktopMyLocationBtn = document.getElementById('desktopMyLocationBtn');
    if (desktopMyLocationBtn) {
        desktopMyLocationBtn.addEventListener('click', function() {
            focusOnUser();
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
    }
    
    // Mobile map controls - My Location button
    const mobileMyLocationBtn = document.getElementById('mobileMyLocationBtn');
    if (mobileMyLocationBtn) {
        mobileMyLocationBtn.addEventListener('click', function() {
            console.log('Mobile My Location button clicked');
            focusOnUser();
            this.style.transform = 'scale(0.9)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
    }
    
    // Mobile map controls - Notifications button
    const mobileNotificationsBtn = document.getElementById('mobileNotificationsBtn');
    if (mobileNotificationsBtn) {
        mobileNotificationsBtn.addEventListener('click', function() {
            console.log('Mobile Notifications button clicked');
            showNotificationsPanel();
            this.style.transform = 'scale(0.9)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
    }
    
    // Search toggle
    const searchToggle = document.getElementById('searchToggle');
    if (searchToggle) {
        searchToggle.addEventListener('click', toggleSearch);
    }
    
    // Search form
    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', handleSearch);
    }
    
    // Station search toggle
    const searchStationBtn = document.getElementById('searchStationBtn');
    if (searchStationBtn) {
        searchStationBtn.addEventListener('click', toggleStationSearch);
    }
    
    // Station search form
    const stationSearchForm = document.getElementById('stationSearchForm');
    if (stationSearchForm) {
        stationSearchForm.addEventListener('submit', handleStationSearch);
    }
    
    // Add real-time search for stations
    const stationSearchBox = document.getElementById('stationSearchBox');
    if (stationSearchBox) {
        stationSearchBox.addEventListener('input', function() {
            const query = this.value.trim();
            showStationSearchResults(query);
        });
    }
    
    // Refresh stations button
    const refreshStations = document.getElementById('refreshStations');
    if (refreshStations) {
        refreshStations.addEventListener('click', loadStations);
    }
    
    // Mobile menu close button
    const closeMenu = document.getElementById('closeMenu');
    if (closeMenu) {
        closeMenu.addEventListener('click', hideMobileMenu);
    }
    
    // Close search when clicking outside - MOBILE COMPATIBLE
    document.addEventListener('click', function(e) {
        const searchContainer = document.querySelector('.search-container');
        const searchToggle = document.getElementById('searchToggle');
        const stationSearchContainer = document.querySelector('.station-search-container');
        const searchStationBtn = document.getElementById('searchStationBtn');
        
        if (searchContainer && searchToggle && 
            !searchContainer.contains(e.target) && 
            !searchToggle.contains(e.target)) {
            searchContainer.classList.remove('active');
        }
        
        if (stationSearchContainer && searchStationBtn && 
            !stationSearchContainer.contains(e.target) && 
            !searchStationBtn.contains(e.target)) {
            stationSearchContainer.classList.remove('active');
        }
        
        // Close mobile menu when clicking outside content
        const overlay = document.querySelector('.mobile-menu-overlay');
        if (overlay && overlay.classList.contains('active') && 
            !overlay.querySelector('.overlay-content').contains(e.target) &&
            !e.target.closest('.mobile-control-btn')) {
            hideMobileMenu();
        }
    });
    
    // Handle window resize
    window.addEventListener('resize', handleResize);
    
    console.log('All event listeners initialized successfully');
}

// === Handle Window Resize ===
function handleResize() {
    const wasMobile = isMobile;
    checkMobileDevice();
    
    if (wasMobile !== isMobile) {
        console.log('Device orientation changed, refreshing layout...');
        if (map) {
            map.invalidateSize();
        }
        
        initDashboard();
    }
}

// === FIXED: Show Notifications Panel ===
function showNotificationsPanel() {
    console.log('Opening notifications panel...');
    const overlay = document.querySelector('.mobile-menu-overlay');
    const overlayContent = document.querySelector('.overlay-content');
    
    if (!overlay || !overlayContent) return;
    
    overlayContent.innerHTML = `
        <div class="notifications-header">
            <h4><i class="fas fa-bell"></i> Recent Alerts & Updates</h4>
            <p class="notifications-subtitle">Past water level changes and system alerts</p>
        </div>
        <div class="notifications-list" id="mobileNotificationsList">
            <div class="notification-item">
                <div class="notification-icon">
                    <i class="fas fa-info-circle"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">System Ready</div>
                    <div class="notification-message">Flood monitoring system is active and receiving data</div>
                    <div class="notification-time">Just now</div>
                </div>
            </div>
        </div>
        <div class="notifications-actions">
            <button class="clear-notifications-btn">
                <i class="fas fa-trash"></i> Clear All
            </button>
        </div>
    `;
    
    loadMobileNotifications();
    
    const clearBtn = overlayContent.querySelector('.clear-notifications-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearNotifications);
    }
    
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    console.log('Notifications panel opened');
}

// === Load Mobile Notifications ===
function loadMobileNotifications() {
    const notificationsList = document.getElementById('mobileNotificationsList');
    if (!notificationsList) return;
    
    const alertItems = document.querySelectorAll('#alertList .alert-item');
    const notifications = [];
    
    notifications.push({
        type: 'info',
        title: 'System Status',
        message: 'Monitoring system is active and receiving real-time data',
        time: 'Just now',
        icon: 'fa-info-circle'
    });
    
    alertItems.forEach((alert, index) => {
        if (index < 8) {
            const icon = alert.querySelector('i').className;
            const message = alert.querySelector('span').textContent;
            const type = alert.classList.contains('warning') ? 'warning' : 
                        alert.classList.contains('danger') ? 'danger' : 
                        alert.classList.contains('success') ? 'success' : 'info';
            
            notifications.push({
                type: type,
                title: type === 'danger' ? 'Flood Alert' : 
                      type === 'warning' ? 'Water Level Warning' : 
                      type === 'success' ? 'Normal Conditions' : 'System Update',
                message: message,
                time: 'Recent',
                icon: icon.includes('exclamation-triangle') ? 'fa-exclamation-triangle' :
                     icon.includes('check-circle') ? 'fa-check-circle' :
                     icon.includes('times-circle') ? 'fa-times-circle' : 'fa-info-circle'
            });
        }
    });
    
    if (notifications.length <= 1) {
        notifications.push({
            type: 'info',
            title: 'No Recent Alerts',
            message: 'Water levels are being monitored. You will be notified of any changes.',
            time: 'System',
            icon: 'fa-water'
        });
    }
    
    notificationsList.innerHTML = notifications.map(notification => `
        <div class="notification-item ${notification.type}">
            <div class="notification-icon">
                <i class="fas ${notification.icon}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-title">${notification.title}</div>
                <div class="notification-message">${notification.message}</div>
                <div class="notification-time">${notification.time}</div>
            </div>
        </div>
    `).join('');
}

// === Clear Notifications ===
function clearNotifications() {
    const alertList = document.getElementById('alertList');
    if (alertList) {
        alertList.innerHTML = '<div class="alert-item"><i class="fas fa-info-circle"></i><span>No recent alerts</span></div>';
    }
    
    loadMobileNotifications();
    
    showWaterLevelAlert('Notifications cleared', 'success');
}

// === Hide Mobile Menu ===
function hideMobileMenu() {
    console.log('Closing mobile menu...');
    const overlay = document.querySelector('.mobile-menu-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
    document.body.style.overflow = '';
    
    console.log('Mobile menu closed');
}

// Debounce timer for loadStations to prevent excessive calls
let loadStationsTimer = null;
let isLoadingStations = false;

// === Load Stations from flood_data, hydropole_devices, and monitoring_stations tables ===
async function loadStations() {
    if (isLoadingStations) {
        console.log('loadStations already in progress, skipping...');
        return;
    }
    
    if (loadStationsTimer) {
        clearTimeout(loadStationsTimer);
        loadStationsTimer = null;
    }
    
    isLoadingStations = true;
    
    try {
        const stationsList = document.getElementById('stationsList');
        const refreshBtn = document.getElementById('refreshStations');
        
        if (stationsList) {
            stationsList.innerHTML = '<div class="loading-stations">Loading flood monitoring data...</div>';
        }
        if (refreshBtn) {
            refreshBtn.classList.add('loading');
        }
        
        // Fetch data from all three tables in parallel
        const [floodDataResult, devicesResult, stationsResult] = await Promise.all([
            supabase.from('flood_data').select('*').order('timestamp', { ascending: false }).limit(100),
            supabase.from('hydropole_devices').select('*'),
            supabase.from('monitoring_stations').select('*')
        ]);

        // Check for errors
        if (floodDataResult.error) {
            console.error('Error loading flood_data:', floodDataResult.error);
        }
        if (devicesResult.error) {
            console.error('Error loading hydropole_devices:', devicesResult.error);
        }
        if (stationsResult.error) {
            console.error('Error loading monitoring_stations:', stationsResult.error);
        }

        const floodData = floodDataResult.data || [];
        const devices = devicesResult.data || [];
        const stationInfo = stationsResult.data || [];

        console.log(`Loaded: ${floodData.length} flood records, ${devices.length} devices, ${stationInfo.length} station records`);

        if (floodData.length === 0 && devices.length === 0) {
            if (stationsList) {
                stationsList.innerHTML = `
                    <div class="no-stations">
                        <i class="fas fa-water"></i>
                        <p>No flood data available</p>
                        <p class="station-help">Waiting for real-time data from monitoring devices...</p>
                    </div>
                `;
            }
            stations = [];
            updateStationMarkers();
            updateStationsCount();
            if (refreshBtn) {
                refreshBtn.classList.remove('loading');
            }
            return;
        }

        // Create maps for quick lookup
        const deviceMap = new Map();
        devices.forEach(device => {
            if (device.device_id) {
                deviceMap.set(device.device_id, device);
            }
        });

        const stationInfoMap = new Map();
        stationInfo.forEach(station => {
            if (station.device_id) {
                stationInfoMap.set(station.device_id, station);
            }
        });

        // Group flood_data by device_id to get latest record per device
        const latestFloodDataMap = new Map();
        floodData.forEach(record => {
            const deviceId = record.device_id;
            if (!deviceId) {
                console.warn('Record missing device_id:', record);
                return;
            }
            
            if (!latestFloodDataMap.has(deviceId) || 
                new Date(record.timestamp || record.created_at || Date.now()) > 
                new Date(latestFloodDataMap.get(deviceId).timestamp || latestFloodDataMap.get(deviceId).created_at || 0)) {
                latestFloodDataMap.set(deviceId, record);
            }
        });

        // Store current water levels before update for comparison
        const currentWaterLevels = new Map();
        stations.forEach(station => {
            if (station.device_id && station.water_level !== null) {
                currentWaterLevels.set(station.device_id, station.water_level);
            }
        });

        // Combine data from all three tables
        const newStations = [];
        
        // Process devices that have flood data
        latestFloodDataMap.forEach((floodRecord, deviceId) => {
            const device = deviceMap.get(deviceId);
            const station = stationInfoMap.get(deviceId);
            
            // Parse water level from database
            let waterLevel = null;
            if (floodRecord.water_level !== null && floodRecord.water_level !== undefined) {
                waterLevel = parseFloat(floodRecord.water_level);
                if (isNaN(waterLevel)) {
                    console.warn(`Invalid water_level for device ${deviceId}:`, floodRecord.water_level);
                    waterLevel = null;
                }
            }
            
            // === ENHANCED GPS COORDINATE HANDLING ===
            let lat = null;
            let lng = null;
            let gpsSource = 'default';
            
            // PRIORITY 1: Use GPS coordinates from flood_data (if available and valid)
            if (floodRecord.gps_lat && floodRecord.gps_lng && 
                isValidCoordinate(floodRecord.gps_lat, floodRecord.gps_lng)) {
                lat = parseFloat(floodRecord.gps_lat);
                lng = parseFloat(floodRecord.gps_lng);
                gpsSource = 'live_gps';
                console.log(`📍 Using LIVE GPS coordinates for ${deviceId}: ${lat}, ${lng}`);
            }
            // PRIORITY 2: Use monitoring_stations coordinates
            else if (station) {
                lat = parseFloat(station.lat || station.latitude);
                lng = parseFloat(station.lng || station.longitude || station.long || station.longitude);
                gpsSource = 'station_db';
            }
            // PRIORITY 3: Use device coordinates
            else if (device) {
                lat = parseFloat(device.current_lat || device.latitude);
                lng = parseFloat(device.current_lng || device.current_long || device.longitude || device.lng);
                gpsSource = 'device_db';
            }
            // PRIORITY 4: Use flood_data coordinates as fallback
            else if (floodRecord) {
                lat = parseFloat(floodRecord.gps_lat || floodRecord.latitude);
                lng = parseFloat(floodRecord.gps_lng || floodRecord.gps_long || floodRecord.longitude);
                gpsSource = 'flood_data';
            }
            
            // Special handling for HYDROPOLE_001 - ensure it gets proper coordinates
            if (deviceId === 'HYDROPOLE_001') {
                if (!lat || isNaN(lat) || !isValidCoordinate(lat, lng)) {
                    console.log('Setting default coordinates for HYDROPOLE_001');
                    lat = 14.847090;
                    lng = 120.813300;
                    gpsSource = 'default_fallback';
                }
            } else if ((!lat || isNaN(lat) || !isValidCoordinate(lat, lng)) && deviceId) {
                console.warn(`Device ${deviceId} missing valid coordinates, using default location`);
                lat = 14.847090;
                lng = 120.813300;
                gpsSource = 'default_fallback';
            }
            
            if ((!lng || isNaN(lng)) && deviceId) {
                lng = 120.813300;
            }
            
            const deviceName = station?.name || device?.device_name || `Station ${deviceId}`;
            const location = station?.location || getLocationFromStatus(floodRecord.status);
            
            newStations.push({
                id: deviceId,
                record_id: floodRecord.id,
                device_id: deviceId,
                name: deviceName,
                location: location,
                latitude: lat,
                longitude: lng,
                water_level: waterLevel,
                status: floodRecord.status || 'unknown',
                message: floodRecord.message || null,
                battery_level: floodRecord.battery_level !== null && floodRecord.battery_level !== undefined ? parseFloat(floodRecord.battery_level) : null,
                signal_strength: floodRecord.signal_strength !== null && floodRecord.signal_strength !== undefined ? parseFloat(floodRecord.signal_strength) : null,
                last_communication: floodRecord.timestamp || floodRecord.created_at || new Date().toISOString(),
                sim_number: device?.sim_number || null,
                gps_source: gpsSource // Track where coordinates came from
            });
        });
        
        // Also include devices that don't have flood data yet
        devices.forEach(device => {
            if (device.device_id && !latestFloodDataMap.has(device.device_id)) {
                const station = stationInfoMap.get(device.device_id);
                
                let lat = null;
                let lng = null;
                let gpsSource = 'device_only';
                
                if (station) {
                    lat = parseFloat(station.lat || station.latitude);
                    lng = parseFloat(station.lng || station.longitude || station.long);
                    gpsSource = 'station_db';
                }
                
                if ((!lat || isNaN(lat)) && device) {
                    lat = parseFloat(device.current_lat || device.latitude);
                    lng = parseFloat(device.current_lng || device.current_long || device.longitude || device.lng);
                    gpsSource = 'device_db';
                }
                
                // Special handling for HYDROPOLE_001
                if (device.device_id === 'HYDROPOLE_001') {
                    if (!lat || isNaN(lat)) {
                        lat = 14.847090;
                        lng = 120.813300;
                        gpsSource = 'default_fallback';
                    }
                } else if ((!lat || isNaN(lat)) && device.device_id) {
                    lat = 14.847090;
                    lng = 120.813300;
                    gpsSource = 'default_fallback';
                }
                
                if ((!lng || isNaN(lng)) && device.device_id) {
                    lng = 120.813300;
                }
                
                newStations.push({
                    id: device.device_id,
                    device_id: device.device_id,
                    name: station?.name || device.device_name || `Station ${device.device_id}`,
                    location: station?.location || device.device_name || 'Device Location',
                    latitude: lat,
                    longitude: lng,
                    water_level: null,
                    status: 'unknown',
                    message: null,
                    battery_level: null,
                    signal_strength: null,
                    last_communication: null,
                    sim_number: device.sim_number || null,
                    gps_source: gpsSource
                });
            }
        });

        // Update stations array
        stations = newStations;

        // Check for water level changes and create appropriate alerts
        checkForWaterLevelChanges(currentWaterLevels);

        renderStationsList();
        updateStationMarkers();
        updateStationsCount();
        
        if (stations.length > 0) {
            console.log(`✅ Loaded ${stations.length} monitoring station(s) from database`);
            // Log GPS sources for debugging
            stations.forEach(station => {
                console.log(`📍 ${station.device_id}: ${station.latitude}, ${station.longitude} (Source: ${station.gps_source})`);
            });
        }
        
        if (refreshBtn) {
            refreshBtn.classList.remove('loading');
        }
    } catch (error) {
        console.error('Error loading stations:', error);
        showWaterLevelAlert('Error loading stations: ' + error.message, 'error');
        const refreshBtn = document.getElementById('refreshStations');
        if (refreshBtn) {
            refreshBtn.classList.remove('loading');
        }
        const stationsList = document.getElementById('stationsList');
        if (stationsList) {
            stationsList.innerHTML = `
                <div class="no-stations">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error Loading Data</p>
                    <p class="station-help">${error.message}</p>
                    <button class="add-station-btn" onclick="loadStations()">
                        <i class="fas fa-sync"></i> Retry
                    </button>
                </div>
            `;
        }
    } finally {
        isLoadingStations = false;
    }
}

// === Validate GPS Coordinates ===
function isValidCoordinate(lat, lng) {
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return false;
    
    // Check if coordinates are within reasonable Philippines range
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    
    return (latNum >= 14.0 && latNum <= 15.0 && lngNum >= 120.0 && lngNum <= 121.0);
}

// === Get Water Level Status Based on Water Level ===
function getWaterLevelStatus(waterLevel) {
    if (waterLevel === null || waterLevel === undefined) return 'offline';
    
    const level = parseFloat(waterLevel);
    if (isNaN(level)) return 'offline';
    
    // Color coding based on water level thresholds
    if (level >= 2.6) return 'danger';     // Red - High risk
    if (level >= 1.1) return 'warning';    // Orange - Elevated
    if (level >= 0) return 'safe';         // Green - Normal
    
    return 'offline';                      // Gray - No data/offline
}

// === Get Station Status ===
function getStationStatus(station) {
    if (!station.last_communication) return 'offline';
    
    const lastUpdate = new Date(station.last_communication);
    const now = new Date();
    const minutesSinceUpdate = (now - lastUpdate) / (1000 * 60);
    
    if (minutesSinceUpdate > 60) return 'offline';
    
    // Use water level for status if available
    return getWaterLevelStatus(station.water_level);
}

// === Check for Water Level Changes ===
function checkForWaterLevelChanges(previousLevels) {
    stations.forEach(station => {
        if (station.device_id && station.water_level !== null) {
            const previousLevel = previousLevels.get(station.device_id);
            const currentLevel = station.water_level;
            const currentStatus = getWaterLevelStatus(currentLevel);
            const previousStatus = previousLevel !== undefined ? getWaterLevelStatus(previousLevel) : null;
            
            // Only create alert if level changed significantly or status changed
            if (previousLevel !== undefined && 
                (Math.abs(currentLevel - previousLevel) >= 0.1 || 
                 previousStatus !== currentStatus)) {
                
                let alertType = 'info';
                let alertMessage = '';
                
                if (currentStatus === 'danger') {
                    alertType = 'danger';
                    alertMessage = `🚨 DANGER: Water level at ${station.name || station.device_id} is ${currentLevel.toFixed(2)} ft (HIGH RISK)`;
                } else if (currentStatus === 'warning') {
                    alertType = 'warning';
                    alertMessage = `⚠️ ALERT: Water level at ${station.name || station.device_id} is ${currentLevel.toFixed(2)} ft (ELEVATED)`;
                } else if (currentStatus === 'safe') {
                    alertType = 'success';
                    alertMessage = `✅ Water level at ${station.name || station.device_id} is ${currentLevel.toFixed(2)} ft (NORMAL)`;
                }
                
                if (alertMessage) {
                    addWaterLevelAlert(alertMessage, alertType);
                    
                    // Also show toast for danger and warning alerts
                    if (currentStatus === 'danger' || currentStatus === 'warning') {
                        showWaterLevelAlert(alertMessage, alertType);
                    }
                }
            }
        }
    });
}

// Helper function to get location from status
function getLocationFromStatus(status) {
    const statusMap = {
        'safe': 'Normal Water Level',
        'alert': 'Elevated Water Level', 
        'danger': 'Flood Warning Area'
    };
    return statusMap[status] || 'Monitoring Location';
}

// === Render Stations List ===
function renderStationsList() {
    const stationsList = document.getElementById('stationsList');
    if (!stationsList) return;
    
    if (stations.length === 0) {
        stationsList.innerHTML = '<div class="loading-stations">No stations available</div>';
        return;
    }
    
    stationsList.innerHTML = stations.map(station => {
        const status = getStationStatus(station);
        const waterLevel = station.water_level !== null && station.water_level !== undefined && !isNaN(parseFloat(station.water_level)) 
            ? parseFloat(station.water_level).toFixed(2) + ' ft' 
            : 'No data';
        
        // Add GPS source indicator
        const gpsIndicator = station.gps_source === 'live_gps' ? ' 🎯' : 
                            station.gps_source === 'default_fallback' ? ' ⚠️' : '';
        
        return `
        <div class="station-item ${selectedStation?.id === station.id ? 'active' : ''}" 
             data-station-id="${station.id}"
             data-lat="${station.latitude}"
             data-lng="${station.longitude}">
            <div class="station-info">
                <div class="station-name">${station.name || 'Unnamed Station'}${gpsIndicator}</div>
                <div class="station-location">${station.location || 'Location not set'}</div>
                <div class="station-coordinates">${parseFloat(station.latitude).toFixed(4)}, ${parseFloat(station.longitude).toFixed(4)}</div>
                <div class="station-data">
                    <span class="water-level-badge ${status}">${waterLevel}</span>
                </div>
            </div>
            <div class="station-status ${status}" title="${status.toUpperCase()}"></div>
        </div>
    `}).join('');
    
    // Add event listeners to station items
    const stationItems = stationsList.querySelectorAll('.station-item');
    stationItems.forEach(item => {
        item.addEventListener('click', function() {
            const stationId = this.getAttribute('data-station-id');
            console.log('Station item clicked, ID:', stationId);
            let station = stations.find(s => s.id === stationId);
            if (!station) {
                station = stations.find(s => s.device_id === stationId);
            }
            if (!station) {
                station = stations.find(s => s.record_id === stationId);
            }
            if (station) {
                selectStation(station);
            } else {
                console.warn('Station not found with ID:', stationId);
            }
        });
        
        // Add hover effects for better UX
        item.addEventListener('mouseenter', function() {
            this.style.cursor = 'pointer';
            this.style.transform = 'translateY(-2px)';
        });
        
        item.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
}

// === Update Station Markers on Map ===
function updateStationMarkers() {
    if (!map) return;
    
    // Clear existing markers
    stationMarkers.forEach(marker => {
        if (map.hasLayer(marker)) {
            map.removeLayer(marker);
        }
    });
    stationMarkers = [];
    
    // Add new markers
    stations.forEach(station => {
        if (station.latitude && station.longitude && !isNaN(station.latitude) && !isNaN(station.longitude)) {
            const marker = createStationMarker(station);
            if (marker) {
                stationMarkers.push(marker);
                marker.addTo(map);
            }
        } else {
            console.warn('Invalid coordinates for station:', station.device_id, station.latitude, station.longitude);
        }
    });
    
    console.log(`Added ${stationMarkers.length} station markers to map`);
}

// === Create Enhanced Station Marker with Water Level Colors ===
function createStationMarker(station) {
    const status = getWaterLevelStatus(station.water_level);
    const waterLevel = station.water_level !== null && !isNaN(parseFloat(station.water_level)) 
        ? parseFloat(station.water_level) 
        : null;
    
    const waterLevelDisplay = waterLevel !== null ? waterLevel.toFixed(1) + 'ft' : '--';
    
    // Add GPS accuracy indicator
    const gpsAccuracy = station.gps_source === 'live_gps' ? 'gps-accurate' : 'gps-estimated';
    
    const stationIcon = L.divIcon({
        className: `station-marker enhanced ${status} ${gpsAccuracy}`,
        html: `
            <div class="station-marker-container">
                <div class="station-pulse ${status}"></div>
                <div class="station-dot ${status}">
                    <div class="water-level-indicator">
                        <i class="fas fa-tint"></i>
                    </div>
                </div>
                <div class="station-marker-label ${status}">${waterLevelDisplay}</div>
            </div>
        `,
        iconSize: [50, 50],
        iconAnchor: [25, 25]
    });
    
    try {
        const marker = L.marker([parseFloat(station.latitude), parseFloat(station.longitude)], {
            icon: stationIcon,
            zIndexOffset: station.device_id === 'HYDROPOLE_001' ? 2000 : 1000
        });
        
        // Add popup with station info
        const popupContent = createStationPopupContent(station);
        marker.bindPopup(popupContent, {
            className: 'user-popup-enhanced',
            maxWidth: isMobile ? 280 : 300,
            autoClose: true
        });
        
        // Add click event to select station
        marker.on('click', function() {
            selectStation(station);
        });
        
        return marker;
    } catch (error) {
        console.error('Error creating marker for station:', station.device_id, error);
        return null;
    }
}

// === Create Station Popup Content ===
function createStationPopupContent(station) {
    const status = getWaterLevelStatus(station.water_level);
    const lastUpdate = station.last_communication ? new Date(station.last_communication) : null;
    const timeAgo = lastUpdate ? getTimeAgo(lastUpdate) : 'Never';
    const waterLevel = station.water_level !== null && !isNaN(parseFloat(station.water_level)) 
        ? parseFloat(station.water_level) 
        : null;
    
    // Get location name - handle gracefully if API fails
    const locationPromise = getLocationName(parseFloat(station.latitude), parseFloat(station.longitude));
    
    // Use the promise to update the popup if it resolves
    locationPromise.then(locationName => {
        const marker = stationMarkers.find(m => {
            const markerLatLng = m.getLatLng();
            const stationLat = parseFloat(station.latitude);
            const stationLng = parseFloat(station.longitude);
            return Math.abs(markerLatLng.lat - stationLat) < 0.0001 && 
                   Math.abs(markerLatLng.lng - stationLng) < 0.0001;
        });
        if (marker) {
            const freshPopupContent = createEnhancedStationPopupContent(station, locationName, waterLevel, status);
            marker.setPopupContent(freshPopupContent);
        }
    }).catch(error => {
        console.warn('Could not fetch location name for popup:', error);
    });
    
    return createEnhancedStationPopupContent(station, 'Loading location...', waterLevel, status);
}

// === Create Enhanced Station Popup Content ===
function createEnhancedStationPopupContent(station, locationName, waterLevel, status) {
    const lastUpdate = station.last_communication ? new Date(station.last_communication) : null;
    const timeAgo = lastUpdate ? getTimeAgo(lastUpdate) : 'Never';

    // Determine status description based on water level
    let statusDescription = 'No Data';
    if (waterLevel !== null) {
        if (status === 'danger') {
            statusDescription = 'HIGH RISK - Flood Warning';
        } else if (status === 'warning') {
            statusDescription = 'ELEVATED - Monitor Closely';
        } else if (status === 'safe') {
            statusDescription = 'NORMAL - Safe Conditions';
        }
    }

    // GPS source description
    let gpsDescription = 'Estimated Location';
    let gpsIcon = 'fa-map-marker-alt';
    if (station.gps_source === 'live_gps') {
        gpsDescription = 'Live GPS Location';
        gpsIcon = 'fa-satellite';
    } else if (station.gps_source === 'default_fallback') {
        gpsDescription = 'Default Location (GPS Offline)';
        gpsIcon = 'fa-exclamation-triangle';
    }

    return `
        <div class="enhanced-popup-container">
            <div class="enhanced-popup-header">
                <div class="enhanced-popup-icon">
                    <i class="fas fa-satellite-dish"></i>
                </div>
                <div class="enhanced-popup-title-section">
                    <div class="enhanced-popup-title">${station.name || 'Monitoring Station'}</div>
                    <div class="enhanced-popup-subtitle">${station.device_id === 'HYDROPOLE_001' ? 'Primary Monitoring Station' : 'Live Monitoring Station'}</div>
                </div>
            </div>
            
            <div class="enhanced-popup-divider"></div>
            
            <div class="enhanced-popup-content">
                <div class="enhanced-info-grid">
                    ${waterLevel !== null ? `
                    <div class="enhanced-info-item">
                        <div class="enhanced-info-icon water-level">
                            <i class="fas fa-water"></i>
                        </div>
                        <div class="enhanced-info-content">
                            <div class="enhanced-info-label">Water Level</div>
                            <div class="enhanced-info-value level-value">${waterLevel.toFixed(2)} ft</div>
                            <div class="enhanced-level-status ${status}">${statusDescription}</div>
                            <div class="water-level-range">
                                <div class="range-labels">
                                    <span>0 ft</span>
                                    <span>1 ft</span>
                                    <span>2.5 ft</span>
                                    <span>6+ ft</span>
                                </div>
                                <div class="range-bar">
                                    <div class="range-fill ${status}" style="width: ${Math.min((waterLevel / 6) * 100, 100)}%"></div>
                                </div>
                                <div class="range-indicators">
                                    <div class="range-safe"></div>
                                    <div class="range-warning"></div>
                                    <div class="range-danger"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : `
                    <div class="enhanced-info-item">
                        <div class="enhanced-info-icon water-level">
                            <i class="fas fa-water"></i>
                        </div>
                        <div class="enhanced-info-content">
                            <div class="enhanced-info-label">Water Level</div>
                            <div class="enhanced-info-value level-value">No Data</div>
                            <div class="enhanced-level-status offline">WAITING FOR DATA</div>
                        </div>
                    </div>
                    `}
                    
                    <div class="enhanced-info-item">
                        <div class="enhanced-info-icon">
                            <i class="fas fa-map-marker-alt"></i>
                        </div>
                        <div class="enhanced-info-content">
                            <div class="enhanced-info-label">Coordinates</div>
                            <div class="enhanced-info-value coordinates">${parseFloat(station.latitude).toFixed(6)}, ${parseFloat(station.longitude).toFixed(6)}</div>
                        </div>
                    </div>
                    
                    <div class="enhanced-info-item">
                        <div class="enhanced-info-icon">
                            <i class="fas fa-clock"></i>
                        </div>
                        <div class="enhanced-info-content">
                            <div class="enhanced-info-label">Last Updated</div>
                            <div class="enhanced-info-value">${timeAgo}</div>
                            <div class="enhanced-info-date">${lastUpdate ? lastUpdate.toLocaleDateString() : 'Never'}</div>
                        </div>
                    </div>
                    
                    <div class="enhanced-info-item">
                        <div class="enhanced-info-icon">
                            <i class="fas fa-location-dot"></i>
                        </div>
                        <div class="enhanced-info-content">
                            <div class="enhanced-info-label">Location</div>
                            <div class="enhanced-info-value location">${locationName}</div>
                        </div>
                    </div>
                    
                    <div class="enhanced-info-item">
                        <div class="enhanced-info-icon">
                            <i class="fas ${gpsIcon}"></i>
                        </div>
                        <div class="enhanced-info-content">
                            <div class="enhanced-info-label">GPS Status</div>
                            <div class="enhanced-info-value">${gpsDescription}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="enhanced-popup-footer">
                <div class="enhanced-accuracy-info">
                    <i class="fas fa-satellite"></i>
                    ${station.device_id === 'HYDROPOLE_001' ? 'Primary Station • Real-time GPS' : 'Live Monitoring • Real-time GPS'}
                </div>
            </div>
        </div>
    `;
}

// === Select Station ===
function selectStation(station) {
    console.log('Selecting station:', station);
    
    selectedStation = station;
    
    // Only move to station location, don't show panel
    if (station.latitude && station.longitude && map) {
        const stationLatLng = [parseFloat(station.latitude), parseFloat(station.longitude)];
        const zoomLevel = 16;
        
        // Use flyTo for smooth animation to the station location
        map.flyTo(stationLatLng, zoomLevel, {
            duration: 1.5,
            easeLinearity: 0.25
        });
        
        // Open station marker popup after animation
        setTimeout(() => {
            const stationMarker = stationMarkers.find(marker => {
                const markerLatLng = marker.getLatLng();
                const stationLat = parseFloat(station.latitude);
                const stationLng = parseFloat(station.longitude);
                
                return Math.abs(markerLatLng.lat - stationLat) < 0.0001 && 
                       Math.abs(markerLatLng.lng - stationLng) < 0.0001;
            });
            
            if (stationMarker) {
                stationMarker.openPopup();
            }
        }, 1600);
    }
    
    if (isMobile) {
        hideMobileMenu();
    }
}

// === Get Time Ago ===
function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

// === Update Stations Count ===
function updateStationsCount() {
    const onlineStations = stations.filter(station => {
        const status = getStationStatus(station);
        return status === 'safe' || status === 'warning' || status === 'danger';
    }).length;
    const totalStations = stations.length;
    
    const countElement = document.getElementById('stationsCount');
    if (!countElement) return;
    
    countElement.textContent = `${onlineStations}/${totalStations} Stations Online`;
    
    // Update badge color based on status
    if (onlineStations === totalStations) {
        countElement.style.color = 'var(--safe-green)';
    } else if (onlineStations === 0) {
        countElement.style.color = 'var(--warning-red)';
    } else {
        countElement.style.color = 'var(--alert-orange)';
    }
}

// === SMART REAL-TIME UPDATES ===
function setupRealtimeUpdates() {
    console.log('🔄 Setting up SMART real-time flood data monitoring...');
    
    try {
        // Clean up any existing subscriptions first
        if (window.floodSubscription) {
            window.floodSubscription.unsubscribe();
        }
        
        // Single subscription for all flood data changes
        window.floodSubscription = supabase
            .channel('smart-flood-updates')
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to ALL changes (INSERT, UPDATE, DELETE)
                    schema: 'public',
                    table: 'flood_data',
                },
                (payload) => {
                    console.log('🆕 Smart real-time update received');
                    
                    // SMART THROTTLING: Only update if enough time passed
                    const now = Date.now();
                    if (now - lastStationUpdate > MIN_UPDATE_INTERVAL) {
                        console.log('✅ Processing real-time update (throttled)');
                        handleFloodDataUpdate(payload);
                        lastStationUpdate = now;
                    } else {
                        console.log('⏸️ Skipping update (too frequent)');
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Smart real-time subscription ACTIVE');
                    showWaterLevelAlert('Smart real-time monitoring active', 'success');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('❌ Real-time subscription FAILED');
                    showWaterLevelAlert('Real-time updates disconnected', 'warning');
                }
            });

        return window.floodSubscription;
    } catch (error) {
        console.error('Error setting up real-time updates:', error);
        showWaterLevelAlert('Real-time setup failed: ' + error.message, 'error');
    }
}

// === Handle Real-time Flood Data Updates ===
function handleFloodDataUpdate(payload) {
    const eventType = payload.eventType || payload.event;
    const newRecord = payload.new || payload.new_record;
    
    if (!eventType) {
        console.warn('Unknown payload structure:', payload);
        return;
    }
    
    switch (eventType) {
        case 'INSERT':
        case 'UPDATE':
            if (newRecord && newRecord.device_id) {
                console.log('🔄 SMART: Processing new data from', newRecord.device_id);
                 
                // Show immediate notification but throttle full reload
                showWaterLevelAlert(`New data: ${newRecord.device_id} - ${newRecord.water_level}ft`, 'info');
                
                // Only do full reload if it's been more than 10 seconds
                if (Date.now() - lastStationUpdate > 10000) {
                    console.log('🔄 SMART: Doing full stations reload');
                    loadStations();
                } else {
                    console.log('⚡ SMART: Quick UI update only');
                    updateSingleStation(newRecord);
                }
            }
            break;
    }
}

// === Update Single Station (Lightweight) ===
function updateSingleStation(newData) {
    // Find and update only the specific station without full reload
    const stationIndex = stations.findIndex(s => s.device_id === newData.device_id);
    if (stationIndex !== -1) {
        // Update the station data
        stations[stationIndex].water_level = newData.water_level;
        stations[stationIndex].status = newData.status;
        stations[stationIndex].last_communication = newData.timestamp;
        
        // Update GPS coordinates if available and valid
        if (newData.gps_lat && newData.gps_lng && isValidCoordinate(newData.gps_lat, newData.gps_lng)) {
            stations[stationIndex].latitude = parseFloat(newData.gps_lat);
            stations[stationIndex].longitude = parseFloat(newData.gps_lng);
            stations[stationIndex].gps_source = 'live_gps';
            console.log(`📍 GPS Updated for ${newData.device_id}`);
        }
        
        // Update the station marker color only
        updateStationMarkerColor(stations[stationIndex]);
        
        // Update stations list if visible
        updateStationsListUI();
        
        console.log('⚡ Quick updated station:', newData.device_id);
    }
}

// === Update Only Marker Color (Fast) ===
function updateStationMarkerColor(station) {
    const status = getWaterLevelStatus(station.water_level);
    
    // Find and update the specific marker
    stationMarkers.forEach(marker => {
        const markerLatLng = marker.getLatLng();
        const stationLat = parseFloat(station.latitude);
        const stationLng = parseFloat(station.longitude);
        
        if (Math.abs(markerLatLng.lat - stationLat) < 0.0001 && 
            Math.abs(markerLatLng.lng - stationLng) < 0.0001) {
            
            // Update marker class for color change
            const iconElement = marker.getElement();
            if (iconElement) {
                // Remove old status classes
                iconElement.className = iconElement.className.replace(/\b(safe|warning|danger|offline)\b/g, '');
                // Add new status class
                iconElement.classList.add(`station-marker`, `enhanced`, status);
                
                // Update GPS accuracy class
                if (station.gps_source === 'live_gps') {
                    iconElement.classList.add('gps-accurate');
                    iconElement.classList.remove('gps-estimated');
                } else {
                    iconElement.classList.add('gps-estimated');
                    iconElement.classList.remove('gps-accurate');
                }
            }
        }
    });
}

// === Update Stations List UI ===
function updateStationsListUI() {
    const stationsList = document.getElementById('stationsList');
    if (!stationsList) return;
    
    // Simple update - just refresh the entire list
    renderStationsList();
}

// === Start Real-time Updates ===
function startRealTimeUpdates() {
    console.log('🚀 Starting SMART real-time monitoring...');
    
    // Smart throttled real-time
    setupRealtimeUpdates();
    
    // Fallback: Check every 2 minutes (instead of 1)
    setInterval(() => {
        console.log('🔄 Scheduled background refresh');
        loadStations();
    }, 120000); // 2 minutes
    
    // Emergency check every 15 seconds for critical levels
    setInterval(() => {
        checkForEmergencyLevels();
    }, 15000);
}

// === Emergency Level Check ===
function checkForEmergencyLevels() {
    stations.forEach(station => {
        if (station.water_level !== null && station.water_level >= 2.5) {
            console.log('🚨 Emergency level detected:', station.device_id);
            // Force immediate update for emergency
            loadStations();
        }
    });
}

// === Request User Location ===
function requestUserLocation() {
    if (!navigator.geolocation) {
        return;
    }
    
    console.log('Requesting user location...');
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            console.log('📍 Initial location found:', latitude, longitude);
            
            currentUserLocation = { lat: latitude, lng: longitude };
            
            const zoomLevel = isMobile ? 15 : 15;
            if (map) {
                map.flyTo([latitude, longitude], zoomLevel);
            }
            createUserLocationMarker(latitude, longitude);
        },
        (error) => {
            console.error('Error getting location:', error);
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        }
    );
    
    // Only start watching if not already watching
    if (!watchId) {
        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                console.log('📍 Real-time location update:', { 
                    lat: latitude, 
                    lng: longitude, 
                    accuracy: accuracy + ' meters'
                });
                
                currentUserLocation = { lat: latitude, lng: longitude };
                updateUserLocationMarker(latitude, longitude);
            },
            (error) => {
                console.error('Error watching location:', error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 2000,
                distanceFilter: 5
            }
        );
    }
}

// === Create User Location Marker ===
function createUserLocationMarker(lat, lng) {
    if (!map) return;
    
    console.log('Creating user marker at:', lat, lng);
    
    if (userLocationMarker) map.removeLayer(userLocationMarker);
    if (userLocationCircle) map.removeLayer(userLocationCircle);
    
    const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `
            <div class="user-pulse-outer"></div>
            <div class="user-pulse-inner"></div>
            <div class="user-dot"></div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
    
    userLocationCircle = L.circle([lat, lng], {
        color: '#2563eb',
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
        weight: 2,
        radius: isMobile ? 20 : 25
    }).addTo(map);
    
    userLocationMarker = L.marker([lat, lng], { 
        icon: userIcon,
        zIndexOffset: 1000
    }).addTo(map);
    
    const popupContent = createUserPopupContent(lat, lng);
    userLocationMarker.bindPopup(popupContent, {
        className: 'user-popup-enhanced',
        maxWidth: isMobile ? 280 : 300,
        autoClose: true
    });
    
    console.log('✅ User location marker created');
}

// === Focus on User Location ===
function focusOnUser() {
    if (currentUserLocation) {
        // User location is known, fly to it
        const zoomLevel = 16;
        map.flyTo([currentUserLocation.lat, currentUserLocation.lng], zoomLevel, {
            duration: 1.5,
            easeLinearity: 0.25
        });
        
        // Open user location popup after animation
        setTimeout(() => {
            if (userLocationMarker) {
                userLocationMarker.openPopup();
            }
        }, 1600);
        
        if (isMobile) {
            hideMobileMenu();
        }
        
        console.log('Focused on user location:', currentUserLocation);
    } else {
        // User location not known yet, request it
        if (navigator.geolocation) {
            showWaterLevelAlert('Requesting your location...', 'info');
            requestUserLocation();
        } else {
            showWaterLevelAlert('Geolocation is not supported by your browser', 'warning');
        }
    }
}

// === Create Enhanced User Popup Content ===
function createUserPopupContent(lat, lng) {
    getLocationName(lat, lng).then(locationName => {
        const freshPopupContent = createEnhancedPopupContent(lat, lng, locationName);
        if (userLocationMarker) {
            userLocationMarker.setPopupContent(freshPopupContent);
        }
    });
    
    return createEnhancedPopupContent(lat, lng, 'Loading address...');
}

// === Create Enhanced Popup Content with Location Name ===
function createEnhancedPopupContent(lat, lng, locationName) {
    return `
        <div class="enhanced-popup-container">
            <div class="enhanced-popup-header">
                <div class="enhanced-popup-icon">
                    <i class="fas fa-user-circle"></i>
                </div>
                <div class="enhanced-popup-title-section">
                    <div class="enhanced-popup-title">Your Current Location</div>
                    <div class="enhanced-popup-subtitle">Live GPS Position</div>
                </div>
            </div>
            
            <div class="enhanced-popup-divider"></div>
            
            <div class="enhanced-popup-content">
                <div class="enhanced-info-grid">
                    <div class="enhanced-info-item">
                        <div class="enhanced-info-icon">
                            <i class="fas fa-map-marker-alt"></i>
                        </div>
                        <div class="enhanced-info-content">
                            <div class="enhanced-info-label">Coordinates</div>
                            <div class="enhanced-info-value coordinates">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
                        </div>
                    </div>
                    
                    <div class="enhanced-info-item">
                        <div class="enhanced-info-icon">
                            <i class="fas fa-clock"></i>
                        </div>
                        <div class="enhanced-info-content">
                            <div class="enhanced-info-label">Last Updated</div>
                            <div class="enhanced-info-value">${new Date().toLocaleTimeString()}</div>
                            <div class="enhanced-info-date">${new Date().toLocaleDateString()}</div>
                        </div>
                    </div>
                    
                    <div class="enhanced-info-item">
                        <div class="enhanced-info-icon">
                            <i class="fas fa-location-dot"></i>
                        </div>
                        <div class="enhanced-info-content">
                            <div class="enhanced-info-label">Location</div>
                            <div class="enhanced-info-value location">${locationName}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="enhanced-popup-footer">
                <div class="enhanced-accuracy-info">
                    <i class="fas fa-satellite"></i>
                    GPS Active • Real-time Tracking
                </div>
            </div>
        </div>
    `;
}

// === Get Location Name from Coordinates ===
async function getLocationName(lat, lng) {
    try {
        // For local development, just return coordinates to avoid CORS issues
        console.log('Location name lookup disabled for local development');
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch (error) {
        console.warn('Error getting location name:', error);
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
}

// === Update User Location Marker ===
function updateUserLocationMarker(lat, lng) {
    if (userLocationMarker && userLocationCircle && map) {
        console.log('🔄 Updating user location to:', lat, lng);
        
        userLocationMarker.setLatLng([lat, lng]);
        userLocationCircle.setLatLng([lat, lng]);
        
        getLocationName(lat, lng).then(locationName => {
            const freshPopupContent = createEnhancedPopupContent(lat, lng, locationName);
            userLocationMarker.setPopupContent(freshPopupContent);
        });
        
        userLocationCircle.setStyle({
            fillColor: '#60a5fa',
            color: '#1d4ed8'
        });
        setTimeout(() => {
            if (userLocationCircle) {
                userLocationCircle.setStyle({
                    fillColor: '#3b82f6',
                    color: '#2563eb'
                });
            }
        }, 500);
    }
}

// === Toggle Search Bar ===
function toggleSearch() {
    const searchContainer = document.querySelector('.search-container');
    const stationSearchContainer = document.querySelector('.station-search-container');
    
    if (stationSearchContainer) {
        stationSearchContainer.classList.remove('active');
    }
    
    if (searchContainer) {
        searchContainer.classList.toggle('active');
        
        if (searchContainer.classList.contains('active')) {
            const searchBox = document.getElementById('searchBox');
            if (searchBox) {
                setTimeout(() => {
                    searchBox.focus();
                }, 100);
            }
        }
    }
}

// === Toggle Station Search Bar ===
function toggleStationSearch() {
    const stationSearchContainer = document.querySelector('.station-search-container');
    const searchContainer = document.querySelector('.search-container');
    
    if (searchContainer) {
        searchContainer.classList.remove('active');
    }
    
    if (stationSearchContainer) {
        stationSearchContainer.classList.toggle('active');
        
        if (stationSearchContainer.classList.contains('active')) {
            const stationSearchBox = document.getElementById('stationSearchBox');
            if (stationSearchBox) {
                setTimeout(() => {
                    stationSearchBox.focus();
                }, 100);
            }
        }
    }
}

// === Handle Station Search Form Submission ===
function handleStationSearch(e) {
    e.preventDefault();
    const stationSearchBox = document.getElementById('stationSearchBox');
    if (!stationSearchBox) return;
    
    const query = stationSearchBox.value.trim().toUpperCase();
    
    if (query) {
        console.log('Searching for station:', query);
        searchStation(query);
    }
}

// === Show Station Search Results ===
function showStationSearchResults(query) {
    const resultsContainer = document.getElementById('stationSearchResults');
    if (!resultsContainer) return;
    
    if (!query) {
        resultsContainer.innerHTML = '';
        return;
    }
    
    const filteredStations = stations.filter(station => 
        (station.device_id && station.device_id.toUpperCase().includes(query.toUpperCase())) ||
        (station.name && station.name.toUpperCase().includes(query.toUpperCase()))
    );
    
    if (filteredStations.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">No stations found</div>';
        return;
    }
    
    resultsContainer.innerHTML = filteredStations.map(station => `
        <div class="search-result-item" data-station-id="${station.id || station.device_id}">
            <div class="result-station-name">${station.name || station.device_id}</div>
            <div class="result-station-id">${station.device_id}</div>
            <div class="result-station-location">${station.location || 'Monitoring Station'}</div>
            <div class="result-station-coordinates">${parseFloat(station.latitude).toFixed(4)}, ${parseFloat(station.longitude).toFixed(4)}</div>
        </div>
    `).join('');
    
    const resultItems = resultsContainer.querySelectorAll('.search-result-item');
    resultItems.forEach(item => {
        item.addEventListener('click', function() {
            const stationId = this.getAttribute('data-station-id');
            const station = stations.find(s => (s.id === stationId) || (s.device_id === stationId));
            
            if (station) {
                const stationSearchContainer = document.querySelector('.station-search-container');
                if (stationSearchContainer) {
                    stationSearchContainer.classList.remove('active');
                }
                const stationSearchBox = document.getElementById('stationSearchBox');
                if (stationSearchBox) {
                    stationSearchBox.value = '';
                }
                
                selectStation(station);
            }
        });
    });
}

// === Search Station Function ===
function searchStation(query) {
    if (!map) return;
    
    const foundStation = stations.find(s => 
        s.device_id && s.device_id.toUpperCase().includes(query) ||
        s.name && s.name.toUpperCase().includes(query)
    );
    
    if (foundStation) {
        selectStation(foundStation);
        
        const stationSearchContainer = document.querySelector('.station-search-container');
        if (stationSearchContainer) {
            stationSearchContainer.classList.remove('active');
        }
        const stationSearchBox = document.getElementById('stationSearchBox');
        if (stationSearchBox) {
            stationSearchBox.value = '';
        }
    }
}

// === Handle Search Form Submission ===
function handleSearch(e) {
    e.preventDefault();
    const searchBox = document.getElementById('searchBox');
    if (!searchBox) return;
    
    const query = searchBox.value.trim();
    
    if (query) {
        console.log('Searching for:', query);
        searchLocation(query);
    }
}

// === WORKING Mobile Search Location Function ===
function searchLocation(query) {
    if (!map) return;
    
    // Show loading state
    showWaterLevelAlert(`Searching for "${query}"...`, 'info');
    
    // Use a reliable CORS proxy that actually works
    const proxyUrl = 'https://api.allorigins.win/raw?url=';
    const targetUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`;
    
    fetch(proxyUrl + encodeURIComponent(targetUrl))
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data && data.length > 0) {
                const result = data[0];
                const lat = parseFloat(result.lat);
                const lon = parseFloat(result.lon);
                
                console.log('✅ Search result found:', result.display_name);
                
                // Fly to the location
                map.flyTo([lat, lon], 15, {
                    duration: 1.5,
                    easeLinearity: 0.25
                });
                
                // Create a temporary marker
                const marker = L.marker([lat, lon]).addTo(map)
                    .bindPopup(`
                        <div class="enhanced-popup-container">
                            <div class="enhanced-popup-header">
                                <div class="enhanced-popup-icon">
                                    <i class="fas fa-map-marker-alt"></i>
                                </div>
                                <div class="enhanced-popup-title-section">
                                    <div class="enhanced-popup-title">Search Result</div>
                                    <div class="enhanced-popup-subtitle">${result.display_name}</div>
                                </div>
                            </div>
                        </div>
                    `)
                    .openPopup();
                
                // Remove marker after 10 seconds
                setTimeout(() => {
                    if (marker && map.hasLayer(marker)) {
                        map.removeLayer(marker);
                    }
                }, 10000);
                
                // Close search container and clear input
                const searchContainer = document.querySelector('.search-container');
                if (searchContainer) {
                    searchContainer.classList.remove('active');
                }
                const searchBox = document.getElementById('searchBox');
                if (searchBox) {
                    searchBox.value = '';
                }
                
                showWaterLevelAlert(`✅ Found: ${result.display_name}`, 'success');
                
                if (isMobile) {
                    hideMobileMenu();
                }
            } else {
                showWaterLevelAlert(`❌ No results found for "${query}"`, 'warning');
            }
        })
        .catch(error => {
            console.error('❌ Search error:', error);
            showWaterLevelAlert(`🔧 Search temporarily unavailable. Try "Hagonoy" or "Manila"`, 'error');
        });
}

// === Add Water Level Alert to Dashboard ===
function addWaterLevelAlert(message, type = 'info') {
    const alertList = document.getElementById('alertList');
    if (!alertList) return;
    
    const alertItem = document.createElement('div');
    alertItem.className = `alert-item ${type}`;
    
    const iconClass = type === 'info' ? 'fa-info-circle' : 
                     type === 'success' ? 'fa-check-circle' : 
                     type === 'warning' ? 'fa-exclamation-triangle' : 'fa-times-circle';
    
    alertItem.innerHTML = `
        <i class="fas ${iconClass}"></i>
        <span>${message}</span>
    `;
    
    alertList.insertBefore(alertItem, alertList.firstChild);
    
    while (alertList.children.length > 8) {
        alertList.removeChild(alertList.lastChild);
    }
}

// === Show Water Level Alert Function ===
function showWaterLevelAlert(message, type = 'info') {
    const existingAlerts = document.querySelectorAll('.alert-toast');
    existingAlerts.forEach(alert => alert.remove());
    
    const alert = document.createElement('div');
    alert.className = `alert-toast ${type}`;
    alert.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(alert);
    
    // Only add to dashboard if it's a water level related alert
    if (message.includes('Water level') || message.includes('DANGER') || message.includes('ALERT')) {
        addWaterLevelAlert(message, type);
    }
    
    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 5000);
}

// === Toggle Dark Mode ===
function toggleDarkMode() {
    console.log('Toggling dark mode...');
    document.body.classList.toggle('dark-mode');
    
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        if (document.body.classList.contains('dark-mode')) {
            darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            console.log('Dark mode enabled');
        } else {
            darkModeToggle.innerHTML = '<i class="fas fa-moon"></i>';
            console.log('Dark mode disabled');
        }
    }
    
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

// === Load Dark Mode Preference ===
function loadDarkModePreference() {
    const darkModeEnabled = localStorage.getItem('darkMode') === 'true';
    if (darkModeEnabled) {
        document.body.classList.add('dark-mode');
        const darkModeToggle = document.getElementById('darkModeToggle');
        if (darkModeToggle) {
            darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        }
    }
}

// === Update Display with New Data ===
function updateDisplay(newData) {
    console.log('📊 Updating display with new data:', newData);
    
    // Show immediate notification
    if (newData.device_id && newData.water_level !== undefined) {
        const status = getWaterLevelStatus(newData.water_level);
        let alertMessage = `New data from ${newData.device_id}: ${newData.water_level} ft`;
        let alertType = 'info';
        
        if (status === 'danger') {
            alertMessage = `🚨 NEW DANGER: ${newData.device_id} water level ${newData.water_level} ft`;
            alertType = 'danger';
        } else if (status === 'warning') {
            alertMessage = `⚠️ NEW ALERT: ${newData.device_id} water level ${newData.water_level} ft`;
            alertType = 'warning';
        }
        
        showWaterLevelAlert(alertMessage, alertType);
    }
    
    // SMART reload with throttling
    if (Date.now() - lastStationUpdate > MIN_UPDATE_INTERVAL) {
        loadStations();
    }
}

// === Load Initial Data ===
async function loadInitialData() {
    console.log('📥 Loading initial flood data...');
    
    const { data, error } = await supabase
        .from('flood_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
    
    if (error) {
        console.error('Error loading initial data:', error);
        return;
    }
    
    if (data && data.length > 0) {
        console.log('✅ Initial data loaded:', data[0]);
        updateDisplay(data[0]);
    } else {
        console.log('ℹ️ No initial data found');
    }
}

// === Clean up when page unloads ===
window.addEventListener('beforeunload', function() {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
    }
});

// === Make functions globally available ===
window.selectStationFromPopup = function(stationId) {
    console.log('Selecting station from popup, ID:', stationId);
    let station = stations.find(s => s.id === stationId);
    if (!station) {
        station = stations.find(s => s.device_id === stationId);
    }
    if (!station) {
        station = stations.find(s => s.record_id === stationId);
    }
    if (station) {
        selectStation(station);
    } else {
        console.warn('Station not found with ID:', stationId);
    }
};

window.focusOnUser = focusOnUser;
window.showWaterLevelAlert = showWaterLevelAlert;
window.hideMobileMenu = hideMobileMenu;
window.loadStations = loadStations;
window.clearNotifications = clearNotifications;