import { isDemoMode } from '../data/config.js';
import { mockDb } from '../data/mockDb.js';
import { getSupabase } from '../data/supabaseClient.js';

function generateGroupCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem caracteres ambíguos (0/O, 1/I)
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Retorna { group, members } do grupo ao qual o perfil pertence, ou null se não há grupo.
// Grupo é sempre opcional — nem todo usuário precisa ter um.
export async function getMyGroup(profileId) {
  if (isDemoMode()) {
    const membership = (await mockDb.list('group_members')).find((m) => m.profile_id === profileId);
    if (!membership) return null;
    const group = await mockDb.get('groups', membership.group_id);
    const memberRows = await mockDb.list('group_members', (m) => m.group_id === membership.group_id);
    const members = [];
    for (const m of memberRows) members.push(await mockDb.get('profiles', m.profile_id));
    return { group, members };
  }
  const supabase = await getSupabase();
  const { data: membership, error: mErr } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('profile_id', profileId)
    .maybeSingle();
  if (mErr) throw mErr;
  if (!membership) return null;

  const { data: group, error: gErr } = await supabase.from('groups').select('*').eq('id', membership.group_id).single();
  if (gErr) throw gErr;

  const { data: memberRows, error: memErr } = await supabase
    .from('group_members')
    .select('profiles(*)')
    .eq('group_id', membership.group_id);
  if (memErr) throw memErr;

  return { group, members: memberRows.map((r) => r.profiles) };
}

export async function createGroup(nome, ownerId) {
  const codigo = generateGroupCode();
  if (isDemoMode()) {
    const group = await mockDb.insert('groups', { nome, criado_por: ownerId, codigo });
    await mockDb.insert('group_members', { group_id: group.id, profile_id: ownerId, papel: 'admin', entrou_em: new Date().toISOString() });
    return group;
  }
  const supabase = await getSupabase();
  const { data: group, error } = await supabase.from('groups').insert({ nome, criado_por: ownerId, codigo }).select().single();
  if (error) throw error;
  const { error: memErr } = await supabase.from('group_members').insert({ group_id: group.id, profile_id: ownerId, papel: 'admin' });
  if (memErr) throw memErr;
  return group;
}

export async function joinGroupByCode(codigo, profileId) {
  if (isDemoMode()) {
    const group = (await mockDb.list('groups')).find((g) => g.codigo === codigo.toUpperCase());
    if (!group) throw new Error('Código de grupo não encontrado.');
    await mockDb.insert('group_members', { group_id: group.id, profile_id: profileId, papel: 'membro', entrou_em: new Date().toISOString() });
    return group;
  }
  const supabase = await getSupabase();
  const { data: group, error } = await supabase.from('groups').select('*').eq('codigo', codigo.toUpperCase()).single();
  if (error) throw new Error('Código de grupo não encontrado.');
  const { error: memErr } = await supabase.from('group_members').insert({ group_id: group.id, profile_id: profileId, papel: 'membro' });
  if (memErr) throw memErr;
  return group;
}

export async function leaveGroup(groupId, profileId) {
  if (isDemoMode()) {
    const rows = await mockDb.list('group_members');
    const row = rows.find((m) => m.group_id === groupId && m.profile_id === profileId);
    if (row) await mockDb.remove('group_members', row.id);
    return;
  }
  const supabase = await getSupabase();
  const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('profile_id', profileId);
  if (error) throw error;
}
