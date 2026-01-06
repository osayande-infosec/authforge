// AuthForge - Encrypted Vault Routes

import { Hono } from 'hono';
import { Env, VaultItem, VaultFolder } from '../types';
import { generateId, sha256, logAudit } from '../lib/utils';
import { requireAuth, requireVerified, requireCSRF } from '../lib/middleware';

const vault = new Hono<{ Bindings: Env }>();

// All vault routes require authentication
vault.use('*', requireAuth);

/*
 * VAULT ARCHITECTURE:
 * - Items are encrypted client-side using user's vault key
 * - Server stores encrypted_data (ciphertext) and metadata
 * - Server never sees plaintext passwords/notes/cards
 * - User's vault key is derived from their master password
 */

// Setup vault (store salt and verification hash)
vault.post('/setup', requireCSRF(), async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    salt: string;
    verificationHash: string;
  }>();

  if (!body.salt || !body.verificationHash) {
    return c.json({ error: 'Salt and verification hash are required' }, 400);
  }

  // Check if vault is already set up
  const existing = await c.env.DB.prepare(
    'SELECT vault_key FROM users WHERE id = ?'
  ).bind(user.id).first<{ vault_key: string | null }>();

  if (existing?.vault_key) {
    return c.json({ error: 'Vault already set up' }, 400);
  }

  // Store salt and verification hash combined
  const vaultData = JSON.stringify({
    salt: body.salt,
    verificationHash: body.verificationHash
  });

  await c.env.DB.prepare(
    'UPDATE users SET vault_key = ? WHERE id = ?'
  ).bind(vaultData, user.id).run();

  await logAudit(c.env.DB, 'vault.setup', user.id, c.req.raw, {});

  return c.json({ success: true, message: 'Vault created' });
});

// Get vault salt (for unlocking)
vault.get('/salt', async (c) => {
  const user = c.get('user');

  const result = await c.env.DB.prepare(
    'SELECT vault_key FROM users WHERE id = ?'
  ).bind(user.id).first<{ vault_key: string | null }>();

  if (!result?.vault_key) {
    return c.json({ error: 'Vault not set up' }, 404);
  }

  try {
    const vaultData = JSON.parse(result.vault_key);
    return c.json({
      success: true,
      salt: vaultData.salt,
      verificationHash: vaultData.verificationHash
    });
  } catch {
    return c.json({ error: 'Invalid vault data' }, 500);
  }
});

// List vault items
vault.get('/items', async (c) => {
  const user = c.get('user');
  const folderId = c.req.query('folderId');
  const type = c.req.query('type') as 'login' | 'note' | 'card' | 'identity' | undefined;
  const search = c.req.query('search');

  let query = `
    SELECT id, folder_id, type, name, favorite, created_at, updated_at
    FROM vault_items 
    WHERE user_id = ?
  `;
  const params: any[] = [user.id];

  if (folderId) {
    query += ` AND folder_id = ?`;
    params.push(folderId);
  } else if (folderId === '') {
    query += ` AND folder_id IS NULL`;
  }

  if (type) {
    query += ` AND type = ?`;
    params.push(type);
  }

  if (search) {
    query += ` AND name LIKE ?`;
    params.push(`%${search}%`);
  }

  query += ` ORDER BY favorite DESC, name ASC`;

  const result = await c.env.DB.prepare(query).bind(...params).all<VaultItem>();

  return c.json({
    success: true,
    items: result.results.map(item => ({
      id: item.id,
      folderId: item.folder_id,
      type: item.type,
      name: item.name,
      favorite: item.favorite === 1,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }))
  });
});

// Get single vault item (includes encrypted data)
vault.get('/items/:id', async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('id');

  const item = await c.env.DB.prepare(`
    SELECT * FROM vault_items WHERE id = ? AND user_id = ?
  `).bind(itemId, user.id).first<VaultItem>();

  if (!item) {
    return c.json({ error: 'Item not found' }, 404);
  }

  return c.json({
    success: true,
    item: {
      id: item.id,
      folderId: item.folder_id,
      type: item.type,
      name: item.name,
      encryptedData: item.encrypted_data,
      iv: item.iv,
      favorite: item.favorite === 1,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }
  });
});

