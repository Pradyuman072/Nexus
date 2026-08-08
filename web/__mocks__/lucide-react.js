const React = require('react');

module.exports = {
  Activity: function Activity() { return React.createElement('div', { 'data-testid': 'activity-icon' }); },
  LogOut: function LogOut() { return React.createElement('div', { 'data-testid': 'logout-icon' }); }
};
