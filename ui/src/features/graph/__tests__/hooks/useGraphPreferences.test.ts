/**
 * useGraphPreferences Hook Tests
 * Tests for localStorage preferences management hook
 * @module features/graph/__tests__/hooks/useGraphPreferences.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useGraphPreferences,
  DEFAULT_PREFERENCES,
  type GraphPreferences,
} from '../../hooks/useGraphPreferences';
import { createMockLocalStorage } from '../utils/testUtils';

describe('useGraphPreferences', () => {
  let mockLocalStorage: ReturnType<typeof createMockLocalStorage>;

  beforeEach(() => {
    mockLocalStorage = createMockLocalStorage();
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  describe('initialization', () => {
    it('should initialize with default preferences', () => {
      const { result } = renderHook(() => useGraphPreferences());

      expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);
    });

    it('should load preferences from localStorage', () => {
      const stored = {
        version: 1,
        data: {
          showMinimap: false,
          layoutDirection: 'LR',
        },
      };
      mockLocalStorage.setItem('graph-preferences', JSON.stringify(stored));

      const { result } = renderHook(() => useGraphPreferences());

      expect(result.current.preferences.showMinimap).toBe(false);
      expect(result.current.preferences.layoutDirection).toBe('LR');
      // Other preferences should be defaults
      expect(result.current.preferences.showLabels).toBe(DEFAULT_PREFERENCES.showLabels);
    });

    it('should handle corrupted localStorage gracefully', () => {
      mockLocalStorage.setItem('graph-preferences', 'invalid json');

      const { result } = renderHook(() => useGraphPreferences());

      // Should fall back to defaults
      expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);
    });

    it('should handle version mismatch', () => {
      const stored = {
        version: 0, // Old version
        data: {
          showMinimap: false,
        },
      };
      mockLocalStorage.setItem('graph-preferences', JSON.stringify(stored));

      const { result } = renderHook(() => useGraphPreferences());

      // Should fall back to defaults on version mismatch
      expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);
    });

    it('should sanitize invalid values', () => {
      const stored = {
        version: 1,
        data: {
          layoutDirection: 'INVALID', // Invalid direction
          defaultZoom: 5, // Out of range
          gridSize: -10, // Negative
        },
      };
      mockLocalStorage.setItem('graph-preferences', JSON.stringify(stored));

      const { result } = renderHook(() => useGraphPreferences());

      // Invalid values should be ignored, using defaults
      expect(result.current.preferences.layoutDirection).toBe(
        DEFAULT_PREFERENCES.layoutDirection
      );
      expect(result.current.preferences.defaultZoom).toBe(2.0); // Clamped to max
      expect(result.current.preferences.gridSize).toBe(DEFAULT_PREFERENCES.gridSize);
    });
  });

  describe('updatePreference', () => {
    it('should update a single preference', () => {
      const { result } = renderHook(() => useGraphPreferences());

      act(() => {
        result.current.updatePreference('showMinimap', false);
      });

      expect(result.current.preferences.showMinimap).toBe(false);
    });

    it('should persist to localStorage', () => {
      const { result } = renderHook(() => useGraphPreferences());

      act(() => {
        result.current.updatePreference('showLabels', false);
      });

      const stored = JSON.parse(mockLocalStorage.getItem('graph-preferences') || '{}');
      expect(stored.data.showLabels).toBe(false);
    });

    it('should update layoutDirection', () => {
      const { result } = renderHook(() => useGraphPreferences());

      act(() => {
        result.current.updatePreference('layoutDirection', 'LR');
      });

      expect(result.current.preferences.layoutDirection).toBe('LR');
    });

    it('should update theme', () => {
      const { result } = renderHook(() => useGraphPreferences());

      act(() => {
        result.current.updatePreference('theme', 'dark');
      });

      expect(result.current.preferences.theme).toBe('dark');
    });

    it('should remove from custom prefs when set back to default', () => {
      const { result } = renderHook(() => useGraphPreferences());

      // First change from default
      act(() => {
        result.current.updatePreference('showMinimap', false);
      });

      expect(result.current.hasCustomPreferences).toBe(true);

      // Set back to default
      act(() => {
        result.current.updatePreference('showMinimap', DEFAULT_PREFERENCES.showMinimap);
      });

      expect(result.current.hasCustomPreferences).toBe(false);
    });
  });

  describe('updatePreferences', () => {
    it('should update multiple preferences at once', () => {
      const { result } = renderHook(() => useGraphPreferences());

      act(() => {
        result.current.updatePreferences({
          showMinimap: false,
          showLabels: false,
          layoutDirection: 'RL',
        });
      });

      expect(result.current.preferences.showMinimap).toBe(false);
      expect(result.current.preferences.showLabels).toBe(false);
      expect(result.current.preferences.layoutDirection).toBe('RL');
    });

    it('should persist batch updates', () => {
      const { result } = renderHook(() => useGraphPreferences());

      act(() => {
        result.current.updatePreferences({
          animateEdges: false,
          defaultZoom: 1.0,
        });
      });

      const stored = JSON.parse(mockLocalStorage.getItem('graph-preferences') || '{}');
      expect(stored.data.animateEdges).toBe(false);
      expect(stored.data.defaultZoom).toBe(1.0);
    });
  });

  describe('resetPreferences', () => {
    it('should reset all preferences to defaults', () => {
      const { result } = renderHook(() => useGraphPreferences());

      // Make some changes
      act(() => {
        result.current.updatePreferences({
          showMinimap: false,
          showLabels: false,
          theme: 'dark',
        });
      });

      // Reset
      act(() => {
        result.current.resetPreferences();
      });

      expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);
    });

    it('should clear localStorage custom prefs', () => {
      const { result } = renderHook(() => useGraphPreferences());

      act(() => {
        result.current.updatePreference('showMinimap', false);
      });

      act(() => {
        result.current.resetPreferences();
      });

      expect(result.current.hasCustomPreferences).toBe(false);
    });
  });

  describe('resetPreference', () => {
    it('should reset a single preference to default', () => {
      const { result } = renderHook(() => useGraphPreferences());

      act(() => {
        result.current.updatePreferences({
          showMinimap: false,
          showLabels: false,
        });
      });

      act(() => {
        result.current.resetPreference('showMinimap');
      });

      expect(result.current.preferences.showMinimap).toBe(DEFAULT_PREFERENCES.showMinimap);
      // Other custom prefs should remain
      expect(result.current.preferences.showLabels).toBe(false);
    });
  });

  describe('togglePreference', () => {
    it('should toggle boolean preference on', () => {
      const { result } = renderHook(() => useGraphPreferences());

      // Start with false
      act(() => {
        result.current.updatePreference('snapToGrid', false);
      });

      act(() => {
        result.current.togglePreference('snapToGrid');
      });

      expect(result.current.preferences.snapToGrid).toBe(true);
    });

    it('should toggle boolean preference off', () => {
      const { result } = renderHook(() => useGraphPreferences());

      expect(result.current.preferences.showMinimap).toBe(true);

      act(() => {
        result.current.togglePreference('showMinimap');
      });

      expect(result.current.preferences.showMinimap).toBe(false);
    });

    it('should persist toggle to localStorage', () => {
      const { result } = renderHook(() => useGraphPreferences());

      act(() => {
        result.current.togglePreference('animateEdges');
      });

      const stored = JSON.parse(mockLocalStorage.getItem('graph-preferences') || '{}');
      expect(stored.data.animateEdges).toBe(false); // Default is true, toggled to false
    });
  });

  describe('hasCustomPreferences', () => {
    it('should return false when no custom preferences', () => {
      const { result } = renderHook(() => useGraphPreferences());

      expect(result.current.hasCustomPreferences).toBe(false);
    });

    it('should return true when any preference differs from default', () => {
      const { result } = renderHook(() => useGraphPreferences());

      act(() => {
        result.current.updatePreference('defaultZoom', 1.5);
      });

      expect(result.current.hasCustomPreferences).toBe(true);
    });
  });

  describe('cross-tab synchronization', () => {
    it('should update state from storage event', () => {
      const { result } = renderHook(() => useGraphPreferences());

      // Simulate storage event from another tab
      const newPrefs = {
        version: 1,
        data: {
          showMinimap: false,
          theme: 'dark',
        },
      };

      act(() => {
        const event = new StorageEvent('storage', {
          key: 'graph-preferences',
          newValue: JSON.stringify(newPrefs),
        });
        window.dispatchEvent(event);
      });

      expect(result.current.preferences.showMinimap).toBe(false);
      expect(result.current.preferences.theme).toBe('dark');
    });

    it('should ignore storage events for other keys', () => {
      const { result } = renderHook(() => useGraphPreferences());

      const originalPrefs = { ...result.current.preferences };

      act(() => {
        const event = new StorageEvent('storage', {
          key: 'other-key',
          newValue: JSON.stringify({ showMinimap: false }),
        });
        window.dispatchEvent(event);
      });

      expect(result.current.preferences).toEqual(originalPrefs);
    });

    it('should ignore malformed storage events', () => {
      const { result } = renderHook(() => useGraphPreferences());

      const originalPrefs = { ...result.current.preferences };

      act(() => {
        const event = new StorageEvent('storage', {
          key: 'graph-preferences',
          newValue: 'not valid json',
        });
        window.dispatchEvent(event);
      });

      expect(result.current.preferences).toEqual(originalPrefs);
    });
  });

  describe('array preferences', () => {
    it('should handle collapsedFilterGroups', () => {
      const { result } = renderHook(() => useGraphPreferences());

      act(() => {
        result.current.updatePreference('collapsedFilterGroups', ['group1', 'group2']);
      });

      expect(result.current.preferences.collapsedFilterGroups).toEqual(['group1', 'group2']);
    });

    it('should handle recentNodeTypes', () => {
      const { result } = renderHook(() => useGraphPreferences());

      act(() => {
        result.current.updatePreference('recentNodeTypes', ['terraform_resource', 'helm_chart']);
      });

      expect(result.current.preferences.recentNodeTypes).toEqual([
        'terraform_resource',
        'helm_chart',
      ]);
    });

    it('should limit recentNodeTypes to 10 items when loading from storage', () => {
      const stored = {
        version: 1,
        data: {
          recentNodeTypes: Array.from({ length: 15 }, (_, i) => `type-${i}`),
        },
      };
      mockLocalStorage.setItem('graph-preferences', JSON.stringify(stored));

      const { result } = renderHook(() => useGraphPreferences());

      expect(result.current.preferences.recentNodeTypes.length).toBe(10);
    });
  });

  describe('numeric preferences', () => {
    it('should clamp defaultZoom to valid range', () => {
      const stored = {
        version: 1,
        data: {
          defaultZoom: 0.05, // Below min
        },
      };
      mockLocalStorage.setItem('graph-preferences', JSON.stringify(stored));

      const { result } = renderHook(() => useGraphPreferences());

      expect(result.current.preferences.defaultZoom).toBe(0.1); // Clamped to min
    });

    it('should floor gridSize to integer', () => {
      const stored = {
        version: 1,
        data: {
          gridSize: 25.7,
        },
      };
      mockLocalStorage.setItem('graph-preferences', JSON.stringify(stored));

      const { result } = renderHook(() => useGraphPreferences());

      expect(result.current.preferences.gridSize).toBe(25);
    });
  });
});
