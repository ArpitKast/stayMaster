const accessControl = {
    '/admin': ['admin'],
    '/dashboard': ['admin', 'user'],
    '/reports': ['admin', 'manager'],
};
const homePage ={
    'admin': 'admin/',
    'operator': 'admin/bookings',
    'accounts': 'admin/accounts'
}