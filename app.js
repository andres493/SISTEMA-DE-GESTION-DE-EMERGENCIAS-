// Sistema de Gestion de Emergencias para Bomberos Colombia
// Guarda y consulta informacion en IndexedDB con migracion desde localStorage.

document.addEventListener('DOMContentLoaded', async () => {
    const STORAGE_KEY = 'bomberosEmergencias';
    const DRAFT_KEY = 'bomberosEmergenciasDraft';
    const LEGACY_MIGRATION_KEY = 'bomberosEmergenciasMigrated';
    const DB_NAME = 'bomberosSistemaDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'emergencias';
    const emergencyForm = document.getElementById('emergency-form');
    const emergencyFormSection = document.getElementById('emergency-form-section');
    const recordsSection = document.getElementById('records-section');
    const recordsTableBody = document.getElementById('records-table-body');
    const viewRecordsBtn = document.getElementById('view-records');
    const exportExcelBtn = document.getElementById('export-excel');
    const exportMonthlyBtn = document.getElementById('export-monthly');
    const exportBackupBtn = document.getElementById('export-backup');
    const importBackupBtn = document.getElementById('import-backup');
    const navLinks = Array.from(document.querySelectorAll('nav ul li a'));
    const recordsSearchInput = document.getElementById('records-search');
    const recordsCountLabel = document.getElementById('records-count-label');
    const statTotal = document.getElementById('stat-total');
    const statToday = document.getElementById('stat-today');
    const statGeolocated = document.getElementById('stat-geolocated');
    const statLast = document.getElementById('stat-last');
    const systemStatus = document.getElementById('system-status');
    const formFeedback = document.getElementById('form-feedback');
    const newRecordBtn = document.getElementById('new-record-btn');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const latitudInput = document.getElementById('latitud');
    const longitudInput = document.getElementById('longitud');
    const useLocationBtn = document.getElementById('usar-ubicacion');
    const mapContainer = document.getElementById('mapa-ubicacion');
    const submitButton = emergencyForm ? emergencyForm.querySelector('button[type="submit"]') : null;
    let map;
    let marker;
    let suppressCoordinateSync = false;
    let isRestoringDraft = false;
    let dbPromise;
    let editingRecordIndex = null;

    if (!emergencyForm || !recordsTableBody || !emergencyFormSection || !recordsSection) {
        console.error('No se pudieron encontrar los elementos principales de la interfaz.');
        return;
    }

    const fieldIds = [
        'fecha',
        'hora',
        'municipio',
        'tipo-incidente',
        'entidad-apoyo',
        'nombre-atendio',
        'rango-atendio',
        'nombre-paciente',
        'identificacion-paciente',
        'edad',
        'sexo',
        'barrio-vereda',
        'direccion',
        'latitud',
        'longitud',
        'telefono',
        'total-afectados',
        'perdidas',
        'unidades',
        'vehiculos',
        'departamento',
        'codigo-emergencia',
        'observaciones'
    ];

    const fieldLabels = {
        fecha: 'Fecha',
        hora: 'Hora',
        municipio: 'Municipio',
        'tipo-incidente': 'Tipo de incidente',
        departamento: 'Departamento',
        'identificacion-paciente': 'Identificacion del paciente',
        edad: 'Edad',
        telefono: 'Telefono',
        'total-afectados': 'Total de afectados',
        latitud: 'Latitud',
        longitud: 'Longitud',
        'codigo-emergencia': 'Codigo de emergencia',
        observaciones: 'Observaciones'
    };

    function getFieldValue(id) {
        const element = document.getElementById(id);
        return element ? element.value.trim() : '';
    }

    function setFieldValue(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.value = value || '';
        }
    }

    function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = window.indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = event => {
                const database = event.target.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function getDatabase() {
        if (!dbPromise) {
            dbPromise = openDatabase();
        }

        return dbPromise;
    }

    async function migrateLegacyDataIfNeeded() {
        if (localStorage.getItem(LEGACY_MIGRATION_KEY) === 'done') {
            return;
        }

        let legacyRecords = [];

        try {
            legacyRecords = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        } catch (error) {
            console.error('Error leyendo datos legados:', error);
        }

        if (legacyRecords.length > 0) {
            const existingRecords = await getEmergencies();
            if (existingRecords.length === 0) {
                await saveEmergencies(legacyRecords);
            }
        }

        localStorage.setItem(LEGACY_MIGRATION_KEY, 'done');
    }

    async function getEmergencies() {
        try {
            const database = await getDatabase();

            return await new Promise((resolve, reject) => {
                const transaction = database.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.getAll();

                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Error leyendo registros:', error);
            return [];
        }
    }

    async function saveEmergencies(emergencies) {
        const database = await getDatabase();

        await new Promise((resolve, reject) => {
            const clearTransaction = database.transaction(STORE_NAME, 'readwrite');
            const clearStore = clearTransaction.objectStore(STORE_NAME);
            const clearRequest = clearStore.clear();

            clearRequest.onerror = () => reject(clearRequest.error);
            clearTransaction.oncomplete = () => resolve();
            clearTransaction.onerror = () => reject(clearTransaction.error);
        });

        await new Promise((resolve, reject) => {
            const writeTransaction = database.transaction(STORE_NAME, 'readwrite');
            const writeStore = writeTransaction.objectStore(STORE_NAME);

            emergencies.forEach(emergency => {
                writeStore.add(emergency.id ? emergency : { ...emergency });
            });

            writeTransaction.oncomplete = () => resolve();
            writeTransaction.onerror = () => reject(writeTransaction.error);
        });
    }

    async function readAllEmergencies() {
        return await getEmergencies();
    }

    function updateSystemStatus(message) {
        if (systemStatus) {
            systemStatus.textContent = message;
        }
    }

    function showFormFeedback(message) {
        if (!formFeedback) {
            return;
        }

        formFeedback.textContent = message;
        formFeedback.hidden = !message;
    }

    function clearFormFeedback() {
        showFormFeedback('');
    }

    function setFieldError(fieldId, hasError) {
        const field = document.getElementById(fieldId);
        if (!field) {
            return;
        }

        field.classList.toggle('input-error', hasError);
        field.setAttribute('aria-invalid', hasError ? 'true' : 'false');
    }

    function clearFieldErrors() {
        Object.keys(fieldLabels).forEach(fieldId => setFieldError(fieldId, false));
    }

    function updateFullscreenButtonLabel() {
        if (!fullscreenBtn) {
            return;
        }

        const isFullscreen = Boolean(document.fullscreenElement);
        fullscreenBtn.textContent = isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa';
        document.body.classList.toggle('is-fullscreen', isFullscreen);
    }

    async function toggleFullscreen() {
        if (!document.fullscreenEnabled) {
            updateSystemStatus('Pantalla completa no disponible en este navegador');
            return;
        }

        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
                updateSystemStatus('Pantalla completa desactivada');
            } else {
                await document.documentElement.requestFullscreen();
                updateSystemStatus('Pantalla completa activada');
            }
        } catch (error) {
            console.error('No fue posible cambiar a pantalla completa:', error);
            updateSystemStatus('No fue posible cambiar a pantalla completa');
        } finally {
            updateFullscreenButtonLabel();
        }
    }

    function setSubmitButtonLabel() {
        if (!submitButton) {
            return;
        }

        submitButton.textContent = editingRecordIndex === null
            ? 'Guardar Emergencia'
            : 'Actualizar Emergencia';
    }

    function generateEmergencyCode() {
        const fecha = getFieldValue('fecha');
        if (!fecha) {
            return '';
        }

        const compactDate = fecha.replace(/-/g, '');
        return `EMRG-${compactDate}`;
    }

    function ensureEmergencyCode() {
        const currentCode = getFieldValue('codigo-emergencia');
        if (currentCode) {
            return;
        }

        setFieldValue('codigo-emergencia', generateEmergencyCode());
    }

    function saveDraft() {
        if (isRestoringDraft) {
            return;
        }

        localStorage.setItem(DRAFT_KEY, JSON.stringify(collectFormData()));
        updateSystemStatus('Borrador guardado');
    }

    function clearDraft() {
        localStorage.removeItem(DRAFT_KEY);
    }

    function restoreDraft() {
        try {
            const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
            if (!draft) {
                return;
            }

            isRestoringDraft = true;
            fieldIds.forEach(fieldId => {
                const camelKey = fieldId
                    .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
                    .replace(/-+/g, '');

                const draftValue = Object.prototype.hasOwnProperty.call(draft, camelKey)
                    ? draft[camelKey]
                    : draft[fieldId];

                setFieldValue(fieldId, draftValue || '');
            });
            isRestoringDraft = false;
            syncMapFromInputs(false);
            updateSystemStatus('Borrador restaurado');
        } catch (error) {
            console.error('Error restaurando borrador:', error);
            isRestoringDraft = false;
        }
    }

    function updateDashboard(emergencies) {
        const today = new Date().toISOString().slice(0, 10);
        const todaysCount = emergencies.filter(emergency => emergency.fecha === today).length;
        const geolocatedCount = emergencies.filter(emergency => (
            hasValidCoordinates(parseCoordinate(emergency.latitud), parseCoordinate(emergency.longitud))
        )).length;
        const lastEmergency = emergencies
            .slice()
            .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))[0];

        if (statTotal) {
            statTotal.textContent = String(emergencies.length);
        }

        if (statToday) {
            statToday.textContent = String(todaysCount);
        }

        if (statGeolocated) {
            statGeolocated.textContent = String(geolocatedCount);
        }

        if (statLast) {
            statLast.textContent = lastEmergency
                ? `${lastEmergency.municipio || 'Sin municipio'} - ${formatDate(lastEmergency.fecha)}`
                : 'Sin datos';
        }
    }

    function primeDefaultFields() {
        if (!getFieldValue('fecha')) {
            setFieldValue('fecha', new Date().toISOString().slice(0, 10));
        }

        if (!getFieldValue('hora')) {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            setFieldValue('hora', `${hours}:${minutes}`);
        }

        ensureEmergencyCode();
    }

    function matchesSearch(emergency, searchTerm) {
        if (!searchTerm) {
            return true;
        }

        const searchableFields = [
            emergency.codigoEmergencia,
            emergency.municipio,
            emergency.departamento,
            emergency.nombrePaciente,
            emergency.nombreAtendio,
            emergency.entidadApoyo,
            getTipoIncidenteLabel(emergency.tipoIncidente)
        ];

        return searchableFields
            .filter(Boolean)
            .some(value => String(value).toLowerCase().includes(searchTerm));
    }

    function setActiveNav(link) {
        navLinks.forEach(navLink => navLink.classList.remove('active'));
        if (link) {
            link.classList.add('active');
        }
    }

    function showSection(sectionName) {
        const showRecords = sectionName === 'records';
        emergencyFormSection.classList.toggle('active-section', !showRecords);
        recordsSection.classList.toggle('active-section', showRecords);

        const activeLink = showRecords
            ? viewRecordsBtn
            : navLinks.find(link => link.textContent.includes('Ingreso'));

        setActiveNav(activeLink);

        if (!showRecords && map) {
            setTimeout(() => map.invalidateSize(), 0);
        }
    }

    function getTipoIncidenteLabel(value) {
        const tipos = {
            incendio: 'Incendio',
            explosion: 'Explosion',
            inspeccion: 'Inspeccion',
            'despeje-vial': 'Despeje Vial',
            'control-hidrocarburos': 'Control de Hidrocarburos',
            'control-abejas': 'Control de Abejas',
            'accidente-transito': 'Accidente de Transito',
            'atencion-paciente': 'Atencion a Paciente',
            rescate: 'Rescate',
            fuga: 'Fuga',
            derrame: 'Derrame',
            deslizamiento: 'Deslizamiento',
            desfile: 'Desfile',
            simulacro: 'Simulacro',
            'suministro-agua': 'Suministro de Agua',
            'entrega-ayudas': 'Entrega de Ayudas',
            censo: 'Censo',
            otro: 'Otro'
        };

        return tipos[value] || value || 'N/A';
    }

    function parseCoordinate(value) {
        if (value === '' || value === null || value === undefined) {
            return null;
        }

        const parsedValue = Number.parseFloat(value);
        return Number.isFinite(parsedValue) ? parsedValue : null;
    }

    function formatCoordinate(value) {
        const parsedValue = parseCoordinate(value);
        return parsedValue === null ? 'N/A' : parsedValue.toFixed(6);
    }

    function hasValidCoordinates(lat, lng) {
        return (
            typeof lat === 'number' &&
            typeof lng === 'number' &&
            lat >= -90 &&
            lat <= 90 &&
            lng >= -180 &&
            lng <= 180
        );
    }

    function updateMarker(lat, lng, shouldCenter = true) {
        if (!map || !hasValidCoordinates(lat, lng)) {
            return;
        }

        if (!marker) {
            marker = L.marker([lat, lng]).addTo(map);
        } else {
            marker.setLatLng([lat, lng]);
        }

        if (shouldCenter) {
            map.setView([lat, lng], 16);
        }
    }

    function clearMarker() {
        if (marker && map) {
            map.removeLayer(marker);
            marker = null;
        }
    }

    function syncMapFromInputs(shouldCenter = false) {
        if (suppressCoordinateSync) {
            return;
        }

        const lat = parseCoordinate(latitudInput ? latitudInput.value : '');
        const lng = parseCoordinate(longitudInput ? longitudInput.value : '');

        if (hasValidCoordinates(lat, lng)) {
            updateMarker(lat, lng, shouldCenter);
        } else {
            clearMarker();
        }
    }

    function setCoordinates(lat, lng, shouldCenter = true) {
        if (!latitudInput || !longitudInput) {
            return;
        }

        suppressCoordinateSync = true;
        latitudInput.value = lat.toFixed(6);
        longitudInput.value = lng.toFixed(6);
        suppressCoordinateSync = false;
        updateMarker(lat, lng, shouldCenter);
    }

    function initializeMap() {
        if (!mapContainer || typeof L === 'undefined') {
            return;
        }

        map = L.map(mapContainer).setView([4.570868, -74.297333], 6);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        map.on('click', event => {
            setCoordinates(event.latlng.lat, event.latlng.lng, true);
        });

        if (latitudInput) {
            latitudInput.addEventListener('input', () => syncMapFromInputs(false));
        }

        if (longitudInput) {
            longitudInput.addEventListener('input', () => syncMapFromInputs(false));
        }

        if (useLocationBtn) {
            useLocationBtn.addEventListener('click', () => {
                if (!navigator.geolocation) {
                    alert('El navegador no permite obtener la ubicacion actual.');
                    return;
                }

                navigator.geolocation.getCurrentPosition(
                    position => {
                        setCoordinates(position.coords.latitude, position.coords.longitude, true);
                    },
                    () => {
                        alert('No fue posible obtener la ubicacion actual.');
                    },
                    { enableHighAccuracy: true, timeout: 10000 }
                );
            });
        }

        setTimeout(() => {
            map.invalidateSize();
            syncMapFromInputs(false);
        }, 0);
    }

    function formatDate(dateString) {
        if (!dateString) {
            return 'N/A';
        }

        const date = new Date(`${dateString}T00:00:00`);
        if (Number.isNaN(date.getTime())) {
            return dateString;
        }

        return date.toLocaleDateString('es-CO');
    }

    function escapeHtml(value) {
        return String(value || 'N/A')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function buildDetailItem(label, value, extraClass = '') {
        const className = extraClass ? `detail-item ${extraClass}` : 'detail-item';

        return `
            <div class="${className}">
                <strong>${escapeHtml(label)}</strong>
                <span>${escapeHtml(value)}</span>
            </div>
        `;
    }

    function buildDetailSection(title, items) {
        const sectionItems = items
            .map(([label, value, extraClass]) => buildDetailItem(label, value, extraClass))
            .join('');

        return `
            <div class="details-section">
                <h4>${escapeHtml(title)}</h4>
                <div class="details-grid">
                    ${sectionItems}
                </div>
            </div>
        `;
    }

    function buildEmergencyDetails(emergency) {
        const sections = [
            {
                title: 'Datos de la Emergencia',
                items: [
                    ['Codigo de emergencia', emergency.codigoEmergencia || 'N/A'],
                    ['Fecha', formatDate(emergency.fecha)],
                    ['Hora', emergency.hora || 'N/A'],
                    ['Municipio', emergency.municipio || 'N/A'],
                    ['Departamento', emergency.departamento || 'N/A'],
                    ['Tipo de incidente', getTipoIncidenteLabel(emergency.tipoIncidente)]
                ]
            },
            {
                title: 'Personal y Apoyo',
                items: [
                    ['Entidad de apoyo', emergency.entidadApoyo || 'N/A'],
                    ['Nombre del que atiende', emergency.nombreAtendio || 'N/A'],
                    ['Rango', emergency.rangoAtendio || 'N/A']
                ]
            },
            {
                title: 'Paciente y Afectacion',
                items: [
                    ['Paciente', emergency.nombrePaciente || 'N/A'],
                    ['Identificacion', emergency.identificacionPaciente || 'N/A'],
                    ['Edad', emergency.edad || 'N/A'],
                    ['Sexo', emergency.sexo || 'N/A'],
                    ['Telefono', emergency.telefono || 'N/A'],
                    ['Total afectados', emergency.totalAfectados || 'N/A'],
                    ['Perdidas', emergency.perdidas || 'N/A', 'detail-item-wide']
                ]
            },
            {
                title: 'Ubicacion',
                items: [
                    ['Barrio o vereda', emergency.barrioVereda || 'N/A'],
                    ['Direccion', emergency.direccion || 'N/A'],
                    ['Latitud', formatCoordinate(emergency.latitud)],
                    ['Longitud', formatCoordinate(emergency.longitud)]
                ]
            },
            {
                title: 'Recursos y Observaciones',
                items: [
                    ['Unidades', emergency.unidades || 'N/A'],
                    ['Vehiculos', emergency.vehiculos || 'N/A'],
                    ['Observaciones', emergency.observaciones || 'N/A', 'detail-item-wide']
                ]
            }
        ];

        return sections.map(section => buildDetailSection(section.title, section.items)).join('');
    }

    async function loadRecords() {
        const searchTerm = recordsSearchInput ? recordsSearchInput.value.trim().toLowerCase() : '';
        const allEmergencies = await readAllEmergencies();
        const emergencies = allEmergencies
            .map((emergency, originalIndex) => ({ emergency, originalIndex }))
            .filter(({ emergency }) => matchesSearch(emergency, searchTerm))
            .sort((a, b) => new Date(b.emergency.timestamp || 0) - new Date(a.emergency.timestamp || 0));

        updateDashboard(allEmergencies);

        recordsTableBody.innerHTML = '';

        if (recordsCountLabel) {
            recordsCountLabel.textContent = `${emergencies.length} registro${emergencies.length === 1 ? '' : 's'}`;
        }

        if (emergencies.length === 0) {
            recordsTableBody.innerHTML = `
                <tr>
                    <td colspan="10" class="empty-state">
                        <div class="empty-state-icon">0</div>
                        <h3>${searchTerm ? 'No hay coincidencias' : 'No hay registros de emergencias'}</h3>
                        <p>${searchTerm ? 'Prueba con otro termino de busqueda.' : 'Guarda una emergencia y aparecera aqui con su detalle completo.'}</p>
                    </td>
                </tr>
            `;
            return;
        }

        emergencies.forEach(({ emergency, originalIndex }, visibleIndex) => {
            const summaryRow = document.createElement('tr');
            summaryRow.innerHTML = `
                <td>${escapeHtml(formatDate(emergency.fecha))}</td>
                <td><span class="record-summary">${escapeHtml(emergency.codigoEmergencia || 'Sin codigo')}</span></td>
                <td>${escapeHtml(emergency.hora || 'N/A')}</td>
                <td>${escapeHtml(emergency.municipio || 'N/A')}</td>
                <td>${escapeHtml(emergency.departamento || 'N/A')}</td>
                <td>${escapeHtml(getTipoIncidenteLabel(emergency.tipoIncidente))}</td>
                <td>${escapeHtml(emergency.entidadApoyo || 'N/A')}</td>
                <td>${escapeHtml(emergency.nombrePaciente || 'N/A')}</td>
                <td>${escapeHtml(emergency.totalAfectados || '0')}</td>
                <td class="actions-cell">
                    <button class="actions-btn view-btn" data-target="details-${visibleIndex}">Ver detalle</button>
                    <button class="actions-btn pdf-btn" data-index="${originalIndex}">PDF</button>
                    <button class="actions-btn edit-btn" data-index="${originalIndex}">Editar</button>
                    <button class="actions-btn delete-btn" data-index="${originalIndex}">Eliminar</button>
                </td>
            `;

            const detailsRow = document.createElement('tr');
            detailsRow.className = 'details-row';
            detailsRow.id = `details-${visibleIndex}`;
            detailsRow.hidden = true;
            detailsRow.innerHTML = `
                <td colspan="10">
                    <div class="details-panel">
                        ${buildEmergencyDetails(emergency)}
                    </div>
                </td>
            `;

            recordsTableBody.appendChild(summaryRow);
            recordsTableBody.appendChild(detailsRow);
        });

        recordsTableBody.querySelectorAll('.view-btn').forEach(button => {
            button.addEventListener('click', () => {
                const detailsRow = document.getElementById(button.dataset.target);
                const isHidden = detailsRow.hidden;
                detailsRow.hidden = !isHidden;
                button.textContent = isHidden ? 'Ocultar detalle' : 'Ver detalle';
            });
        });

        recordsTableBody.querySelectorAll('.pdf-btn').forEach(button => {
            button.addEventListener('click', async () => downloadEmergencyAsPDFFromIndex(Number(button.dataset.index)));
        });

        recordsTableBody.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', async () => editEmergency(Number(button.dataset.index)));
        });

        recordsTableBody.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', async () => deleteEmergency(Number(button.dataset.index)));
        });
    }

    function collectFormData() {
        return {
            fecha: getFieldValue('fecha'),
            hora: getFieldValue('hora'),
            municipio: getFieldValue('municipio'),
            tipoIncidente: getFieldValue('tipo-incidente'),
            entidadApoyo: getFieldValue('entidad-apoyo'),
            nombreAtendio: getFieldValue('nombre-atendio'),
            rangoAtendio: getFieldValue('rango-atendio'),
            nombrePaciente: getFieldValue('nombre-paciente'),
            identificacionPaciente: getFieldValue('identificacion-paciente'),
            edad: getFieldValue('edad'),
            sexo: getFieldValue('sexo'),
            barrioVereda: getFieldValue('barrio-vereda'),
            direccion: getFieldValue('direccion'),
            latitud: getFieldValue('latitud'),
            longitud: getFieldValue('longitud'),
            telefono: getFieldValue('telefono'),
            totalAfectados: getFieldValue('total-afectados'),
            perdidas: getFieldValue('perdidas'),
            unidades: getFieldValue('unidades'),
            vehiculos: getFieldValue('vehiculos'),
            departamento: getFieldValue('departamento'),
            codigoEmergencia: getFieldValue('codigo-emergencia') || generateEmergencyCode(),
            observaciones: getFieldValue('observaciones'),
            timestamp: new Date().toISOString()
        };
    }

    function validateFormData(formData) {
        const errors = [];
        const invalidFields = [];
        const today = new Date().toISOString().slice(0, 10);
        const phoneDigits = formData.telefono.replace(/\D/g, '');
        const idDigits = formData.identificacionPaciente.replace(/\D/g, '');
        const affectedCount = formData.totalAfectados === '' ? null : Number(formData.totalAfectados);
        const ageValue = formData.edad === '' ? null : Number(formData.edad);
        const lat = parseCoordinate(formData.latitud);
        const lng = parseCoordinate(formData.longitud);

        const requireField = (value, fieldId, message) => {
            if (!value) {
                errors.push(message);
                invalidFields.push(fieldId);
            }
        };

        requireField(formData.fecha, 'fecha', 'La fecha es obligatoria.');
        requireField(formData.hora, 'hora', 'La hora es obligatoria.');
        requireField(formData.municipio, 'municipio', 'El municipio es obligatorio.');
        requireField(formData.tipoIncidente, 'tipo-incidente', 'Selecciona un tipo de incidente.');
        requireField(formData.departamento, 'departamento', 'Selecciona un departamento.');

        if (formData.fecha && formData.fecha > today) {
            errors.push('La fecha no puede ser futura.');
            invalidFields.push('fecha');
        }

        if (formData.identificacionPaciente && idDigits.length !== formData.identificacionPaciente.length) {
            errors.push('La identificacion del paciente debe contener solo numeros.');
            invalidFields.push('identificacion-paciente');
        }

        if (formData.telefono && (phoneDigits.length < 7 || phoneDigits.length > 15)) {
            errors.push('El telefono debe tener entre 7 y 15 digitos.');
            invalidFields.push('telefono');
        }

        if (formData.codigoEmergencia && !/^EMRG-[A-Z0-9_-]+$/i.test(formData.codigoEmergencia)) {
            errors.push('El codigo de emergencia solo puede usar letras, numeros, guiones y guion bajo.');
            invalidFields.push('codigo-emergencia');
        }

        if (ageValue !== null && (!Number.isInteger(ageValue) || ageValue < 0 || ageValue > 120)) {
            errors.push('La edad debe estar entre 0 y 120.');
            invalidFields.push('edad');
        }

        if (affectedCount !== null && (!Number.isInteger(affectedCount) || affectedCount < 0 || affectedCount > 999)) {
            errors.push('El total de afectados debe estar entre 0 y 999.');
            invalidFields.push('total-afectados');
        }

        if ((formData.latitud && !formData.longitud) || (!formData.latitud && formData.longitud)) {
            errors.push('Si registras coordenadas, debes completar latitud y longitud.');
            invalidFields.push('latitud', 'longitud');
        } else if ((formData.latitud || formData.longitud) && !hasValidCoordinates(lat, lng)) {
            errors.push('Las coordenadas ingresadas no son validas.');
            invalidFields.push('latitud', 'longitud');
        }

        if (formData.observaciones && formData.observaciones.length > 600) {
            errors.push('Las observaciones no pueden superar 600 caracteres.');
            invalidFields.push('observaciones');
        }

        return {
            isValid: errors.length === 0,
            errors,
            invalidFields: [...new Set(invalidFields)]
        };
    }

    function clearForm() {
        emergencyForm.reset();
        fieldIds.forEach(fieldId => setFieldValue(fieldId, ''));
        clearMarker();
        clearDraft();
        clearFieldErrors();
        clearFormFeedback();
        editingRecordIndex = null;
        setSubmitButtonLabel();
        primeDefaultFields();
    }

    async function editEmergency(index) {
        const emergencies = await readAllEmergencies();
        const emergency = emergencies[index];

        if (!emergency) {
            return;
        }

        setFieldValue('fecha', emergency.fecha);
        setFieldValue('hora', emergency.hora);
        setFieldValue('municipio', emergency.municipio);
        setFieldValue('tipo-incidente', emergency.tipoIncidente);
        setFieldValue('entidad-apoyo', emergency.entidadApoyo);
        setFieldValue('nombre-atendio', emergency.nombreAtendio);
        setFieldValue('rango-atendio', emergency.rangoAtendio);
        setFieldValue('nombre-paciente', emergency.nombrePaciente);
        setFieldValue('identificacion-paciente', emergency.identificacionPaciente);
        setFieldValue('edad', emergency.edad);
        setFieldValue('sexo', emergency.sexo);
        setFieldValue('barrio-vereda', emergency.barrioVereda);
        setFieldValue('direccion', emergency.direccion);
        setFieldValue('latitud', emergency.latitud);
        setFieldValue('longitud', emergency.longitud);
        setFieldValue('telefono', emergency.telefono);
        setFieldValue('total-afectados', emergency.totalAfectados);
        setFieldValue('perdidas', emergency.perdidas);
        setFieldValue('unidades', emergency.unidades);
        setFieldValue('vehiculos', emergency.vehiculos);
        setFieldValue('departamento', emergency.departamento);
        setFieldValue('codigo-emergencia', emergency.codigoEmergencia);
        setFieldValue('observaciones', emergency.observaciones);
        editingRecordIndex = index;
        setSubmitButtonLabel();
        syncMapFromInputs(true);
        showSection('form');
        updateSystemStatus('Registro cargado para edicion');
    }

    async function deleteEmergency(index) {
        const confirmed = confirm('Esta seguro de eliminar este registro? Esta accion no se puede deshacer.');
        if (!confirmed) {
            return;
        }

        const emergencies = await readAllEmergencies();
        emergencies.splice(index, 1);
        await saveEmergencies(emergencies);
        await loadRecords();
        alert('Registro eliminado exitosamente.');
        updateSystemStatus('Registro eliminado');
    }

    function downloadEmergencyAsPDF(emergency) {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            alert('La libreria PDF no esta disponible en este momento.');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const fields = [
            ['Codigo', emergency.codigoEmergencia || 'N/A'],
            ['Fecha', formatDate(emergency.fecha)],
            ['Hora', emergency.hora || 'N/A'],
            ['Municipio', emergency.municipio || 'N/A'],
            ['Departamento', emergency.departamento || 'N/A'],
            ['Tipo de incidente', getTipoIncidenteLabel(emergency.tipoIncidente)],
            ['Entidad de apoyo', emergency.entidadApoyo || 'N/A'],
            ['Nombre del que atiende', emergency.nombreAtendio || 'N/A'],
            ['Rango', emergency.rangoAtendio || 'N/A'],
            ['Paciente', emergency.nombrePaciente || 'N/A'],
            ['Identificacion', emergency.identificacionPaciente || 'N/A'],
            ['Edad', emergency.edad || 'N/A'],
            ['Sexo', emergency.sexo || 'N/A'],
            ['Barrio o vereda', emergency.barrioVereda || 'N/A'],
            ['Direccion', emergency.direccion || 'N/A'],
            ['Latitud', formatCoordinate(emergency.latitud)],
            ['Longitud', formatCoordinate(emergency.longitud)],
            ['Telefono', emergency.telefono || 'N/A'],
            ['Total afectados', emergency.totalAfectados || 'N/A'],
            ['Perdidas', emergency.perdidas || 'N/A'],
            ['Unidades', emergency.unidades || 'N/A'],
            ['Vehiculos', emergency.vehiculos || 'N/A'],
            ['Observaciones', emergency.observaciones || 'N/A']
        ];

        doc.setFontSize(18);
        doc.text('Reporte de Emergencia', 20, 20);
        doc.setFontSize(11);

        let y = 32;
        fields.forEach(([label, value]) => {
            const text = `${label}: ${value}`;
            const lines = doc.splitTextToSize(text, 170);
            doc.text(lines, 20, y);
            y += lines.length * 7;

            if (y > 270) {
                doc.addPage();
                y = 20;
            }
        });

        const codigo = (emergency.codigoEmergencia || 'emergencia').replace(/[^a-z0-9_-]/gi, '_');
        doc.save(`${codigo}.pdf`);
    }

    async function downloadEmergencyAsPDFFromIndex(index) {
        const emergencies = await readAllEmergencies();
        const emergency = emergencies[index];

        if (!emergency) {
            alert('No se encontro el registro seleccionado.');
            return;
        }

        downloadEmergencyAsPDF(emergency);
    }

    function exportToCsv(emergencies, fileName) {
        const headers = [
            'Fecha',
            'Codigo de Emergencia',
            'Hora',
            'Municipio',
            'Departamento',
            'Tipo de Incidente',
            'Entidad de Apoyo',
            'Nombre del que Atiende',
            'Rango',
            'Nombre del Paciente',
            'Identificacion del Paciente',
            'Edad',
            'Sexo',
            'Barrio/Vereda',
            'Direccion',
            'Latitud',
            'Longitud',
            'Telefono',
            'Total de Afectados',
            'Perdidas',
            'Unidades',
            'Vehiculos',
            'Observaciones',
            'Fecha de Registro'
        ];

        const rows = emergencies.map(emergency => ([
            formatDate(emergency.fecha),
            emergency.codigoEmergencia || '',
            emergency.hora || '',
            emergency.municipio || '',
            emergency.departamento || '',
            getTipoIncidenteLabel(emergency.tipoIncidente),
            emergency.entidadApoyo || '',
            emergency.nombreAtendio || '',
            emergency.rangoAtendio || '',
            emergency.nombrePaciente || '',
            emergency.identificacionPaciente || '',
            emergency.edad || '',
            emergency.sexo || '',
            emergency.barrioVereda || '',
            emergency.direccion || '',
            formatCoordinate(emergency.latitud),
            formatCoordinate(emergency.longitud),
            emergency.telefono || '',
            emergency.totalAfectados || '',
            emergency.perdidas || '',
            emergency.unidades || '',
            emergency.vehiculos || '',
            emergency.observaciones || '',
            emergency.timestamp ? new Date(emergency.timestamp).toLocaleString('es-CO') : ''
        ]));

        const csv = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    async function exportAllRecords() {
        const emergencies = await readAllEmergencies();
        if (emergencies.length === 0) {
            alert('No hay registros para exportar.');
            return;
        }

        exportToCsv(emergencies, `BOMBEROS_EMERGENCIAS_${new Date().toISOString().slice(0, 10)}.csv`);
    }

    async function exportByMonthToExcel() {
        const emergencies = await readAllEmergencies();
        if (emergencies.length === 0) {
            alert('No hay registros para exportar.');
            return;
        }

        const year = prompt('Ingrese el ano (ejemplo: 2026):');
        if (!year || Number.isNaN(Number(year)) || String(year).length !== 4) {
            alert('Ano invalido.');
            return;
        }

        const month = prompt('Ingrese el mes (1-12):');
        const monthNumber = Number(month);
        if (!month || Number.isNaN(monthNumber) || monthNumber < 1 || monthNumber > 12) {
            alert('Mes invalido.');
            return;
        }

        const filtered = emergencies.filter(emergency => {
            const date = new Date(`${emergency.fecha}T00:00:00`);
            return date.getFullYear() === Number(year) && date.getMonth() + 1 === monthNumber;
        });

        if (filtered.length === 0) {
            alert(`No hay registros para ${month}/${year}.`);
            return;
        }

        const monthName = new Date(Number(year), monthNumber - 1, 1)
            .toLocaleString('es-CO', { month: 'long', year: 'numeric' })
            .replace(/\s+/g, '_');

        exportToCsv(filtered, `BOMBEROS_EMERGENCIAS_${monthName}.csv`);
    }

    emergencyForm.addEventListener('submit', async event => {
        event.preventDefault();

        const formData = collectFormData();
        const isEditing = editingRecordIndex !== null;
        const validation = validateFormData(formData);

        clearFieldErrors();

        if (!validation.isValid) {
            validation.invalidFields.forEach(fieldId => setFieldError(fieldId, true));
            showFormFeedback(validation.errors[0] || 'Revisa los datos del formulario.');
            updateSystemStatus('Formulario con validaciones pendientes');

            const firstInvalidField = document.getElementById(validation.invalidFields[0]);
            if (firstInvalidField) {
                firstInvalidField.focus();
            }

            return;
        }

        clearFormFeedback();

        const emergencies = await readAllEmergencies();
        if (isEditing && emergencies[editingRecordIndex]) {
            const originalRecord = emergencies[editingRecordIndex];
            emergencies[editingRecordIndex] = {
                ...originalRecord,
                ...formData,
                timestamp: originalRecord.timestamp || formData.timestamp,
                updatedAt: new Date().toISOString()
            };
        } else {
            emergencies.push(formData);
        }

        await saveEmergencies(emergencies);
        clearForm();
        await loadRecords();
        showSection('records');
        alert(isEditing
            ? 'Emergencia actualizada exitosamente.'
            : 'Emergencia guardada exitosamente.');
        updateSystemStatus(isEditing
            ? 'Emergencia actualizada correctamente'
            : 'Emergencia registrada correctamente');
    });

    emergencyForm.addEventListener('reset', () => {
        setTimeout(() => {
            fieldIds.forEach(fieldId => setFieldValue(fieldId, ''));
            clearMarker();
            clearDraft();
            primeDefaultFields();
            updateSystemStatus('Formulario limpio');
        }, 0);
    });

    emergencyForm.addEventListener('input', () => {
        saveDraft();
        clearFormFeedback();
    });

    emergencyForm.addEventListener('change', () => {
        saveDraft();
        clearFormFeedback();
    });

    [
        ['identificacion-paciente', value => value.replace(/\D/g, '')],
        ['telefono', value => value.replace(/[^\d+\s()-]/g, '')],
        ['codigo-emergencia', value => value.toUpperCase().replace(/[^A-Z0-9_-]/g, '')]
    ].forEach(([fieldId, sanitize]) => {
        const field = document.getElementById(fieldId);
        if (!field) {
            return;
        }

        field.addEventListener('input', event => {
            const sanitizedValue = sanitize(event.target.value);
            if (event.target.value !== sanitizedValue) {
                event.target.value = sanitizedValue;
            }

            setFieldError(fieldId, false);
        });
    });

    Object.keys(fieldLabels).forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field) {
            return;
        }

        field.addEventListener('input', () => setFieldError(fieldId, false));
        field.addEventListener('change', () => setFieldError(fieldId, false));
    });

    if (document.getElementById('fecha')) {
        document.getElementById('fecha').addEventListener('change', () => {
            ensureEmergencyCode();
        });
    }

    if (recordsSearchInput) {
        recordsSearchInput.addEventListener('input', async () => {
            await loadRecords();
            updateSystemStatus(recordsSearchInput.value.trim() ? 'Filtro aplicado' : 'Vista completa de registros');
        });
    }

    if (newRecordBtn) {
        newRecordBtn.addEventListener('click', () => {
            clearForm();
            showSection('form');
            updateSystemStatus('Nuevo registro listo para captura');
        });
    }

    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', async () => {
            await toggleFullscreen();
        });
    }

    document.addEventListener('fullscreenchange', () => {
        updateFullscreenButtonLabel();
    });

    if (exportBackupBtn) {
        exportBackupBtn.addEventListener('click', async () => {
            await exportBackup();
        });
    }

    if (importBackupBtn) {
        importBackupBtn.addEventListener('click', async () => {
            await importBackup();
        });
    }

    navLinks.forEach(link => {
        link.addEventListener('click', async event => {
            event.preventDefault();

            if (link === viewRecordsBtn) {
                await loadRecords();
                showSection('records');
                updateSystemStatus('Consulta de registros');
                return;
            }

            if (link === exportExcelBtn) {
                await exportAllRecords();
                return;
            }

            if (link === exportMonthlyBtn) {
                await exportByMonthToExcel();
                return;
            }

            showSection('form');
            updateSystemStatus('Modo captura');
        });
    });

    primeDefaultFields();
    setSubmitButtonLabel();
    await migrateLegacyDataIfNeeded();
    restoreDraft();
    await loadRecords();
    showSection('form');
    initializeMap();
    updateFullscreenButtonLabel();
    window.bomberosApp = {
        readAllEmergencies,
        saveEmergencies,
        loadRecords,
        showSection,
        updateSystemStatus
    };
    updateSystemStatus('Sistema listo para operar');
});
