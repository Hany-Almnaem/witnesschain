import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Users table
 * Stores DID-based user identities
 */
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(), // DID string (did:key:...)
    publicKey: text('public_key').notNull(),
    walletAddress: text('wallet_address'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    walletIdx: index('users_wallet_idx').on(table.walletAddress),
  })
);

/**
 * Evidence table
 * Stores evidence submissions and metadata
 */
export const evidence = sqliteTable(
  'evidence',
  {
    id: text('id').primaryKey(), // UUID
    userId: text('user_id')
      .notNull()
      .references(() => users.id),

    // Content info
    title: text('title').notNull(),
    description: text('description'),
    category: text('category').notNull(),

    // Filecoin Storage info (via Synapse SDK)
    pieceCid: text('piece_cid'), // Filecoin PieceCID
    dataSetId: text('data_set_id'), // Synapse data set ID
    providerAddress: text('provider_address'), // Storage Provider address

    // Encryption info
    encryptedKey: text('encrypted_key').notNull(), // Encrypted file key
    nonce: text('nonce').notNull(), // Encryption nonce

    // File info
    fileSize: integer('file_size').notNull(),
    mimeType: text('mime_type').notNull(),
    contentHash: text('content_hash').notNull(), // SHA-256 of original file

    // FVM Blockchain info
    txHash: text('tx_hash'), // FVM transaction hash
    blockNumber: integer('block_number'),
    onChainTimestamp: integer('on_chain_timestamp'),

    // Filecoin Payment info
    filPaid: text('fil_paid'), // Amount of FIL paid for storage
    paymentTxHash: text('payment_tx_hash'), // Filecoin Pay transaction

    // Status
    status: text('status').notNull().default('pending'),
    // 'pending', 'uploading', 'stored', 'timestamped', 'verified', 'rejected'

    // Access Control
    ucanToken: text('ucan_token'), // UCAN token for access control

    // Additional metadata (JSON)
    metadata: text('metadata', { mode: 'json' }),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdx: index('evidence_user_idx').on(table.userId),
    statusIdx: index('evidence_status_idx').on(table.status),
    categoryIdx: index('evidence_category_idx').on(table.category),
    contentHashIdx: uniqueIndex('evidence_content_hash_idx').on(table.contentHash),
    pieceCidIdx: index('evidence_piece_cid_idx').on(table.pieceCid),
  })
);

/**
 * Verifications table
 * Stores verification requests and results
 */
export const verifications = sqliteTable(
  'verifications',
  {
    id: text('id').primaryKey(), // UUID
    evidenceId: text('evidence_id')
      .notNull()
      .references(() => evidence.id),

    status: text('status').notNull().default('pending'),
    // 'pending', 'approved', 'rejected'

    // Verifier info
    verifiedBy: text('verified_by'), // DID of verifier
    verifiedAt: integer('verified_at', { mode: 'timestamp' }),
    notes: text('notes'),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    evidenceIdx: index('verifications_evidence_idx').on(table.evidenceId),
    statusIdx: index('verifications_status_idx').on(table.status),
  })
);

/**
 * Access logs table
 * Audit trail for evidence access
 */
export const accessLogs = sqliteTable(
  'access_logs',
  {
    id: text('id').primaryKey(), // UUID
    evidenceId: text('evidence_id')
      .notNull()
      .references(() => evidence.id),
    userId: text('user_id').notNull(),
    action: text('action').notNull(), // 'view', 'download', 'share', 'revoke'
    ucanToken: text('ucan_token'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    evidenceIdx: index('access_logs_evidence_idx').on(table.evidenceId),
    userIdx: index('access_logs_user_idx').on(table.userId),
    actionIdx: index('access_logs_action_idx').on(table.action),
  })
);

// Type exports for use in application code
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Evidence = typeof evidence.$inferSelect;
export type NewEvidence = typeof evidence.$inferInsert;

export type Verification = typeof verifications.$inferSelect;
export type NewVerification = typeof verifications.$inferInsert;

export type AccessLog = typeof accessLogs.$inferSelect;
export type NewAccessLog = typeof accessLogs.$inferInsert;
