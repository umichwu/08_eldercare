// ================================================
// 地理位置管理 JavaScript
// ================================================

// Supabase 設定
const SUPABASE_URL = 'https://rxquczgjsgkeqemhngnb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4cXVjemdqc2drZXFlbWhuZ25iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc0MzU2ODIsImV4cCI6MjA1MzAxMTY4Mn0.DsULEgz4hzs0lY2PHQhP3nQyggwsI2_BcZttxPLobYw';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 後端 API URL
const API_BASE_URL = 'https://eldercare-backend-8o4k.onrender.com';

// 全域變數
let map = null;
let elderMarker = null;
let safeZoneCircles = [];
let drawMode = false;
let tempCircle = null;
let currentElderId = null;
let currentUser = null;

// ================================================
// 初始化
// ================================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 檢查登入狀態
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.href = 'login.html';
            return;
        }
        currentUser = session.user;

        // 初始化地圖
        initMap();

        // 載入長輩列表
        await loadElders();

    } catch (error) {
        console.error('初始化錯誤:', error);
        showToast('初始化失敗：' + error.message, 'error');
    }
});

// ================================================
// 地圖初始化
// ================================================

function initMap() {
    // 初始化 Leaflet 地圖（台灣中心）
    map = L.map('map').setView([23.6978, 120.9605], 8);

    // 加入 OpenStreetMap 圖層
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    // 地圖點擊事件（繪製模式）
    map.on('click', handleMapClick);
}

// ================================================
// 載入長輩列表
// ================================================

async function loadElders() {
    try {
        // 取得當前使用者的家屬資料
        const { data: familyMember } = await supabase
            .from('family_members')
            .select('id')
            .eq('user_profile_id', currentUser.id)
            .single();

        if (!familyMember) {
            showToast('找不到家屬資料', 'error');
            return;
        }

        // 取得關聯的長輩
        const { data: relationships, error } = await supabase
            .from('elder_family_relationships')
            .select('elder_id, elders(id, name)')
            .eq('family_member_id', familyMember.id);

        if (error) throw error;

        const elderSelect = document.getElementById('elderSelect');
        elderSelect.innerHTML = '<option value="">選擇要監控的長輩...</option>';

        relationships.forEach(rel => {
            const option = document.createElement('option');
            option.value = rel.elders.id;
            option.textContent = rel.elders.name;
            elderSelect.appendChild(option);
        });

        // 如果只有一個長輩，自動選擇
        if (relationships.length === 1) {
            elderSelect.value = relationships[0].elders.id;
            switchElder(relationships[0].elders.id);
        }

    } catch (error) {
        console.error('載入長輩列表錯誤:', error);
        showToast('載入長輩列表失敗', 'error');
    }
}

// ================================================
// 切換長輩
// ================================================

async function switchElder(elderId) {
    if (!elderId) {
        currentElderId = null;
        return;
    }

    currentElderId = elderId;

    // 載入所有資料
    await Promise.all([
        loadCurrentLocation(),
        loadSafeZones(),
        loadGeofenceAlerts()
    ]);
}

// ================================================
// 載入當前位置
// ================================================

