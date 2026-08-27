/**
 * Reusable Helper to calculate aggregate parent Order status from child OrderItems
 * @param {Array} orderItems - Array of OrderItem models or plain objects
 * @returns {String} - Aggregate parent status ('placed', 'preparing', 'ready', 'completed', 'cancelled')
 */
const calculateParentOrderStatus = (orderItems) => {
  if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
    return 'placed';
  }

  const statuses = orderItems.map((item) => (item.status || 'pending').toLowerCase());

  // 1. All items completed -> parent is completed
  if (statuses.every((s) => s === 'completed')) {
    return 'completed';
  }

  // 2. All items ready or completed -> parent is ready
  if (statuses.every((s) => s === 'ready' || s === 'completed')) {
    return 'ready';
  }

  // 3. Any item accepted, preparing, or ready -> parent is preparing
  if (statuses.some((s) => ['accepted', 'preparing', 'ready', 'completed'].includes(s))) {
    return 'preparing';
  }

  // 4. All items rejected or cancelled -> parent is cancelled
  if (statuses.every((s) => s === 'rejected' || s === 'cancelled')) {
    return 'cancelled';
  }

  // 5. Default placed/pending
  return 'placed';
};

module.exports = {
  calculateParentOrderStatus,
};