// Create vault item
vault.post('/items', requireCSRF(), async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    type: 'login' | 'note' | 'card' | 'identity';
    name: string;
    encryptedData: string;
    iv?: string;
    folderId?: string;
    favorite?: boolean;
    notes?: string;
  }>();

  if (!body.type || !body.name || !body.encryptedData) {
    return c.json({ error: 'Type, name, and encryptedData are required' }, 400);
  }

  // Schema uses 'password' not 'login' for type
  const typeMap: Record<string, string> = {
    'login': 'password',
    'password': 'password',
    'note': 'note',
    'card': 'card',
    'identity': 'identity'
  };
  const dbType = typeMap[body.type] || body.type;
  const validTypes = ['password', 'note', 'card', 'identity'];
  if (!validTypes.includes(dbType)) {
    return c.json({ error: 'Invalid item type' }, 400);
  }

  // Verify folder exists if provided
  if (body.folderId) {
    const folder = await c.env.DB.prepare(
      'SELECT id FROM vault_folders WHERE id = ? AND user_id = ?'
    ).bind(body.folderId, user.id).first();

    if (!folder) {
      return c.json({ error: 'Folder not found' }, 404);
    }
  }

  const itemId = generateId();
  // Use client-provided IV or generate a random one
  const iv = body.iv || crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  
  await c.env.DB.prepare(`
    INSERT INTO vault_items (id, user_id, folder_id, type, name, encrypted_data, iv, favorite)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    itemId,
    user.id,
    body.folderId || null,
    dbType,
    body.name,
    body.encryptedData,
    iv,
    body.favorite ? 1 : 0
  ).run();

  await logAudit(c.env.DB, 'vault.item.created', user.id, c.req.raw, { itemId, type: body.type });

  return c.json({
    success: true,
    message: 'Item created',
    item: { id: itemId }
  }, 201);
});

// Update vault item
vault.put('/items/:id', requireCSRF(), async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('id');
  const body = await c.req.json<{
    name?: string;
    encryptedData?: string;
    folderId?: string | null;
    favorite?: boolean;
    notes?: string;
  }>();

  // Build update query
  const updates: string[] = [];
  const params: any[] = [];

  if (body.name !== undefined) {
    updates.push('name = ?');
    params.push(body.name);
  }

  if (body.encryptedData !== undefined) {
    updates.push('encrypted_data = ?');
    params.push(body.encryptedData);
  }

  if (body.folderId !== undefined) {
    updates.push('folder_id = ?');
    params.push(body.folderId);
  }

  if (body.favorite !== undefined) {
    updates.push('favorite = ?');
    params.push(body.favorite ? 1 : 0);
  }

  if (body.notes !== undefined) {
    updates.push('notes = ?');
    params.push(body.notes);
  }

  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  updates.push('updated_at = datetime(\'now\')');

  const result = await c.env.DB.prepare(`
    UPDATE vault_items SET ${updates.join(', ')} WHERE id = ? AND user_id = ?
  `).bind(...params, itemId, user.id).run();

  if (!result.meta.changes) {
    return c.json({ error: 'Item not found' }, 404);
  }

  await logAudit(c.env.DB, 'vault.item.updated', user.id, c.req.raw, { itemId });

  return c.json({ success: true, message: 'Item updated' });
});

// Delete vault item
vault.delete('/items/:id', requireCSRF(), async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('id');

  const result = await c.env.DB.prepare(
    'DELETE FROM vault_items WHERE id = ? AND user_id = ?'
  ).bind(itemId, user.id).run();

  if (!result.meta.changes) {
    return c.json({ error: 'Item not found' }, 404);
  }

  await logAudit(c.env.DB, 'vault.item.deleted', user.id, c.req.raw, { itemId });

  return c.json({ success: true, message: 'Item deleted' });
});

// ============ FOLDERS ============

// List folders
vault.get('/folders', async (c) => {
  const user = c.get('user');

  const result = await c.env.DB.prepare(`
    SELECT id, name, parent_id, created_at
    FROM vault_folders 
    WHERE user_id = ?
    ORDER BY name ASC
  `).bind(user.id).all<VaultFolder>();

  // Also get item counts
  const counts = await c.env.DB.prepare(`
    SELECT folder_id, COUNT(*) as count
    FROM vault_items
    WHERE user_id = ?
    GROUP BY folder_id
  `).bind(user.id).all<{ folder_id: string | null; count: number }>();

  const countMap = new Map(counts.results.map(c => [c.folder_id, c.count]));

  return c.json({
    success: true,
    folders: result.results.map(f => ({
      id: f.id,
      name: f.name,
      parentId: f.parent_id,
      itemCount: countMap.get(f.id) || 0,
      createdAt: f.created_at
    })),
    unfiledCount: countMap.get(null) || 0
  });
});

// Create folder
vault.post('/folders', requireCSRF(), async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ name: string; parentId?: string }>();

  if (!body.name) {
    return c.json({ error: 'Name is required' }, 400);
  }

  // Verify parent exists if provided
  if (body.parentId) {
    const parent = await c.env.DB.prepare(
      'SELECT id FROM vault_folders WHERE id = ? AND user_id = ?'
    ).bind(body.parentId, user.id).first();

    if (!parent) {
      return c.json({ error: 'Parent folder not found' }, 404);
    }
  }

  const folderId = generateId();
  await c.env.DB.prepare(`
    INSERT INTO vault_folders (id, user_id, name, parent_id)
    VALUES (?, ?, ?, ?)
  `).bind(folderId, user.id, body.name, body.parentId || null).run();

  return c.json({
    success: true,
    message: 'Folder created',
    folder: { id: folderId }
  }, 201);
});

// Rename folder
vault.patch('/folders/:id', requireCSRF(), async (c) => {
  const user = c.get('user');
  const folderId = c.req.param('id');
  const body = await c.req.json<{ name: string }>();

  if (!body.name) {
    return c.json({ error: 'Name is required' }, 400);
  }

  const result = await c.env.DB.prepare(
    'UPDATE vault_folders SET name = ? WHERE id = ? AND user_id = ?'
  ).bind(body.name, folderId, user.id).run();

  if (!result.meta.changes) {
    return c.json({ error: 'Folder not found' }, 404);
  }

  return c.json({ success: true, message: 'Folder renamed' });
});

// Delete folder (moves items to unfiled)
vault.delete('/folders/:id', requireCSRF(), async (c) => {
  const user = c.get('user');
  const folderId = c.req.param('id');

  // Move items to unfiled
  await c.env.DB.prepare(
    'UPDATE vault_items SET folder_id = NULL WHERE folder_id = ? AND user_id = ?'
  ).bind(folderId, user.id).run();

  // Move subfolders to root
  await c.env.DB.prepare(
    'UPDATE vault_folders SET parent_id = NULL WHERE parent_id = ? AND user_id = ?'
  ).bind(folderId, user.id).run();

  // Delete folder
  const result = await c.env.DB.prepare(
    'DELETE FROM vault_folders WHERE id = ? AND user_id = ?'
  ).bind(folderId, user.id).run();

  if (!result.meta.changes) {
    return c.json({ error: 'Folder not found' }, 404);
  }

  return c.json({ success: true, message: 'Folder deleted' });
});

// ============ VAULT KEY ============

// Check if vault is unlocked (has key)
vault.get('/status', async (c) => {
  const user = c.get('user');

  return c.json({
    success: true,
    hasVaultKey: user.vault_key !== null,
    itemCount: (await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM vault_items WHERE user_id = ?'
    ).bind(user.id).first<{ count: number }>())?.count || 0
  });
});

// Set/update vault key (encrypted master key)
vault.post('/key', requireCSRF(), async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ encryptedKey: string }>();

  if (!body.encryptedKey) {
    return c.json({ error: 'Encrypted key is required' }, 400);
  }

  await c.env.DB.prepare(
    'UPDATE users SET vault_key = ?, updated_at = datetime(\'now\') WHERE id = ?'
  ).bind(body.encryptedKey, user.id).run();

  await logAudit(c.env.DB, 'vault.key.updated', user.id, c.req.raw);

  return c.json({ success: true, message: 'Vault key updated' });
});

// Export vault (encrypted)
vault.get('/export', async (c) => {
  const user = c.get('user');

  const items = await c.env.DB.prepare(`
    SELECT id, folder_id, type, name, encrypted_data, favorite, notes, created_at
    FROM vault_items WHERE user_id = ?
  `).bind(user.id).all<VaultItem>();

  const folders = await c.env.DB.prepare(`
    SELECT id, name, parent_id FROM vault_folders WHERE user_id = ?
  `).bind(user.id).all<VaultFolder>();

  await logAudit(c.env.DB, 'vault.exported', user.id, c.req.raw);

  return c.json({
    success: true,
    export: {
      version: 1,
      exportedAt: new Date().toISOString(),
      folders: folders.results,
      items: items.results
    }
  });
});

// Import vault (encrypted)
vault.post('/import', requireCSRF(), async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    folders: VaultFolder[];
    items: VaultItem[];
    merge?: boolean;
  }>();

  if (!body.items) {
    return c.json({ error: 'Items are required' }, 400);
  }

  // If not merging, clear existing
  if (!body.merge) {
    await c.env.DB.prepare('DELETE FROM vault_items WHERE user_id = ?').bind(user.id).run();
    await c.env.DB.prepare('DELETE FROM vault_folders WHERE user_id = ?').bind(user.id).run();
  }

  // Create folder ID mapping (old -> new)
  const folderMap = new Map<string, string>();

  // Import folders first
  if (body.folders) {
    for (const folder of body.folders) {
      const newId = generateId();
      folderMap.set(folder.id, newId);
      
      await c.env.DB.prepare(`
        INSERT INTO vault_folders (id, user_id, name, parent_id)
        VALUES (?, ?, ?, ?)
      `).bind(
        newId,
        user.id,
        folder.name,
        folder.parent_id ? folderMap.get(folder.parent_id) || null : null
      ).run();
    }
  }

  // Import items
  let imported = 0;
  for (const item of body.items) {
    const newId = generateId();
    await c.env.DB.prepare(`
      INSERT INTO vault_items (id, user_id, folder_id, type, name, encrypted_data, favorite, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      newId,
      user.id,
      item.folder_id ? folderMap.get(item.folder_id) || null : null,
      item.type,
      item.name,
      item.encrypted_data,
      item.favorite ? 1 : 0,
      item.notes || null
    ).run();
    imported++;
  }

  await logAudit(c.env.DB, 'vault.imported', user.id, c.req.raw, { 
    itemCount: imported,
    folderCount: body.folders?.length || 0 
  });

  return c.json({
    success: true,
    message: `Imported ${imported} items`,
    imported
  });
});

export { vault as vaultRoutes };