async function loadCurrentLocation() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/geolocation/location/latest/${currentElderId}`);
        const result = await response.json();

        const locationInfo = document.getElementById('currentLocationInfo');

        if (result.success && result.location) {
            const loc = result.location;

            // 顯示位置資訊
            locationInfo.innerHTML = `
                <div class="location-info">
                    <div class="location-info-item">
                        <span class="location-info-label">📍 位置</span>
                        <span class="location-info-value">${loc.address || '未知地址'}</span>
                    </div>
                    <div class="location-info-item">
                        <span class="location-info-label">🕐 記錄時間</span>
                        <span class="location-info-value">${formatDateTime(loc.recorded_at)}</span>
                    </div>
                    <div class="location-info-item">
                        <span class="location-info-label">📐 座標</span>
                        <span class="location-info-value">${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}</span>
                    </div>
                    ${loc.battery_level ? `
                    <div class="location-info-item">
                        <span class="location-info-label">🔋 電量</span>
                        <span class="location-info-value">${loc.battery_level}%</span>
                    </div>
                    ` : ''}
                </div>
                <button class="btn btn-primary" onclick="getCurrentLocation()" style="width: 100%; margin-top: 15px;">
                    🔄 更新位置
                </button>
            `;

            // 在地圖上標記位置
            if (elderMarker) {
                map.removeLayer(elderMarker);
            }

            elderMarker = L.marker([loc.latitude, loc.longitude], {
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                })
            }).addTo(map);

            elderMarker.bindPopup(`
                <strong>📍 長輩當前位置</strong><br>
                ${loc.address || '未知地址'}<br>
                <small>${formatDateTime(loc.recorded_at)}</small>
            `);

            // 移動地圖到長輩位置
            map.setView([loc.latitude, loc.longitude], 15);

        } else {
            locationInfo.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📍</div>
                    <p>尚無位置記錄</p>
                    <button class="btn btn-primary" onclick="getCurrentLocation()">
                        📍 取得位置
                    </button>
                </div>
            `;
        }

    } catch (error) {
        console.error('載入位置錯誤:', error);
        showToast('載入位置失敗', 'error');
    }
}

// ================================================
// 取得當前位置（觸發長輩裝置回報）
// ================================================

async function getCurrentLocation() {
    showToast('正在請求位置更新...', 'info');

    // 實際應用中，這裡會觸發長輩裝置的位置更新
    // 目前先重新載入最新位置
    await loadCurrentLocation();
}

// ================================================
// 載入安全區域
// ================================================

async function loadSafeZones() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/geolocation/safe-zones/elder/${currentElderId}`);
        const result = await response.json();

        const safeZonesList = document.getElementById('safeZonesList');

        if (result.success && result.safe_zones.length > 0) {
            // 清除舊的圓圈
            safeZoneCircles.forEach(circle => map.removeLayer(circle));
            safeZoneCircles = [];

            // 顯示列表
            safeZonesList.innerHTML = result.safe_zones.map(zone => `
                <div class="safe-zone-item">
                    <div class="safe-zone-header">
                        <span class="safe-zone-name">${zone.name}</span>
                        <span class="safe-zone-status ${zone.is_active ? 'status-active' : 'status-inactive'}">
                            ${zone.is_active ? '✓ 啟用中' : '✗ 已停用'}
                        </span>
                    </div>
                    <div class="safe-zone-details">
                        📍 半徑：${zone.radius_meters}m &nbsp;|&nbsp;
                        🚨 ${zone.alert_on_exit ? '離開警示' : ''} ${zone.alert_on_enter ? '進入通知' : ''}
                        ${zone.description ? `<br>📝 ${zone.description}` : ''}
                    </div>
                    <div class="safe-zone-actions">
                        <button class="btn btn-secondary" onclick="editSafeZone('${zone.id}')">
                            ✏️ 編輯
                        </button>
                        <button class="btn btn-secondary" onclick="locateZone(${zone.center_latitude}, ${zone.center_longitude})">
                            📍 定位
                        </button>
                        <button class="btn btn-secondary" onclick="toggleZoneStatus('${zone.id}', ${!zone.is_active})">
                            ${zone.is_active ? '⏸️ 停用' : '▶️ 啟用'}
                        </button>
                        <button class="btn btn-danger" onclick="deleteSafeZone('${zone.id}', '${zone.name}')">
                            🗑️ 刪除
                        </button>
                    </div>
                </div>
            `).join('');

            // 在地圖上繪製圓圈
            result.safe_zones.forEach(zone => {
                const circle = L.circle([zone.center_latitude, zone.center_longitude], {
                    radius: zone.radius_meters,
                    color: zone.is_active ? '#4caf50' : '#999',
                    fillColor: zone.is_active ? '#4caf50' : '#999',
                    fillOpacity: 0.2,
                    weight: 2
                }).addTo(map);

                circle.bindPopup(`
                    <strong>🛡️ ${zone.name}</strong><br>
                    半徑：${zone.radius_meters}m<br>
                    ${zone.is_active ? '✅ 啟用中' : '⏸️ 已停用'}
                `);

                safeZoneCircles.push(circle);
            });

        } else {
            safeZonesList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🛡️</div>
                    <p>尚未設定安全區域</p>
                    <p style="font-size: 14px; color: #999;">點擊上方「開始繪製區域」按鈕新增安全區域</p>
                </div>
            `;
        }

    } catch (error) {
        console.error('載入安全區域錯誤:', error);
        showToast('載入安全區域失敗', 'error');
    }
}

