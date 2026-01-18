import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDataManagement } from '@/composables/useDataManagement';
import { createTestingPinia } from '@pinia/testing';
import { setActivePinia } from 'pinia';
import { useFinanceStore } from '@/stores/finance';

describe('useDataManagement', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({
      createSpy: vi.fn,
      stubActions: false,
      initialState: {
        finance: {
          accounts: [{ id: 1, accountName: 'Test', startingBalance: 0, accountTypeId: 1, isDefault: true }],
          categories: [],
          transactions: [],
          accountTypes: [],
          ledgerYears: []
        }
      }
    }));
    vi.clearAllMocks();
  });

  describe('deleteDatabase', () => {
    it('deletes database after confirmation and closes window', async () => {
      console.log('[Test: useDataManagement] Testing deleteDatabase flow...');
      const { deleteDatabase } = useDataManagement();
      
      const confirmModal = { openConfirmation: vi.fn().mockResolvedValue(true) };
      const notifModal = { openConfirmation: vi.fn().mockResolvedValue(true) };
      const errorModal = { openConfirmation: vi.fn() };

      (window.electronAPI.deleteDatabase as any).mockResolvedValue(true);
      window.close = vi.fn(); // Mock window.close

      await deleteDatabase(confirmModal as any, notifModal as any, errorModal as any);

      expect(confirmModal.openConfirmation).toHaveBeenCalled();
      expect(window.electronAPI.deleteDatabase).toHaveBeenCalled();
      expect(notifModal.openConfirmation).toHaveBeenCalledWith(expect.objectContaining({ title: 'Database Deleted' }));
      expect(window.close).toHaveBeenCalled();
      console.log('[Test: useDataManagement] Database deleted successfully.');
    });
    // ...
  });

  describe('exportData', () => {
    it('exports data with correct structure', async () => {
      console.log('[Test: useDataManagement] Testing exportData flow...');
      const { exportData } = useDataManagement();
      const notifModal = { openConfirmation: vi.fn() };

      (window.electronAPI.exportDatabase as any).mockResolvedValue({ success: true });

      await exportData(notifModal as any);

      expect(window.electronAPI.exportDatabase).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.stringContaining('"accounts":'),
        defaultName: expect.stringContaining('One-Finance Export')
      }));
      expect(notifModal.openConfirmation).toHaveBeenCalled();
      console.log('[Test: useDataManagement] Data exported successfully.');
    });
  });

  describe('importData', () => {
    it('imports data and replaces when requested', async () => {
      console.log('[Test: useDataManagement] Testing importData (Replace) flow...');
      const { importData } = useDataManagement();
      const store = useFinanceStore();
      
      // Mock store actions
      store.deleteAllDataFromTables = vi.fn();
      store.importDatabaseData = vi.fn().mockResolvedValue(true);

      const errorModal = { openConfirmation: vi.fn() };
      const notifModal = { openConfirmation: vi.fn() };
      const actionModal = { 
        openConfirmation: vi.fn().mockResolvedValue({ action: 'replace', skipDuplicates: false }) 
      };

      // Mock Electron import
      const mockData = {
        accounts: [{ id: 1, accountName: 'Imp', startingBalance: 0, accountTypeId: 1, isDefault: true }],
        transactions: [],
        categories: [],
        accountTypes: [{ id: 1, type: 'Checking' }], // Added matching type
        ledgerYears: []
      };
      (window.electronAPI.importDatabase as any).mockResolvedValue({ success: true, data: mockData });

      await importData(errorModal as any, actionModal as any, notifModal as any);

      expect(store.deleteAllDataFromTables).toHaveBeenCalled();
      expect(store.importDatabaseData).toHaveBeenCalledWith(mockData, false);
      expect(notifModal.openConfirmation).toHaveBeenCalledWith(expect.objectContaining({ title: 'Import Successful' }));
      console.log('[Test: useDataManagement] Data imported (replaced) successfully.');
    });
    // ...
  });
});
