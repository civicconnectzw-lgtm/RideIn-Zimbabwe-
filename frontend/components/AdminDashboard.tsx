import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { xanoService } from '../services/xano';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
  onUserUpdate: (user: User) => void;
}

interface UserListItem {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  city: string;
  rating: number;
  tripsCount: number;
  isOnline: boolean;
  accountStatus?: string;
  driverStatus?: string;
  driverApproved?: boolean;
  createdAt: string;
}

interface PaginationInfo {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export function AdminDashboard({ user, onLogout, onUserUpdate }: AdminDashboardProps): React.ReactElement {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    perPage: 30,
    total: 0,
    totalPages: 0,
  });
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'rider' | 'driver' | 'pending_driver' | 'admin'>('all');
  const [confirmAction, setConfirmAction] = useState<{ type: 'driver' | 'account'; action: string; status: string; reason: string } | null>(null);

  const fetchUsers = async (page: number = 1) => {
    setLoading(true);
    setError(null);
    try {
      const response = await xanoService.request<{ users: UserListItem[]; pagination: PaginationInfo }>(
        `/admin/users?page=${page}&per_page=30`,
        'GET'
      );
      setUsers(response.users);
      setPagination(response.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleStatusChange = async (userId: string, newStatus: string, reason: string) => {
    try {
      await xanoService.request(
        `/admin/users/${userId}/status`,
        'POST',
        { status: newStatus, reason }
      );
      // Refresh user list
      fetchUsers(pagination.page);
      setShowStatusModal(false);
      setSelectedUser(null);
      setConfirmAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user status');
    }
  };

  const handleDriverStatusChange = async (userId: string, driverStatus: string, reason: string) => {
    try {
      await xanoService.request(
        `/admin/users/${userId}/driver-status`,
        'POST',
        { driver_status: driverStatus, reason }
      );
      // Refresh user list
      fetchUsers(pagination.page);
      setShowStatusModal(false);
      setSelectedUser(null);
      setConfirmAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update driver status');
    }
  };

  const getRoleColor = (role: UserRole): string => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'driver':
        return 'bg-blue-100 text-blue-800';
      case 'rider':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status?: string): string => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'suspended':
        return 'bg-yellow-100 text-yellow-800';
      case 'banned':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDriverStatusColor = (status?: string): string => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Filter and search users locally
  const filteredUsers = users.filter(u => {
    // Apply search filter
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      u.name.toLowerCase().includes(searchLower) ||
      u.phone.includes(searchTerm) ||
      u.city.toLowerCase().includes(searchLower) ||
      u.role.toLowerCase().includes(searchLower);

    // Apply role filter
    const matchesRole = 
      roleFilter === 'all' ||
      (roleFilter === 'pending_driver' && u.role === 'driver' && u.driverStatus === 'pending') ||
      (roleFilter !== 'pending_driver' && u.role === roleFilter);

    return matchesSearch && matchesRole;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">Welcome, {user.name}</p>
            </div>
            <button
              onClick={onLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-lg p-3">
                <i className="fa-solid fa-users text-blue-600 text-2xl"></i>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{pagination.total}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-lg p-3">
                <i className="fa-solid fa-user text-green-600 text-2xl"></i>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Riders</p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.filter(u => u.role === 'rider').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-100 rounded-lg p-3">
                <i className="fa-solid fa-car text-purple-600 text-2xl"></i>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Drivers</p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.filter(u => u.role === 'driver').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-100 rounded-lg p-3">
                <i className="fa-solid fa-clock text-yellow-600 text-2xl"></i>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending Drivers</p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.filter(u => u.role === 'driver' && u.driverStatus === 'pending').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* User Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
          </div>

          {/* Search and Filter Bar */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search by name, phone, city, or role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setRoleFilter('all')}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    roleFilter === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setRoleFilter('rider')}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    roleFilter === 'rider'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Riders
                </button>
                <button
                  onClick={() => setRoleFilter('driver')}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    roleFilter === 'driver'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Drivers
                </button>
                <button
                  onClick={() => setRoleFilter('pending_driver')}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    roleFilter === 'pending_driver'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Pending Drivers
                </button>
                <button
                  onClick={() => setRoleFilter('admin')}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    roleFilter === 'admin'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Admins
                </button>
              </div>
            </div>
          </div>
          
          {error && (
            <div className="px-6 py-4 bg-red-50 border-l-4 border-red-500">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="px-6 py-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <p className="mt-2 text-sm text-gray-600">Loading users...</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        City
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rating
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Trips
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                              <i className="fa-solid fa-user text-gray-600"></i>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {u.name}
                                {u.id === user.id && <span className="ml-2 text-xs text-gray-500">(You)</span>}
                              </div>
                              <div className="text-sm text-gray-500">{u.phone}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleColor(u.role)}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {u.city}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ⭐ {u.rating.toFixed(1)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {u.tripsCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(u.accountStatus)}`}>
                            {u.accountStatus || 'active'}
                          </span>
                          {u.role === 'driver' && u.driverStatus && (
                            <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getDriverStatusColor(u.driverStatus)}`}>
                              Driver: {u.driverStatus}
                            </span>
                          )}
                          {u.isOnline && (
                            <span className="ml-2 text-xs text-green-600">● Online</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setShowStatusModal(true);
                            }}
                            disabled={u.id === user.id}
                            className={`${
                              u.id === user.id
                                ? 'text-gray-400 cursor-not-allowed'
                                : 'text-indigo-600 hover:text-indigo-900'
                            } mr-4`}
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => fetchUsers(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => fetchUsers(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{((pagination.page - 1) * pagination.perPage) + 1}</span> to{' '}
                      <span className="font-medium">
                        {Math.min(pagination.page * pagination.perPage, pagination.total)}
                      </span>{' '}
                      of <span className="font-medium">{pagination.total}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => fetchUsers(pagination.page - 1)}
                        disabled={pagination.page === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                        Page {pagination.page} of {pagination.totalPages}
                      </span>
                      <button
                        onClick={() => fetchUsers(pagination.page + 1)}
                        disabled={pagination.page >= pagination.totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status Change Modal */}
      {showStatusModal && selectedUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowStatusModal(false)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              {confirmAction ? (
                /* Confirmation View */
                <div>
                  <div className="mt-3 text-center sm:mt-0 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Confirm Action
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Are you sure you want to {confirmAction.action}?
                      This action will affect <strong>{selectedUser.name}</strong>.
                    </p>
                    <div className="mt-4 space-y-3">
                      <button
                        onClick={() => {
                          if (confirmAction.type === 'driver') {
                            handleDriverStatusChange(selectedUser.id, confirmAction.status, confirmAction.reason);
                          } else {
                            handleStatusChange(selectedUser.id, confirmAction.status, confirmAction.reason);
                          }
                        }}
                        className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmAction(null)}
                        className="w-full px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Action Selection View */
                <div>
                  <div className="mt-3 text-center sm:mt-0 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Manage User: {selectedUser.name}
                    </h3>

                    {/* Driver Approval Section */}
                    {selectedUser.role === 'driver' && (
                      <div className="mb-6 pb-6 border-b border-gray-200">
                        <h4 className="text-md font-medium text-gray-800 mb-3">Driver Approval</h4>
                        <p className="text-sm text-gray-600 mb-3">
                          Current Status: <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getDriverStatusColor(selectedUser.driverStatus)}`}>
                            {selectedUser.driverStatus || 'pending'}
                          </span>
                        </p>
                        <div className="space-y-2">
                          <button
                            onClick={() => setConfirmAction({ type: 'driver', action: 'approve this driver', status: 'approved', reason: 'Driver approved by admin' })}
                            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                          >
                            Approve Driver
                          </button>
                          <button
                            onClick={() => setConfirmAction({ type: 'driver', action: 'reject this driver', status: 'rejected', reason: 'Driver rejected by admin' })}
                            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                          >
                            Reject Driver
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Account Status Section */}
                    <h4 className="text-md font-medium text-gray-800 mb-3">Account Status</h4>
                    <div className="mt-4 space-y-3">
                      <button
                        onClick={() => handleStatusChange(selectedUser.id, 'active', 'Admin action')}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                      >
                        Set Active
                      </button>
                      <button
                        onClick={() => setConfirmAction({ type: 'account', action: 'suspend this account', status: 'suspended', reason: 'Admin action' })}
                        className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition"
                      >
                        Suspend Account
                      </button>
                      <button
                        onClick={() => setConfirmAction({ type: 'account', action: 'ban this account', status: 'banned', reason: 'Admin action' })}
                        className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                      >
                        Ban Account
                      </button>
                      <button
                        onClick={() => {
                          setShowStatusModal(false);
                          setSelectedUser(null);
                        }}
                        className="w-full px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
