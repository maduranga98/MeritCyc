import JSZip from 'jszip';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { type Cycle } from '../types/cycle';
import { type Evaluation } from '../types/evaluation';
import { auditService } from './auditService';

export const dataExportService = {
  /**
   * Export all company data as a ZIP file
   * Includes cycles, evaluations, audit logs, users, departments, salary bands
   */
  exportCompanyDataZIP: async (companyId: string): Promise<void> => {
    try {
      const zip = new JSZip();

      // Fetch all company data
      const cyclesSnap = await getDocs(query(collection(db, 'cycles'), where('companyId', '==', companyId)));
      const evalsSnap = await getDocs(query(collection(db, 'evaluations'), where('companyId', '==', companyId)));
      const usersSnap = await getDocs(query(collection(db, 'users'), where('companyId', '==', companyId)));
      const deptsSnap = await getDocs(query(collection(db, 'companies', companyId, 'departments')));
      const bandsSnap = await getDocs(query(collection(db, 'companies', companyId, 'salaryBands')));

      // Fetch audit logs
      const auditLogs = await auditService.fetchAuditLogs(companyId, {}, undefined, true);

      // Create folders in ZIP
      const cyclesFolder = zip.folder('cycles');
      const evalsFolder = zip.folder('evaluations');
      const usersFolder = zip.folder('users');
      const auditFolder = zip.folder('audit_logs');
      const metaFolder = zip.folder('metadata');

      // Export Cycles
      const cyclesData = cyclesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.().toISOString(),
        updatedAt: doc.data().updatedAt?.toDate?.().toISOString(),
      }));
      cyclesFolder?.file('cycles.json', JSON.stringify(cyclesData, null, 2));

      // Export Evaluations
      const evalsData = evalsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.().toISOString(),
        updatedAt: doc.data().updatedAt?.toDate?.().toISOString(),
      }));
      evalsFolder?.file('evaluations.json', JSON.stringify(evalsData, null, 2));

      // Export Users
      const usersData = usersSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.().toISOString(),
      }));
      usersFolder?.file('users.json', JSON.stringify(usersData, null, 2));

      // Export Departments
      const deptsData = deptsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      metaFolder?.file('departments.json', JSON.stringify(deptsData, null, 2));

      // Export Salary Bands
      const bandsData = bandsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      metaFolder?.file('salary_bands.json', JSON.stringify(bandsData, null, 2));

      // Export Audit Logs as CSV
      const auditCSV = dataExportService.logsToCSV(auditLogs);
      auditFolder?.file('audit_logs.csv', auditCSV);

      // Create export manifest
      const manifest = {
        exportDate: new Date().toISOString(),
        companyId,
        recordCounts: {
          cycles: cyclesData.length,
          evaluations: evalsData.length,
          users: usersData.length,
          departments: deptsData.length,
          salaryBands: bandsData.length,
          auditLogs: auditLogs.length,
        },
        files: [
          'cycles/cycles.json',
          'evaluations/evaluations.json',
          'users/users.json',
          'metadata/departments.json',
          'metadata/salary_bands.json',
          'audit_logs/audit_logs.csv',
          'MANIFEST.json',
        ],
      };
      zip.file('MANIFEST.json', JSON.stringify(manifest, null, 2));

      // Generate and download ZIP
      const blob = await zip.generateAsync({ type: 'blob' });
      dataExportService.downloadZIP(blob, `company_data_export_${new Date().toISOString().split('T')[0]}.zip`);
    } catch (error) {
      console.error('Error exporting company data:', error);
      throw error;
    }
  },

  /**
   * Download a ZIP file blob
   */
  downloadZIP: (blob: Blob, filename: string): void => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
  },

  /**
   * Convert audit logs to CSV format
   */
  logsToCSV: (logs: any[]): string => {
    const headers = ['Timestamp', 'Action', 'Actor Email', 'Actor Role', 'Target Type', 'Target ID', 'Details'];
    const rows = logs.map(log => [
      log.timestamp ? new Date(log.timestamp.toDate?.() || log.timestamp).toISOString() : '',
      log.action,
      log.actorEmail,
      log.actorRole,
      log.targetType,
      log.targetId,
      log.metadata ? JSON.stringify(log.metadata) : '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return csvContent;
  },
};
