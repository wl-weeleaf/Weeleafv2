import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const remoteSessions=sqliteTable('leafy_remote_sessions',{
 id:text('id').primaryKey(),owner:text('owner').notNull(),pairHash:text('pairHash').notNull(),tokenHash:text('tokenHash'),kind:text('kind').notNull().default('chrome'),capabilities:text('capabilities').notNull().default('{}'),device:text('device').notNull().default('Chrome'),control:text('control').notNull().default('DISCONNECTED'),snapshot:text('snapshot').notNull().default('{}'),expiresAt:integer('expiresAt').notNull(),lastSeen:integer('lastSeen').notNull().default(0),revoked:integer('revoked').notNull().default(0),
},t=>[index('idx_leafy_remote_owner').on(t.owner)]);
export const platformControls=sqliteTable('leafy_platform_controls',{id:text('id').primaryKey(),owner:text('owner').notNull(),control:text('control').notNull().default('AGENT_CONTROL')});
export const uiCommands=sqliteTable('leafy_ui_commands',{
 id:text('id').primaryKey(),owner:text('owner').notNull(),target:text('target').notNull(),kind:text('kind').notNull(),payload:text('payload').notNull(),status:text('status').notNull().default('queued'),result:text('result').notNull().default(''),createdAt:integer('createdAt').notNull(),expiresAt:integer('expiresAt').notNull(),
},t=>[index('idx_leafy_ui_target').on(t.target,t.status)]);
export const visitorSettings=sqliteTable('leafy_settings',{owner:text('owner').primaryKey(),autoCookies:integer('autoCookies').notNull().default(1),cookieChoice:text('cookieChoice').notNull().default('necessary'),viewUntil:integer('viewUntil').notNull().default(0)});
export const uploads=sqliteTable('leafy_uploads',{id:text('id').primaryKey(),owner:text('owner').notNull(),name:text('name').notNull(),mime:text('mime').notNull(),size:integer('size').notNull(),excerpt:text('excerpt').notNull().default(''),visions:integer('visions').notNull().default(0),createdAt:integer('createdAt').notNull()},t=>[index('idx_leafy_uploads_owner').on(t.owner,t.createdAt)]);

export const leafyIdentity = sqliteTable('leafy_identity', {
  owner: text('owner').primaryKey(),
  profileId: text('profileId').notNull(),
  createdAt: integer('createdAt').notNull(),
}, t => [index('idx_leafy_identity_profile').on(t.profileId)]);

export const leafyCoreMeta = sqliteTable('leafy_core_meta', {
  profileId: text('profileId').primaryKey(),
  version: integer('version').notNull().default(0),
  crossContext: integer('crossContext').notNull().default(1),
  personalMemory: text('personalMemory').notNull().default(''),
  permissions: text('permissions').notNull().default('[]'),
  updatedAt: integer('updatedAt').notNull(),
});

export const leafyCoreNotes = sqliteTable('leafy_core_notes', {
  id: text('id').primaryKey(),
  profileId: text('profileId').notNull(),
  kind: text('kind').notNull().default('preference'),
  text: text('text').notNull(),
  source: text('source').notNull().default('user'),
  status: text('status').notNull().default('active'),
  createdAt: integer('createdAt').notNull(),
  updatedAt: integer('updatedAt').notNull(),
  deletedAt: integer('deletedAt'),
}, t => [index('idx_core_notes_profile').on(t.profileId, t.status)]);

export const leafyCoreSkills = sqliteTable('leafy_core_skills', {
  id: text('id').primaryKey(),
  profileId: text('profileId').notNull(),
  name: text('name').notNull(),
  instructions: text('instructions').notNull(),
  status: text('status').notNull().default('draft'),
  version: integer('version').notNull().default(1),
  createdAt: integer('createdAt').notNull(),
  updatedAt: integer('updatedAt').notNull(),
  deletedAt: integer('deletedAt'),
});