// ================================================
// 載入地理圍欄警示
// ================================================

async function loadGeofenceAlerts() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/geolocation/alerts/elder/${currentElderId}`);
        const result = await response.json();

        const alertsContainer = document.getElementById('geofenceAlerts');

        if (result.success && result.alerts.length > 0) {
            // 只顯示最近 7 天的警示
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const recentAlerts = result.alerts.filter(alert =>
                new Date(alert.created_at) >= sevenDaysAgo
            );

            if (recentAlerts.length > 0) {
                alertsContainer.innerHTML = `
                    <div class="alert-list">
                        ${recentAlerts.map(alert => `
                            <div class="alert-item type-${alert.alert_type} status-${alert.status}">
                                <div class="alert-header">
                                    <span class="alert-type">
                                        ${getAlertIcon(alert.alert_type)} ${getAlertTypeName(alert.alert_type)}
                                    </span>
                                    <span class="alert-time">${formatDateTime(alert.created_at)}</span>
                                </div>
                                <div class="alert-details">
                                    ${alert.safe_zone_name ? `📍 ${alert.safe_zone_name}` : ''}
                                    ${alert.address ? `<br>🗺️ ${alert.address}` : ''}
                                </div>
                                ${alert.status === 'pending' ? `
                                <div class="alert-actions">
                                    <button class="btn btn-primary" onclick="acknowledgeAlert('${alert.id}')">
                                        ✓ 已知悉
                                    </button>
                                    <button class="btn btn-secondary" onclick="resolveAlert('${alert.id}')">
                                        ✓ 已處理
                                    </button>
                                </div>
                                ` : `
                                <div style="margin-top: 10px; color: #4caf50; font-size: 13px;">
                                    ✓ ${alert.status === 'acknowledged' ? '已知悉' : '已處理'}
                                    ${alert.acknowledged_at ? ` (${formatDateTime(alert.acknowledged_at)})` : ''}
                                </div>
                                `}
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                alertsContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">✅</div>
                        <p>最近 7 天無警示記錄</p>
                    </div>
                `;
            }

        } else {
            alertsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">✅</div>
                    <p>目前無警示記錄</p>
                </div>
            `;
        }

    } catch (error) {
        console.error('載入警示錯誤:', error);
        showToast('載入警示失敗', 'error');
    }
}

// ================================================
// 地圖繪製功能
// ================================================

function startDrawingZone() {
    if (!currentElderId) {
        showToast('請先選擇長輩', 'warning');
        return;
    }

    drawMode = true;
    document.getElementById('drawModeHint').classList.add('active');
    document.getElementById('cancelDrawBtn').style.display = 'inline-block';
    showToast('請在地圖上點選安全區域的中心點', 'info');
}

function cancelDrawing() {
    drawMode = false;
    document.getElementById('drawModeHint').classList.remove('active');
    document.getElementById('cancelDrawBtn').style.display = 'none';

    if (tempCircle) {
        map.removeLayer(tempCircle);
        tempCircle = null;
    }
}

function handleMapClick(e) {
    if (!drawMode) return;

    const { lat, lng } = e.latlng;

    // 移除舊的臨時圓圈
    if (tempCircle) {
        map.removeLayer(tempCircle);
    }

    // 取得半徑
    const radius = parseInt(document.getElementById('zoneRadius').value) || 500;

    // 繪製新的臨時圓圈
    tempCircle = L.circle([lat, lng], {
        radius: radius,
        color: '#ff9800',
        fillColor: '#ff9800',
        fillOpacity: 0.3,
        weight: 3,
        dashArray: '10, 10'
    }).addTo(map);

    // 更新表單
    document.getElementById('zoneLat').value = lat;
    document.getElementById('zoneLng').value = lng;

    // 結束繪製模式
    drawMode = false;
    document.getElementById('drawModeHint').classList.remove('active');
    document.getElementById('cancelDrawBtn').style.display = 'none';

    showToast('已選擇中心點，請填寫區域資訊後儲存', 'success');

    // 捲動到表單
    document.getElementById('safeZoneForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ================================================
// 安全區域 CRUD
// ================================================

async function saveSafeZone(event) {
    event.preventDefault();

    if (!currentElderId) {
        showToast('請先選擇長輩', 'warning');
        return;
    }

    const lat = parseFloat(document.getElementById('zoneLat').value);
    const lng = parseFloat(document.getElementById('zoneLng').value);

    if (!lat || !lng) {
        showToast('請先在地圖上選擇區域中心點', 'warning');
        startDrawingZone();
        return;
    }

    const zoneData = {
        elder_id: currentElderId,
        name: document.getElementById('zoneName').value,
        center_latitude: lat,
        center_longitude: lng,
        radius_meters: parseInt(document.getElementById('zoneRadius').value),
        alert_on_exit: document.getElementById('alertOnExit').checked,
        alert_on_enter: document.getElementById('alertOnEnter').checked,
        description: document.getElementById('zoneDescription').value
    };

    try {
        const zoneId = document.getElementById('zoneId').value;
        const url = zoneId
            ? `${API_BASE_URL}/api/geolocation/safe-zones/${zoneId}`
            : `${API_BASE_URL}/api/geolocation/safe-zones`;

        const method = zoneId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(zoneData)
        });

        const result = await response.json();

        if (result.success) {
            showToast(zoneId ? '安全區域已更新' : '安全區域已新增', 'success');
            resetZoneForm();
            await loadSafeZones();
        } else {
            throw new Error(result.message || '儲存失敗');
        }

    } catch (error) {
        console.error('儲存安全區域錯誤:', error);
        showToast('儲存失敗：' + error.message, 'error');
    }
}

async function editSafeZone(zoneId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/geolocation/safe-zones/elder/${currentElderId}`);
        const result = await response.json();

        const zone = result.safe_zones.find(z => z.id === zoneId);
        if (!zone) return;

        // 填入表單
        document.getElementById('zoneFormTitle').textContent = '✏️ 編輯安全區域';
        document.getElementById('zoneId').value = zone.id;
        document.getElementById('zoneName').value = zone.name;
        document.getElementById('zoneRadius').value = zone.radius_meters;
        document.getElementById('zoneLat').value = zone.center_latitude;
        document.getElementById('zoneLng').value = zone.center_longitude;
        document.getElementById('alertOnExit').checked = zone.alert_on_exit;
        document.getElementById('alertOnEnter').checked = zone.alert_on_enter;
        document.getElementById('zoneDescription').value = zone.description || '';

        // 在地圖上顯示臨時圓圈
        if (tempCircle) {
            map.removeLayer(tempCircle);
        }

        tempCircle = L.circle([zone.center_latitude, zone.center_longitude], {
            radius: zone.radius_meters,
            color: '#ff9800',
            fillColor: '#ff9800',
            fillOpacity: 0.3,
            weight: 3,
            dashArray: '10, 10'
        }).addTo(map);

        // 移動地圖
        map.setView([zone.center_latitude, zone.center_longitude], 15);

        // 捲動到表單
        document.getElementById('safeZoneForm').scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
        console.error('載入安全區域錯誤:', error);
        showToast('載入失敗', 'error');
    }
}

