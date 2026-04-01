// Funcionalidad de copia de seguridad para el sistema de bomberos.

function getBomberosApp() {
    const app = window.bomberosApp;

    if (!app) {
        throw new Error('La aplicacion principal no esta lista todavia.');
    }

    return app;
}

/**
 * Exporta todas las emergencias como un archivo JSON de respaldo.
 */
async function exportBackup() {
    try {
        const app = getBomberosApp();
        const emergencies = await app.readAllEmergencies();

        if (emergencies.length === 0) {
            alert('No hay registros para exportar como copia de seguridad.');
            return;
        }

        const backupData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            totalRecords: emergencies.length,
            data: emergencies
        };

        const jsonBlob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const downloadLink = document.createElement('a');
        const dateString = new Date().toISOString().slice(0, 10);
        downloadLink.href = URL.createObjectURL(jsonBlob);
        downloadLink.download = `BOMBEROS_BACKUP_${dateString}.json`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(downloadLink.href);

        alert(`Copia de seguridad exportada exitosamente con ${emergencies.length} registros.`);
        app.updateSystemStatus('Copia de seguridad exportada');
    } catch (error) {
        console.error('Error al exportar copia de seguridad:', error);
        alert('Error al exportar la copia de seguridad. Consulte la consola para mas detalles.');

        if (window.bomberosApp) {
            window.bomberosApp.updateSystemStatus('Error al exportar copia de seguridad');
        }
    }
}

/**
 * Importa emergencias desde un archivo JSON de respaldo.
 */
async function importBackup() {
    let app;

    try {
        app = getBomberosApp();
    } catch (error) {
        alert(error.message);
        return;
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';

    fileInput.onchange = async event => {
        const file = event.target.files[0];
        if (!file) {
            fileInput.remove();
            return;
        }

        try {
            const text = await file.text();
            const backupData = JSON.parse(text);

            if (!backupData || !backupData.data || !Array.isArray(backupData.data)) {
                throw new Error('Formato de archivo de backup invalido.');
            }

            const emergencies = backupData.data;
            if (emergencies.length === 0) {
                alert('El archivo de backup no contiene registros.');
                return;
            }

            const exportedAt = backupData.exportedAt
                ? new Date(backupData.exportedAt).toLocaleString('es-CO')
                : 'Desconocido';

            const confirmMessage = `Esta seguro de importar ${emergencies.length} registros?\n\n` +
                'Esta accion reemplazara todos los registros existentes.\n' +
                'Se recomienda hacer una copia de seguridad antes de continuar.\n\n' +
                'Informacion del backup:\n' +
                `- Version: ${backupData.version || 'Desconocida'}\n` +
                `- Exportado: ${exportedAt}\n` +
                `- Total registros: ${emergencies.length}`;

            if (!confirm(confirmMessage)) {
                return;
            }

            await app.saveEmergencies(emergencies);
            await app.loadRecords();
            app.showSection('records');

            alert(`Importacion completada exitosamente. Se importaron ${emergencies.length} registros.`);
            app.updateSystemStatus('Copia de seguridad importada');
        } catch (error) {
            console.error('Error al importar copia de seguridad:', error);
            alert(`Error al importar la copia de seguridad: ${error.message}`);
            app.updateSystemStatus('Error al importar copia de seguridad');
        } finally {
            fileInput.remove();
        }
    };

    document.body.appendChild(fileInput);
    fileInput.click();
}
