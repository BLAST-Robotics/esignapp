'use client';

import { toLocalISO } from './constants';

export default function UsersTab({ allUsers, editUserId, editUserData, setEditUserId, setEditUserData, apiReq, fetchUsers, setError }) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200/80 dark:border-neutral-800 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">User Management</h2>
        </div>
        {allUsers.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-neutral-800/50 border-b border-gray-200 dark:border-neutral-800">
                  <th className="text-left px-5 py-3 font-medium text-gray-600 dark:text-neutral-400">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-neutral-400 hidden sm:table-cell">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-neutral-400">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-neutral-400 hidden md:table-cell">Created</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600 dark:text-neutral-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((u) => (
                  <tr key={u.id} className="border-b border-gray-100 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800/30">
                    <td className="px-5 py-4">
                      {editUserId === u.id ? (
                        <input value={editUserData.email} onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })} className="w-full text-sm text-gray-900 dark:text-neutral-100 bg-transparent border border-blue-400 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400" />
                      ) : (
                        <span className="text-gray-900 dark:text-neutral-100 font-medium">{u.email}</span>
                      )}
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      {editUserId === u.id ? (
                        <input value={editUserData.name} onChange={(e) => setEditUserData({ ...editUserData, name: e.target.value })} className="w-full text-sm text-gray-700 dark:text-neutral-300 bg-transparent border border-blue-400 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400" />
                      ) : (
                        <span className="text-gray-700 dark:text-neutral-300">{u.name || '-'}</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {editUserId === u.id ? (
                        <select value={editUserData.role} onChange={(e) => setEditUserData({ ...editUserData, role: e.target.value })} className="text-xs bg-transparent border border-blue-400 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400 dark:text-neutral-200">
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      ) : (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-50 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400'}`}>{u.role}</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-gray-500 text-xs hidden md:table-cell">{toLocalISO(new Date(u.created_at))}</td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      {editUserId === u.id ? (
                        <div className="flex items-center gap-1 justify-end">
                          <button type="button" onClick={async () => { try { await apiReq(`/api/admin/users/${u.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editUserData) }); setEditUserId(null); fetchUsers(); } catch (e) { setError(e.message); } }} className="px-2 py-1 text-xs text-blue-600 hover:text-blue-700 font-medium">Save</button>
                          <button type="button" onClick={() => { setEditUserId(null); fetchUsers(); }} className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 justify-end">
                          <button type="button" onClick={() => { setEditUserId(u.id); setEditUserData({ email: u.email, name: u.name || '', role: u.role }); }} className="px-2 py-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg text-xs font-medium transition-colors">Edit</button>
                          <button type="button" onClick={async () => { if (!confirm(`Delete user ${u.email}?`)) return; try { await apiReq(`/api/admin/users/${u.id}`, { method: 'DELETE' }); fetchUsers(); } catch (e) { setError(e.message); } }} className="px-2 py-1 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-xs font-medium transition-colors">Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