async function deleteSafeZone(zoneId, zoneName) {
    if (!confirm(`確定要刪除安全區域「${zoneName}」嗎？`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/geolocation/safe-zones/${zoneId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            showToast('安全區域已刪除', 'success');
            await loadSafeZones();
        } else {
            throw new Error(result.message || '刪除失敗');
        }

    } catch (error) {
        console.error('刪除安全區域錯誤:', error);
        showToast('刪除失敗：' + error.message, 'error');
    }
}

async function toggleZoneStatus(zoneId, newStatus) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/geolocation/safe-zones/${zoneId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: newStatus })
        });

        const result = await response.json();

        if (result.success) {
            showToast(newStatus ? '安全區域已啟用' : '安全區域已停用', 'success');
            await loadSafeZones();
        } else {
            throw new Error(result.message || '更新失敗');
        }

    } catch (error) {
        console.error('更新狀態錯誤:', error);
        showToast('更新失敗：' + error.message, 'error');
    }
}

function resetZoneForm() {
    document.getElementById('zoneFormTitle').textContent = '➕ 新增安全區域';
    document.getElementById('safeZoneForm').reset();
    document.getElementById('zoneId').value = '';
    document.getElementById('zoneLat').value = '';
    document.getElementById('zoneLng').value = '';
    document.getElementById('zoneRadius').value = '500';
    document.getElementById('alertOnExit').checked = true;
    document.getElementById('alertOnEnter').checked = false;

    if (tempCircle) {
        map.removeLayer(tempCircle);
        tempCircle = null;
    }
}

