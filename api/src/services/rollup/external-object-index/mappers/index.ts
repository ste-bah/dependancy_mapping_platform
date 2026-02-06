/**
 * External Object Index Mappers
 * @module services/rollup/external-object-index/mappers
 *
 * Data mappers for the External Object Index subsystem.
 * Provides bidirectional conversion between domain and persistence representations.
 *
 * TASK-ROLLUP-003: Data layer mapper exports
 */

export {
  // Mapper class
  ExternalObjectMapper,
  createExternalObjectMapper,
  getDefaultMapper,
  resetDefaultMapper,

  // Row types (for repository use)
  type ExternalObjectIndexRow,
  type NodeExternalObjectRow,
  type ExternalObjectMasterRow,

  // Persistence types
  type ExternalObjectIndexPersistence,
  type NodeExternalObjectPersistence,
} from './external-object-mapper.js';