function locateZone(lat, lng) {
    map.setView([lat, lng], 16);
}

// ================================================
// 警示處理
// ================================================

async function acknowledgeAlert(alertId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/geolocation/alerts/${alertId}/acknowledge`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                acknowledged_by: currentUser.id
            })
        });

        const result = await response.json();

        if (result.success) {
            showToast('已標記為知悉', 'success');
            await loadGeofenceAlerts();
        } else {
            throw new Error(result.message || '更新失敗');
        }

    } catch (error) {
        console.error('更新警示錯誤:', error);
        showToast('更新失敗：' + error.message, 'error');
    }
}

async function resolveAlert(alertId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/geolocation/alerts/${alertId}/resolve`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                acknowledged_by: currentUser.id,
                notes: '已處理'
            })
        });

        const result = await response.json();

        if (result.success) {
            showToast('已標記為已處理', 'success');
            await loadGeofenceAlerts();
        } else {
            throw new Error(result.message || '更新失敗');
        }

    } catch (error) {
        console.error('更新警示錯誤:', error);
        showToast('更新失敗：' + error.message, 'error');
    }
}

// ================================================
// 輔助函數
// ================================================

function formatDateTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    // 5 分鐘內
    if (diff < 5 * 60 * 1000) {
        return '剛剛';
    }

    // 1 小時內
    if (diff < 60 * 60 * 1000) {
        return `${Math.floor(diff / 60000)} 分鐘前`;
    }

    // 今天
    if (date.toDateString() === now.toDateString()) {
        return `今天 ${date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // 昨天
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return `昨天 ${date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // 其他
    return date.toLocaleString('zh-TW', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getAlertIcon(type) {
    const icons = {
        'exit': '🚨',
        'enter': '✅',
        'sos': '🆘',
        'low_battery': '🔋',
        'inactive': '⏰'
    };
    return icons[type] || '🔔';
}

function getAlertTypeName(type) {
    const names = {
        'exit': '離開安全區域',
        'enter': '進入安全區域',
        'sos': '緊急求助',
        'low_battery': '低電量警示',
        'inactive': '無活動警示'
    };
    return names[type] || type;
}

function showInstructions() {
    const instructionBox = document.getElementById('instructionBox');
    instructionBox.style.display = instructionBox.style.display === 'none' ? 'block' : 'none';
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show';

    if (type === 'error') {
        toast.style.background = '#f44336';
    } else if (type === 'success') {
        toast.style.background = '#4caf50';
    } else if (type === 'warning') {
        toast.style.background = '#ff9800';
    } else {
        toast.style.background = '#2196f3';
    }

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// 監聽半徑變更，更新臨時圓圈
document.getElementById('zoneRadius').addEventListener('input', (e) => {
    const lat = parseFloat(document.getElementById('zoneLat').value);
    const lng = parseFloat(document.getElementById('zoneLng').value);

    if (lat && lng && tempCircle) {
        map.removeLayer(tempCircle);

        tempCircle = L.circle([lat, lng], {
            radius: parseInt(e.target.value),
            color: '#ff9800',
            fillColor: '#ff9800',
            fillOpacity: 0.3,
            weight: 3,
            dashArray: '10, 10'
        }).addTo(map);
    }
});
